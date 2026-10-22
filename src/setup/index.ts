// src/setup/index.ts: the setup engine (ADR-0019 section 3), shared by setup, doctor and upgrade.
export { assertWritable, buildRegistry, hookCommandString, BACKUP_DIR, LOCK_FILE, STATE_DIR, INSTRUCTION_FILES } from "./registry.ts";
export type { CheckRow, SetupContext } from "./registry.ts";
export { runRemove, runSetup, OVERHEAD_P95_MS } from "./engine.ts";
export type { AgentResult, Check, SetupOptions, SetupResult } from "./engine.ts";
