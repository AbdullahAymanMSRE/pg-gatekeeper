import type { Usage } from "../review/schema.js";

/** USD per million tokens. Source: claude-api skill model table (2026-06-24). */
export const PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
};

export function emptyUsage(): Usage {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0 };
}

export function addUsage(
  acc: Usage,
  model: string,
  u: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null },
): Usage {
  const p = PRICES[model];
  if (!p) throw new Error(`No price for model ${model}`);
  const cacheRead = u.cache_read_input_tokens ?? 0;
  const cacheWrite = u.cache_creation_input_tokens ?? 0;
  const cost =
    (u.input_tokens * p.input + u.output_tokens * p.output + cacheRead * p.cacheRead + cacheWrite * p.cacheWrite) / 1_000_000;
  return {
    inputTokens: acc.inputTokens + u.input_tokens,
    outputTokens: acc.outputTokens + u.output_tokens,
    cacheReadTokens: acc.cacheReadTokens + cacheRead,
    cacheWriteTokens: acc.cacheWriteTokens + cacheWrite,
    costUsd: acc.costUsd + cost,
  };
}
