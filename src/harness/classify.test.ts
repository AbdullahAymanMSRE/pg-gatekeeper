import { describe, expect, test } from "vitest";
import { classify } from "./classify.js";
import { DEFAULT_THRESHOLDS } from "./thresholds.js";
import type { Evidence } from "./types.js";

const clean: Evidence = {
  migrationMs: 120,
  migrationError: null,
  locks: [{ table: "orders", mode: "AccessExclusiveLock" }],
  writerMaxStallMs: 40,
  writerErrors: 0,
  writerAttempts: 200,
  rowCountsBefore: [{ table: "orders", rows: 200_000 }],
  rowCountsAfter: [{ table: "orders", rows: 200_000 }],
  droppedColumns: [],
  droppedTables: [],
  lossyChanges: [],
  constraintFullScan: false,
  plans: [],
  columnsBefore: [],
  columnsAfter: [],
};

describe("classify", () => {
  test("a fast migration that never stalls the writer is SAFE", () => {
    expect(classify(clean, DEFAULT_THRESHOLDS)).toEqual({ verdict: "SAFE" });
  });

  test("a writer stall over the threshold is LOCK_BLOCKING", () => {
    expect(classify({ ...clean, writerMaxStallMs: 8_200 }, DEFAULT_THRESHOLDS)).toEqual({
      verdict: "UNSAFE",
      hazard: "LOCK_BLOCKING",
    });
  });

  test("writer lock_timeout errors count as blocking even if no stall was measured", () => {
    expect(classify({ ...clean, writerErrors: 3 }, DEFAULT_THRESHOLDS)).toEqual({
      verdict: "UNSAFE",
      hazard: "LOCK_BLOCKING",
    });
  });

  test("dropping a column is DATA_LOSS and outranks a stall", () => {
    expect(
      classify({ ...clean, droppedColumns: ["orders.notes"], writerMaxStallMs: 5_000 }, DEFAULT_THRESHOLDS),
    ).toEqual({ verdict: "UNSAFE", hazard: "DATA_LOSS" });
  });

  test("a lossy type change is DATA_LOSS", () => {
    expect(
      classify(
        { ...clean, lossyChanges: [{ column: "orders.sku", detail: "3 rows exceed varchar(100)" }] },
        DEFAULT_THRESHOLDS,
      ),
    ).toEqual({ verdict: "UNSAFE", hazard: "DATA_LOSS" });
  });

  test("a migration that errors on existing data (e.g. NOT NULL on nulls) is DATA_LOSS", () => {
    expect(classify({ ...clean, migrationError: "column contains null values" }, DEFAULT_THRESHOLDS)).toEqual({
      verdict: "UNSAFE",
      hazard: "DATA_LOSS",
    });
  });

  test("a long single-transaction migration without a stall is LONG_TRANSACTION", () => {
    expect(classify({ ...clean, migrationMs: 45_000 }, DEFAULT_THRESHOLDS)).toEqual({
      verdict: "UNSAFE",
      hazard: "LONG_TRANSACTION",
    });
  });

  test("a full-table constraint validation is CONSTRAINT_SCAN", () => {
    expect(classify({ ...clean, constraintFullScan: true }, DEFAULT_THRESHOLDS)).toEqual({
      verdict: "UNSAFE",
      hazard: "CONSTRAINT_SCAN",
    });
  });

  test("an after-query 5x slower than before is QUERY_REGRESSION", () => {
    const plans = [
      { name: "list_orders", which: "before" as const, executionMs: 12, nodeTypes: ["Index Scan"], seqScanRows: 0, rowsReturned: 50 },
      { name: "list_orders", which: "after" as const, executionMs: 90, nodeTypes: ["Seq Scan"], seqScanRows: 200_000, rowsReturned: 50 },
    ];
    expect(classify({ ...clean, plans }, DEFAULT_THRESHOLDS)).toEqual({
      verdict: "UNSAFE",
      hazard: "QUERY_REGRESSION",
    });
  });

  test("a new query that seq-scans a big table is QUERY_REGRESSION even with no before-plan", () => {
    const plans = [
      { name: "search", which: "after" as const, executionMs: 400, nodeTypes: ["Seq Scan"], seqScanRows: 2_000_000, rowsReturned: 3 },
    ];
    expect(classify({ ...clean, plans }, DEFAULT_THRESHOLDS)).toEqual({
      verdict: "UNSAFE",
      hazard: "QUERY_REGRESSION",
    });
  });

  test("a query that seq-scans a small table is not a regression", () => {
    const plans = [
      { name: "list_countries", which: "after" as const, executionMs: 1, nodeTypes: ["Seq Scan"], seqScanRows: 250, rowsReturned: 250 },
    ];
    expect(classify({ ...clean, plans }, DEFAULT_THRESHOLDS)).toEqual({ verdict: "SAFE" });
  });
});
