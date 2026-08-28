---
status: accepted
---
# The tool has no way to touch a non-disposable database

The Gatekeeper accepts only Case directories and only ever connects to Shadow DBs it created itself; there is no `--apply`, no connection-string input, and no "run this on staging" mode. The deliverable is a Review and a Fix file that a human applies through their normal process. This forgoes an obvious product feature, but it makes the hackathon's "consequential actions stay in a sandbox with human approval" rule structurally true rather than a matter of prompt discipline.
