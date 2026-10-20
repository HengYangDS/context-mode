// PORT of tests/adapters/{codex,gemini-cli,kiro,qwen-code}-external-mcp-routing.test.ts (#529), cleanup-plan W1-adapters.
// v1 asserted an EXTERNAL_MCP_MATCHER_PATTERN in each hook config so another server's large output was routed.
// v2 (ADR-0008 table row "other MCP servers", D-M7-RR-2): the host matcher lists only the agent's native tools and
// its own ctx_* tools; another server's tool is decoded to mcp:<server>:<tool> and decide() allows it with no hint.
import { test } from "node:test";
import assert from "node:assert/strict";

import { buildMatcher } from "../../../build/manifests.ts";
import { getAdapter } from "../../../src/adapters/table.ts";
import { decide } from "../../../src/core/policy/decide.ts";
import { decode as decodeCodex } from "../../../src/adapters/codex.ts";
import { decode as decodeQwen } from "../../../src/adapters/qwen.ts";
import { decode as decodeKiro } from "../../../src/adapters/kiro.ts";
import { decode as decodeGemini } from "../../../src/adapters/gemini.ts";

const cwd = "/tmp/proj";
const claudeShape = { session_id: "s-1", transcript_path: null, cwd, model: "m", permission_mode: "default" };

test("#529 codex: another server's tool decodes to mcp:<server>:<tool>; decide allows, no hint", () => {
  const ev = decodeCodex({ ...claudeShape, turn_id: "t1", hook_event_name: "PreToolUse", tool_name: "mcp__slack__list_channels", tool_input: {} });
  assert.equal(ev.tool.canonicalName, "mcp:slack:list_channels");
  assert.deepEqual(decide(ev, getAdapter("codex"), []), { kind: "allow" });
});

test("#529 qwen: another server's tool decodes to mcp:<server>:<tool>; decide allows, no hint", () => {
  const ev = decodeQwen({ ...claudeShape, hook_event_name: "PreToolUse", tool_name: "mcp__notion__query_database", tool_input: {} });
  assert.equal(ev.tool.canonicalName, "mcp:notion:query_database");
  assert.deepEqual(decide(ev, getAdapter("qwen"), []), { kind: "allow" });
});

test("#529 kiro: another server's tool decodes to mcp:<server>:<tool>; decide allows, no hint", () => {
  const ev = decodeKiro({ session_id: "k-1", cwd, hook_event_name: "PreToolUse", tool_name: "mcp_gdrive_search", tool_input: {} });
  assert.equal(ev.tool.canonicalName, "mcp:gdrive:search");
  assert.deepEqual(decide(ev, getAdapter("kiro"), []), { kind: "allow" });
});

test("#529 gemini: another server's tool is read from mcp_context; decide allows, no hint", () => {
  const ev = decodeGemini({
    session_id: "g-1", cwd, hook_event_name: "BeforeTool", tool_name: "mcp_telegram_list_messages", tool_input: {},
    mcp_context: { server_name: "telegram", tool_name: "list_messages" },
  });
  assert.equal(ev.tool.canonicalName, "mcp:telegram:list_messages");
  assert.deepEqual(decide(ev, getAdapter("gemini"), []), { kind: "allow" });
});

test("#529 host matcher: own ctx_* tools and native tools match; another server's tool does not (no v1 mcp__ catch-all)", () => {
  for (const [id, own, external] of [
    ["codex", "mcp__context_mode__ctx_execute", "mcp__slack__list_channels"],
    ["qwen", "mcp__context-mode__ctx_execute", "mcp__telegram__list_messages"],
    ["claude-code", "mcp__plugin_context-mode_context-mode__ctx_execute", "mcp__gdrive__search"],
  ]) {
    const re = new RegExp(buildMatcher(getAdapter(id)));
    assert.equal(re.test(own), true, id + " own");
    assert.equal(re.test(external), false, id + " external");
    assert.equal(re.test("Bash") || re.test("run_shell_command"), true, id + " native shell");
  }
});
