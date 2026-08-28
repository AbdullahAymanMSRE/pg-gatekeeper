# Postgres Change Gatekeeper

An agentic reviewer that decides whether a database change (a migration plus the queries it affects) is safe to ship, by actually running it against a disposable Postgres and measuring what happens. Built for backend teams without a dedicated DBA.

## Language

### The thing under review

**Case**:
One self-contained review request: a starting schema, seed data, one Migration, and the Queries it affects. The unit of evaluation.
_Avoid_: PR, ticket, scenario, example

**Migration**:
The SQL that changes the schema or data. Exactly one per Case.
_Avoid_: change, patch, diff, script

**Query**:
A read or write statement the application runs against the schema, supplied before and after the Migration where it changes.
_Avoid_: statement, request

**Shadow DB**:
A freshly created, throwaway Postgres containing the Case's schema and seed data. Every Simulation gets its own.
_Avoid_: staging, test DB, sandbox, container

**Writer**:
The synthetic concurrent workload that keeps writing to the affected tables while the Migration runs, standing in for production traffic.
_Avoid_: load generator, background job, hammer

### What we find

**Simulation**:
One execution of a Migration (and its Queries) on a Shadow DB with the Writer running, producing Evidence.
_Avoid_: dry run, test, replay

**Evidence**:
Measured facts from a Simulation: lock modes acquired, Writer stall time, Migration duration, rows changed, query plans and latencies. Every claim in a Review must point at Evidence.
_Avoid_: output, logs, findings, results

**Hazard**:
The category of harm a Migration or Query would cause in production. Exactly one of: `LOCK_BLOCKING`, `LONG_TRANSACTION`, `DATA_LOSS`, `CONSTRAINT_SCAN`, `QUERY_REGRESSION`, or none.
_Avoid_: issue, risk, problem, smell, finding

**Threshold**:
The numeric line that turns Evidence into a Hazard (e.g. Writer stalled longer than one second). Thresholds are the definition of "unsafe" for this project.
_Avoid_: limit, rule, heuristic

**Verdict**:
The reviewer's decision on a Case: `SAFE` or `UNSAFE`, together with the primary Hazard when unsafe.
_Avoid_: result, score, classification, grade

**Fix**:
A rewritten Migration proposed for an `UNSAFE` Case that is intended to reach the same end state without the Hazard. A Fix is *verified* only when a fresh Simulation shows it clear of Hazards and schema-equivalent.
_Avoid_: patch, suggestion, remediation, rewrite

**Review**:
The one-screen, human-facing deliverable for a Case: Verdict, Hazard, the Evidence that matters, the Fix diff, and what the reader should do. The thing a DBA signs.
_Avoid_: report, summary, analysis

### Who does the work

**Planner**:
The role that reads a Case and decides which tables, Queries, and Simulations matter.

**Executor**:
The role that runs Simulations, forms the Verdict, and drafts the Fix.

**Verifier**:
The role that independently reproduces the Executor's Evidence on its own Shadow DB and accepts or rejects the Verdict and Fix. It never sees the Executor's reasoning.
_Avoid_: reviewer, judge, checker

**Rejection**:
The Verifier's refusal of a Verdict or Fix, with the reason. Triggers an Executor retry.

**Escalation**:
Handing a Case to a human with the flag `needs_human_review` because the retry budget, cost cap, or time cap was hit.
_Avoid_: failure, timeout, give-up

**Baseline**:
The comparison method: one direct prompt to the same model with the same Case files, no tools, no Shadow DB, same output contract.
_Avoid_: control, naive, v0

### Measuring

**Label**:
The ground-truth Verdict and Hazard for a Case, established by running the Simulation harness directly, not by human opinion.
_Avoid_: expected, answer key, truth

**Run**:
One execution of the evaluation over all Cases with a fixed method (Baseline or Gatekeeper), model, and prompt version, producing a results table.

**Trajectory**:
The complete recorded sequence of instructions, model turns, tool calls, tool responses, Rejections, and retries for one role on one Case.
_Avoid_: trace, log, transcript, history

**Iteration**:
A changelog entry: something tried, the Run that measured it, and the decision that followed.
