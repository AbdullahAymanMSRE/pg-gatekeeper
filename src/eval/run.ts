import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { gatekeeper, loadPrompt, type GatekeeperOptions } from "../agents/gatekeeper.js";
import { MODEL } from "../agents/llm.js";
import { baseline } from "../baseline/run.js";
import { loadCase } from "../cases/load.js";
import { DEFAULT_THRESHOLDS } from "../harness/thresholds.js";
import { VerdictSchema, type Verdict } from "../harness/types.js";
import type { ReviewResult } from "../review/schema.js";
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
  scores: CaseScore[];
  summary: Summary;
}

export async function listCaseIds(filter?: string): Promise<string[]> {
  return (await readdir("cases")).filter((d) => !d.startsWith(".") && (!filter || d.startsWith(filter))).sort();
}

export async function loadLabel(caseId: string): Promise<Verdict> {
  const raw = JSON.parse(await readFile(path.join("cases", caseId, "label.json"), "utf8"));
  return VerdictSchema.parse(raw);
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
      scores: [],
      summary: summarize([]),
    };
  }

  for (const id of await listCaseIds(opts.caseFilter)) {
    if (run.results.some((r) => r.caseId === id)) continue;
    const c = await loadCase(path.join("cases", id));
    const expected = await loadLabel(id);
    const result =
      method === "baseline" ? await baseline(c, { runId: opts.runId }) : await gatekeeper(c, { runId: opts.runId, ...opts.gatekeeper });
    const score = scoreCase(result, expected);
    run.results.push(result);
    run.scores.push(score);
    run.summary = summarize(run.scores);
    await writeFile(file, JSON.stringify(run, null, 2) + "\n");
    log(
      `${method.padEnd(10)} ${id.padEnd(34)} ${score.correct ? "✓" : "✗"} got=${fmt(score.got).padEnd(24)} exp=${fmt(expected).padEnd(24)} fix=${score.fixVerified ? "verified" : "-"} $${score.costUsd.toFixed(2)} ${(score.wallMs / 1000).toFixed(0)}s${score.needsHumanReview ? " ESCALATED" : ""}`,
    );
  }
  await writeFile(path.join(dir, `${method}.md`), renderRunTable(run));
  return run;
}

export function fmt(v: Verdict): string {
  return v.verdict === "SAFE" ? "SAFE" : `UNSAFE/${v.hazard}`;
}

export function renderRunTable(run: RunFile): string {
  const rows = run.scores.map(
    (s) =>
      `| ${s.caseId} | ${fmt(s.expected)} | ${fmt(s.got)} | ${s.correct ? "✓" : "✗"} | ${s.expected.verdict === "UNSAFE" ? (s.fixVerified ? "✓" : "✗") : "–"} | ${s.needsHumanReview ? "yes" : ""} | $${s.costUsd.toFixed(2)} | ${(s.wallMs / 1000).toFixed(0)}s |`,
  );
  const s = run.summary;
  return [
    `# ${run.method} · run ${run.runId}`,
    `model \`${run.model}\` · prompts ${Object.entries(run.promptHashes).map(([k, v]) => `${k}@${v}`).join(", ")} · ${run.startedAt}`,
    "",
    "| Case | Label | Got | Correct | Fix verified | Escalated | Cost | Wall |",
    "|---|---|---|:-:|:-:|:-:|--:|--:|",
    ...rows,
    "",
    `**Accuracy ${s.correct}/${s.cases} = ${(s.accuracy * 100).toFixed(0)}%** · fixes verified ${s.fixesVerified}/${s.unsafeCases} · escalated ${s.escalated} · total $${s.totalCostUsd.toFixed(2)} · mean $${s.meanCostUsd.toFixed(2)} · mean ${(s.meanWallMs / 1000).toFixed(0)}s/case`,
    "",
  ].join("\n");
}

export function renderComparison(b: RunFile, g: RunFile, humanMinutesPerCase = 25): string {
  const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
  const rows = [
    ["Verdict + hazard accuracy (primary)", pct(b.summary.accuracy), pct(g.summary.accuracy), `${((g.summary.accuracy - b.summary.accuracy) * 100).toFixed(0)} pts`],
    ["Fixes verified on a fresh DB", `${b.summary.fixesVerified}/${b.summary.unsafeCases}`, `${g.summary.fixesVerified}/${g.summary.unsafeCases}`, ""],
    ["Cases escalated to a human", String(b.summary.escalated), String(g.summary.escalated), ""],
    ["Human time per case (est., see REPRODUCE.md)", `${humanMinutesPerCase} min`, "~3 min (read + sign)", `−${humanMinutesPerCase - 3} min`],
    ["Cost per case", `$${b.summary.meanCostUsd.toFixed(2)}`, `$${g.summary.meanCostUsd.toFixed(2)}`, `+$${(g.summary.meanCostUsd - b.summary.meanCostUsd).toFixed(2)}`],
    ["Wall time per case", `${(b.summary.meanWallMs / 1000).toFixed(0)}s`, `${(g.summary.meanWallMs / 1000).toFixed(0)}s`, ""],
  ];
  const perCase = g.scores.map((gs) => {
    const bs = b.scores.find((x) => x.caseId === gs.caseId);
    return `| ${gs.caseId} | ${fmt(gs.expected)} | ${bs ? (bs.correct ? "✓" : `✗ ${fmt(bs.got)}`) : "–"} | ${gs.correct ? "✓" : `✗ ${fmt(gs.got)}`} |`;
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
