import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import type pg from "pg";
import { z } from "zod";
import { classify } from "../harness/classify.js";
import { startShadowDb, type ShadowDb } from "../harness/shadow-db.js";
import { explainOne, simulate } from "../harness/simulate.js";
import { DEFAULT_THRESHOLDS } from "../harness/thresholds.js";
import type { Case, Evidence } from "../harness/types.js";
import { ReviewSchema, type Review } from "../review/schema.js";

/**
 * Everything the tools share for one Case within one role: a lazily started
 * read-only exploratory Shadow DB, and a cache of the original migration's Evidence.
 */
export class CaseContext {
  private exploratory: Promise<ShadowDb> | null = null;
  private originalEvidence: Promise<Evidence> | null = null;

  constructor(readonly c: Case) {}

  /** Read-only session on a pre-migration Shadow DB, shared within the role. */
  async explore<T>(f: (client: pg.Client) => Promise<T>): Promise<T> {
    this.exploratory ??= startShadowDb(this.c);
    const db = await this.exploratory;
    const client = await db.connect();
    try {
      await client.query("SET default_transaction_read_only = on");
      await client.query("SET statement_timeout = 30000");
      return await f(client);
    } finally {
      await client.end();
    }
  }

  /** Evidence for the migration as written; computed once per context (fresh container). */
  original(): Promise<Evidence> {
    this.originalEvidence ??= simulate(this.c);
    return this.originalEvidence;
  }

  async close() {
    if (this.exploratory) await (await this.exploratory).stop();
  }
}

const json = (v: unknown) => JSON.stringify(v);

/** Models sometimes emit the two characters backslash+n inside SQL strings; turn them back into newlines. */
function unescapeSql(sql: string | null): string | null {
  if (sql === null) return null;
  const literal = String.raw`\n`;
  return sql.includes(literal) && !sql.includes("\n") ? sql.split(literal).join("\n") : sql;
}

/** Compact, model-facing view of Evidence. */
export function summarizeEvidence(e: Evidence) {
  return {
    thresholds: DEFAULT_THRESHOLDS,
    migration: {
      duration_ms: e.migrationMs,
      longest_transaction_ms: e.maxTransactionMs,
      error: e.migrationError,
      locks_held_on_user_tables: e.locks.map((l) => `${l.table}: ${l.mode}`),
    },
    concurrent_writer: {
      max_stall_ms: e.writerMaxStallMs,
      lock_timeout_errors: e.writerErrors,
      updates_attempted: e.writerAttempts,
    },
    data: {
      row_counts_before: e.rowCountsBefore,
      row_counts_after: e.rowCountsAfter,
      dropped_tables: e.droppedTables,
      dropped_columns: e.droppedColumns,
      lossy_changes: e.lossyChanges,
      constraint_validated_inline_on_populated_table: e.constraintFullScan,
    },
    query_plans: e.plans.map((p) => ({
      query: p.name,
      when: p.which,
      execution_ms: p.executionMs,
      plan_nodes: p.nodeTypes,
      rows_seq_scanned: p.seqScanRows,
      rows_returned: p.rowsReturned,
    })),
  };
}

function schemaDiff(a: Evidence, b: Evidence): string[] {
  const key = (c: Evidence["columnsAfter"][number]) => `${c.table}.${c.column} ${c.type}${c.nullable ? "" : " NOT NULL"}`;
  const A = new Set(a.columnsAfter.map(key));
  const B = new Set(b.columnsAfter.map(key));
  return [...[...A].filter((x) => !B.has(x)).map((x) => `missing after fix: ${x}`), ...[...B].filter((x) => !A.has(x)).map((x) => `extra after fix: ${x}`)];
}

export function inspectSchemaTool(ctx: CaseContext) {
  return betaZodTool({
    name: "inspect_schema",
    description: "Columns, indexes, constraints and row count of one table in the current (pre-migration) database.",
    inputSchema: z.object({ table: z.string() }),
    run: (input) =>
      ctx.explore(async (client) => {
        const cols = await client.query(
          `SELECT a.attname AS column, format_type(a.atttypid, a.atttypmod) AS type, NOT a.attnotnull AS nullable, pg_get_expr(d.adbin, d.adrelid) AS default
             FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
             LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
            WHERE n.nspname = 'public' AND c.relname = $1 AND a.attnum > 0 AND NOT a.attisdropped ORDER BY a.attnum`,
          [input.table],
        );
        if (cols.rowCount === 0) return json({ error: `no table named ${input.table}` });
        const idx = await client.query(`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = $1`, [input.table]);
        const cons = await client.query(
          `SELECT conname, pg_get_constraintdef(oid) AS definition, convalidated FROM pg_constraint WHERE conrelid = ('public.' || quote_ident($1))::regclass`,
          [input.table],
        );
        const count = await client.query(`SELECT count(*)::int AS n FROM "${input.table.replace(/"/g, "")}"`);
        return json({ table: input.table, rows: count.rows[0].n, columns: cols.rows, indexes: idx.rows, constraints: cons.rows });
      }),
  });
}

