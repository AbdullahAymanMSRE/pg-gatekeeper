---
status: accepted
---
# Cases are raw SQL directories, not git PRs or ORM migrations

Input is a directory of `schema.sql`, `seed.sql`, `migration.sql` and `queries/*.sql`. Parsing PR diffs or Prisma/Drizzle/Knex migrations would make the tool drop-in for more teams, but it would spend the three-day budget on translation layers instead of on Simulation and verification, and would make eval Cases harder to hand-craft precisely. ORM adapters are future work.
