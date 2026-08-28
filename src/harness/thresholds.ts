import type { Thresholds } from "./types.js";

/**
 * The definition of "unsafe" for this project (see ADR-0001).
 * Ground-truth Labels are derived with exactly these numbers.
 */
export const DEFAULT_THRESHOLDS: Thresholds = {
  writerStallMs: 1_000,
  migrationMs: 30_000,
  latencyFactor: 5,
  seqScanRows: 100_000,
};
