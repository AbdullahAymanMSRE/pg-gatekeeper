# gatekeeper · run iter2-executor-verifier
model `claude-sonnet-5` · prompts baseline@94ec0e2dee26, planner@6f0917989378, executor@9aa59328a180, verifier@523587b76e1c · 2026-08-28T18:07:46.795Z

| Case | Label | Got | Verdict | Fix (harness-proven) | Actionable | Grounded numbers | Escalated | Cost | Wall |
|---|---|---|:-:|:-:|:-:|:-:|:-:|--:|--:|
| 01-add-nullable-column | SAFE | SAFE | ✓ | – | ✓ | 4/4 |  | $0.03 | 28s |
| 02-create-index-concurrently | SAFE | SAFE | ✓ | – | ✓ | 4/4 |  | $0.02 | 30s |
| 03-add-fk-not-valid | SAFE | SAFE | ✓ | – | ✓ | 4/4 |  | $0.02 | 28s |
| 04-add-column-volatile-default | UNSAFE/LOCK_BLOCKING | UNSAFE/LOCK_BLOCKING | ✓ | ✓ proven | ✓ | 5/5 |  | $0.25 | 192s |
| 05-alter-column-type | UNSAFE/LOCK_BLOCKING | UNSAFE/LOCK_BLOCKING | ✓ | ✓ proven | ✓ | 4/4 |  | $0.07 | 71s |
| 06-create-index-plain | UNSAFE/LOCK_BLOCKING | UNSAFE/LOCK_BLOCKING | ✓ | ✓ proven | ✓ | 1/1 |  | $0.03 | 40s |
| 07-backfill-single-transaction | UNSAFE/LONG_TRANSACTION | UNSAFE/LONG_TRANSACTION | ✓ | ✓ proven | ✓ | 2/2 |  | $0.04 | 56s |
| 08-drop-column | UNSAFE/DATA_LOSS | UNSAFE/DATA_LOSS | ✓ | – | ✓ | 2/2 |  | $0.10 | 104s |
| 09-narrow-varchar | UNSAFE/DATA_LOSS | UNSAFE/DATA_LOSS | ✓ | – | ✓ | 0/0 |  | $0.09 | 106s |
| 10-add-fk-validated-inline | UNSAFE/CONSTRAINT_SCAN | UNSAFE/CONSTRAINT_SCAN | ✓ | ✓ proven | ✓ | 2/2 |  | $0.04 | 43s |
| 11-drop-unused-index | UNSAFE/QUERY_REGRESSION | UNSAFE/QUERY_REGRESSION | ✓ | ✓ proven | ✓ | 6/7 |  | $0.04 | 49s |
| 12-index-not-used-by-query | UNSAFE/QUERY_REGRESSION | UNSAFE/QUERY_REGRESSION | ✓ | ✓ proven | ✓ | 4/4 |  | $0.04 | 57s |
| 13-add-column-stable-default | SAFE | SAFE | ✓ | – | ✓ | 4/4 |  | $0.03 | 34s |
| 14-narrow-varchar-fits | SAFE | SAFE | ✓ | – | ✓ | 2/2 |  | $0.02 | 29s |
| 15-set-not-null-with-nulls | UNSAFE/DATA_LOSS | UNSAFE/DATA_LOSS | ✓ | – | ✓ | 2/3 |  | $0.13 | 125s |
| 16-set-not-null-no-nulls | SAFE | SAFE | ✓ | – | ✓ | 4/4 |  | $0.02 | 30s |
| 17-drop-index-unused | SAFE | SAFE | ✓ | – | ✓ | 3/3 |  | $0.02 | 29s |

**Actionable 17/17 = 100%** · verdict accuracy 17/17 · fixes proven 7/7 · false verification claims 0 · grounded numbers 53/55 (2 reviews cite unmeasured numbers) · escalated 0 · total $1.00 · mean $0.06 · mean 62s/case
