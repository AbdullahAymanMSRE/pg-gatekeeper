import type { ReviewResult } from "./schema.js";

/** The one-screen Review a DBA signs. Everything else lives in the JSON and the Trajectory. */
export function renderReview(r: ReviewResult, title: string): string {
  const v = r.review;
  const badge = r.needsHumanReview ? "⚠️ NEEDS HUMAN REVIEW" : v.verdict === "SAFE" ? "✅ SAFE" : "⛔ UNSAFE";
  const lines = [
    `# ${badge}${v.hazard ? ` — ${v.hazard.replace("_", " ")}` : ""}`,
    `**${title}** · confidence ${(v.confidence * 100).toFixed(0)}%`,
    "",
    v.summary,
    "",
    ...v.evidence.map((e) => `- ${e}`),
  ];
  if (v.fixed_migration) {
    lines.push("", `## Fix ${v.fix_verified ? "(verified on a fresh database)" : "(NOT verified)"}`, "```sql", v.fixed_migration.trim(), "```");
  }
  lines.push("", `**Do this:** ${v.action}`);
  if (r.escalationReason) lines.push("", `_Escalated: ${r.escalationReason}_`);
  lines.push("", `<sub>${r.method} · ${(r.wallMs / 1000).toFixed(0)}s · $${r.usage.costUsd.toFixed(2)} · ${r.retries} retr${r.retries === 1 ? "y" : "ies"}</sub>`);
  return lines.join("\n") + "\n";
}
