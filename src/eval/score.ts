import type { Verdict } from "../harness/types.js";
import type { ReviewResult } from "../review/schema.js";
import type { Grounding } from "./grounding.js";
import type { FixProof } from "./proof.js";

export interface CaseScore {
  caseId: string;
  expected: Verdict;
  got: Verdict;
  /** Verdict and, when UNSAFE, primary Hazard match the Label. */
  verdictCorrect: boolean;
  /** A fix was shipped and the harness proved it clean and schema-equivalent. */
  fixProven: boolean;
  /** The model said fix_verified: true but the harness could not confirm it. */
  falseVerificationClaim: boolean;
  /**
   * Primary metric. The Review is something a DBA can act on: the verdict is right and,
   * for a hazard that has a safe rewrite, the shipped fix is proven. DATA_LOSS has no
   * schema-equivalent rewrite (the right action is to stop), so the verdict alone counts.
   */
  actionable: boolean;
  needsHumanReview: boolean;
  /** Numbers cited in the evidence bullets, and how many of them exist in a source the reviewer could read. */
  numbersCited: number;
  numbersUngrounded: number;
  costUsd: number;
  wallMs: number;
}

export function scoreCase(result: ReviewResult, expected: Verdict, proof: FixProof | null, grounding?: Grounding): CaseScore {
  const got: Verdict =
    result.review.verdict === "SAFE"
      ? { verdict: "SAFE" }
      : { verdict: "UNSAFE", hazard: result.review.hazard ?? "LOCK_BLOCKING" };
  const verdictCorrect =
    expected.verdict === got.verdict && (expected.verdict === "SAFE" || got.verdict === "SAFE" || expected.hazard === got.hazard);
  const fixProven = proof !== null && proof.clean && proof.schemaEquivalent;
  const fixRequired = expected.verdict === "UNSAFE" && expected.hazard !== "DATA_LOSS";
  return {
    caseId: result.caseId,
    expected,
    got,
    verdictCorrect,
    fixProven,
    falseVerificationClaim: result.review.fix_verified && !fixProven,
    actionable: verdictCorrect && (!fixRequired || fixProven),
    needsHumanReview: result.needsHumanReview,
    numbersCited: grounding?.cited ?? 0,
    numbersUngrounded: grounding?.ungrounded.length ?? 0,
    costUsd: result.usage.costUsd,
    wallMs: result.wallMs,
  };
}

export interface Summary {
  cases: number;
  actionable: number;
  actionableRate: number;
  verdictCorrect: number;
  verdictAccuracy: number;
  fixesRequired: number;
  fixesProven: number;
  falseVerificationClaims: number;
  escalated: number;
  numbersCited: number;
  numbersUngrounded: number;
  /** Reviews citing at least one number that exists in no readable source. */
  reviewsWithFabricatedNumbers: number;
  totalCostUsd: number;
  meanCostUsd: number;
  meanWallMs: number;
}

export function summarize(scores: CaseScore[]): Summary {
  const n = scores.length;
  const actionable = scores.filter((s) => s.actionable).length;
  const verdictCorrect = scores.filter((s) => s.verdictCorrect).length;
  const fixesRequired = scores.filter((s) => s.expected.verdict === "UNSAFE" && s.expected.hazard !== "DATA_LOSS").length;
  const totalCostUsd = scores.reduce((a, s) => a + s.costUsd, 0);
  return {
    cases: n,
    actionable,
    actionableRate: n === 0 ? 0 : actionable / n,
    verdictCorrect,
    verdictAccuracy: n === 0 ? 0 : verdictCorrect / n,
    fixesRequired,
    fixesProven: scores.filter((s) => s.expected.verdict === "UNSAFE" && s.expected.hazard !== "DATA_LOSS" && s.fixProven).length,
    falseVerificationClaims: scores.filter((s) => s.falseVerificationClaim).length,
    escalated: scores.filter((s) => s.needsHumanReview).length,
    numbersCited: scores.reduce((a, s) => a + s.numbersCited, 0),
    numbersUngrounded: scores.reduce((a, s) => a + s.numbersUngrounded, 0),
    reviewsWithFabricatedNumbers: scores.filter((s) => s.numbersUngrounded > 0).length,
    totalCostUsd,
    meanCostUsd: n === 0 ? 0 : totalCostUsd / n,
    meanWallMs: n === 0 ? 0 : scores.reduce((a, s) => a + s.wallMs, 0) / n,
  };
}
