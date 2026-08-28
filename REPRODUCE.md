# Reproduction guide

Written for a clean machine. Everything runs locally except the Claude API calls.

## Prerequisites

| Tool | Version used | Notes |
|---|---|---|
| Node.js | 22.22 | `node --version` |
| pnpm | 11.4 | `corepack enable && corepack prepare pnpm@11 --activate` |
| Docker | 29.1 (daemon running) | the harness pulls `postgres:16` on first use (~150 MB) |
| Anthropic API key | — | put it in `.env` (see `.env.example`); `.env` overrides a shell `ANTHROPIC_API_KEY` on purpose |

No Postgres install is needed; every simulation runs in its own throwaway container.

## Setup

```bash
git clone <this repo> && cd pg-gatekeeper
pnpm install
cp .env.example .env   # then paste your key
pnpm test              # 25 tests, incl. 4 real-Postgres simulations (~30 s, no API calls)
```

## The data

The 12 evaluation Cases live in `cases/<id>/` and are fully synthetic (`seed.sql` uses `generate_series` with a fixed `setseed`). Each has:

- `schema.sql`, `seed.sql` — the starting database (1M `orders` rows; case 12 uses 2M)
- `migration.sql` — the change under review
- `queries/*.sql` (+ optional `.after.sql`) — affected application queries
- `label.json` — the ground truth, **derived by running the harness** (ADR-0001), including the raw evidence

Re-derive every label from scratch (~2 min, no API calls):

```bash
pnpm label
```

Expected: the printed verdicts match the current `label.json` files (3 SAFE, 3 LOCK_BLOCKING, 1 LONG_TRANSACTION, 2 DATA_LOSS, 1 CONSTRAINT_SCAN, 2 QUERY_REGRESSION). Millisecond numbers vary run to run; verdicts should not. If a verdict flips on your machine, see "Calibration" below.

## Run the solution on one case

```bash
pnpm review cases/04-add-column-volatile-default
```

Prints the one-screen Review (verdict, hazard, evidence, verified fix, action) and the path of the trajectory JSONL files. ~2–4 min, roughly $1–2 in API usage.

The baseline on the same case (one prompt, no tools, ~20 s, a few cents):

```bash
pnpm baseline cases/04-add-column-volatile-default
```

## Run the full evaluation

```bash
pnpm eval --run-id final          # baseline then gatekeeper over all 12 cases, then the comparison
pnpm viewer final                 # builds results/final/viewer.html (open it in a browser)
```

Outputs:

- `results/final/baseline.{json,md}`, `results/final/gatekeeper.{json,md}` — per-case verdicts, correctness, tokens, cost, wall time, plus the model id and prompt hashes used
- `results/final/comparison.md` — the baseline-vs-agent table used in the README
- `trajectories/final/<case>/<role>.jsonl` — every instruction, model turn, tool call, tool result, rejection and retry
- `results/final/viewer.html` — all of the above in one page

Runs are resumable: re-running with the same `--run-id` skips finished cases. `--case 07` limits to cases whose id starts with `07`. `--agent --no-verifier` / `--no-planner` run the ablations referenced in the changelog.

Approximate runtime and cost for a full run (12 cases, `claude-opus-5`): baseline ~4 min / ~$0.50; gatekeeper ~40 min / ~$15–25. Both figures are recorded exactly in the results files of the submitted run.

## "Human time per task" estimate

The 25-minute figure in the comparison is an estimate of the manual procedure the agent replaces, not a measurement: read the migration and queries (3 min), restore or pick a staging DB with realistic volume (5 min), run the migration while watching `pg_stat_activity`/`pg_locks` (7 min), `EXPLAIN ANALYZE` the affected queries before and after (5 min), write up the verdict and a safer rewrite (5 min). Reading and signing the agent's Review is estimated at 3 min.

## Calibration

Thresholds live in `src/harness/thresholds.ts` and were calibrated on Postgres 16 in Docker on an Apple-silicon laptop (`docs/calibration.md`). Safe operations stall the concurrent writer 2–5 ms; blocking DDL 100–600 ms; a backfill ~4 s. On a much slower disk the safe/blocking gap stays wide, but if a label flips, re-run `pnpm label` and compare the evidence in `label.json` with the calibration table.
