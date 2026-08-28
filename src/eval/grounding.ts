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
  const nums = citedNumbers(evidence);
  const ungrounded = nums.filter((n) => !new RegExp(`(?<![\\d.])${n.replace(".", "\\.")}(?![\\d])`).test(haystack));
  return { cited: nums.length, grounded: nums.length - ungrounded.length, ungrounded };
}
