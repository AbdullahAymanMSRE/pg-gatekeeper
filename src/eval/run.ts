import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { gatekeeper, loadPrompt, type GatekeeperOptions } from "../agents/gatekeeper.js";
import { MODEL } from "../agents/llm.js";
import { baseline } from "../baseline/run.js";
import { loadCase } from "../cases/load.js";
import { DEFAULT_THRESHOLDS } from "../harness/thresholds.js";
import { VerdictSchema, type Evidence, type Verdict } from "../harness/types.js";
import type { ReviewResult } from "../review/schema.js";
import { groundEvidence, type Grounding } from "./grounding.js";
import { proveFix, type FixProof } from "./proof.js";
import { scoreCase, summarize, type CaseScore, type Summary } from "./score.js";

export type Method = "baseline" | "gatekeeper";

export interface RunFile {
  runId: string;
  method: Method;
  model: string;
  promptHashes: Record<string, string>;
  thresholds: typeof DEFAULT_THRESHOLDS;
  options: Partial<GatekeeperOptions>;
  startedAt: string;
  results: ReviewResult[];
  /** The eval's own re-run of each shipped fix, keyed by case id (free: no API calls). */
  proofs: Record<string, FixProof | null>;
  grounding: Record<string, Grounding>;
  scores: CaseScore[];
  summary: Summary;
}

export async function listCaseIds(filter?: string): Promise<string[]> {
  return (await readdir("cases")).filter((d) => !d.startsWith(".") && (!filter || d.startsWith(filter))).sort();
}

export async function loadLabel(caseId: string): Promise<{ verdict: Verdict; evidence: Evidence }> {
  const raw = JSON.parse(await readFile(path.join("cases", caseId, "label.json"), "utf8"));
  return { verdict: VerdictSchema.parse(raw), evidence: raw.evidence as Evidence };
}

/** Everything a reviewer could legitimately have read numbers from. */
async function groundingSources(runId: string, caseId: string): Promise<string[]> {
  const dir = path.join("cases", caseId);
  const files = ["schema.sql", "seed.sql", "migration.sql"].map((f) => readFile(path.join(dir, f), "utf8"));
  const queriesDir = path.join(dir, "queries");
  const queries = (await readdir(queriesDir).catch(() => [])).map((f) => readFile(path.join(queriesDir, f), "utf8"));
  const sources = await Promise.all([...files, ...queries, loadPrompt("baseline")]);
  const tdir = path.join("trajectories", runId, caseId);
  for (const f of (await readdir(tdir).catch(() => [])).filter((f) => f.endsWith(".jsonl"))) {
    for (const line of (await readFile(path.join(tdir, f), "utf8")).split("\n")) {
      if (!line) continue;
      const ev = JSON.parse(line);
      if (ev.type === "tool_result") sources.push(typeof ev.output === "string" ? ev.output : JSON.stringify(ev.output));
    }
  }
  return sources;
}

async function groundingFor(runId: string, result: ReviewResult): Promise<Grounding> {
  return groundEvidence(result.review.evidence, await groundingSources(runId, result.caseId));
}

/** Re-runs a shipped fix through the harness; null when there is nothing to prove. */
async function proofFor(result: ReviewResult, label: { verdict: Verdict; evidence: Evidence }): Promise<FixProof | null> {
  const fix = result.review.fixed_migration?.trim();
  if (!fix || label.verdict.verdict === "SAFE") return null;
  const c = await loadCase(path.join("cases", result.caseId));
  return proveFix(c, fix, label.evidence);
}

async function promptHashes(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const name of ["baseline", "planner", "executor", "verifier"]) {
    out[name] = createHash("sha256").update(await loadPrompt(name)).digest("hex").slice(0, 12);
  }
  return out;
}

/**
 * Runs one method over the Cases, resuming from results/<runId>/<method>.json
 * if it exists (so a crashed or interrupted Run does not re-spend money).
 */
