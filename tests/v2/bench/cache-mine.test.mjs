// bench/cache/mine.mjs: per-turn prompt-cache accounting from raw Claude Code stream-json (pure parsing).
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSession, analyzeSession, percentile, armOf, workloadOf, summarize } from "../../../bench/cache/mine.mjs";

const j = (o) => JSON.stringify(o);
const usage = (i, cc, cr, out = 10) => ({ input_tokens: i, cache_creation_input_tokens: cc, cache_read_input_tokens: cr, output_tokens: out });
const asst = (id, u, extra = {}) => j({ type: "assistant", session_id: "s", timestamp: "2026-01-01T00:00:00Z", message: { id, usage: u }, ...extra });
const init = j({ type: "system", subtype: "init", session_id: "s", cwd: "/p", claude_code_version: "9.9.9", model: "m" });

test("parseSession: one turn per message id (last usage wins), sidechain skipped, version recorded", () => {
  const s = parseSession([init, asst("a", usage(2, 100, 0, 1)), asst("a", usage(2, 100, 0, 5)), asst("x", usage(1, 1, 1), { parent_tool_use_id: "t" }), "garbage", asst("b", usage(2, 50, 100))].join("\n"));
  assert.equal(s.version, "9.9.9");
  assert.equal(s.turns.length, 2);
  assert.equal(s.turns[0].out, 5);
  assert.equal(s.turns[0].kind, "first");
  assert.equal(s.turns[1].kind, "normal");
});

test("break rule: prior prefix not read back by more than 1024 tokens", () => {
  const s = parseSession([init, asst("a", usage(2, 5000, 0)), asst("b", usage(2, 300, 5000)), asst("c", usage(2, 4000, 0))].join("\n"));
  const r = analyzeSession(s);
  assert.deepEqual(r.turns.map((t) => t.break), [false, false, true]);
  assert.equal(r.turns[2].rewritten, 5302 - 2);
});

test("a rewrite of exactly 1024 is not a break", () => {
  const s = parseSession([init, asst("a", usage(0, 2000, 0)), asst("b", usage(0, 1100, 976))].join("\n"));
  assert.equal(analyzeSession(s).turns[1].rewritten, 1024);
  assert.equal(analyzeSession(s).turns[1].break, false);
});

test("compact turn is counted apart and never a normal break", () => {
  const cb = j({ type: "system", subtype: "compact_boundary", session_id: "s" });
  const s = parseSession([init, asst("a", usage(0, 9000, 0)), init, cb, asst("b", usage(0, 3000, 0)), asst("c", usage(0, 100, 3000))].join("\n"));
  const r = analyzeSession(s);
  assert.deepEqual(r.turns.map((t) => t.kind), ["first", "compact", "normal"]);
  assert.equal(r.turns[1].break, false);
  assert.equal(r.turns[1].rewritten, 9000);
});

test("resume (new init, no compact) is its own kind and is tested for breaks", () => {
  const s = parseSession([init, asst("a", usage(0, 5000, 0)), init, asst("b", usage(0, 5000, 0))].join("\n"));
  const r = analyzeSession(s);
  assert.equal(r.turns[1].kind, "resume");
  assert.equal(r.turns[1].break, true);
});

test("hit ratio = cr / (cr + cc + in)", () => {
  const s = parseSession([init, asst("a", usage(0, 100, 300))].join("\n"));
  assert.equal(analyzeSession(s).turns[0].hit, 0.75);
});

test("percentile is nearest rank; empty is null", () => {
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.5), 5);
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9), 9);
  assert.equal(percentile([], 0.5), null);
});

test("armOf and workloadOf read path segments", () => {
  assert.equal(armOf("compact-m2/du-units/main1/main-direct-cfg-a-0.jsonl"), "off");
  assert.equal(armOf("compact-m2/r3-merge/x/main-v2-tests-seed-0.jsonl"), "v2");
  assert.equal(armOf("m2/big-json-off-a.jsonl"), "off");
  assert.equal(armOf("tryit/large-json/transcripts/large-json-measured-1-1-plain.jsonl"), "off");
  assert.equal(armOf("tryit/large-json/transcripts/large-json-measured-1-1-gateway.jsonl"), "gateway");
  assert.equal(workloadOf("compact-m2/du-units/main1/a.jsonl"), "compact-m2/du-units");
  assert.equal(workloadOf("tryit/large-json/transcripts/a.jsonl"), "tryit/large-json");
  assert.equal(workloadOf("m2/a.jsonl"), "m2");
});

test("summarize: per arm and workload, breaks listed with path and turn", () => {
  const mk = (p, rows) => ({ path: p, session: analyzeSession(parseSession([init, ...rows].join("\n"))) });
  const out = summarize([
    mk("w/a/x-v2-0.jsonl", [asst("a", usage(0, 5000, 0)), asst("b", usage(0, 4000, 0))]),
    mk("w/a/x-off-0.jsonl", [asst("a", usage(0, 5000, 0)), asst("b", usage(0, 100, 5000))]),
  ]);
  assert.equal(out.arms.v2.total.breaks, 1);
  assert.equal(out.arms.off.total.breaks, 0);
  assert.deepEqual(out.arms.v2.breakList, [{ path: "w/a/x-v2-0.jsonl", turn: 2, rewritten: 5000 }]);
  assert.equal(out.arms.v2.byWorkload["w/a"].sessions, 1);
});

test("zero-usage assistant message (synthetic, no API call) is not a turn and never a break", () => {
  const s = parseSession([init, asst("a", usage(0, 5000, 0)), asst("b", usage(0, 300, 5000)), init, asst("z", usage(0, 0, 0)), asst("c", usage(0, 200, 5300))].join("\n"));
  const r = analyzeSession(s);
  assert.equal(r.turns.length, 3);
  assert.deepEqual(r.turns.map((t) => t.break), [false, false, false]);
});
