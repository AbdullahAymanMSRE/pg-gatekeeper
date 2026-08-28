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
  schemaEquivalent: boolean;
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
  const diffs = schemaDifferences(labelEvidence.columnsAfter, e.columnsAfter);
  return {
    ran: true,
    clean: hazard.verdict === "SAFE",
    schemaEquivalent: diffs.length === 0 && e.migrationError === null,
    hazard,
    schemaDifferences: diffs,
    migrationError: e.migrationError,
    writerMaxStallMs: e.writerMaxStallMs,
    maxTransactionMs: e.maxTransactionMs,
  };
}
