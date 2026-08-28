# Solution video — script (≤ 5 min)

**0:00 – 0:40 · The problem.** Show a real-looking PR: `ALTER TABLE orders ALTER COLUMN total_cents TYPE bigint;`. "CI is green. On a 40-million-row table this rewrites everything under an exclusive lock; every write stalls until it finishes. The reviewer is a backend engineer, not a DBA, and the honest way to check — restore staging, run it under load, watch pg_locks, EXPLAIN the queries — takes 25 minutes, so nobody does it."

**0:40 – 1:10 · The baseline.** `pnpm baseline cases/10-add-fk-validated-inline`. One prompt, same model, same files. Show the review: right verdict… and a fix with a syntax error (`VALIDATE CONSTRAINT` without `ALTER TABLE`). Then case 13: the baseline reports "measured writer stall 2 ms" — it has no tools; it never measured anything.

**1:10 – 3:00 · One realistic execution, start to finish.** `pnpm review cases/04-add-column-volatile-default`. Narrate the trajectory as it runs (or the viewer afterwards): Planner inspects `orders` (1 M rows, indexes) → Executor calls `simulate_migration` → a fresh Postgres container, a writer hammering the table, `pg_locks` sampled every 25 ms → evidence: 510 ms stall, `AccessExclusiveLock`, table rewrite → Executor drafts a batched rewrite, `verify_fix` re-runs it on another fresh container: 23 ms stall, schema-equivalent → Verifier, blind to the reasoning, re-measures and accepts → the one-screen Review a DBA signs.

**3:00 – 3:50 · The comparison.** `results/final/comparison.md`: actionable reviews baseline vs gatekeeper, fixes proven by the harness, false "verified" claims, grounded measurements, cost and time per case, 25 min → 3 min human time.

**3:50 – 4:40 · The changelog.** Four rows in 40 seconds. The change that contributed most: giving one agent a real simulator (76 % → 100 % actionable on its own). The experiment removed: the Planner — same score, +60 % cost, no decision it changed (or: kept, if iteration 3 says otherwise). The surprise: the Verifier looked redundant on the scoreboard but caught the Executor calling `DROP COLUMN` safe and shipping a fix that dropped a constraint while claiming it verified.

**4:40 – 5:00 · Hot take.** "Verification belongs in tools, not in prompts. A second LLM that can *run* the same measurement is a real check; a second LLM that can only *read* the first one's reasoning is a rubber stamp. And test your harness before your agent — my agent spent $0.37 doing the right thing while my harness told it it was wrong."

Recording notes: QuickTime screen recording, terminal at 16 pt, viewer in a browser at 125 %. Keep `RUN_ID=final` so the trajectory paths on screen match the submission.
