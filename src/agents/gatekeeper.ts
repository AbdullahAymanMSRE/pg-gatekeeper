import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { emptyUsage } from "../eval/cost.js";
import type { Case } from "../harness/types.js";
import type { Review, ReviewResult } from "../review/schema.js";
import { TrajectoryLogger } from "../trajectory/logger.js";
import { CapExceeded, DEFAULT_CAPS, caseFilesBlock, runRole, type Caps } from "./llm.js";
import {
  CaseContext,
  explainQueryTool,
  inspectSchemaTool,
  runSqlTool,
  simulateMigrationTool,
  submitPlanTool,
  submitReviewTool,
  submitVerdictTool,
  verifyFixTool,
  type Plan,
  type VerdictCheck,
} from "./tools.js";

const here = path.dirname(fileURLToPath(import.meta.url));

export async function loadPrompt(name: string): Promise<string> {
  const [body, hazards] = await Promise.all([
    readFile(path.join(here, "prompts", `${name}.md`), "utf8"),
    readFile(path.join(here, "prompts", "shared-hazards.md"), "utf8"),
  ]);
  return body.replace("{{HAZARDS}}", hazards.trim()).trim();
}

export interface GatekeeperOptions {
  runId: string;
  caps?: Caps;
  maxRetries?: number;
  /** Iteration knobs for the changelog; all on by default. */
  usePlanner?: boolean;
  useVerifier?: boolean;
}

/**
 * Planner → Executor → Verifier, with the Verifier blind to the Executor's reasoning (ADR-0002).
 * A Rejection sends the Verifier's objection back to a fresh Executor run; after
 * `maxRetries` rejections, or any cap, the Case is escalated to a human.
 */
export async function gatekeeper(c: Case, opts: GatekeeperOptions): Promise<ReviewResult> {
  const caps = opts.caps ?? DEFAULT_CAPS;
  const maxRetries = opts.maxRetries ?? 2;
  const logger = TrajectoryLogger.forCase(opts.runId, c.id);
  const budget = { usage: emptyUsage(), toolCalls: 0, startedAt: Date.now() };
  const caseBlock = caseFilesBlock(c);

  const plannerCtx = new CaseContext(c);
  const executorCtx = new CaseContext(c);
  const verifierCtx = new CaseContext(c);
  let review: Review | null = null;
  let needsHumanReview = false;
  let escalationReason: string | null = null;
  let retries = 0;

  try {
    // --- Planner ---
    let plan: Plan | null = null;
    if (opts.usePlanner !== false) {
      const sink = { plan: null as Plan | null };
      await runRole({
        role: "planner",
        system: await loadPrompt("planner"),
        user: caseBlock,
        tools: [inspectSchemaTool(plannerCtx), runSqlTool(plannerCtx), explainQueryTool(plannerCtx), submitPlanTool(sink)],
        logger,
        caps: { ...caps, maxToolCalls: 8 },
        budget: { ...budget, toolCalls: 0 },
      });
      plan = sink.plan;
      await logger.log("planner", { type: "final", output: plan });
    }

    // --- Executor ⇄ Verifier ---
    let objection: string | null = null;
    for (let round = 0; round <= maxRetries; round++) {
      const sink = { review: null as Review | null };
      const user = [
        caseBlock,
        plan ? `# Measurement plan from the Planner\n${JSON.stringify(plan, null, 2)}` : "",
        objection ? `# The Verifier REJECTED your previous review\n${objection}\n\nAddress this precisely, re-measure where needed, and submit a corrected review.` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      if (round > 0) await logger.log("executor", { type: "retry", round });
      await runRole({
        role: "executor",
        system: await loadPrompt("executor"),
        user,
        tools: [
          inspectSchemaTool(executorCtx),
          runSqlTool(executorCtx),
          explainQueryTool(executorCtx),
          simulateMigrationTool(executorCtx),
          verifyFixTool(executorCtx),
          submitReviewTool(sink),
        ],
        logger,
        caps,
        budget: { ...budget, toolCalls: 0 },
      });
      if (!sink.review) throw new CapExceeded("executor finished without submitting a review");
      review = sink.review;
      await logger.log("executor", { type: "final", output: review });

      if (opts.useVerifier === false) break;

      const check = { check: null as VerdictCheck | null };
      const claim = {
        verdict: review.verdict,
        hazard: review.hazard,
        evidence: review.evidence,
        fixed_migration: review.fixed_migration,
        fix_verified: review.fix_verified,
      };
      await runRole({
        role: "verifier",
        system: await loadPrompt("verifier"),
        user: `${caseBlock}\n\n# The Executor's claim (its reasoning is deliberately withheld)\n${JSON.stringify(claim, null, 2)}`,
        tools: [
          inspectSchemaTool(verifierCtx),
          explainQueryTool(verifierCtx),
          simulateMigrationTool(verifierCtx),
          verifyFixTool(verifierCtx),
          submitVerdictTool(check),
        ],
        logger,
        caps: { ...caps, maxToolCalls: 10 },
        budget: { ...budget, toolCalls: 0 },
      });
      const verdict = check.check ?? { accept: false, reason: "Verifier finished without submitting a verdict." };
      await logger.log("verifier", { type: "final", output: verdict });
      if (verdict.accept) break;
      objection = verdict.reason;
      await logger.log("orchestrator", { type: "rejection", reason: verdict.reason, round });
      retries++;
      if (round === maxRetries) {
        needsHumanReview = true;
        escalationReason = `Verifier rejected ${retries} time(s); last reason: ${verdict.reason}`;
        review = { ...review, fix_verified: false };
      }
    }
  } catch (err) {
    if (!(err instanceof CapExceeded)) throw err;
    needsHumanReview = true;
    escalationReason = err.message;
    review ??= {
      verdict: "UNSAFE",
      hazard: null,
      confidence: 0,
      summary: "The review could not be completed within its budget; treat as unsafe until a human looks at it.",
      evidence: [],
      fixed_migration: null,
      fix_verified: false,
      action: "Escalate to a DBA.",
    };
  } finally {
    await Promise.all([plannerCtx.close(), executorCtx.close(), verifierCtx.close()]);
  }

  if (needsHumanReview) await logger.log("orchestrator", { type: "escalation", reason: escalationReason ?? "" });
  const result: ReviewResult = {
    caseId: c.id,
    method: "gatekeeper",
    review: review!,
    needsHumanReview,
    escalationReason,
    usage: budget.usage,
    wallMs: Date.now() - budget.startedAt,
    retries,
  };
  await logger.log("orchestrator", { type: "final", output: result });
  return result;
}
