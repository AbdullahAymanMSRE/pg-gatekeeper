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

`pnpm review cases/<case>` runs two roles on the same Claude model:

| Role | What it does | Tools |
|---|---|---|
| **Executor** | Inspects the tables, simulates the migration as written, reads the evidence against exact thresholds, drafts a rewrite when needed and proves it on a fresh database. | `inspect_schema`, `run_sql` (read-only), `explain_query`, `simulate_migration`, `verify_fix` |
| **Verifier** | Sees only the case and the Executor's *claim* (never its reasoning), reproduces the evidence on its own fresh database, and accepts or rejects. A rejection goes back to the Executor with the objection; after two rejections, or when the cost/time cap is hit, the case is escalated to a human with `needs_human_review`. | `inspect_schema`, `explain_query`, `simulate_migration`, `verify_fix` |

A third role, a **Planner** that writes a measurement plan first, exists behind `--planner`; the changelog explains why it is off.

The Simulation harness underneath is deterministic TypeScript, not a prompt: a fresh `postgres:16` container per simulation (testcontainers), seeded from SQL, a Writer updating a random row every 50 ms with `lock_timeout`, a monitor sampling `pg_locks` and `pg_stat_activity` every 25 ms, schema and row-count snapshots before and after, longest-value checks for narrowed columns, and `EXPLAIN (ANALYZE, FORMAT JSON)` for every affected query. Thresholds (`src/harness/thresholds.ts`) turn evidence into one of five hazards; they were calibrated empirically (`docs/calibration.md`).

The output is a one-screen Review: verdict badge, hazard, at most three measured facts, the rewritten migration with its verification status, and one sentence saying what to do. The full evidence lives in the JSON result and the trajectory.

Ground rules that are structural rather than promised: the tool has **no way to connect to a non-disposable database** (ADR-0005); every consequential action happens in a container it created itself, and the deliverable is a file a human applies through their normal process.

## How it is evaluated

Seventeen synthetic Cases (`cases/`), each a schema + seed + migration + affected queries. Their labels are **not opinions**: `pnpm label` derives each one by running the harness (ADR-0001), so anyone can re-derive them. The set deliberately includes twins where identical-looking SQL is safe or unsafe depending only on data (`DEFAULT now()` vs `DEFAULT clock_timestamp()`; a `varchar` cap that fits vs one that truncates; `SET NOT NULL` with and without nulls present; dropping an index a query does vs does not use) and one 2 M-row case where an added index is not actually usable by the query it was written for.

**Primary metric — actionable reviews.** A review counts only if the verdict and hazard match the label *and*, for any hazard that has a safe rewrite, the fix the reviewer shipped is **proven by the eval harness itself**: re-run on a fresh database, clean under the thresholds, and schema-equivalent to the original migration's end state. `DATA_LOSS` has no equivalent rewrite (the correct action is to stop), so the verdict alone counts there. Secondary metrics: verdict accuracy, false "fix verified" claims, and **grounded numbers** — every number in the evidence bullets must exist in a tool result, the case files or the threshold definitions, so a review cannot quote a measurement that was never made.

**Baseline.** One prompt to the same model with the same files, the same hazard definitions and the same output schema — no tools, no database. Both methods see identical inputs; the only difference is whether the reviewer can run anything.

## Results

Run `final` (`pnpm eval --run-id final`), 17 cases, `claude-sonnet-5` for both methods. Copied verbatim from [`results/final/comparison.md`](results/final/comparison.md); per-case detail, proofs and trajectories are in `results/final/` and `trajectories/final/`.

| Metric | Simple baseline | Agent solution | Change |
|---|---|---|---|
| Actionable reviews (primary) | 88% | 100% | 12 pts |
| Verdict + hazard accuracy | 88% | 100% | 12 pts |
| Fixes proven by the harness | 7/7 | 7/7 |  |
| False "fix verified" claims | 1 | 0 |  |
| Reviews citing numbers that were never measured | 0/17 | 0/17 |  |
| Cases escalated to a human | 0 | 0 |  |
| Human time per case (est., see REPRODUCE.md) | 25 min | ~3 min (read + sign) | −22 min |
| Cost per case | $0.01 | $0.04 | +$0.03 |
| Wall time per case | 8s | 53s |  |

