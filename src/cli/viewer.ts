/** pnpm viewer <run-id>  — build results/<run-id>/viewer.html from results + trajectories. */
import { buildViewer } from "../viewer/build.js";

const runId = process.argv[2];
if (!runId) throw new Error("usage: pnpm viewer <run-id>");
console.log(`wrote ${await buildViewer(runId)}`);
