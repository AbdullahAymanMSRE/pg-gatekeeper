import Anthropic from "@anthropic-ai/sdk";
import { loadDotenv } from "../env.js";
import type { BetaMessageParam, BetaToolUnion } from "@anthropic-ai/sdk/resources/beta.js";
import type { BetaRunnableTool } from "@anthropic-ai/sdk/lib/tools/BetaRunnableTool.js";
import { addUsage, emptyUsage } from "../eval/cost.js";
import { assertBudget, record } from "../eval/ledger.js";
import type { Usage } from "../review/schema.js";
import type { Role, TrajectoryLogger } from "../trajectory/logger.js";

/** ADR-0004: one model for every role and for the Baseline in scored Runs. */
export const MODEL = (loadDotenv(), process.env.GATEKEEPER_MODEL ?? "claude-sonnet-5");
export const EFFORT = (process.env.GATEKEEPER_EFFORT ?? "medium") as "low" | "medium" | "high";

loadDotenv();
/** Identity-linked API keys must name the workspace on every request. */
const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
export const client = new Anthropic(workspaceId ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } } : {});

export interface Caps {
  maxToolCalls: number;
  maxCostUsd: number;
  maxWallMs: number;
}

export const DEFAULT_CAPS: Caps = { maxToolCalls: 12, maxCostUsd: 0.6, maxWallMs: 6 * 60_000 };

export class CapExceeded extends Error {}

export interface Spend {
  usage: Usage;
  startedAt: number;
}
export const newSpend = (): Spend => ({ usage: emptyUsage(), startedAt: Date.now() });

export interface RoleRun {
  usage: Usage;
  toolCalls: number;
  text: string;
}

/**
 * Runs one role's tool loop, logging every turn, tool call and tool result to the
 * Trajectory, accumulating usage, and enforcing the Caps.
 */
export async function runRole(opts: {
  role: Role;
  system: string;
  user: string;
  tools: BetaRunnableTool<any>[];
  logger: TrajectoryLogger;
  caps?: Caps;
  /** Shared across roles of one Case so cost and time caps apply to the whole review. */
  spend?: Spend;
  ledger?: { runId: string; caseId: string };
}): Promise<RoleRun> {
  const caps = opts.caps ?? DEFAULT_CAPS;
  const spend = opts.spend ?? newSpend();
  const budget = { spend, toolCalls: 0 };
  await assertBudget();
  const costBefore = spend.usage.costUsd;
  await opts.logger.log(opts.role, { type: "instructions", system: opts.system, user: opts.user });

  const tools = opts.tools.map((t) => wrapTool(t, opts.role, opts.logger, budget, caps));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1_000, caps.maxWallMs - (Date.now() - spend.startedAt)));

  const runner = client.beta.messages.toolRunner(
    {
      model: MODEL,
      max_tokens: 16_000,
      max_iterations: caps.maxToolCalls + 5,
      // Auto-cache the growing prefix (system + case + tool results) on every turn.
      cache_control: { type: "ephemeral" },
      // Server-side refusal fallback exists only on the Opus/Fable tier.
      ...(MODEL.startsWith("claude-opus") || MODEL.startsWith("claude-fable")
        ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
        : {}),
      system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
      messages: [
        { role: "user", content: [{ type: "text", text: opts.user, cache_control: { type: "ephemeral" } }] },
      ] satisfies BetaMessageParam[],
      tools: tools as (BetaToolUnion | BetaRunnableTool<any>)[],
      thinking: { type: "adaptive", display: "summarized" },
      output_config: { effort: EFFORT },
    },
    { signal: controller.signal },
  );

  let text = "";
  try {
    for await (const message of runner) {
      spend.usage = addUsage(spend.usage, MODEL, message.usage);
      const parts: string[] = [];
      for (const block of message.content) {
        if (block.type === "text") parts.push(block.text);
        else if (block.type === "thinking" && block.thinking) await opts.logger.log(opts.role, { type: "thinking", text: block.thinking });
      }
      text = parts.join("\n");
      await opts.logger.log(opts.role, {
        type: "assistant",
        text,
        usage: {
          input: message.usage.input_tokens,
          output: message.usage.output_tokens,
          cacheRead: message.usage.cache_read_input_tokens,
          cacheWrite: message.usage.cache_creation_input_tokens,
        },
      });
      if (message.stop_reason === "refusal") throw new CapExceeded("model refused the request");
      if (spend.usage.costUsd > caps.maxCostUsd) throw new CapExceeded(`cost cap hit: $${spend.usage.costUsd.toFixed(2)}`);
    }
  } catch (err) {
    if (controller.signal.aborted) throw new CapExceeded("time cap hit");
    throw err;
  } finally {
    clearTimeout(timer);
    if (opts.ledger) await record({ ...opts.ledger, role: opts.role, usd: spend.usage.costUsd - costBefore });
  }
  return { usage: spend.usage, toolCalls: budget.toolCalls, text };
}

function wrapTool(
  tool: BetaRunnableTool<any>,
  role: Role,
  logger: TrajectoryLogger,
  budget: { toolCalls: number },
  caps: Caps,
): BetaRunnableTool<any> {
  return {
    ...tool,
    run: async (input: unknown, ctx?: unknown) => {
      const id = `${role}-${budget.toolCalls + 1}`;
      budget.toolCalls++;
      await logger.log(role, { type: "tool_call", id, name: tool.name, input });
      const t0 = performance.now();
      let output: unknown;
      if (budget.toolCalls > caps.maxToolCalls && !tool.name.startsWith("submit_")) {
        output = { error: `Tool-call budget of ${caps.maxToolCalls} exhausted. Submit your result now with what you have.` };
      } else {
        try {
          output = await (tool.run as (i: unknown, c?: unknown) => Promise<unknown>)(input, ctx);
        } catch (err) {
          output = { error: (err as Error).message };
        }
      }
      const parsed = typeof output === "string" ? tryParse(output) : output;
      await logger.log(role, { type: "tool_result", id, name: tool.name, ms: Math.round(performance.now() - t0), output: parsed });
      return typeof output === "string" ? output : JSON.stringify(output);
    },
  };
}

function tryParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

export function caseFilesBlock(c: { id: string; title: string; schemaSql: string; seedSql: string; migrationSql: string; queries: { name: string; before: string; after?: string }[] }): string {
  const queries = c.queries
    .map((q) => `-- queries/${q.name}.sql (current)\n${q.before.trim()}` + (q.after ? `\n-- queries/${q.name}.after.sql (after this change)\n${q.after.trim()}` : ""))
    .join("\n\n");
  return [
    `# Case ${c.id}: ${c.title}`,
    "## schema.sql (current production schema)",
    "```sql\n" + c.schemaSql.trim() + "\n```",
    "## seed.sql (how the shadow database is populated; production is larger)",
    "```sql\n" + c.seedSql.trim() + "\n```",
    "## migration.sql (the change under review)",
    "```sql\n" + c.migrationSql.trim() + "\n```",
    "## Affected queries",
    "```sql\n" + queries + "\n```",
  ].join("\n\n");
}
