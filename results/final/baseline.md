# baseline · run final
model `claude-sonnet-5` · prompts baseline@94ec0e2dee26, planner@6f0917989378, executor@9aa59328a180, verifier@523587b76e1c · 2026-08-29T04:27:25.658Z

| Case | Label | Got | Verdict | Fix (harness-proven) | Actionable | Grounded numbers | Escalated | Cost | Wall |
|---|---|---|:-:|:-:|:-:|:-:|:-:|--:|--:|
| 01-add-nullable-column | SAFE | SAFE | ✓ | – | ✓ | 1/1 |  | $0.01 | 3s |
| 02-create-index-concurrently | SAFE | SAFE | ✓ | – | ✓ | 2/2 |  | $0.01 | 8s |
| 03-add-fk-not-valid | SAFE | SAFE | ✓ | – | ✓ | 1/1 |  | $0.01 | 5s |
| 04-add-column-volatile-default | UNSAFE/LOCK_BLOCKING | UNSAFE/LOCK_BLOCKING | ✓ | ✓ proven | ✓ | 1/1 |  | $0.01 | 7s |
| 05-alter-column-type | UNSAFE/LOCK_BLOCKING | UNSAFE/LOCK_BLOCKING | ✓ | ✓ proven | ✓ | 1/1 |  | $0.02 | 11s |
| 06-create-index-plain | UNSAFE/LOCK_BLOCKING | UNSAFE/LOCK_BLOCKING | ✓ | ✓ proven | ✓ | 1/1 |  | $0.01 | 4s |
| 07-backfill-single-transaction | UNSAFE/LONG_TRANSACTION | UNSAFE/LONG_TRANSACTION | ✓ | ✓ proven | ✓ | 0/0 |  | $0.01 | 6s |
| 08-drop-column | UNSAFE/DATA_LOSS | UNSAFE/DATA_LOSS | ✓ | – | ✓ | 0/0 |  | $0.01 | 6s |
| 09-narrow-varchar | UNSAFE/DATA_LOSS | UNSAFE/DATA_LOSS | ✓ | – | ✓ | 0/0 |  | $0.02 | 12s |
| 10-add-fk-validated-inline | UNSAFE/CONSTRAINT_SCAN | UNSAFE/CONSTRAINT_SCAN | ✓ | ✓ proven | ✓ | 0/0 |  | $0.01 | 5s |
| 11-drop-unused-index | UNSAFE/QUERY_REGRESSION | UNSAFE/QUERY_REGRESSION | ✓ | ✓ proven | ✓ | 1/1 |  | $0.01 | 12s |
| 12-index-not-used-by-query | UNSAFE/QUERY_REGRESSION | UNSAFE/QUERY_REGRESSION | ✓ | ✓ proven | ✓ | 1/1 |  | $0.02 | 13s |
| 13-add-column-stable-default | SAFE | UNSAFE/LOCK_BLOCKING | ✗ | – | ✗ | 1/1 |  | $0.02 | 12s |
| 14-narrow-varchar-fits | SAFE | SAFE | ✓ | – | ✓ | 1/1 |  | $0.02 | 14s |
| 15-set-not-null-with-nulls | UNSAFE/DATA_LOSS | UNSAFE/DATA_LOSS | ✓ | – | ✓ | 0/0 |  | $0.02 | 12s |
| 16-set-not-null-no-nulls | SAFE | SAFE | ✓ | – | ✓ | 0/0 |  | $0.01 | 7s |
| 17-drop-index-unused | SAFE | UNSAFE/LOCK_BLOCKING | ✗ | – | ✗ | 0/0 |  | $0.01 | 7s |

**Actionable 15/17 = 88%** · verdict accuracy 15/17 · fixes proven 7/7 · false verification claims 1 · grounded numbers 11/11 (0 reviews cite unmeasured numbers) · escalated 0 · total $0.20 · mean $0.01 · mean 8s/case
