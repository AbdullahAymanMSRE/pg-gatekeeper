import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { loadPrompt } from "../agents/gatekeeper.js";
import { EFFORT, MODEL, caseFilesBlock, client } from "../agents/llm.js";
import { addUsage, emptyUsage } from "../eval/cost.js";
import { assertBudget, record } from "../eval/ledger.js";
import type { Case } from "../harness/types.js";
import { ReviewSchema, type ReviewResult } from "../review/schema.js";
import { TrajectoryLogger } from "../trajectory/logger.js";

/**
 * The Baseline: one direct prompt, same model, same case files, same output
 * contract. No tools, no Shadow DB.
 */
export async function baseline(c: Case, opts: { runId: string }): Promise<ReviewResult> {
  const logger = TrajectoryLogger.forCase(opts.runId, c.id);
  const system = await loadPrompt("baseline");
  const user = caseFilesBlock(c);
  await logger.log("baseline", { type: "instructions", system, user });
  const t0 = Date.now();
  await assertBudget();
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16_000,
    system,
    messages: [{ role: "user", content: user }],
    output_config: { format: zodOutputFormat(ReviewSchema), effort: EFFORT },
  });
  const usage = addUsage(emptyUsage(), MODEL, response.usage);
  await record({ runId: opts.runId, caseId: c.id, role: "baseline", usd: usage.costUsd });
  const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  await logger.log("baseline", { type: "assistant", text, usage: { input: response.usage.input_tokens, output: response.usage.output_tokens } });
  const review = response.parsed_output;
  const result: ReviewResult = {
    caseId: c.id,
    method: "baseline",
    review: review ?? {
      verdict: "UNSAFE",
      hazard: null,
      confidence: 0,
      summary: "Model output could not be parsed.",
      evidence: [],
      fixed_migration: null,
      fix_verified: false,
      action: "Escalate to a DBA.",
    },
    needsHumanReview: review === null,
    escalationReason: review === null ? "unparseable output" : null,
    usage,
    wallMs: Date.now() - t0,
    retries: 0,
  };
  await logger.log("baseline", { type: "final", output: result });
  return result;
}
