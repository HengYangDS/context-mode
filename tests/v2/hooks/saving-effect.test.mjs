// tests/v2/hooks/saving-effect.test.mjs
// Spec: docs/v2/adr/0020-hooks-and-skills-on-every-agent.md decision 4 and the "Saving" column. Per host, the
// dispatch uses the strongest effect the host allows: replace (R) on claude-code and pi; deny + redirect (D) to
// the ctx tool on PreToolUse everywhere else. One effect per host, no fallback.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { ADAPTERS, getAdapter, hasReplace } from "../../../src/adapters/table.ts";
import { decide } from "../../../src/core/policy/decide.ts";

const SAVING = {
  "claude-code": "R", codex: "D", gemini: "D", qwen: "D", "copilot-cli": "D",
  vscode: "D", kiro: "D", zcode: "D", pi: "R", opencode: "D",
};
const CURL = "curl -s https://x.io/a.json";

test("ADR-0020: every row has exactly one saving effect and it matches the ADR table", () => {
  assert.deepEqual(ADAPTERS.map((r) => r.id).sort(), Object.keys(SAVING).sort());
  for (const r of ADAPTERS) assert.equal(hasReplace(r) ? "R" : "D", SAVING[r.id], r.id);
});

for (const id of Object.keys(SAVING)) {
  test(`ADR-0020: ${id} saving decision for a large-output shell call is ${SAVING[id]}`, async (t) => {
    const dir = mkdtempSync(path.join(tmpdir(), "cm-saving-"));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const row = getAdapter(id);
    const ev = { event: "PreToolUse", agent: id, sessionId: "s1", cwd: dir,
      tool: { name: "Bash", canonicalName: "Bash", input: { command: CURL } } };
    const d = decide(ev, row, []);
    if (SAVING[id] === "R") {
      assert.notEqual(d.kind, "deny", id + ": a replace host runs the call and replaces the output after");
      return;
    }
    assert.equal(d.kind, "deny", id);
    assert.ok(d.reason.includes(row.toolNamePrefix + "ctx_execute"), id + " redirect names " + row.toolNamePrefix + "ctx_execute");
    const mod = await import(`../../../src/adapters/${id}.ts`);
    const out = mod.encode(ev, d);
    const blocks = out.exitCode === 2 || /deny|block/i.test(out.stdout);
    assert.ok(blocks, id + " encode blocks the call: " + JSON.stringify(out).slice(0, 200));
    assert.ok(out.stdout.includes("ctx_execute"), id + " the host sees the redirect");
  });
}

// D-HA-GEMINI-NAMES-1: a real Gemini BeforeTool payload (native run_shell_command) reaches the shell rules and is denied
// with the redirect, so the large output never enters the model.
test("ADR-0020: gemini BeforeTool run_shell_command with a large-output call is denied with the redirect", async (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "cm-saving-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const row = getAdapter("gemini");
  const ev = row.decode({ session_id: "s1", transcript_path: "/tmp/t.json", cwd: dir, hook_event_name: "BeforeTool",
    timestamp: "2026-10-25T00:00:00.000Z", tool_name: "run_shell_command", tool_input: { command: CURL } });
  const d = decide(ev, row, []);
  assert.equal(d.kind, "deny");
  const out = row.encode(ev, d);
  assert.equal(JSON.parse(out.stdout).decision, "deny");
  assert.ok(out.stdout.includes(row.toolNamePrefix + "ctx_execute"));
});
