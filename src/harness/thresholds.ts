import type { Thresholds } from "./types.js";

/**
 * The definition of "unsafe" for this project (see ADR-0001).
 * Ground-truth Labels are derived with exactly these numbers.
 *
 * Calibrated on Postgres 16 with a 1M-row table (docs/calibration.md):
 * safe operations stall the Writer 2–4 ms, blocking DDL 100–600 ms,
 * single-transaction backfills ~4 s.
 */
export const DEFAULT_THRESHOLDS: Thresholds = {
  writerStallMs: 50,
  migrationMs: 2_000,
  latencyFactor: 5,
  seqScanRows: 100_000,
};
