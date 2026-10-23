// bench/m2/score.mjs: transcript parsing and oracle-gated M2 scoring (pure, no live session).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseTranscript, oracle, scoreRows, normalizeNumbers, toolKey } from "../../../bench/m2/score.mjs";
import { TASKS as HELDOUT } from "../../../bench/m2/heldout/tasks.mjs";
import { TASKS as MAIN } from "../../../bench/m2/main/tasks.mjs";

const line = (o) => JSON.stringify(o);
const T = [
  line({ type: "assistant", message: { content: [{ type: "tool_use", id: "a", name: "Read" }, { type: "tool_use", id: "b", name: "mcp__tix__list" }, { type: "tool_use", id: "c", name: "mcp__plugin_context-mode_context-mode__ctx_search" }] } }),
  line({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "a", content: "héllo" }, { type: "tool_result", tool_use_id: "b", content: [{ type: "text", text: "abc" }, { type: "image" }] }] } }),
  line({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "a", content: "dup ignored" }, { type: "tool_result", tool_use_id: "c", content: "12" }] } }),
  line({ type: "system", subtype: "hook_response", stdout: line({ hookSpecificOutput: { additionalContext: "xyz" } }) }),
  "not json",
  line({ type: "result", result: "total 1,234", is_error: false }),
].join("\n");

test("parseTranscript: UTF-8 bytes per tool, first result per id, hook context bytes", () => {
  const t = parseTranscript(T);
  assert.deepEqual(t.perTool, { Read: { calls: 1, bytes: 6 }, "mcp:other": { calls: 1, bytes: 3 }, ctx_search: { calls: 1, bytes: 2 } });
  assert.equal(t.bytes, 11);
  assert.equal(t.hookBytes, 3);
  assert.equal(t.calls, 3);
  assert.equal(toolKey("Bash"), "Bash");
});

test("oracle: every expect string, thousands separators read as digits, errors fail", () => {
  const res = parseTranscript(T).res;
  assert.equal(oracle(res, ["1234"]), true);
  assert.equal(oracle(res, ["1234", "nope"]), false);
  assert.equal(oracle({ ...res, is_error: true }, ["1234"]), false);
  assert.equal(oracle(null, []), false);
  assert.equal(normalizeNumbers("1,234,567 and 1,23 and a,123"), "1234567 and 1,23 and a,123");
});

test("scoreRows: failed v2 run never adds saving; no passing off run makes the workload invalid", () => {
  const rows = [
    { task: "x", arm: "off", ok: true, bytes: 1000 }, { task: "x", arm: "off", ok: false, bytes: 10 }, { task: "x", arm: "off", ok: true, bytes: 1000 },
    { task: "x", arm: "v2", ok: true, bytes: 100 }, { task: "x", arm: "v2", ok: false, bytes: 50 }, { task: "x", arm: "v2", ok: true, bytes: 200 },
    { task: "y", arm: "off", ok: false, bytes: 1000 }, { task: "y", arm: "v2", ok: true, bytes: 1 },
  ];
  const s = scoreRows(rows, ["x", "y"]);
  assert.equal(s.perTask[0].savingPct, 80); // runs 90, 0 (failed), 80 -> median 80
  assert.equal(s.perTask[1].savingPct, null);
  assert.deepEqual(s.invalid, ["y"]);
  assert.equal(s.score, 80);
});

test("heldout: at least 6 workloads, ids distinct from main, deterministic fixtures with an oracle", () => {
  assert.ok(HELDOUT.length >= 6);
  assert.equal(MAIN.length, 4);
  const mainIds = new Set(MAIN.map((t) => t.id));
  for (const t of HELDOUT) {
    assert.ok(!mainIds.has(t.id), t.id);
    const build = () => {
      const d = fs.mkdtempSync(path.join(os.tmpdir(), "m2h-")); let page = null;
      try { const b = t.build(d, { url: "http://127.0.0.1:1/p", serve: (_, body) => { page = body; } }); return { ...b, page }; } finally { fs.rmSync(d, { recursive: true, force: true }); }
    };
    const a = build(), b = build();
    assert.ok(a.expect.length > 0 && a.expect.every((e) => typeof e === "string" && e.length > 0), t.id);
    assert.deepEqual(a, b, t.id + " deterministic");
  }
});
