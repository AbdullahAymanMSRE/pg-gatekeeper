import { describe, expect, test } from "vitest";
import { loadCase } from "../cases/load.js";
import { simulate } from "./simulate.js";

// Real Postgres in Docker. No mocks: the harness IS the product.
describe("simulate", () => {
  test("a nullable ADD COLUMN completes without stalling the writer and keeps every row", async () => {
    const c = await loadCase("cases/01-add-nullable-column");
    const e = await simulate(c);
    expect(e.migrationError).toBeNull();
    expect(e.writerErrors).toBe(0);
    expect(e.writerAttempts).toBeGreaterThan(5);
    expect(e.writerMaxStallMs).toBeLessThan(1_000);
    expect(e.rowCountsAfter).toContainEqual({ table: "orders", rows: 200_000 });
    expect(e.droppedColumns).toEqual([]);
    expect(e.columnsAfter.some((col) => col.table === "orders" && col.column === "coupon_code")).toBe(true);
    expect(e.plans.map((p) => `${p.name}:${p.which}`)).toEqual([
      "recent_orders_for_customer:before",
      "recent_orders_for_customer:after",
    ]);
  });

  test("a migration that holds ACCESS EXCLUSIVE for 2s stalls the writer for ~2s and is seen in pg_locks", async () => {
    const c = await loadCase("cases/01-add-nullable-column");
    const e = await simulate({
      ...c,
      migrationSql: "BEGIN; LOCK TABLE orders IN ACCESS EXCLUSIVE MODE; SELECT pg_sleep(2); COMMIT;",
    });
    expect(e.migrationError).toBeNull();
    expect(e.writerMaxStallMs).toBeGreaterThan(1_500);
    expect(e.locks).toContainEqual({ table: "orders", mode: "AccessExclusiveLock" });
  });

  test("a migration that drops a column reports it and a failing one reports the error", async () => {
    const c = await loadCase("cases/01-add-nullable-column");
    const dropped = await simulate({ ...c, migrationSql: "ALTER TABLE orders DROP COLUMN notes;" });
    expect(dropped.droppedColumns).toEqual(["orders.notes"]);

    const failing = await simulate({ ...c, migrationSql: "ALTER TABLE orders ALTER COLUMN notes SET NOT NULL;" });
    expect(failing.migrationError).toMatch(/null values/);
  });

  test("narrowing a text column below its longest value is a lossy change", async () => {
    const c = await loadCase("cases/01-add-nullable-column");
    const e = await simulate({
      ...c,
      migrationSql: "ALTER TABLE customers ALTER COLUMN email TYPE varchar(12) USING left(email, 12);",
    });
    expect(e.migrationError).toBeNull();
    expect(e.lossyChanges).toEqual([
      { column: "customers.email", detail: expect.stringMatching(/varchar\(12\)/) },
    ]);
  });
});
