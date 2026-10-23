// src/setup/registry.ts
// ADR-0019 section 3: one check registry, built from src/adapters/table.ts, shared by setup, doctor and upgrade.
// Every write path is absolute and listed; every command is absolute node + absolute bundle file (never npx).
import path from "node:path";

import { ADAPTERS } from "../adapters/table.ts";
import { OWN_MCP_ENTRY, SERVER_KEY } from "../core/contracts/constants.ts";
import type { AgentId, AdapterRow, HostConfigFormat } from "../core/contracts/types.ts";

export const SERVER_BUNDLE = "server.mjs";
export const HOOK_BUNDLE = "hook.mjs";
export const AGENT_FLAG = "--agent";
export const STATE_DIR = ".context-mode";
export const LOCK_FILE = "setup.lock";
export const BACKUP_DIR = "backups";
const PLUGIN_ID = `${SERVER_KEY}@${SERVER_KEY}`;

// Routing-instruction files: setup never writes them, even if a row lists one by mistake (ADR-0019 section 3).
export const INSTRUCTION_FILES: readonly string[] = Object.freeze([
  "CLAUDE.md", "AGENTS.md", "AGENTS.override.md", "GEMINI.md", "QWEN.md", "copilot-instructions.md", "KIRO.md",
]);

export interface SetupContext { home: string; pkgDir: string; env: Record<string, string | undefined>; }

/** A config file setup edits itself: the exact diff is known before apply. */
export interface ConfigTarget { file: string; format: HostConfigFormat; key: readonly string[]; value: unknown; }

/** Host settings files that may hold v1 hook commands (S-V1). rewrite = setup owns the hooks (D4: absolute form);
 *  drop = the installed package ships its own hooks, so a v1 copy would run twice. */
export interface HookFile { file: string; mode: "rewrite" | "drop"; }

export interface CliPlan { bin: string; install: string[][]; remove: string[][]; }

export interface CheckRow {
  id: AgentId;
  installMode: AdapterRow["installMode"];
  serverCommand: string[];
  hookCommand?: string[];
  config?: ConfigTarget;
  cli?: CliPlan;
  listCommand?: { bin: string; args: string[] };
  hookFiles: HookFile[];
  allowedWrites: string[];
  goldenPayload: Record<string, unknown>;
}

function serverCmd(ctx: SetupContext, id: AgentId): string[] {
  return [process.execPath, path.join(ctx.pkgDir, SERVER_BUNDLE), AGENT_FLAG, id];
}

/** D4: the one v2 hook command string (quoted, so paths with spaces survive the host shell). */
export function hookCommandString(row: CheckRow): string {
  const [node, file, flag, id] = row.hookCommand ?? [];
  return `"${node}" "${file}" ${flag} ${id}`;
}

function golden(row: AdapterRow, home: string): Record<string, unknown> {
  const shell = row.nativeTools.shell?.[0];
  return {
    hook_event_name: row.eventMap.PreToolUse ?? "PreToolUse",
    session_id: "context-mode-setup-verify",
    cwd: home,
    tool_name: shell ?? "ctx_execute",
    tool_input: { command: "true" },
  };
}

function configFor(ctx: SetupContext, id: AgentId): ConfigTarget | undefined {
  const [node, server, flag, agent] = serverCmd(ctx, id);
  const own = OWN_MCP_ENTRY[id];
  if (own) {
    const file = path.join(ctx.home, ...own.file);
    const format: HostConfigFormat = file.endsWith(".toml") ? "toml" : id === "vscode" ? "jsonc" : "json";
    return { file, format, key: own.key, value: { command: node, args: [server, flag, agent] } };
  }
  if (id === "opencode") { // docs/install/opencode.md: a local MCP entry in opencode.json
    return {
      file: path.join(ctx.home, ".config", "opencode", "opencode.json"), format: "json", key: ["mcp", SERVER_KEY],
      value: { type: "local", command: [node, server, flag, agent], enabled: true },
    };
  }
  return undefined;
}

function cliFor(ctx: SetupContext, id: AgentId): CliPlan | undefined {
  const s = serverCmd(ctx, id);
  switch (id) {
    case "claude-code":
      return { bin: "claude", install: [["plugin", "marketplace", "add", ctx.pkgDir], ["plugin", "install", PLUGIN_ID]], remove: [["plugin", "uninstall", PLUGIN_ID]] };
    case "gemini": return { bin: "gemini", install: [["extensions", "install", ctx.pkgDir, "--consent"]], remove: [["extensions", "uninstall", SERVER_KEY]] };
    case "qwen": return { bin: "qwen", install: [["extensions", "install", ctx.pkgDir, "--consent"]], remove: [["extensions", "uninstall", SERVER_KEY]] };
    case "copilot-cli": return { bin: "copilot", install: [["mcp", "add", SERVER_KEY, "--", ...s]], remove: [["mcp", "remove", SERVER_KEY]] };
    case "pi": return { bin: "pi", install: [["install", ctx.pkgDir]], remove: [["remove", ctx.pkgDir]] };
    default: return undefined;
  }
}

const LIST: Partial<Record<AgentId, { bin: string; args: string[] }>> = {
  "claude-code": { bin: "claude", args: ["plugin", "list"] },
  codex: { bin: "codex", args: ["mcp", "list"] },
  gemini: { bin: "gemini", args: ["extensions", "list"] },
  qwen: { bin: "qwen", args: ["extensions", "list"] },
  "copilot-cli": { bin: "copilot", args: ["mcp", "list"] },
  pi: { bin: "pi", args: ["list"] },
  opencode: { bin: "opencode", args: ["mcp", "list"] },
};

function hookFilesFor(home: string, id: AgentId): HookFile[] {
  switch (id) {
    case "codex": return [{ file: path.join(home, ".codex", "hooks.json"), mode: "rewrite" }];
    case "copilot-cli": return [{ file: path.join(home, ".copilot", "hooks", "context-mode.json"), mode: "rewrite" }];
    case "claude-code": return [{ file: path.join(home, ".claude", "settings.json"), mode: "drop" }];
    case "gemini": return [{ file: path.join(home, ".gemini", "settings.json"), mode: "drop" }];
    case "qwen": return [{ file: path.join(home, ".qwen", "settings.json"), mode: "drop" }];
    default: return [];
  }
}

export function buildRegistry(ctx: SetupContext): CheckRow[] {
  return ADAPTERS.map((row): CheckRow => {
    const id = row.id;
    const config = configFor(ctx, id);
    const hookFiles = hookFilesFor(ctx.home, id);
    const out: CheckRow = {
      id, installMode: row.installMode, serverCommand: serverCmd(ctx, id), config, cli: cliFor(ctx, id),
      listCommand: LIST[id], hookFiles,
      allowedWrites: [...(config ? [config.file] : []), ...hookFiles.map((h) => h.file)].map((f) => path.resolve(f)),
      goldenPayload: golden(row, ctx.home),
    };
    if (row.installMode !== "in-process") out.hookCommand = [process.execPath, path.join(ctx.pkgDir, HOOK_BUNDLE), AGENT_FLAG, id];
    return out;
  });
}

/** Allowlist guard: only the row's listed files, never an instruction file. */
export function assertWritable(row: CheckRow, file: string): void {
  const abs = path.resolve(file);
  if (INSTRUCTION_FILES.includes(path.basename(abs)) || !row.allowedWrites.includes(abs)) {
    throw new Error(`setup: write to ${abs} is not allowed for ${row.id}`);
  }
}