export function runSqlTool(ctx: CaseContext) {
  return betaZodTool({
    name: "run_sql",
    description: "Run a read-only SQL query against the current (pre-migration) database. Returns at most 50 rows. Use it to check data facts (max lengths, nulls, distinct values).",
    inputSchema: z.object({ sql: z.string() }),
    run: (input) =>
      ctx.explore(async (client) => {
        const r = await client.query(input.sql);
        return json({ rowCount: r.rowCount, rows: r.rows.slice(0, 50) });
      }),
  });
}

export function explainQueryTool(ctx: CaseContext) {
  return betaZodTool({
    name: "explain_query",
    description: "EXPLAIN ANALYZE a query against the current (pre-migration) database. Returns plan node types, rows seq-scanned, execution ms.",
    inputSchema: z.object({ sql: z.string() }),
    run: (input) => ctx.explore(async (client) => json(await explainOne(client, "adhoc", "before", input.sql))),
  });
}

export function simulateMigrationTool(ctx: CaseContext) {
  return betaZodTool({
    name: "simulate_migration",
    description:
      "Run a migration on a fresh seeded shadow database while a concurrent writer keeps updating rows, and measure: duration, locks held, writer stall, row counts and schema before/after, lossy changes, and EXPLAIN ANALYZE of the affected queries before and after. Omit migration_sql to simulate the migration under review. Takes ~10 s.",
    inputSchema: z.object({
      migration_sql: z.string().nullable().describe("Alternative migration to simulate; null for the original."),
    }),
    run: async (input) => {
      const e = input.migration_sql ? await simulate(ctx.c, { migrationSql: input.migration_sql }) : await ctx.original();
      return json(summarizeEvidence(e));
    },
  });
}

export function verifyFixTool(ctx: CaseContext) {
  return betaZodTool({
    name: "verify_fix",
    description:
      "Run a proposed rewritten migration on a fresh shadow database with the concurrent writer, and compare the resulting schema with the original migration's end state. Returns the same evidence as simulate_migration plus schema_equivalent and clean_under_thresholds.",
    inputSchema: z.object({ fixed_migration: z.string() }),
    run: async (input) => {
      const [original, fixed] = await Promise.all([ctx.original(), simulate(ctx.c, { migrationSql: input.fixed_migration })]);
      const diff = schemaDiff(original, fixed);
      const verdict = classify(fixed, DEFAULT_THRESHOLDS);
      return json({
        schema_equivalent: diff.length === 0 && original.migrationError === null,
        schema_differences: diff,
        clean_under_thresholds: verdict.verdict === "SAFE",
        hazard_if_any: verdict.verdict === "UNSAFE" ? verdict.hazard : null,
        evidence: summarizeEvidence(fixed),
      });
    },
  });
}

export function submitReviewTool(sink: { review: Review | null }) {
  return betaZodTool({
    name: "submit_review",
    description: "Submit the final review. Call exactly once, after measuring.",
    inputSchema: ReviewSchema,
    run: (input) => {
      sink.review = { ...input, fixed_migration: unescapeSql(input.fixed_migration) };
      return "Review recorded.";
    },
  });
}

export const PlanSchema = z.object({
  tables_of_interest: z.array(z.object({ table: z.string(), rows: z.number(), relevant_indexes: z.array(z.string()) })),
  suspected_hazards: z.array(z.object({ hazard: z.string(), evidence_that_would_confirm: z.string() })),
  simulations_to_run: z.array(z.string()).describe("Migrations to simulate, original first; candidate rewrites after."),
  notes: z.string(),
});
export type Plan = z.infer<typeof PlanSchema>;

export function submitPlanTool(sink: { plan: Plan | null }) {
  return betaZodTool({
    name: "submit_plan",
    description: "Submit the measurement plan. Call exactly once.",
    inputSchema: PlanSchema,
    run: (input) => {
      sink.plan = input;
      return "Plan recorded.";
    },
  });
}

export const VerdictCheckSchema = z.object({
  accept: z.boolean(),
  reason: z.string().describe("What you measured and why it does or does not support the claim. If rejecting, what must change."),
});
export type VerdictCheck = z.infer<typeof VerdictCheckSchema>;

export function submitVerdictTool(sink: { check: VerdictCheck | null }) {
  return betaZodTool({
    name: "submit_verdict",
    description: "Submit ACCEPT or REJECT for the Executor's claim. Call exactly once.",
    inputSchema: VerdictCheckSchema,
    run: (input) => {
      sink.check = input;
      return "Verdict recorded.";
    },
  });
}
