# gatekeeper · run iter1-executor-only
model `claude-sonnet-5` · prompts baseline@94ec0e2dee26, planner@6f0917989378, executor@9aa59328a180, verifier@523587b76e1c · 2026-08-28T17:50:14.325Z

| Case | Label | Got | Verdict | Fix (harness-proven) | Actionable | Grounded numbers | Escalated | Cost | Wall |
|---|---|---|:-:|:-:|:-:|:-:|:-:|--:|--:|
| 04-add-column-volatile-default | UNSAFE/LOCK_BLOCKING | UNSAFE/LOCK_BLOCKING | ✓ | ✓ proven | ✓ | 5/5 |  | $0.04 | 40s |
| 01-add-nullable-column | SAFE | SAFE | ✓ | – | ✓ | 5/5 |  | $0.02 | 19s |
| 02-create-index-concurrently | SAFE | SAFE | ✓ | – | ✓ | 3/3 |  | $0.01 | 19s |
| 03-add-fk-not-valid | SAFE | SAFE | ✓ | – | ✓ | 4/4 |  | $0.01 | 20s |
| 05-alter-column-type | UNSAFE/LOCK_BLOCKING | UNSAFE/LOCK_BLOCKING | ✓ | ✓ proven | ✓ | 2/2 |  | $0.04 | 42s |
| 06-create-index-plain | UNSAFE/LOCK_BLOCKING | UNSAFE/LOCK_BLOCKING | ✓ | ✓ proven | ✓ | 1/1 |  | $0.02 | 26s |
| 07-backfill-single-transaction | UNSAFE/LONG_TRANSACTION | UNSAFE/LONG_TRANSACTION | ✓ | ✓ proven | ✓ | 2/2 |  | $0.02 | 42s |
| 08-drop-column | UNSAFE/DATA_LOSS | UNSAFE/DATA_LOSS | ✓ | – | ✓ | 2/2 |  | $0.02 | 21s |
| 09-narrow-varchar | UNSAFE/DATA_LOSS | UNSAFE/DATA_LOSS | ✓ | – | ✓ | 0/0 |  | $0.05 | 55s |
| 10-add-fk-validated-inline | UNSAFE/CONSTRAINT_SCAN | UNSAFE/CONSTRAINT_SCAN | ✓ | ✓ proven | ✓ | 3/3 |  | $0.02 | 27s |
| 11-drop-unused-index | UNSAFE/QUERY_REGRESSION | UNSAFE/QUERY_REGRESSION | ✓ | ✓ proven | ✓ | 4/4 |  | $0.02 | 32s |
| 12-index-not-used-by-query | UNSAFE/QUERY_REGRESSION | UNSAFE/QUERY_REGRESSION | ✓ | ✓ proven | ✓ | 4/4 |  | $0.02 | 37s |
| 13-add-column-stable-default | SAFE | SAFE | ✓ | – | ✓ | 4/4 |  | $0.01 | 15s |
| 14-narrow-varchar-fits | SAFE | SAFE | ✓ | – | ✓ | 4/4 |  | $0.01 | 16s |
| 15-set-not-null-with-nulls | UNSAFE/DATA_LOSS | UNSAFE/DATA_LOSS | ✓ | – | ✓ | 2/2 |  | $0.05 | 54s |
| 16-set-not-null-no-nulls | SAFE | SAFE | ✓ | – | ✓ | 4/4 |  | $0.01 | 16s |
| 17-drop-index-unused | SAFE | SAFE | ✓ | – | ✓ | 5/5 |  | $0.01 | 16s |

**Actionable 17/17 = 100%** · verdict accuracy 17/17 · fixes proven 7/7 · false verification claims 0 · grounded numbers 54/54 (0 reviews cite unmeasured numbers) · escalated 0 · total $0.39 · mean $0.02 · mean 29s/case
