# gatekeeper · run iter3-full-pipeline
model `claude-sonnet-5` · prompts baseline@94ec0e2dee26, planner@6f0917989378, executor@9aa59328a180, verifier@523587b76e1c · 2026-08-28T18:28:55.894Z

| Case | Label | Got | Verdict | Fix (harness-proven) | Actionable | Grounded numbers | Escalated | Cost | Wall |
|---|---|---|:-:|:-:|:-:|:-:|:-:|--:|--:|
| 01-add-nullable-column | SAFE | SAFE | ✓ | – | ✓ | 6/6 |  | $0.05 | 46s |
| 02-create-index-concurrently | SAFE | SAFE | ✓ | – | ✓ | 4/4 |  | $0.05 | 51s |
| 03-add-fk-not-valid | SAFE | SAFE | ✓ | – | ✓ | 4/4 |  | $0.05 | 59s |
| 04-add-column-volatile-default | UNSAFE/LOCK_BLOCKING | UNSAFE/LOCK_BLOCKING | ✓ | ✓ proven | ✓ | 4/4 |  | $0.10 | 101s |
| 05-alter-column-type | UNSAFE/LOCK_BLOCKING | UNSAFE/LOCK_BLOCKING | ✓ | ✓ proven | ✓ | 1/1 |  | $0.19 | 168s |
| 06-create-index-plain | UNSAFE/LOCK_BLOCKING | UNSAFE/LOCK_BLOCKING | ✓ | ✓ proven | ✓ | 1/1 |  | $0.05 | 57s |
| 07-backfill-single-transaction | UNSAFE/LONG_TRANSACTION | UNSAFE/LONG_TRANSACTION | ✓ | ✓ proven | ✓ | 0/0 |  | $0.06 | 86s |
| 08-drop-column | UNSAFE/DATA_LOSS | UNSAFE/DATA_LOSS | ✓ | – | ✓ | 5/5 |  | $0.11 | 107s |
| 09-narrow-varchar | UNSAFE/DATA_LOSS | UNSAFE/DATA_LOSS | ✓ | – | ✓ | 0/0 |  | $0.11 | 117s |
| 10-add-fk-validated-inline | UNSAFE/CONSTRAINT_SCAN | UNSAFE/CONSTRAINT_SCAN | ✓ | ✓ proven | ✓ | 1/1 |  | $0.07 | 65s |
| 11-drop-unused-index | UNSAFE/QUERY_REGRESSION | UNSAFE/QUERY_REGRESSION | ✓ | ✗ | ✗ | 4/4 |  | $0.08 | 71s |
| 12-index-not-used-by-query | UNSAFE/QUERY_REGRESSION | UNSAFE/QUERY_REGRESSION | ✓ | ✓ proven | ✓ | 4/4 |  | $0.06 | 92s |
| 13-add-column-stable-default | SAFE | SAFE | ✓ | – | ✓ | 4/4 |  | $0.07 | 71s |
| 14-narrow-varchar-fits | SAFE | SAFE | ✓ | – | ✓ | 5/5 |  | $0.06 | 67s |
| 15-set-not-null-with-nulls | UNSAFE/DATA_LOSS | UNSAFE/DATA_LOSS | ✓ | – | ✓ | 4/4 | yes | $0.35 | 360s |
| 16-set-not-null-no-nulls | SAFE | SAFE | ✓ | – | ✓ | 4/4 |  | $0.05 | 53s |
| 17-drop-index-unused | SAFE | SAFE | ✓ | – | ✓ | 5/5 |  | $0.05 | 69s |

**Actionable 16/17 = 94%** · verdict accuracy 17/17 · fixes proven 6/7 · false verification claims 0 · grounded numbers 56/56 (0 reviews cite unmeasured numbers) · escalated 1 · total $1.56 · mean $0.09 · mean 96s/case
