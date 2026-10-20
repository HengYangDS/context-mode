// impl/10 §2 + shared decode/encode pseudocode; ADR-0001 (Claude Code is the reference contract).
// Also exports the Claude-shape decode/encode that codex.ts instantiates with its own fields (impl/10 §3).
import type { AgentId } from "../core/contracts/agents.ts";
import { PERSISTED_READ_MAX_BYTES } from "../core/contracts/constants.ts";
import type { CanonicalEventName, CanonicalHookEvent, Decision, HookOutput, ToolCall, ToolResultInfo } from "../core/contracts/types.ts";

export const TOOL_NAME_PREFIX = "mcp__plugin_context-mode_context-mode__"; // impl/10 §1.3, TECH-SPEC §3.8 (plugin install)

const CLAUDE_SHAPE_EVENTS: readonly CanonicalEventName[] = ["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse"]; // impl/10 §1.4
const MCP_PREFIX = "mcp__";
const MCP_SEP = "__";

type Source = NonNullable<CanonicalHookEvent["source"]>;
const CLAUDE_SOURCES: Readonly<Record<string, Source>> = { startup: "startup", resume: "resume", clear: "clear", compact: "compact" };

// Own tool -> bare ctx_* name; mcp__<server>__<tool> -> "mcp:<server>:<tool>"; native names unchanged (impl/01 §2).
function canonicalName(name: string, ownPrefix: string): string {
  if (name.startsWith(ownPrefix)) return name.slice(ownPrefix.length);
  if (!name.startsWith(MCP_PREFIX)) return name;
  const rest = name.slice(MCP_PREFIX.length);
  const sep = rest.indexOf(MCP_SEP);
  if (sep < 0) return name;
  return "mcp:" + rest.slice(0, sep) + ":" + rest.slice(sep + MCP_SEP.length);
}

// D-M7-RR-1: a Bash tool_response {stdout, stderr, ...} is read as the output the model sees (stdout, then
// stderr on its own line), so the replace selects and indexes plain lines, not one escaped JSON string.
function outputOf(resp: unknown): string {
  if (resp === undefined) return "";
  if (typeof resp === "string") return resp;
  if (typeof resp === "object" && resp !== null) {
    const r = resp as { stdout?: unknown; stderr?: unknown };
    if (typeof r.stdout === "string") {
      const err = typeof r.stderr === "string" ? r.stderr : "";
      return err === "" ? r.stdout : r.stdout === "" ? err : r.stdout + "\n" + err;
    }
  }
  return JSON.stringify(resp);
}

// D-M7-SV-7: over its persist threshold (about 30000 chars) Claude Code gives the hook only the head of
// stdout and writes the whole output to persistedOutputPath (persistedOutputSize bytes). The replace must
// select from the whole output, or a line past the head can never be returned. The file is read only when
// its size equals persistedOutputSize and is at most PERSISTED_READ_MAX_BYTES; else the stdout as received.
function persistedOf(resp: unknown): string | null {
  if (typeof resp !== "object" || resp === null) return null;
  const r = resp as { persistedOutputPath?: unknown; persistedOutputSize?: unknown };
  if (typeof r.persistedOutputPath !== "string" || typeof r.persistedOutputSize !== "number") return null;
  if (r.persistedOutputSize > PERSISTED_READ_MAX_BYTES) return null;
  try {
    const fs = process.getBuiltinModule("node:fs") as typeof import("node:fs");
    const buf = fs.readFileSync(r.persistedOutputPath);
    return buf.length === r.persistedOutputSize ? buf.toString("utf8") : null;
  } catch {
    return null;
  }
}

function readResult(resp: unknown): ToolResultInfo {
  const text = persistedOf(resp) ?? outputOf(resp);
  const isError = typeof resp === "object" && resp !== null && (resp as { is_error?: unknown }).is_error === true;
  return { isError, bytes: Buffer.byteLength(text), text };
}

export function decodeClaudeShape(raw: unknown, agent: AgentId, ownPrefix: string, sources: Readonly<Record<string, Source>>): CanonicalHookEvent {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error(agent + ": hook payload is not a JSON object");
  const p = raw as Record<string, unknown>;
  const event = CLAUDE_SHAPE_EVENTS.find((e) => e === p.hook_event_name);
  if (event === undefined) throw new Error(agent + ": unknown hook event " + String(p.hook_event_name));
  const ev: CanonicalHookEvent = { event, agent, sessionId: String(p.session_id ?? ""), cwd: String(p.cwd ?? "") };
  if (typeof p.agent_id === "string") {
    ev.agentId = p.agent_id;
    if (typeof p.agent_type === "string") ev.agentType = p.agent_type;
  }
  if (event === "SessionStart" && typeof p.source === "string" && sources[p.source] !== undefined) ev.source = sources[p.source];
  if (event === "UserPromptSubmit" && typeof p.prompt === "string") ev.prompt = p.prompt;
  if (event === "PreToolUse" || event === "PostToolUse") {
    const name = String(p.tool_name ?? "");
    const input = typeof p.tool_input === "object" && p.tool_input !== null ? (p.tool_input as Record<string, unknown>) : {};
    const tool: ToolCall = { name, canonicalName: canonicalName(name, ownPrefix), input };
    if (typeof p.tool_use_id === "string" && p.tool_use_id !== "") tool.callId = p.tool_use_id;
    ev.tool = tool;
  }
  if (event === "PostToolUse") ev.result = readResult(p.tool_response);
  return ev;
}

// Deny exits 0: the reason travels in the JSON deny field, and Claude-shape hosts ignore stdout JSON on
// exit 2 (only stderr is read there; HookOutput has no stderr). DEVIATIONS D-M0-T8-1.
// D-M7-SV-1: Claude Code checks updatedToolOutput against the tool's own output schema and keeps the
// original output on a mismatch ("does not match Bash's output shape; using original output"). Bash
// output is an object {stdout, stderr, interrupted}, so a bare string never reached the model.
function replaceShape(ev: CanonicalHookEvent, output: string): unknown {
  return ev.tool?.canonicalName === "Bash" ? { stdout: output, stderr: "", interrupted: false } : output;
}

export function encodeClaudeShape(ev: CanonicalHookEvent, d: Decision, hasReplace: boolean): HookOutput {
  const out = (fields: Record<string, unknown>): HookOutput => ({
    stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: ev.event, ...fields } }),
    exitCode: 0,
  });
  switch (d.kind) {
    case "allow":
      return { stdout: "", exitCode: 0 };
    case "hint":
      return out({ additionalContext: d.text });
    case "deny":
      return out({ permissionDecision: "deny", permissionDecisionReason: d.rewritten === undefined ? d.reason : d.rewritten + "\n" + d.reason });
    case "replace":
      return hasReplace && ev.event === "PostToolUse" ? out({ updatedToolOutput: replaceShape(ev, d.output) }) : { stdout: "", exitCode: 0 };
  }
}

export function decode(raw: unknown): CanonicalHookEvent {
  return decodeClaudeShape(raw, "claude-code", TOOL_NAME_PREFIX, CLAUDE_SOURCES);
}

export function encode(ev: CanonicalHookEvent, d: Decision, _extra?: string): HookOutput {
  return encodeClaudeShape(ev, d, true);
}
