import { describe, expect, test } from "vitest";
import type { ReviewResult } from "../review/schema.js";
import { scoreCase, summarize } from "./score.js";

const result = (verdict: "SAFE" | "UNSAFE", hazard: ReviewResult["review"]["hazard"] = null): ReviewResult => ({
  caseId: "x",
  method: "baseline",
  review: { verdict, hazard, confidence: 0.9, summary: "", evidence: [], fixed_migration: null, fix_verified: false, action: "" },
  needsHumanReview: false,
  escalationReason: null,
  usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0.2 },
  wallMs: 1000,
  retries: 0,
});

describe("scoreCase", () => {
  test("SAFE vs SAFE is correct", () => {
    expect(scoreCase(result("SAFE"), { verdict: "SAFE" }).correct).toBe(true);
  });
  test("UNSAFE with the right hazard is correct", () => {
    expect(scoreCase(result("UNSAFE", "DATA_LOSS"), { verdict: "UNSAFE", hazard: "DATA_LOSS" }).correct).toBe(true);
  });
  test("UNSAFE with the wrong hazard is wrong", () => {
    expect(scoreCase(result("UNSAFE", "LOCK_BLOCKING"), { verdict: "UNSAFE", hazard: "DATA_LOSS" }).correct).toBe(false);
  });
  test("calling an unsafe case SAFE is wrong", () => {
    expect(scoreCase(result("SAFE"), { verdict: "UNSAFE", hazard: "DATA_LOSS" }).correct).toBe(false);
  });
});

test("summarize computes accuracy and mean cost", () => {
  const s = summarize([
    scoreCase(result("SAFE"), { verdict: "SAFE" }),
    scoreCase(result("SAFE"), { verdict: "UNSAFE", hazard: "DATA_LOSS" }),
  ]);
  expect(s.accuracy).toBe(0.5);
  expect(s.meanCostUsd).toBeCloseTo(0.2);
  expect(s.unsafeCases).toBe(1);
});
