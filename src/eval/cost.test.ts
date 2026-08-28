import { expect, test } from "vitest";
import { addUsage, emptyUsage } from "./cost.js";

test("cost for opus-5 uses $5/$25 per million with cache read at $0.50", () => {
  const u = addUsage(emptyUsage(), "claude-opus-5", {
    input_tokens: 100_000,
    output_tokens: 10_000,
    cache_read_input_tokens: 200_000,
    cache_creation_input_tokens: 0,
  });
  expect(u.costUsd).toBeCloseTo(0.5 + 0.25 + 0.1, 6);
  expect(u.inputTokens).toBe(100_000);
});
