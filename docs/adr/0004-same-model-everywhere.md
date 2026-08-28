---
status: accepted
---
# Same model for Baseline, Planner, Executor and Verifier in scored Runs

Scored Runs use one pinned model ID for every role and for the Baseline, so the measured improvement is attributable to tools, Simulation and verification rather than to model strength. Using a cheaper model for Planner/Verifier would cut cost, and a stronger Executor might raise accuracy; both are allowed only as clearly separated changelog experiments, never in the headline comparison.