export async function runMethod(
  method: Method,
  opts: { runId: string; caseFilter?: string; gatekeeper?: Partial<GatekeeperOptions>; log?: (line: string) => void },
): Promise<RunFile> {
  const log = opts.log ?? console.log;
  const dir = path.join("results", opts.runId);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${method}.json`);
  let run: RunFile;
  try {
    run = JSON.parse(await readFile(file, "utf8"));
    log(`resuming ${file} (${run.results.length} case(s) done)`);
  } catch {
    run = {
      runId: opts.runId,
      method,
      model: MODEL,
      promptHashes: await promptHashes(),
      thresholds: DEFAULT_THRESHOLDS,
      options: opts.gatekeeper ?? {},
      startedAt: new Date().toISOString(),
      results: [],
      proofs: {},
      grounding: {},
      scores: [],
      summary: summarize([]),
    };
  }
  run.proofs ??= {};
  run.grounding ??= {};

  const save = async () => {
    run.summary = summarize(run.scores);
    await writeFile(file, JSON.stringify(run, null, 2) + "\n");
  };
  const line = (score: CaseScore) =>
    `${method.padEnd(10)} ${score.caseId.padEnd(34)} ${score.actionable ? "✓" : "✗"} got=${fmt(score.got).padEnd(24)} exp=${fmt(score.expected).padEnd(24)} fix=${score.fixProven ? "proven" : score.falseVerificationClaim ? "FALSE CLAIM" : "-"} nums=${score.numbersCited - score.numbersUngrounded}/${score.numbersCited} $${score.costUsd.toFixed(2)} ${(score.wallMs / 1000).toFixed(0)}s${score.needsHumanReview ? " ESCALATED" : ""}`;

  // Rescore what is already there (labels, proofs or the scorer may have changed; costs nothing).
  run.scores = [];
  for (const result of run.results) {
    const label = await loadLabel(result.caseId);
    if (!(result.caseId in run.proofs)) run.proofs[result.caseId] = await proofFor(result, label);
    run.grounding[result.caseId] = await groundingFor(opts.runId, result);
    run.scores.push(scoreCase(result, label.verdict, run.proofs[result.caseId] ?? null, run.grounding[result.caseId]));
  }
  await save();

  for (const id of await listCaseIds(opts.caseFilter)) {
    if (run.results.some((r) => r.caseId === id)) continue;
    const c = await loadCase(path.join("cases", id));
    const label = await loadLabel(id);
    const result =
      method === "baseline" ? await baseline(c, { runId: opts.runId }) : await gatekeeper(c, { runId: opts.runId, ...opts.gatekeeper });
    run.results.push(result);
    run.proofs[id] = await proofFor(result, label);
    run.grounding[id] = await groundingFor(opts.runId, result);
    const score = scoreCase(result, label.verdict, run.proofs[id] ?? null, run.grounding[id]);
    run.scores.push(score);
    await save();
    log(line(score));
  }
  await writeFile(path.join(dir, `${method}.md`), renderRunTable(run));
  return run;
}

export function fmt(v: Verdict): string {
  return v.verdict === "SAFE" ? "SAFE" : `UNSAFE/${v.hazard}`;
}

export function renderRunTable(run: RunFile): string {
  const fixCell = (s: CaseScore) => {
    const required = s.expected.verdict === "UNSAFE" && s.expected.hazard !== "DATA_LOSS";
    if (!required) return "–";
    return s.fixProven ? "✓ proven" : s.falseVerificationClaim ? "✗ false claim" : "✗";
  };
  const rows = run.scores.map(
    (s) =>
      `| ${s.caseId} | ${fmt(s.expected)} | ${fmt(s.got)} | ${s.verdictCorrect ? "✓" : "✗"} | ${fixCell(s)} | ${s.actionable ? "✓" : "✗"} | ${s.numbersCited - s.numbersUngrounded}/${s.numbersCited} | ${s.needsHumanReview ? "yes" : ""} | $${s.costUsd.toFixed(2)} | ${(s.wallMs / 1000).toFixed(0)}s |`,
  );
  const s = run.summary;
  return [
    `# ${run.method} · run ${run.runId}`,
    `model \`${run.model}\` · prompts ${Object.entries(run.promptHashes).map(([k, v]) => `${k}@${v}`).join(", ")} · ${run.startedAt}`,
    "",
    "| Case | Label | Got | Verdict | Fix (harness-proven) | Actionable | Grounded numbers | Escalated | Cost | Wall |",
    "|---|---|---|:-:|:-:|:-:|:-:|:-:|--:|--:|",
    ...rows,
    "",
    `**Actionable ${s.actionable}/${s.cases} = ${(s.actionableRate * 100).toFixed(0)}%** · verdict accuracy ${s.verdictCorrect}/${s.cases} · fixes proven ${s.fixesProven}/${s.fixesRequired} · false verification claims ${s.falseVerificationClaims} · grounded numbers ${s.numbersCited - s.numbersUngrounded}/${s.numbersCited} (${s.reviewsWithFabricatedNumbers} reviews cite unmeasured numbers) · escalated ${s.escalated} · total $${s.totalCostUsd.toFixed(2)} · mean $${s.meanCostUsd.toFixed(2)} · mean ${(s.meanWallMs / 1000).toFixed(0)}s/case`,
    "",
  ].join("\n");
}

