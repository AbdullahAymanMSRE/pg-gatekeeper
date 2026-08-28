/**
 * pnpm eval                      # baseline + gatekeeper over all cases, then comparison
 * pnpm eval --baseline           # one method only
 * pnpm eval --agent
 * pnpm eval --case 07            # filter cases by id prefix
 * pnpm eval --run-id my-run      # name the run (default: timestamp); re-running resumes it
 * pnpm eval --agent --no-planner --no-verifier   # ablations for the changelog
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { renderComparison, runMethod, type RunFile } from "../eval/run.js";

const args = process.argv.slice(2);
const flag = (f: string) => args.includes(f);
const opt = (f: string) => (args.includes(f) ? args[args.indexOf(f) + 1] : undefined);

const runId = opt("--run-id") ?? `run-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}`;
const caseFilter = opt("--case");
const both = !flag("--baseline") && !flag("--agent");

let b: RunFile | undefined;
let g: RunFile | undefined;
if (both || flag("--baseline")) b = await runMethod("baseline", { runId, caseFilter });
if (both || flag("--agent")) {
  g = await runMethod("gatekeeper", {
    runId,
    caseFilter,
    gatekeeper: { usePlanner: !flag("--no-planner"), useVerifier: !flag("--no-verifier") },
  });
}
if (b && g) {
  const md = renderComparison(b, g);
  await writeFile(path.join("results", runId, "comparison.md"), md);
  console.log("\n" + md);
}
console.log(`results: results/${runId}/  trajectories: trajectories/${runId}/`);
