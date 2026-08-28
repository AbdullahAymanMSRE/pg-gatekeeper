/**
 * Grounded evidence: every number a Review cites must exist somewhere the reviewer
 * could have read it — a tool result, the case files, or the threshold definitions.
 * A method with no tools can only be grounded by quoting the case files.
 */
const NUMBER = /(\d[\d,]*(?:\.\d+)?)(\s?(?:ms|s|x|×|%|rows?|MB|GB|k|K|M))?/g;

export function citedNumbers(evidence: string[]): string[] {
  const out: string[] = [];
  for (const line of evidence) {
    for (const m of line.matchAll(NUMBER)) {
      const digits = m[1]!.replace(/,/g, "");
      const hasUnit = m[2] !== undefined;
      const isLarge = digits.replace(".", "").length >= 2;
      if (hasUnit || isLarge) out.push(digits.replace(/\.0+$/, ""));
    }
  }
  return out;
}

export interface Grounding {
  cited: number;
  grounded: number;
  ungrounded: string[];
}

export function groundEvidence(evidence: string[], sources: string[]): Grounding {
  const haystack = sources.join("\n").replace(/,(?=\d{3})/g, "");
  const nums = citedNumbers(evidence);
  const ungrounded = nums.filter((n) => !new RegExp(`(?<![\\d.])${n.replace(".", "\\.")}(?![\\d])`).test(haystack));
  return { cited: nums.length, grounded: nums.length - ungrounded.length, ungrounded };
}
