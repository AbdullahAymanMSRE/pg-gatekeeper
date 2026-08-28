---
status: accepted
---
# The Verifier never sees the Executor's reasoning

The Verifier receives only the Case files and the Executor's claimed Verdict and Fix, and must reproduce the Evidence with its own Simulations on its own Shadow DB. Sharing the Executor's transcript would be cheaper, but a verifier that reads a persuasive rationale tends to agree with it; independence is the whole point of the role. Consequence: each Case costs roughly two agent runs plus extra containers, which we report as cost per Case.
