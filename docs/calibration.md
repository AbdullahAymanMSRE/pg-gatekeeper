# Threshold calibration (evidence for `src/harness/thresholds.ts`)

Measured with `simulate()` on Postgres 16 (Docker, tmpfs, fsync off), `orders` table with 1,000,000 rows,
Writer updating one random row every 50 ms. Seeding the Shadow DB takes ~4.8 s.

| Migration | Duration ms | Writer max stall ms | Locks held on `orders` |
|---|---:|---:|---|
| `ADD COLUMN coupon_code text` | 1 | 2 | AccessExclusive |
| `ADD COLUMN … NOT NULL DEFAULT clock_timestamp()` (volatile → rewrite) | 614 | 594 | AccessExclusive, Share |
| `ALTER COLUMN total_cents TYPE bigint` (rewrite) | 531 | 514 | AccessExclusive, Share |
| `CREATE INDEX` (plain) | 241 | 226 | Share |
| `CREATE INDEX CONCURRENTLY` | 314 | 4 | ShareUpdateExclusive |
| `ADD FOREIGN KEY` (validated inline) | 114 | 101 | ShareRowExclusive |
| `ADD FOREIGN KEY … NOT VALID; VALIDATE CONSTRAINT` | 105 | 3 | ShareUpdateExclusive |
| `UPDATE orders SET …` whole table, one transaction | 4364 | 3934 | RowExclusive |
| backfill + `SET NOT NULL` | 3714 | 2934 | AccessExclusive, RowExclusive |

At 200k rows the same rewrites stalled the Writer for only ~100 ms, which is why the seed is 1M rows.

Chosen thresholds: Writer stall > **50 ms** → `LOCK_BLOCKING` (safe ops ≤ 4 ms, blocking ≥ 100 ms, a 25× gap);
migration > **2 000 ms** → `LONG_TRANSACTION` (rewrites ≤ 614 ms, backfills ≥ 3 700 ms).
A production table is typically 10–100× larger, so stalls scale accordingly; the Review reports the measured number, not a projection.
