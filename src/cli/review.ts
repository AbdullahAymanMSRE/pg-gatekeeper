/** pnpm review <case-dir>  — run the Gatekeeper on one Case and print the Review. */
import { gatekeeper } from "../agents/gatekeeper.js";
import { loadCase } from "../cases/load.js";
import { renderReview } from "../review/render.js";

const dir = process.argv[2];
if (!dir) throw new Error("usage: pnpm review <case-dir>");
const c = await loadCase(dir);
const runId = process.env.RUN_ID ?? `review-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const result = await gatekeeper(c, { runId });
console.log(renderReview(result, c.title));
console.log(`trajectory: trajectories/${runId}/${c.id}/`);
