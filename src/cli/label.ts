/**
 * Derives the ground-truth Label for every Case by running the Simulation
 * harness with the project Thresholds (ADR-0001). Writes cases/<id>/label.json.
 *
 *   pnpm label            # all cases
 *   pnpm label 07         # cases whose id starts with "07"
 */
import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadCase } from "../cases/load.js";
import { classify } from "../harness/classify.js";
import { simulate } from "../harness/simulate.js";
import { DEFAULT_THRESHOLDS } from "../harness/thresholds.js";

const filter = process.argv[2];
const ids = (await readdir("cases")).filter((d) => !d.startsWith(".") && (!filter || d.startsWith(filter))).sort();

for (const id of ids) {
  const dir = path.join("cases", id);
  const c = await loadCase(dir);
  const t0 = performance.now();
  const evidence = await simulate(c);
  const label = classify(evidence, DEFAULT_THRESHOLDS);
  const seconds = ((performance.now() - t0) / 1000).toFixed(1);
  await writeFile(
    path.join(dir, "label.json"),
    JSON.stringify({ ...label, thresholds: DEFAULT_THRESHOLDS, evidence }, null, 2) + "\n",
  );
  const summary = `ms=${evidence.migrationMs} stall=${evidence.writerMaxStallMs} err=${evidence.migrationError ? "yes" : "no"} dropped=${evidence.droppedColumns.length} lossy=${evidence.lossyChanges.length} seqScan=${Math.max(0, ...evidence.plans.filter((p) => p.which === "after").map((p) => p.seqScanRows))}`;
  console.log(`${id.padEnd(34)} ${JSON.stringify(label).padEnd(48)} ${summary}  (${seconds}s)`);
}
