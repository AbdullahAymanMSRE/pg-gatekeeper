#!/usr/bin/env bash
# Copies the Claude Code session transcripts that built this project into trajectories/build/,
# after checking they contain no API key. Run before packaging the submission.
set -euo pipefail
SRC="$HOME/.claude/projects/-Users-abdullahayman-micro1-hackathon"
DST="trajectories/build"
mkdir -p "$DST"
for f in "$SRC"/*.jsonl; do
  if grep -q "sk-ant-api03-[A-Za-z0-9_-]\{40,\}" "$f"; then echo "refusing: $f contains an API key" >&2; exit 1; fi
  cp "$f" "$DST/claude-code-session-$(basename "$f")"
done
cat > "$DST/README.md" <<'MD'
# Build trajectories

Raw Claude Code session transcripts (JSONL, one event per line) from building this project with Claude Code
(model: Claude Fable 5, via the `claude` CLI 2.1.250). Each line is a user turn, an assistant turn, a tool call or a tool result,
in order. They cover the whole hackathon: problem selection and grilling, domain modelling (CONTEXT.md, ADRs), test-driven
harness work, calibration, the agent loop, every eval run and the changelog decisions.

The *agent* trajectories (the product's own Planner/Executor/Verifier runs) are the sibling directories `trajectories/<run-id>/`.
MD
ls -la "$DST"
