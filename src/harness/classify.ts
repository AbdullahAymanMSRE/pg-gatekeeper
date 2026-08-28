import type { Evidence, Thresholds, Verdict } from "./types.js";

/**
 * Turns Evidence into a Verdict using the Thresholds.
 *
 * Precedence when several hazards are present: irreversible harm first, then the
 * hazard that names the most specific fix. Losing data beats everything; a long
 * transaction (fix: batch it) and an unvalidated constraint (fix: NOT VALID) beat
 * generic blocking (fix: a non-blocking form); a slow query comes last.
 */
export function classify(e: Evidence, t: Thresholds): Verdict {
  if (e.migrationError !== null || e.droppedColumns.length > 0 || e.droppedTables.length > 0 || e.lossyChanges.length > 0) {
    return { verdict: "UNSAFE", hazard: "DATA_LOSS" };
  }
  if (e.migrationMs > t.migrationMs) {
    return { verdict: "UNSAFE", hazard: "LONG_TRANSACTION" };
  }
  if (e.constraintFullScan) {
    return { verdict: "UNSAFE", hazard: "CONSTRAINT_SCAN" };
  }
  if (e.writerMaxStallMs > t.writerStallMs || e.writerErrors > 0) {
    return { verdict: "UNSAFE", hazard: "LOCK_BLOCKING" };
  }
  if (hasQueryRegression(e, t)) {
    return { verdict: "UNSAFE", hazard: "QUERY_REGRESSION" };
  }
  return { verdict: "SAFE" };
}

function hasQueryRegression(e: Evidence, t: Thresholds): boolean {
  for (const after of e.plans) {
    if (after.which !== "after") continue;
    if (after.seqScanRows > t.seqScanRows) return true;
    const before = e.plans.find((p) => p.name === after.name && p.which === "before");
    if (before && before.executionMs > 0 && after.executionMs / before.executionMs >= t.latencyFactor) return true;
  }
  return false;
}
