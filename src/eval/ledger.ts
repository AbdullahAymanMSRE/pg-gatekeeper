import { mkdir, readFile, writeFile } from "node:fs/promises";

const FILE = "results/spend.json";
export const SPEND_LIMIT_USD = Number(process.env.SPEND_LIMIT_USD ?? 9.5);

export class BudgetExhausted extends Error {}

interface Ledger {
  totalUsd: number;
  entries: { at: string; runId: string; caseId: string; role: string; usd: number }[];
}

async function read(): Promise<Ledger> {
  try {
    return JSON.parse(await readFile(FILE, "utf8"));
  } catch {
    return { totalUsd: 0, entries: [] };
  }
}

/** Total spend across every run so far, in USD. */
export async function spentUsd(): Promise<number> {
  return (await read()).totalUsd;
}

export async function assertBudget(): Promise<void> {
  const spent = await spentUsd();
  if (spent >= SPEND_LIMIT_USD) throw new BudgetExhausted(`spend ledger at $${spent.toFixed(2)} ≥ limit $${SPEND_LIMIT_USD}`);
}

/** Records a role's spend. Called once per role run so the ledger survives crashes. */
export async function record(entry: { runId: string; caseId: string; role: string; usd: number }): Promise<void> {
  const l = await read();
  l.entries.push({ at: new Date().toISOString(), ...entry });
  l.totalUsd = l.entries.reduce((a, e) => a + e.usd, 0);
  await mkdir("results", { recursive: true });
  await writeFile(FILE, JSON.stringify(l, null, 2) + "\n");
}
