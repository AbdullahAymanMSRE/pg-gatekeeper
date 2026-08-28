import { readFileSync } from "node:fs";

/**
 * Loads KEY=VALUE lines from ./.env into process.env, overriding existing values.
 * Overriding on purpose: a stale ANTHROPIC_API_KEY in a shell profile must not
 * silently win over the key the reproducer put in .env.
 */
export function loadDotenv(file = ".env"): void {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return;
  }
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}
