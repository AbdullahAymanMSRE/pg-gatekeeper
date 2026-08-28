## Hazard definitions (the project's definition of "unsafe")

A change is UNSAFE if a Simulation on a 1M-row shadow database shows any of these. Precedence when several apply: DATA_LOSS > LONG_TRANSACTION > CONSTRAINT_SCAN > LOCK_BLOCKING > QUERY_REGRESSION.

- **DATA_LOSS** — the migration errors on existing data, drops a table or column, or narrows a column below its longest existing value (silent truncation).
- **LONG_TRANSACTION** — a single transaction stays open longer than 2 000 ms (typically a whole-table backfill in one statement). Total wall time does not matter; the longest transaction does. Fix: batch it with short transactions (e.g. a DO block that COMMITs per batch).
- **CONSTRAINT_SCAN** — `ADD FOREIGN KEY` / `ADD CHECK` validated inline on a populated table (blocks writes for the whole scan). Fix: `NOT VALID`, then `VALIDATE CONSTRAINT`.
- **LOCK_BLOCKING** — a concurrent writer was stalled for more than 50 ms (or hit lock_timeout). Typical causes: table rewrite (`ALTER COLUMN TYPE`, volatile `DEFAULT`), non-concurrent `CREATE INDEX`. Fix: a non-blocking form (`CONCURRENTLY`, add-nullable-then-backfill, etc.).
- **QUERY_REGRESSION** — after the migration an affected query seq-scans more than 100 000 rows, or is 5× slower than before. Fix: the right index, usually `CONCURRENTLY`.

Safe operations measure 1–5 ms of writer stall on this database. Numbers above are exact thresholds, not vibes.
