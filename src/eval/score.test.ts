import { describe, expect, test } from "vitest";
import type { ReviewResult } from "../review/schema.js";
import type { FixProof } from "./proof.js";
import { scoreCase, summarize } from "./score.js";

const result = (verdict: "SAFE" | "UNSAFE", hazard: ReviewResult["review"]["hazard"] = null, fixVerified = false): ReviewResult => ({
  caseId: "x",
  method: "baseline",
  review: { verdict, hazard, confidence: 0.9, summary: "", evidence: [], fixed_migration: fixVerified ? "SELECT 1" : null, fix_verified: fixVerified, action: "" },
  needsHumanReview: false,
  escalationReason: null,
  usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0.2 },
  wallMs: 1000,
  retries: 0,
});
const proof = (clean: boolean, schemaEquivalent: boolean): FixProof => ({
  ran: true, clean, schemaEquivalent, hazard: clean ? { verdict: "SAFE" } : { verdict: "UNSAFE", hazard: "LOCK_BLOCKING" },
  schemaDifferences: [], migrationError: null, writerMaxStallMs: 3, maxTransactionMs: 10,
});

describe("scoreCase", () => {
  test("SAFE vs SAFE is actionable", () => {
    expect(scoreCase(result("SAFE"), { verdict: "SAFE" }, null).actionable).toBe(true);
  });
  test("right hazard but no proven fix is not actionable for a fixable hazard", () => {
    const s = scoreCase(result("UNSAFE", "LOCK_BLOCKING"), { verdict: "UNSAFE", hazard: "LOCK_BLOCKING" }, null);
    expect(s.verdictCorrect).toBe(true);
    expect(s.actionable).toBe(false);
  });
  test("right hazard with a harness-proven fix is actionable", () => {
    expect(scoreCase(result("UNSAFE", "LOCK_BLOCKING", true), { verdict: "UNSAFE", hazard: "LOCK_BLOCKING" }, proof(true, true)).actionable).toBe(true);
  });
  test("a fix that is clean but changes the schema does not count", () => {
    expect(scoreCase(result("UNSAFE", "LOCK_BLOCKING", true), { verdict: "UNSAFE", hazard: "LOCK_BLOCKING" }, proof(true, false)).fixProven).toBe(false);
  });
  test("DATA_LOSS needs only the right verdict", () => {
    expect(scoreCase(result("UNSAFE", "DATA_LOSS"), { verdict: "UNSAFE", hazard: "DATA_LOSS" }, null).actionable).toBe(true);
  });
  test("claiming fix_verified without proof is a false verification claim", () => {
    expect(scoreCase(result("UNSAFE", "LOCK_BLOCKING", true), { verdict: "UNSAFE", hazard: "LOCK_BLOCKING" }, proof(false, true)).falseVerificationClaim).toBe(true);
  });
  test("wrong hazard is not actionable even with a proven fix", () => {
    expect(scoreCase(result("UNSAFE", "LOCK_BLOCKING", true), { verdict: "UNSAFE", hazard: "DATA_LOSS" }, proof(true, true)).actionable).toBe(false);
  });
});

test("summarize computes the actionable rate and fix counts", () => {
  const s = summarize([
    scoreCase(result("SAFE"), { verdict: "SAFE" }, null),
    scoreCase(result("UNSAFE", "LOCK_BLOCKING"), { verdict: "UNSAFE", hazard: "LOCK_BLOCKING" }, null),
  ]);
  expect(s.actionableRate).toBe(0.5);
  expect(s.verdictAccuracy).toBe(1);
  expect(s.fixesRequired).toBe(1);
  expect(s.fixesProven).toBe(0);
  expect(s.meanCostUsd).toBeCloseTo(0.2);
});
