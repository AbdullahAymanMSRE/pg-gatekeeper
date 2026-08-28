import { describe, expect, test } from "vitest";
import { loadCase } from "./load.js";

describe("loadCase", () => {
  test("reads a case directory into a Case", async () => {
    const c = await loadCase("cases/01-add-nullable-column");
    expect(c.id).toBe("01-add-nullable-column");
    expect(c.title).toBe("Add a nullable column to orders");
    expect(c.migrationSql.trim()).toBe("ALTER TABLE orders ADD COLUMN coupon_code text;");
    expect(c.schemaSql).toContain("CREATE TABLE orders");
    expect(c.seedSql).toContain("generate_series(1, 1000000)");
    expect(c.writerTables.map((w) => w.table)).toEqual(["customers", "orders"]);
    expect(c.queries).toEqual([
      {
        name: "recent_orders_for_customer",
        before: "SELECT id, status, total_cents FROM orders WHERE customer_id = 1234 ORDER BY created_at DESC LIMIT 20;\n",
      },
    ]);
  });

  test("a query with a .after.sql sibling gets an after version", async () => {
    const c = await loadCase("src/cases/fixtures/with-after-query");
    expect(c.queries).toEqual([{ name: "search", before: "SELECT 1;\n", after: "SELECT 2;\n" }]);
  });
});
