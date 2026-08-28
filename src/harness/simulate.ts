import type pg from "pg";
import { startShadowDb } from "./shadow-db.js";
import { splitStatements } from "./split.js";
import type { Case, ColumnInfo, Evidence, ObservedLock, QueryPlan, TableCount } from "./types.js";

export interface SimulateOptions {
  writerIntervalMs?: number;
  writerLockTimeoutMs?: number;
  /** How long the Writer keeps running after the migration finishes. */
  tailMs?: number;
  lockPollMs?: number;
  migrationTimeoutMs?: number;
  /** Alternative migration to run instead of the Case's (used to verify a Fix). */
  migrationSql?: string;
}

const DEFAULTS: Required<Omit<SimulateOptions, "migrationSql">> = {
  writerIntervalMs: 50,
  writerLockTimeoutMs: 5_000,
  tailMs: 2_000,
  lockPollMs: 25,
  migrationTimeoutMs: 120_000,
};

/**
 * One Simulation: run the Migration on a fresh Shadow DB while the Writer keeps
 * writing, watch pg_locks, snapshot schema/rows before and after, and EXPLAIN the Queries.
 */
export async function simulate(c: Case, options: SimulateOptions = {}): Promise<Evidence> {
  const opts = { ...DEFAULTS, ...options };
  const migrationSql = options.migrationSql ?? c.migrationSql;
  const db = await startShadowDb(c);
  try {
    const admin = await db.connect();
    try {
      const tablesBefore = await userTables(admin);
      const columnsBefore = await columnInfo(admin);
      const rowCountsBefore = await rowCounts(admin, tablesBefore);
      const maxLengths = await maxTextLengths(admin, columnsBefore);
      const plansBefore = await explainAll(admin, c, "before");

      const migrator = await db.connect();
      const { rows: pidRows } = await migrator.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
      const migratorPid = pidRows[0]!.pid;
      await migrator.query(`SET statement_timeout = ${opts.migrationTimeoutMs}`);

      const writer = startWriter(db, c, opts);
      const monitor = startLockMonitor(db, migratorPid, opts.lockPollMs);
      await sleep(300); // let the Writer reach steady state

      const started = performance.now();
      let migrationError: string | null = null;
      try {
        for (const stmt of splitStatements(migrationSql)) await migrator.query(stmt);
      } catch (err) {
        migrationError = (err as Error).message;
        await migrator.query("ROLLBACK").catch(() => undefined);
      }
      const migrationMs = Math.round(performance.now() - started);
      await migrator.end();

      await sleep(opts.tailMs);
      const locks = await monitor.stop();
      const w = await writer.stop();

      const tablesAfter = await userTables(admin);
      const columnsAfter = await columnInfo(admin);
      const rowCountsAfter = await rowCounts(admin, tablesAfter);
      const plansAfter = await explainAll(admin, c, "after");

      const key = (x: ColumnInfo) => `${x.table}.${x.column}`;
      const afterKeys = new Set(columnsAfter.map(key));
      const droppedTables = tablesBefore.filter((t) => !tablesAfter.includes(t));
      const droppedColumns = columnsBefore
        .filter((x) => !droppedTables.includes(x.table) && !afterKeys.has(key(x)))
        .map(key);

      const lossyChanges: Evidence["lossyChanges"] = [];
      for (const after of columnsAfter) {
        const limit = varcharLimit(after.type);
        const longest = maxLengths.get(key(after));
        if (limit !== null && longest !== undefined && longest > limit) {
          lossyChanges.push({
            column: key(after),
            detail: `longest existing value was ${longest} chars; column is now ${after.type.replace("character varying", "varchar")}`,
          });
        }
      }

      return {
        migrationMs,
        migrationError,
        locks,
        writerMaxStallMs: w.maxStallMs,
        writerErrors: w.errors,
        writerAttempts: w.attempts,
        rowCountsBefore,
        rowCountsAfter,
        droppedColumns,
        droppedTables,
        lossyChanges,
        constraintFullScan: detectConstraintFullScan(migrationSql, rowCountsBefore),
        plans: [...plansBefore, ...plansAfter],
        columnsBefore,
        columnsAfter,
      };
    } finally {
      await admin.end();
    }
  } finally {
    await db.stop();
  }
}

// ---------- Writer ----------

function startWriter(db: Awaited<ReturnType<typeof startShadowDb>>, c: Case, opts: typeof DEFAULTS) {
  let running = true;
  let maxStallMs = 0;
  let errors = 0;
  let attempts = 0;
  const done = (async () => {
    if (c.writerTables.length === 0) return;
    const client = await db.connect();
    await client.query(`SET lock_timeout = ${opts.writerLockTimeoutMs}`);
    try {
      while (running) {
        const t = c.writerTables[attempts % c.writerTables.length]!;
        const id = 1 + Math.floor(Math.random() * t.keyMax);
        const t0 = performance.now();
        attempts++;
        try {
          await client.query(`UPDATE ${t.table} SET ${t.updateColumn} = ${t.updateExpr} WHERE ${t.keyColumn} = $1`, [id]);
        } catch {
          errors++;
        }
        maxStallMs = Math.max(maxStallMs, performance.now() - t0);
        await sleep(opts.writerIntervalMs);
      }
    } finally {
      await client.end();
    }
  })();
  return {
    stop: async () => {
      running = false;
      await done;
      return { maxStallMs: Math.round(maxStallMs), errors, attempts };
    },
  };
}

// ---------- Lock monitor ----------

