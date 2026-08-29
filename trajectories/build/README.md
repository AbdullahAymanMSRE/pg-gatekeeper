# Build trajectories

Raw Claude Code session transcripts (JSONL, one event per line) from building this project with Claude Code
(model: Claude Fable 5, via the `claude` CLI 2.1.250). Each line is a user turn, an assistant turn, a tool call or a tool result,
in order. They cover the whole hackathon: problem selection and grilling, domain modelling (CONTEXT.md, ADRs), test-driven
harness work, calibration, the agent loop, every eval run and the changelog decisions.

The *agent* trajectories (the product's own Planner/Executor/Verifier runs) are the sibling directories `trajectories/<run-id>/`.
