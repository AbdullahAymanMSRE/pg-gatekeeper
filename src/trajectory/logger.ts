import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export type Role = "baseline" | "planner" | "executor" | "verifier" | "orchestrator";

export type TrajectoryEvent =
  | { type: "instructions"; system: string; user: string }
  | { type: "assistant"; text: string; usage: Record<string, number | null | undefined> }
  | { type: "thinking"; text: string }
  | { type: "tool_call"; id: string; name: string; input: unknown }
  | { type: "tool_result"; id: string; name: string; ms: number; output: unknown }
  | { type: "rejection"; reason: string; round: number }
  | { type: "retry"; round: number }
  | { type: "escalation"; reason: string }
  | { type: "error"; message: string }
  | { type: "final"; output: unknown };

/**
 * Appends one JSONL line per event to trajectories/<run>/<case>/<role>.jsonl.
 * Every role on every Case gets its own file (deliverable 04).
 */
export class TrajectoryLogger {
  constructor(private readonly dir: string) {}

  static forCase(runId: string, caseId: string) {
    return new TrajectoryLogger(path.join("trajectories", runId, caseId));
  }

  async log(role: Role, event: TrajectoryEvent): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const line = JSON.stringify({ ts: new Date().toISOString(), role, ...event });
    await appendFile(path.join(this.dir, `${role}.jsonl`), line + "\n");
  }
}
