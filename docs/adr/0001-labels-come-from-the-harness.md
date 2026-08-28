---
status: accepted
---
# Ground-truth Labels are measured, not asserted

Each Case's Label (Verdict + Hazard) is produced by running the Simulation harness with the project's Thresholds, not by a human deciding what "should" be unsafe. This means the harness is the single definition of unsafe for both the eval and the agent, and a Label can be re-derived by anyone from a clean environment. The trade-off is that labels are only as good as the Thresholds and the seed-data scale; we accept that and document both, rather than scoring against opinions a judge cannot reproduce.
