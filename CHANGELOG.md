# Improvement Changelog

Every row is one Run of the same 17 Cases with the same scorer (`pnpm eval`), model `claude-sonnet-5`, effort `medium`. "Actionable" is the primary metric (verdict + hazard right, and any required fix proven by the harness on a fresh database). Evidence links point at files in `results/`.

| Stage | What was tried and why | Evidence | Decision / learning |
|---|---|---|---|
| **Baseline** | One prompt with the case files, the hazard definitions and the output schema. No tools. The fairest "reasonable basic way": same model, same inputs. | [`results/iter0-baseline/baseline.md`](results/iter0-baseline/baseline.md) — actionable **13/17 (76%)**, verdicts 15/17, fixes proven 5/7, **2 false "fix verified" claims**, 2 reviews citing durations that were never measured. $0.21 total, 11 s/case. | Stronger than expected: it recognises textbook migrations from their text. The misses are exactly the data-dependent ones (a `varchar` cap that fits, dropping an index no query uses), a fix with a **syntax error** (`VALIDATE CONSTRAINT` without `ALTER TABLE`, case 10) and a batched rewrite that still stalls the writer (case 05). It also *claims* measurements it cannot have made. Established the starting point and drove two eval changes: harness-proven fixes as part of the primary metric, and the grounded-numbers check. |
| **Eval change (before Iteration 1)** | My first 12 cases were all recognisable from SQL alone, and the baseline scored 12/12 on verdict. Added five "twin" cases where identical-looking SQL is safe or unsafe depending only on the data, and made the eval re-run every shipped fix itself. | Twin cases `13`–`17`; baseline drops from 12/12 to 15/17 on verdicts and to 13/17 actionable once fixes are proven rather than believed. | A metric the baseline can saturate measures nothing. Kept. |
| **Iteration 1 — Executor with a real simulator** | One agent, five tools (`inspect_schema`, `run_sql`, `explain_query`, `simulate_migration`, `verify_fix`), no Planner, no Verifier. The hypothesis: the missing ingredient is measurement, not reasoning. | [`results/iter1-executor-only/gatekeeper.md`](results/iter1-executor-only/gatekeeper.md) — actionable **17/17 (100%)**, fixes proven 7/7, 0 false claims, 53/54 cited durations grounded (the one miss is `0.06ms` rounded from `0.058`). $0.39 total (~$0.02/case), 29 s/case. | The whole gap closed with one agent and a simulator. The twin cases are trivial once you can run `max(length(email))` or watch the writer. Kept as the core. |
| **Harness fix (found by Iteration 1's smoke run)** | The first smoke run spent 7 simulations and $0.37 on one case because `LONG_TRANSACTION` measured total wall time, so a correctly batched backfill (4 s total, 80 ms per transaction) kept failing verification. Changed the measurement to the longest open transaction from `pg_stat_activity.xact_start`. | Smoke trajectory `trajectories/smoke/04-…/executor.jsonl` (7 tool calls, fix "NOT verified"); after the fix the same case takes 3 tool calls and $0.04. Test: `simulate.test.ts` "a whole-table UPDATE is one long transaction; the same backfill batched … is not". | An agent loop amplifies harness bugs: the model kept doing the right thing and the tool kept telling it it was wrong. Verify the verifier first. |
| **Iteration 2 — + blind Verifier** | _running_ | | |
| **Iteration 3 — + Planner** | _pending_ | | |
| **Final** | _pending_ | | |

## Main failure mode

_pending_

## Hot take

_pending_
