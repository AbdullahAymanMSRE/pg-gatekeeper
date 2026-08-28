import { describe, expect, test } from "vitest";
import { citedNumbers, groundEvidence } from "./grounding.js";

describe("citedNumbers", () => {
  test("extracts measurements and large counts, ignoring small bare integers", () => {
    expect(citedNumbers(["writer stalled 627ms (12x the 50ms threshold) on a 1,000,000-row table", "Step 2 of 3"])).toEqual([
      "627", "12", "50", "1000000",
    ]);
  });
  test("keeps single-digit numbers with a unit", () => {
    expect(citedNumbers(["Measured writer stall of 2ms"])).toEqual(["2"]);
  });
});

describe("groundEvidence", () => {
  const sources = ["max_stall_ms: 627, threshold 50", "rows: 1000000"];
  test("numbers present in the sources are grounded", () => {
    expect(groundEvidence(["stalled 627ms vs 50ms on 1,000,000 rows"], sources)).toEqual({ cited: 3, grounded: 3, ungrounded: [] });
  });
  test("a number that appears nowhere is reported", () => {
    expect(groundEvidence(["measured stall 2ms"], sources)).toEqual({ cited: 1, grounded: 0, ungrounded: ["2"] });
  });
  test("no numbers cited means nothing to check", () => {
    expect(groundEvidence(["rewrite under AccessExclusiveLock"], sources)).toEqual({ cited: 0, grounded: 0, ungrounded: [] });
  });
});
