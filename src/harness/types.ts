import { z } from "zod";

/** See CONTEXT.md for the vocabulary used here. */

export const HazardSchema = z.enum([
  "LOCK_BLOCKING",
  "LONG_TRANSACTION",
  "DATA_LOSS",
  "CONSTRAINT_SCAN",
  "QUERY_REGRESSION",
]);
export type Hazard = z.infer<typeof HazardSchema>;

export const VerdictSchema = z.discriminatedUnion("verdict", [
  z.object({ verdict: z.literal("SAFE") }),
  z.object({ verdict: z.literal("UNSAFE"), hazard: HazardSchema }),
]);
export type Verdict = z.infer<typeof VerdictSchema>;

/** A query the application runs; `after` is provided only when the Migration changes it. */
export interface CaseQuery {
  name: string;
  before: string;
  after?: string;
}

export interface Case {
  id: string;
  title: string;
  schemaSql: string;
  seedSql: string;
  migrationSql: string;
  queries: CaseQuery[];
  /** Tables the Writer keeps writing to during the Migration. */
  writerTables: WriterTable[];
}

export interface WriterTable {
  table: string;
  /** Column used to pick a random row, e.g. "id". */
  keyColumn: string;
  /** Column the Writer updates, e.g. "updated_at". */
  updateColumn: string;
  /** SQL expression written into updateColumn. */
  updateExpr: string;
  /** Upper bound of the key range for random picks. */
  keyMax: number;
}

/** A lock the Migration held on a user table, as observed in pg_locks. */
export interface ObservedLock {
  table: string;
  mode: string;
}

export interface QueryPlan {
  name: string;
  which: "before" | "after";
  /** From EXPLAIN (ANALYZE, FORMAT JSON). */
  executionMs: number;
  /** Node types on the plan's path, e.g. ["Seq Scan"], ["Index Scan"]. */
  nodeTypes: string[];
  /** Largest relation scanned by a Seq Scan, with its row estimate. */
  seqScanRows: number;
  rowsReturned: number;
}

export interface ColumnInfo {
  table: string;
  column: string;
  /** e.g. "character varying(12)", "bigint" — from format_type. */
  type: string;
  nullable: boolean;
}

export interface TableCount {
  table: string;
  rows: number;
}

/** Measured facts from one Simulation. Every claim in a Review points here. */
export interface Evidence {
  /** Wall time of the whole migration file. */
  migrationMs: number;
  /** Longest single transaction the migration held open (from pg_stat_activity.xact_start). */
  maxTransactionMs: number;
  migrationError: string | null;
  locks: ObservedLock[];
  /** Longest single Writer stall, in ms. */
  writerMaxStallMs: number;
  writerErrors: number;
  writerAttempts: number;
  rowCountsBefore: TableCount[];
  rowCountsAfter: TableCount[];
  /** Columns present before but absent after, or narrowed. */
  droppedColumns: string[];
  droppedTables: string[];
  /** Non-null rows lost through truncation or failed casts, per column. */
  lossyChanges: { column: string; detail: string }[];
  /** True when the migration validated a constraint by scanning the full table. */
  constraintFullScan: boolean;
  plans: QueryPlan[];
  columnsBefore: ColumnInfo[];
  columnsAfter: ColumnInfo[];
}

export interface Thresholds {
  /** Writer stalled longer than this → LOCK_BLOCKING. */
  writerStallMs: number;
  /** A single transaction held open longer than this → LONG_TRANSACTION. */
  transactionMs: number;
  /** After-plan slower than before-plan by this factor → QUERY_REGRESSION. */
  latencyFactor: number;
  /** A Seq Scan over more rows than this → QUERY_REGRESSION. */
  seqScanRows: number;
}
