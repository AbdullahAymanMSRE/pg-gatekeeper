import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { Case, CaseQuery } from "../harness/types.js";

const CaseMetaSchema = z.object({
  title: z.string(),
  writerTables: z.array(
    z.object({
      table: z.string(),
      keyColumn: z.string(),
      updateColumn: z.string(),
      updateExpr: z.string(),
      keyMax: z.number().int().positive(),
    }),
  ),
});

/**
 * Reads a Case directory:
 *   case.json, schema.sql, seed.sql, migration.sql, queries/<name>.sql[, <name>.after.sql]
 */
export async function loadCase(dir: string): Promise<Case> {
  const read = (f: string) => readFile(path.join(dir, f), "utf8");
  const meta = CaseMetaSchema.parse(JSON.parse(await read("case.json")));
  const [schemaSql, seedSql, migrationSql] = await Promise.all([
    read("schema.sql"),
    read("seed.sql"),
    read("migration.sql"),
  ]);

  const queriesDir = path.join(dir, "queries");
  const files = (await readdir(queriesDir).catch(() => [])).filter((f) => f.endsWith(".sql")).sort();
  const queries: CaseQuery[] = [];
  for (const f of files) {
    if (f.endsWith(".after.sql")) continue;
    const name = f.slice(0, -".sql".length);
    const before = await readFile(path.join(queriesDir, f), "utf8");
    const afterFile = `${name}.after.sql`;
    const q: CaseQuery = { name, before };
    if (files.includes(afterFile)) q.after = await readFile(path.join(queriesDir, afterFile), "utf8");
    queries.push(q);
  }

  return {
    id: path.basename(path.resolve(dir)),
    title: meta.title,
    schemaSql,
    seedSql,
    migrationSql,
    queries,
    writerTables: meta.writerTables,
  };
}
