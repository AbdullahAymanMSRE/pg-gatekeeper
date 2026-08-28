import { classify } from "../harness/classify.js";
import { simulate } from "../harness/simulate.js";
import { DEFAULT_THRESHOLDS } from "../harness/thresholds.js";
import type { Case, ColumnInfo, Evidence, Verdict } from "../harness/types.js";

/**
 * The eval's own check of a proposed Fix, independent of anything the model claimed:
 * re-run it on a fresh Shadow DB and compare with the Label's end state.
 */
export interface FixProof {
  ran: boolean;
  clean: boolean;
  /**
   * The fix reaches the same end state as the original migration. When the original
   * migration itself failed (e.g. SET NOT NULL over nulls) there is no end state to
   * compare with, so equivalence cannot be judged and is not required.
   */
  schemaEquivalent: boolean;
  schemaCheck: "compared" | "skipped: original migration failed";
  hazard: Verdict;
  schemaDifferences: string[];
  migrationError: string | null;
  writerMaxStallMs: number;
  maxTransactionMs: number;
}

const key = (c: ColumnInfo) => `${c.table}.${c.column} ${c.type}${c.nullable ? "" : " NOT NULL"}`;

export function schemaDifferences(expectedAfter: ColumnInfo[], actualAfter: ColumnInfo[]): string[] {
  const A = new Set(expectedAfter.map(key));
  const B = new Set(actualAfter.map(key));
  return [...[...A].filter((x) => !B.has(x)).map((x) => `missing: ${x}`), ...[...B].filter((x) => !A.has(x)).map((x) => `extra: ${x}`)];
}

export async function proveFix(c: Case, fixedMigration: string, labelEvidence: Evidence): Promise<FixProof> {
  const e = await simulate(c, { migrationSql: fixedMigration });
  const hazard = classify(e, DEFAULT_THRESHOLDS);
  const originalFailed = labelEvidence.migrationError !== null;
  const diffs = originalFailed ? [] : schemaDifferences(labelEvidence.columnsAfter, e.columnsAfter);
  return {
    ran: true,
    clean: hazard.verdict === "SAFE",
    schemaEquivalent: diffs.length === 0 && e.migrationError === null,
    schemaCheck: originalFailed ? "skipped: original migration failed" : "compared",
    hazard,
    schemaDifferences: diffs,
    migrationError: e.migrationError,
    writerMaxStallMs: e.writerMaxStallMs,
    maxTransactionMs: e.maxTransactionMs,
  };
}
