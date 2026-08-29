# gatekeeper · run final
model `claude-sonnet-5` · prompts baseline@94ec0e2dee26, planner@6f0917989378, executor@9aa59328a180, verifier@523587b76e1c · 2026-08-29T04:31:38.138Z

| Case | Label | Got | Verdict | Fix (harness-proven) | Actionable | Grounded numbers | Escalated | Cost | Wall |
|---|---|---|:-:|:-:|:-:|:-:|:-:|--:|--:|
| 01-add-nullable-column | SAFE | SAFE | ✓ | – | ✓ | 4/4 |  | $0.03 | 31s |
| 02-create-index-concurrently | SAFE | SAFE | ✓ | – | ✓ | 4/4 |  | $0.02 | 28s |
| 03-add-fk-not-valid | SAFE | SAFE | ✓ | – | ✓ | 4/4 |  | $0.02 | 40s |
| 04-add-column-volatile-default | UNSAFE/LOCK_BLOCKING | UNSAFE/LOCK_BLOCKING | ✓ | ✓ proven | ✓ | 1/1 |  | $0.05 | 84s |
| 05-alter-column-type | UNSAFE/LOCK_BLOCKING | UNSAFE/LOCK_BLOCKING | ✓ | ✓ proven | ✓ | 4/4 |  | $0.07 | 68s |
| 06-create-index-plain | UNSAFE/LOCK_BLOCKING | UNSAFE/LOCK_BLOCKING | ✓ | ✓ proven | ✓ | 0/0 |  | $0.03 | 41s |
| 07-backfill-single-transaction | UNSAFE/LONG_TRANSACTION | UNSAFE/LONG_TRANSACTION | ✓ | ✓ proven | ✓ | 2/2 |  | $0.04 | 55s |
| 08-drop-column | UNSAFE/DATA_LOSS | UNSAFE/DATA_LOSS | ✓ | – | ✓ | 2/2 |  | $0.08 | 90s |
| 09-narrow-varchar | UNSAFE/DATA_LOSS | UNSAFE/DATA_LOSS | ✓ | – | ✓ | 2/2 |  | $0.06 | 68s |
| 10-add-fk-validated-inline | UNSAFE/CONSTRAINT_SCAN | UNSAFE/CONSTRAINT_SCAN | ✓ | ✓ proven | ✓ | 2/2 |  | $0.04 | 49s |
| 11-drop-unused-index | UNSAFE/QUERY_REGRESSION | UNSAFE/QUERY_REGRESSION | ✓ | ✓ proven | ✓ | 4/4 |  | $0.04 | 50s |
| 12-index-not-used-by-query | UNSAFE/QUERY_REGRESSION | UNSAFE/QUERY_REGRESSION | ✓ | ✓ proven | ✓ | 4/4 |  | $0.04 | 97s |
| 13-add-column-stable-default | SAFE | SAFE | ✓ | – | ✓ | 6/6 |  | $0.03 | 32s |
| 14-narrow-varchar-fits | SAFE | SAFE | ✓ | – | ✓ | 4/4 |  | $0.02 | 31s |
| 15-set-not-null-with-nulls | UNSAFE/DATA_LOSS | UNSAFE/DATA_LOSS | ✓ | – | ✓ | 1/1 |  | $0.05 | 70s |
| 16-set-not-null-no-nulls | SAFE | SAFE | ✓ | – | ✓ | 4/4 |  | $0.02 | 30s |
| 17-drop-index-unused | SAFE | SAFE | ✓ | – | ✓ | 3/3 |  | $0.02 | 36s |

**Actionable 17/17 = 100%** · verdict accuracy 17/17 · fixes proven 7/7 · false verification claims 0 · grounded numbers 51/51 (0 reviews cite unmeasured numbers) · escalated 0 · total $0.67 · mean $0.04 · mean 53s/case