export function renderComparison(b: RunFile, g: RunFile, humanMinutesPerCase = 25): string {
  const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
  const rows = [
    ["Actionable reviews (primary)", pct(b.summary.actionableRate), pct(g.summary.actionableRate), `${((g.summary.actionableRate - b.summary.actionableRate) * 100).toFixed(0)} pts`],
    ["Verdict + hazard accuracy", pct(b.summary.verdictAccuracy), pct(g.summary.verdictAccuracy), `${((g.summary.verdictAccuracy - b.summary.verdictAccuracy) * 100).toFixed(0)} pts`],
    ["Fixes proven by the harness", `${b.summary.fixesProven}/${b.summary.fixesRequired}`, `${g.summary.fixesProven}/${g.summary.fixesRequired}`, ""],
    ["False \"fix verified\" claims", String(b.summary.falseVerificationClaims), String(g.summary.falseVerificationClaims), ""],
    ["Reviews citing numbers that were never measured", `${b.summary.reviewsWithFabricatedNumbers}/${b.summary.cases}`, `${g.summary.reviewsWithFabricatedNumbers}/${g.summary.cases}`, ""],
    ["Cases escalated to a human", String(b.summary.escalated), String(g.summary.escalated), ""],
    ["Human time per case (est., see REPRODUCE.md)", `${humanMinutesPerCase} min`, "~3 min (read + sign)", `−${humanMinutesPerCase - 3} min`],
    ["Cost per case", `$${b.summary.meanCostUsd.toFixed(2)}`, `$${g.summary.meanCostUsd.toFixed(2)}`, `+$${(g.summary.meanCostUsd - b.summary.meanCostUsd).toFixed(2)}`],
    ["Wall time per case", `${(b.summary.meanWallMs / 1000).toFixed(0)}s`, `${(g.summary.meanWallMs / 1000).toFixed(0)}s`, ""],
  ];
  const perCase = g.scores.map((gs) => {
    const bs = b.scores.find((x) => x.caseId === gs.caseId);
    const cell = (s: CaseScore) => `${s.actionable ? "✓" : "✗"} ${fmt(s.got)}${s.fixProven ? " + proven fix" : s.falseVerificationClaim ? " (false claim)" : ""}`;
    return `| ${gs.caseId} | ${fmt(gs.expected)} | ${bs ? cell(bs) : "–"} | ${cell(gs)} |`;
  });
  return [
    `# Baseline vs Gatekeeper · run ${g.runId}`,
    "",
    "| Metric | Simple baseline | Agent solution | Change |",
    "|---|---|---|---|",
    ...rows.map((r) => `| ${r.join(" | ")} |`),
    "",
    "| Case | Label | Baseline | Gatekeeper |",
    "|---|---|---|---|",
    ...perCase,
    "",
  ].join("\n");
}
