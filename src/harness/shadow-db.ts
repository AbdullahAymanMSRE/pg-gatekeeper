import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import pg from "pg";
import type { Case } from "./types.js";

export const POSTGRES_IMAGE = "postgres:16";

export interface ShadowDb {
  connectionString: string;
  /** Opens a new session; caller must end() it. */
  connect(): Promise<pg.Client>;
  stop(): Promise<void>;
}

/**
 * A fresh, throwaway Postgres loaded with the Case's schema and seed (ADR-0003).
 */
export async function startShadowDb(c: Pick<Case, "schemaSql" | "seedSql">): Promise<ShadowDb> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(POSTGRES_IMAGE)
    .withDatabase("shadow")
    .withTmpFs({ "/var/lib/postgresql/data": "rw" })
    .withCommand(["postgres", "-c", "fsync=off", "-c", "synchronous_commit=off", "-c", "full_page_writes=off"])
    .start();
  const connectionString = container.getConnectionUri();
  const connect = async () => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    return client;
  };
  const admin = await connect();
  try {
    await admin.query(c.schemaSql);
    await admin.query(c.seedSql);
  } finally {
    await admin.end();
  }
  return {
    connectionString,
    connect,
    stop: () => container.stop().then(() => undefined),
  };
}