| Case | Label | Baseline | Gatekeeper |
|---|---|---|---|
| 01-add-nullable-column | SAFE | ✓ SAFE | ✓ SAFE |
| 02-create-index-concurrently | SAFE | ✓ SAFE (false claim) | ✓ SAFE |
| 03-add-fk-not-valid | SAFE | ✓ SAFE | ✓ SAFE |
| 04-add-column-volatile-default | UNSAFE/LOCK_BLOCKING | ✓ UNSAFE/LOCK_BLOCKING + proven fix | ✓ UNSAFE/LOCK_BLOCKING + proven fix |
| 05-alter-column-type | UNSAFE/LOCK_BLOCKING | ✓ UNSAFE/LOCK_BLOCKING + proven fix | ✓ UNSAFE/LOCK_BLOCKING + proven fix |
| 06-create-index-plain | UNSAFE/LOCK_BLOCKING | ✓ UNSAFE/LOCK_BLOCKING + proven fix | ✓ UNSAFE/LOCK_BLOCKING + proven fix |
| 07-backfill-single-transaction | UNSAFE/LONG_TRANSACTION | ✓ UNSAFE/LONG_TRANSACTION + proven fix | ✓ UNSAFE/LONG_TRANSACTION + proven fix |
| 08-drop-column | UNSAFE/DATA_LOSS | ✓ UNSAFE/DATA_LOSS | ✓ UNSAFE/DATA_LOSS |
| 09-narrow-varchar | UNSAFE/DATA_LOSS | ✓ UNSAFE/DATA_LOSS | ✓ UNSAFE/DATA_LOSS |
| 10-add-fk-validated-inline | UNSAFE/CONSTRAINT_SCAN | ✓ UNSAFE/CONSTRAINT_SCAN + proven fix | ✓ UNSAFE/CONSTRAINT_SCAN + proven fix |
| 11-drop-unused-index | UNSAFE/QUERY_REGRESSION | ✓ UNSAFE/QUERY_REGRESSION + proven fix | ✓ UNSAFE/QUERY_REGRESSION + proven fix |
| 12-index-not-used-by-query | UNSAFE/QUERY_REGRESSION | ✓ UNSAFE/QUERY_REGRESSION + proven fix | ✓ UNSAFE/QUERY_REGRESSION + proven fix |
| 13-add-column-stable-default | SAFE | ✗ UNSAFE/LOCK_BLOCKING | ✓ SAFE |
| 14-narrow-varchar-fits | SAFE | ✓ SAFE | ✓ SAFE |
| 15-set-not-null-with-nulls | UNSAFE/DATA_LOSS | ✓ UNSAFE/DATA_LOSS + proven fix | ✓ UNSAFE/DATA_LOSS + proven fix |
| 16-set-not-null-no-nulls | SAFE | ✓ SAFE | ✓ SAFE |
| 17-drop-index-unused | SAFE | ✗ UNSAFE/LOCK_BLOCKING | ✓ SAFE |

The baseline's two misses are the data-dependent twins it cannot resolve by reading: `DEFAULT now()` (stable, no rewrite — it called it a rewrite) and dropping an index no query uses. Its one false claim is `fix_verified: true` from a method with no tools. The gatekeeper's cost and time are the price of running ~4 fresh Postgres simulations per case; the 25-minute manual procedure it replaces is an estimate, not a measurement (see REPRODUCE.md). Across the four development runs (changelog) the baseline scored 76–88 % and the Executor+Verifier configuration 100 % on every run; a 17-case set is small, so read the gap as "every data-dependent case, every fix proven" rather than as a precise percentage.

## Improvement Changelog

See [CHANGELOG.md](CHANGELOG.md) — one row per run, each pointing at the results files that drove the next decision, including the experiments that were removed.

## Main failure mode

**The Executor lies about its own fix.** Across the runs, every mistake that reached the Verifier had the same shape: the verdict was right, but the rewrite was wrong *and the Executor said it was verified* — a fix that silently dropped a `NOT NULL` and a default (iteration 2, case 04), a `DROP COLUMN` first called SAFE (iteration 2, case 08), fabricated evidence about a fix it had not re-run (iteration 3, case 15). In every instance the tool result it had just received said the opposite. The model does not fail to measure; it fails to *read* an inconvenient measurement when it is close to finishing. Two things catch this and nothing else did: an independent agent that re-measures rather than re-reads, and an eval that re-runs the shipped SQL itself instead of trusting `fix_verified: true`. The remaining, unsolved version is the judgment call — a review that correctly says "do not ship" but offers no rewrite (iteration 3, case 11) is scored as not actionable, and reasonable DBAs would disagree with the scorer there.

## Hot take

**Verification belongs in tools, not in prompts.** A second LLM that can *run the same measurement* is a real check; a second LLM that can only *read the first one's reasoning* is a rubber stamp — and so is a "verify your work" instruction, which is what the Executor was already following when it fabricated results. The Verifier earned its 2.6× cost not by being smarter but by being blind to the argument and holding its own database. The corollary that cost me the most: **verify the verifier first.** My agent spent seven simulations and $0.37 doing the right thing while my harness measured the wrong quantity (total wall time instead of longest transaction) and told it it was wrong. An agent loop is an amplifier; whatever is wrong in the tool is repeated with confidence, at cost, in every trajectory.

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
