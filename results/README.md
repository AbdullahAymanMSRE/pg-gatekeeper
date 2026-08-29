# Runs

| Run id | Method | Configuration | Purpose |
|---|---|---|---|
| `iter0-baseline` | baseline | one prompt, no tools | starting point |
| `iter1-executor-only` | gatekeeper | Executor + simulator tools; `--no-planner --no-verifier` | does measurement alone close the gap? |
| `iter2-executor-verifier` | gatekeeper | + blind Verifier; `--no-planner` | does independent re-measurement catch Executor mistakes? |
| `iter3-full-pipeline` | gatekeeper | Planner + Executor + Verifier | does a Planner add anything? |
| `final` | both | the configuration chosen in the changelog | the headline comparison in the README |

Each run directory holds `<method>.json` (every result, the harness proof of every shipped fix, the grounding of every cited duration, per-case scores, model id and prompt hashes), `<method>.md` (the table), `comparison.md` when both methods ran, and `viewer.html` (`pnpm viewer <run-id>`). Matching trajectories are in `../trajectories/<run-id>/<case>/<role>.jsonl`.

`spend.json` is the cumulative API spend ledger across every run, including smoke tests; it is what enforces the project budget.

`spend.json` also contains one accidental run, `run-2026-08-29-04-50` (≈ $0.48): a shell-quoting mistake while re-scoring passed the whole flag string as a single argument, so `eval` fell back to a fresh timestamped run of both methods until it was killed. Its outputs were deleted; the spend stays in the ledger because the ledger is the record of what the project cost.
