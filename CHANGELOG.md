# Improvement Changelog

Every row is one Run of the same 12 Cases with the same scorer (`pnpm eval`). Evidence links point at files in `results/`.

| Stage | What was tried and why | Evidence | Decision / learning |
|---|---|---|---|
| Baseline | One prompt to `claude-opus-5` with the case files, structured output, no tools. | _pending run_ | _pending_ |
| Iteration 1 | Give the agent a real Simulation tool (fresh Postgres, concurrent writer, pg_locks, EXPLAIN) — single Executor, no Planner/Verifier. | _pending_ | _pending_ |
| Iteration 2 | Add the blind Verifier (ADR-0002) that re-measures on its own container. | _pending_ | _pending_ |
| Iteration 3 | Add the Planner. | _pending_ | _pending_ |
| Final | Planner → Executor → Verifier. | _pending_ | _pending_ |

## Main failure mode

_pending_

## Hot take

_pending_
