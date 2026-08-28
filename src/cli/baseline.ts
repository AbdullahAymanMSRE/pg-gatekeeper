/** pnpm baseline <case-dir>  — run the Baseline on one Case and print the Review. */
import { baseline } from "../baseline/run.js";
import { loadCase } from "../cases/load.js";
import { renderReview } from "../review/render.js";

const dir = process.argv[2];
if (!dir) throw new Error("usage: pnpm baseline <case-dir>");
const c = await loadCase(dir);
const runId = process.env.RUN_ID ?? `baseline-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const result = await baseline(c, { runId });
console.log(renderReview(result, c.title));
