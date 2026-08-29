# Baseline vs Gatekeeper · run final

| Metric | Simple baseline | Agent solution | Change |
|---|---|---|---|
| Actionable reviews (primary) | 88% | 100% | 12 pts |
| Verdict + hazard accuracy | 88% | 100% | 12 pts |
| Fixes proven by the harness | 7/7 | 7/7 |  |
| False "fix verified" claims | 1 | 0 |  |
| Reviews citing numbers that were never measured | 0/17 | 0/17 |  |
| Cases escalated to a human | 0 | 0 |  |
| Human time per case (est., see REPRODUCE.md) | 25 min | ~3 min (read + sign) | −22 min |
| Cost per case | $0.01 | $0.04 | +$0.03 |
| Wall time per case | 8s | 53s |  |

| Case | Label | Baseline | Gatekeeper |
|---|---|---|---|
| 01-add-nullable-column | SAFE | ✓ SAFE | ✓ SAFE |
| 02-create-index-concurrently | SAFE | ✓ SAFE (false claim) | ✓ SAFE |
| 03-add-fk-not-valid | SAFE | ✓ SAFE | ✓ SAFE |
| 04-add-column-volatile-default | UNSAFE/LOCK_BLOCKING | ✓ UNSAFE/LOCK_BLOCKING + proven fix | ✓ UNSAFE/LOCK_BLOCKING + proven fix |
| 05-alter-column-type | UNSAFE/LOCK_BLOCKING | ✓ UNSAFE/LOCK_BLOCKING + proven fix | ✓ UNSAFE/LOCK_BLOCKING + proven fix |
| 06-create-index-plain | UNSAFE/LOCK_BLOCKING | ✓ UNSAFE/LOCK_BLOCKING + proven fix | ✓ UNSAFE/LOCK_BLOCKING + proven fix |
| 07-backfill-single-transaction | UNSAFE/LONG_TRANSACTION | ✓ UNSAFE/LONG_TRANSACTION + proven fix | ✓ UNSAFE/LONG_TRANSACTION + proven fix |
| 08-drop-column | UNSAFE/DATA_LOSS | ✓ UNSAFE/DATA_LOSS | ✓ UNSAFE/DATA_LOSS |
| 09-narrow-varchar | UNSAFE/DATA_LOSS | ✓ UNSAFE/DATA_LOSS | ✓ UNSAFE/DATA_LOSS |
| 10-add-fk-validated-inline | UNSAFE/CONSTRAINT_SCAN | ✓ UNSAFE/CONSTRAINT_SCAN + proven fix | ✓ UNSAFE/CONSTRAINT_SCAN + proven fix |
| 11-drop-unused-index | UNSAFE/QUERY_REGRESSION | ✓ UNSAFE/QUERY_REGRESSION + proven fix | ✓ UNSAFE/QUERY_REGRESSION + proven fix |
| 12-index-not-used-by-query | UNSAFE/QUERY_REGRESSION | ✓ UNSAFE/QUERY_REGRESSION + proven fix | ✓ UNSAFE/QUERY_REGRESSION + proven fix |
| 13-add-column-stable-default | SAFE | ✗ UNSAFE/LOCK_BLOCKING | ✓ SAFE |
| 14-narrow-varchar-fits | SAFE | ✓ SAFE | ✓ SAFE |
| 15-set-not-null-with-nulls | UNSAFE/DATA_LOSS | ✓ UNSAFE/DATA_LOSS + proven fix | ✓ UNSAFE/DATA_LOSS + proven fix |
| 16-set-not-null-no-nulls | SAFE | ✓ SAFE | ✓ SAFE |
| 17-drop-index-unused | SAFE | ✗ UNSAFE/LOCK_BLOCKING | ✓ SAFE |
