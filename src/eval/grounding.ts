/**
 * Grounded evidence: every *time measurement* a Review cites (a number with a ms/s
 * unit) must exist somewhere the reviewer could have read it — a tool result, the
 * case files, or the threshold definitions. Ratios, percentages and row counts are
 * excluded because they are legitimately derived; durations can only be measured.
 * A method with no tools can only be grounded by quoting the thresholds.
 */
const DURATION = /(\d[\d,]*(?:\.\d+)?)\s?(?:ms|milliseconds?|s|sec|seconds?)\b/g;

export function citedNumbers(evidence: string[]): string[] {
  const out: string[] = [];
  for (const line of evidence) {
    for (const m of line.matchAll(DURATION)) out.push(m[1]!.replace(/,/g, "").replace(/\.0+$/, ""));
  }
  return out;
}

export interface Grounding {
  cited: number;
  grounded: number;
  ungrounded: string[];
}

export function groundEvidence(evidence: string[], sources: string[]): Grounding {
  // "1,000,000" and "2 000" both mean 2000.
  const haystack = sources.join("\n").replace(/(?<=\d)[,\s\u202f\u00a0](?=\d{3}\b)/g, "");
  // Every number in the sources, so a cited "107.1ms" can match a measured 107.123.
  const available = [...haystack.matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
  const nums = citedNumbers(evidence);
  const ungrounded = nums.filter((n) => {
    const decimals = (n.split(".")[1] ?? "").length;
    const target = Number(n);
    return !available.some((x) => Number(x.toFixed(decimals)) === target);
  });
  return { cited: nums.length, grounded: nums.length - ungrounded.length, ungrounded };
}
