import { describe, expect, test } from "vitest";
import { citedNumbers, groundEvidence } from "./grounding.js";

describe("citedNumbers", () => {
  test("extracts only durations, not ratios, percentages or row counts", () => {
    expect(citedNumbers(["writer stalled 627ms (12x the 50ms threshold) on a 1,000,000-row table, ~10% null", "took 4.3 s"])).toEqual([
      "627", "50", "4.3",
    ]);
  });
  test("keeps single-digit durations", () => {
    expect(citedNumbers(["Measured writer stall of 2ms"])).toEqual(["2"]);
  });
});

describe("groundEvidence", () => {
  const sources = ["max_stall_ms: 627, threshold 50", "rows: 1000000"];
  test("numbers present in the sources are grounded", () => {
    expect(groundEvidence(["stalled 627ms vs 50ms on 1,000,000 rows"], sources)).toEqual({ cited: 2, grounded: 2, ungrounded: [] });
  });
  test("a number that appears nowhere is reported", () => {
    expect(groundEvidence(["measured stall 2ms"], sources)).toEqual({ cited: 1, grounded: 0, ungrounded: ["2"] });
  });
  test("thresholds written with digit-group spaces still ground", () => {
    expect(groundEvidence(["one transaction held 3612ms, over the 2000ms limit"], ["longer than 2 000 ms", "3612"])).toEqual({ cited: 2, grounded: 2, ungrounded: [] });
  });
  test("no numbers cited means nothing to check", () => {
    expect(groundEvidence(["rewrite under AccessExclusiveLock"], sources)).toEqual({ cited: 0, grounded: 0, ungrounded: [] });
  });
});
