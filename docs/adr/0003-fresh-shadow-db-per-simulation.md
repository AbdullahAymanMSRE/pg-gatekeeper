---
status: accepted
---
# One fresh Shadow DB per Simulation

Every Simulation (including a Fix re-check) starts a new Postgres 16 container via testcontainers, seeded from the Case. A single long-lived database reset between steps would be faster, but a leftover lock, index, or half-applied migration from a previous attempt would silently corrupt the Evidence, and "the Fix was verified on a clean database" must be literally true. Cost: a few seconds of container startup per Simulation.