function startLockMonitor(db: Awaited<ReturnType<typeof startShadowDb>>, pid: number, pollMs: number) {
  let running = true;
  const seen = new Map<string, ObservedLock>();
  const done = (async () => {
    const client = await db.connect();
    try {
      while (running) {
        const { rows } = await client.query<{ table: string; mode: string }>(
          `SELECT c.relname AS "table", l.mode
             FROM pg_locks l JOIN pg_class c ON c.oid = l.relation
             JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE l.pid = $1 AND l.granted AND l.locktype = 'relation'
              AND n.nspname = 'public' AND c.relkind IN ('r','p')`,
          [pid],
        );
        for (const r of rows) seen.set(`${r.table}:${r.mode}`, { table: r.table, mode: r.mode });
        await sleep(pollMs);
      }
    } finally {
      await client.end();
    }
  })();
  return {
    stop: async () => {
      running = false;
      await done;
      return [...seen.values()].sort((a, b) => a.table.localeCompare(b.table) || a.mode.localeCompare(b.mode));
    },
  };
}

// ---------- Schema & rows ----------

async function userTables(client: pg.Client): Promise<string[]> {
  const { rows } = await client.query<{ t: string }>(
    `SELECT tablename AS t FROM pg_tables WHERE schemaname = 'public' ORDER BY 1`,
  );
  return rows.map((r) => r.t);
}

async function columnInfo(client: pg.Client): Promise<ColumnInfo[]> {
  const { rows } = await client.query<ColumnInfo>(
    `SELECT c.relname AS "table", a.attname AS "column",
            format_type(a.atttypid, a.atttypmod) AS "type", NOT a.attnotnull AS nullable
       FROM pg_attribute a
       JOIN pg_class c ON c.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r','p') AND a.attnum > 0 AND NOT a.attisdropped
      ORDER BY 1, a.attnum`,
  );
  return rows;
}

async function rowCounts(client: pg.Client, tables: string[]): Promise<TableCount[]> {
  const out: TableCount[] = [];
  for (const table of tables) {
    const { rows } = await client.query<{ n: string }>(`SELECT count(*)::text AS n FROM "${table}"`);
    out.push({ table, rows: Number(rows[0]!.n) });
  }
  return out;
}

async function maxTextLengths(client: pg.Client, cols: ColumnInfo[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const col of cols) {
    if (!/^(text|character varying|character)/.test(col.type)) continue;
    const { rows } = await client.query<{ n: number | null }>(
      `SELECT max(length("${col.column}"))::int AS n FROM "${col.table}"`,
    );
    if (rows[0]?.n != null) out.set(`${col.table}.${col.column}`, rows[0].n);
  }
  return out;
}

function varcharLimit(type: string): number | null {
  const m = /^character(?: varying)?\((\d+)\)$/.exec(type);
  return m ? Number(m[1]) : null;
}

function detectConstraintFullScan(migrationSql: string, counts: TableCount[]): boolean {
  for (const stmt of splitStatements(migrationSql)) {
    const m = /ALTER\s+TABLE\s+(?:ONLY\s+)?"?(\w+)"?[\s\S]*?ADD\s+(?:CONSTRAINT\s+\w+\s+)?(FOREIGN\s+KEY|CHECK)/i.exec(stmt);
    if (!m) continue;
    if (/NOT\s+VALID/i.test(stmt)) continue;
    const rows = counts.find((c) => c.table === m[1]!.toLowerCase())?.rows ?? 0;
    if (rows > 0) return true;
  }
  return false;
}

// ---------- EXPLAIN ----------

async function explainAll(client: pg.Client, c: Case, which: "before" | "after"): Promise<QueryPlan[]> {
  const out: QueryPlan[] = [];
  for (const q of c.queries) {
    const sql = which === "after" ? (q.after ?? q.before) : q.before;
    out.push(await explainOne(client, q.name, which, sql));
  }
  return out;
}

export async function explainOne(client: pg.Client, name: string, which: "before" | "after", sql: string): Promise<QueryPlan> {
  const stripped = sql.trim().replace(/;\s*$/, "");
  const runs: number[] = [];
  let plan: PlanNode | undefined;
  for (let i = 0; i < 3; i++) {
    const { rows } = await client.query<{ "QUERY PLAN": [{ Plan: PlanNode; "Execution Time": number }] }>(
      `EXPLAIN (ANALYZE, FORMAT JSON) ${stripped}`,
    );
    const top = rows[0]!["QUERY PLAN"][0];
    runs.push(top["Execution Time"]);
    plan = top.Plan;
  }
  runs.sort((a, b) => a - b);
  const nodeTypes: string[] = [];
  let seqScanRows = 0;
  walk(plan!, (n) => {
    nodeTypes.push(n["Node Type"]);
    if (n["Node Type"] === "Seq Scan") {
      seqScanRows = Math.max(seqScanRows, (n["Actual Rows"] ?? 0) + (n["Rows Removed by Filter"] ?? 0));
    }
  });
  return {
    name,
    which,
    executionMs: Number(runs[1]!.toFixed(3)),
    nodeTypes,
    seqScanRows,
    rowsReturned: plan!["Actual Rows"] ?? 0,
  };
}

interface PlanNode {
  "Node Type": string;
  "Actual Rows"?: number;
  "Rows Removed by Filter"?: number;
  Plans?: PlanNode[];
}

function walk(n: PlanNode, f: (n: PlanNode) => void) {
  f(n);
  for (const child of n.Plans ?? []) walk(child, f);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
