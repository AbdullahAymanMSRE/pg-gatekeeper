# baseline · run iter0-baseline
model `claude-sonnet-5` · prompts baseline@94ec0e2dee26, planner@6f0917989378, executor@9aa59328a180, verifier@523587b76e1c · 2026-08-28T17:48:26.642Z

| Case | Label | Got | Verdict | Fix (harness-proven) | Actionable | Grounded numbers | Escalated | Cost | Wall |
|---|---|---|:-:|:-:|:-:|:-:|:-:|--:|--:|
| 01-add-nullable-column | SAFE | SAFE | ✓ | – | ✓ | 1/1 |  | $0.01 | 6s |
| 02-create-index-concurrently | SAFE | SAFE | ✓ | – | ✓ | 1/1 |  | $0.01 | 4s |
| 03-add-fk-not-valid | SAFE | SAFE | ✓ | – | ✓ | 1/2 |  | $0.01 | 14s |
| 04-add-column-volatile-default | UNSAFE/LOCK_BLOCKING | UNSAFE/LOCK_BLOCKING | ✓ | ✓ proven | ✓ | 1/1 |  | $0.01 | 7s |
| 05-alter-column-type | UNSAFE/LOCK_BLOCKING | UNSAFE/LOCK_BLOCKING | ✓ | ✗ | ✗ | 1/1 |  | $0.02 | 12s |
| 06-create-index-plain | UNSAFE/LOCK_BLOCKING | UNSAFE/LOCK_BLOCKING | ✓ | ✓ proven | ✓ | 1/1 |  | $0.01 | 8s |
| 07-backfill-single-transaction | UNSAFE/LONG_TRANSACTION | UNSAFE/LONG_TRANSACTION | ✓ | ✓ proven | ✓ | 1/1 |  | $0.01 | 6s |
| 08-drop-column | UNSAFE/DATA_LOSS | UNSAFE/DATA_LOSS | ✓ | – | ✓ | 0/0 |  | $0.01 | 9s |
| 09-narrow-varchar | UNSAFE/DATA_LOSS | UNSAFE/DATA_LOSS | ✓ | – | ✓ | 0/0 |  | $0.01 | 10s |
| 10-add-fk-validated-inline | UNSAFE/CONSTRAINT_SCAN | UNSAFE/CONSTRAINT_SCAN | ✓ | ✗ | ✗ | 0/0 |  | $0.01 | 6s |
| 11-drop-unused-index | UNSAFE/QUERY_REGRESSION | UNSAFE/QUERY_REGRESSION | ✓ | ✓ proven | ✓ | 0/0 |  | $0.02 | 13s |
| 12-index-not-used-by-query | UNSAFE/QUERY_REGRESSION | UNSAFE/QUERY_REGRESSION | ✓ | ✓ proven | ✓ | 0/0 |  | $0.01 | 9s |
| 13-add-column-stable-default | SAFE | SAFE | ✓ | – | ✓ | 2/3 |  | $0.01 | 20s |
| 14-narrow-varchar-fits | SAFE | UNSAFE/LOCK_BLOCKING | ✗ | – | ✗ | 0/0 |  | $0.02 | 20s |
| 15-set-not-null-with-nulls | UNSAFE/DATA_LOSS | UNSAFE/DATA_LOSS | ✓ | – | ✓ | 0/0 |  | $0.01 | 11s |
| 16-set-not-null-no-nulls | SAFE | SAFE | ✓ | – | ✓ | 1/1 |  | $0.01 | 11s |
| 17-drop-index-unused | SAFE | UNSAFE/LOCK_BLOCKING | ✗ | – | ✗ | 0/0 |  | $0.02 | 15s |

**Actionable 13/17 = 76%** · verdict accuracy 15/17 · fixes proven 5/7 · false verification claims 2 · grounded numbers 10/12 (2 reviews cite unmeasured numbers) · escalated 0 · total $0.21 · mean $0.01 · mean 11s/case
