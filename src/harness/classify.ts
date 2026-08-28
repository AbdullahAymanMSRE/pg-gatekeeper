import type { Evidence, Thresholds, Verdict } from "./types.js";

/**
 * Turns Evidence into a Verdict using the Thresholds.
 *
 * Precedence when several hazards are present: the one that hurts most
 * irreversibly wins. Losing data beats a stall; a stall beats a slow query.
 */
export function classify(e: Evidence, t: Thresholds): Verdict {
  if (e.migrationError !== null || e.droppedColumns.length > 0 || e.droppedTables.length > 0 || e.lossyChanges.length > 0) {
    return { verdict: "UNSAFE", hazard: "DATA_LOSS" };
  }
  if (e.writerMaxStallMs > t.writerStallMs || e.writerErrors > 0) {
    return { verdict: "UNSAFE", hazard: "LOCK_BLOCKING" };
  }
  if (e.constraintFullScan) {
    return { verdict: "UNSAFE", hazard: "CONSTRAINT_SCAN" };
  }
  if (e.migrationMs > t.migrationMs) {
    return { verdict: "UNSAFE", hazard: "LONG_TRANSACTION" };
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
