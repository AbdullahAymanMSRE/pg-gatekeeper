import { describe, expect, test } from "vitest";
import { splitStatements } from "./split.js";

describe("splitStatements", () => {
  test("splits on top-level semicolons and drops empties", () => {
    expect(splitStatements("ALTER TABLE a ADD COLUMN x int;\n\nCREATE INDEX i ON a(x);\n")).toEqual([
      "ALTER TABLE a ADD COLUMN x int",
      "CREATE INDEX i ON a(x)",
    ]);
  });

  test("ignores semicolons inside quotes, comments and dollar-quoted bodies", () => {
    const sql = `
-- a comment; with a semicolon
UPDATE t SET s = 'a;b';
DO $$ BEGIN PERFORM 1; END $$;
`;
    expect(splitStatements(sql)).toEqual(["UPDATE t SET s = 'a;b'", "DO $$ BEGIN PERFORM 1; END $$"]);
  });
});
