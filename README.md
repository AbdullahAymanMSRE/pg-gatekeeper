# pg-gatekeeper

**An agentic reviewer that decides whether a Postgres migration is safe to ship — by actually running it, not by reading it.**

Give it a migration and the queries it touches. It spins up a throwaway Postgres with a million rows, runs the change while a concurrent writer keeps hitting the table, watches `pg_locks`, diffs the schema and row counts, `EXPLAIN ANALYZE`s the queries before and after, rewrites the migration if it is dangerous, proves the rewrite on a fresh database, and hands a DBA one screen to sign.

Built solo for the micro1 Agentic Workflows Hackathon (Aug 28–31, 2026) with Claude Code as the coding agent. Everything in this repository was written during the hackathon; the only pre-existing components are the open-source dependencies listed under *Reproduction*.

---

## Who has the problem

A backend team of 3–10 engineers running Postgres in production **without a dedicated DBA**. Every week someone opens a PR with `ALTER TABLE …` in it. The reviewer is a peer who knows the application, not Postgres internals.

## The bottleneck

Migrations fail in ways that never show up in CI, because CI runs against an empty database with no concurrent traffic:

- `ALTER COLUMN … TYPE`, a volatile `DEFAULT`, or a plain `CREATE INDEX` rewrites or locks a table under `ACCESS EXCLUSIVE`. On 10 rows it is instant; on 40 M rows it stalls every write for minutes.
- `ADD FOREIGN KEY` without `NOT VALID` scans the whole table while blocking writers.
- A whole-table `UPDATE` in one transaction holds row locks (and bloats WAL) for as long as it runs.
- `SET NOT NULL` or a narrowed `varchar` is fine or catastrophic depending only on the data already in the table.
- Dropping an "unused" index is free — unless one of the application's queries was using it, in which case it now seq-scans a million rows.

The honest manual procedure — restore a staging copy with realistic volume, run the migration while watching `pg_stat_activity`, `EXPLAIN` the affected queries before and after, write up a safer version — takes a competent engineer ~25 minutes per change, so in practice it is done rarely, and the team learns about the bad ones from the on-call pager. The reviewer's real question is not "does this SQL look right?" but **"what will this do to a busy, populated table?"** — and that question cannot be answered by reading.

## What the solution does

`pnpm review cases/<case>` runs three roles on the same Claude model:

| Role | What it does | Tools |
|---|---|---|
| **Planner** | Reads the case, checks table sizes, indexes and current query plans, and writes a measurement plan. | `inspect_schema`, `run_sql` (read-only), `explain_query` |
| **Executor** | Simulates the migration as written, reads the evidence against exact thresholds, drafts a rewrite when needed and proves it. | the above + `simulate_migration`, `verify_fix` |
| **Verifier** | Sees only the case and the Executor's *claim* (never its reasoning), reproduces the evidence on its own fresh database, and accepts or rejects. A rejection goes back to the Executor with the objection; after two rejections the case is escalated to a human. | `simulate_migration`, `verify_fix`, `explain_query` |

The Simulation harness underneath is deterministic TypeScript, not a prompt: a fresh `postgres:16` container per simulation (testcontainers), seeded from SQL, a Writer updating a random row every 50 ms with `lock_timeout`, a monitor sampling `pg_locks` and `pg_stat_activity` every 25 ms, schema and row-count snapshots before and after, longest-value checks for narrowed columns, and `EXPLAIN (ANALYZE, FORMAT JSON)` for every affected query. Thresholds (`src/harness/thresholds.ts`) turn evidence into one of five hazards; they were calibrated empirically (`docs/calibration.md`).

The output is a one-screen Review: verdict badge, hazard, at most three measured facts, the rewritten migration with its verification status, and one sentence saying what to do. The full evidence lives in the JSON result and the trajectory.

Ground rules that are structural rather than promised: the tool has **no way to connect to a non-disposable database** (ADR-0005); every consequential action happens in a container it created itself, and the deliverable is a file a human applies through their normal process.

## How it is evaluated

Seventeen synthetic Cases (`cases/`), each a schema + seed + migration + affected queries. Their labels are **not opinions**: `pnpm label` derives each one by running the harness (ADR-0001), so anyone can re-derive them. The set deliberately includes twins where identical-looking SQL is safe or unsafe depending only on data (`DEFAULT now()` vs `DEFAULT clock_timestamp()`; a `varchar` cap that fits vs one that truncates; `SET NOT NULL` with and without nulls present; dropping an index a query does vs does not use) and one 2 M-row case where an added index is not actually usable by the query it was written for.

**Primary metric — actionable reviews.** A review counts only if the verdict and hazard match the label *and*, for any hazard that has a safe rewrite, the fix the reviewer shipped is **proven by the eval harness itself**: re-run on a fresh database, clean under the thresholds, and schema-equivalent to the original migration's end state. `DATA_LOSS` has no equivalent rewrite (the correct action is to stop), so the verdict alone counts there. Secondary metrics: verdict accuracy, false "fix verified" claims, and **grounded numbers** — every number in the evidence bullets must exist in a tool result, the case files or the threshold definitions, so a review cannot quote a measurement that was never made.

**Baseline.** One prompt to the same model with the same files, the same hazard definitions and the same output schema — no tools, no database. Both methods see identical inputs; the only difference is whether the reviewer can run anything.

## Results

_See the tables below; they are copied verbatim from `results/final/comparison.md`._

{{RESULTS}}

## Improvement Changelog

See [CHANGELOG.md](CHANGELOG.md) — one row per run, each pointing at the results files that drove the next decision, including the experiments that were removed.

## Main failure mode

{{FAILURE_MODE}}

## Hot take

{{HOT_TAKE}}

## Reproduction

[REPRODUCE.md](REPRODUCE.md) — clean-environment setup, exact commands for the solution, the baseline and the evaluation, expected outputs, versions, runtime and cost.

## Agent trajectories

`trajectories/<run>/<case>/<role>.jsonl` holds every instruction, model turn, tool call, tool result, verifier rejection, retry and escalation, one JSON object per line. `pnpm viewer <run>` renders a run into a single self-contained HTML page (`results/<run>/viewer.html`) with the comparison table, both reviews per case and expandable timelines per role. `trajectories/build/` contains the Claude Code session transcripts from building this project.

## Repository map

```
CONTEXT.md            the project's vocabulary (Case, Evidence, Hazard, Verdict, Fix, Review, …)
docs/adr/             six decisions worth explaining
docs/calibration.md   the measurements behind the thresholds
cases/                17 evaluation cases with harness-derived labels
src/harness/          simulate · classify · thresholds · shadow-db · split
src/agents/           planner/executor/verifier orchestration, tools, prompts/*.md
src/baseline/         the one-prompt baseline
src/eval/             runner, scorer, fix proofs, grounding, cost, spend ledger
src/review/           output schema and the one-screen renderer
src/trajectory/       JSONL logger
src/viewer/           results + trajectories → one HTML page
src/cli/              review · baseline · eval · label · viewer
```
