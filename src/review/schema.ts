import { z } from "zod";
import { HazardSchema } from "../harness/types.js";

/**
 * The output contract every method (Baseline and Gatekeeper) must produce.
 * The human-facing Review is rendered from this, never written free-form.
 */
export const ReviewSchema = z.object({
  verdict: z.enum(["SAFE", "UNSAFE"]),
  hazard: HazardSchema.nullable().describe("Primary hazard when UNSAFE; null when SAFE."),
  confidence: z.number().min(0).max(1),
  summary: z.string().describe("One sentence a DBA can act on. No hedging, no preamble."),
  evidence: z
    .array(z.string())
    .max(3)
    .describe("Up to three measured facts with numbers (ms, rows, lock modes). Never speculation."),
  fixed_migration: z
    .string()
    .nullable()
    .describe("Complete rewritten migration SQL that reaches the same end state without the hazard; null if SAFE or no fix."),
  fix_verified: z.boolean().describe("True only if the fix was re-run on a fresh database and measured clean."),
  action: z.string().describe("What the reader should do next, in one sentence."),
});
export type Review = z.infer<typeof ReviewSchema>;

/** Fields the orchestrator adds around the model's Review. */
export interface ReviewResult {
  caseId: string;
  method: "baseline" | "gatekeeper";
  review: Review;
  needsHumanReview: boolean;
  escalationReason: string | null;
  usage: Usage;
  wallMs: number;
  /** Executor↔Verifier rounds; 0 for the baseline. */
  retries: number;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
}
