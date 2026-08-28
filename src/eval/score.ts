import type { Verdict } from "../harness/types.js";
import type { ReviewResult } from "../review/schema.js";

export interface CaseScore {
  caseId: string;
  expected: Verdict;
  got: Verdict;
  correct: boolean;
  fixVerified: boolean;
  needsHumanReview: boolean;
  costUsd: number;
  wallMs: number;
}

/** Primary metric: exact match on Verdict and, when UNSAFE, on the primary Hazard. */
export function scoreCase(result: ReviewResult, expected: Verdict): CaseScore {
  const got: Verdict =
    result.review.verdict === "SAFE"
      ? { verdict: "SAFE" }
      : { verdict: "UNSAFE", hazard: result.review.hazard ?? "LOCK_BLOCKING" };
  const correct =
    expected.verdict === got.verdict &&
    (expected.verdict === "SAFE" || got.verdict === "SAFE" || expected.hazard === got.hazard);
  return {
    caseId: result.caseId,
    expected,
    got,
    correct,
    fixVerified: result.review.fix_verified,
    needsHumanReview: result.needsHumanReview,
    costUsd: result.usage.costUsd,
    wallMs: result.wallMs,
  };
}

export interface Summary {
  cases: number;
  correct: number;
  accuracy: number;
  unsafeCases: number;
  fixesVerified: number;
  escalated: number;
  totalCostUsd: number;
  meanCostUsd: number;
  meanWallMs: number;
}

export function summarize(scores: CaseScore[]): Summary {
  const n = scores.length;
  const correct = scores.filter((s) => s.correct).length;
  const unsafeCases = scores.filter((s) => s.expected.verdict === "UNSAFE").length;
  const totalCostUsd = scores.reduce((a, s) => a + s.costUsd, 0);
  return {
    cases: n,
    correct,
    accuracy: n === 0 ? 0 : correct / n,
    unsafeCases,
    fixesVerified: scores.filter((s) => s.expected.verdict === "UNSAFE" && s.fixVerified).length,
    escalated: scores.filter((s) => s.needsHumanReview).length,
    totalCostUsd,
    meanCostUsd: n === 0 ? 0 : totalCostUsd / n,
    meanWallMs: n === 0 ? 0 : scores.reduce((a, s) => a + s.wallMs, 0) / n,
  };
}
