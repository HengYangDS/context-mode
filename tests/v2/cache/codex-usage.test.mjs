// Codex cache-usage analysis (docs/v2/spikes/cache). Pure: no spawn, no network.
// Codex reports input_tokens (which INCLUDES cached_input_tokens) and no cache write count, so the
// definitions map as: cache_read = cached, cache_creation = input - cached, uncached "input" = 0.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseExecJson, requestsFromRollout, findBreaks, hitRatio, crossSessionRead } from "../../../e2e/live/cache/codex.mjs";

const ev = (o) => JSON.stringify(o);

test("parseExecJson: thread id, one usage row per turn.completed, agent text kept", () => {
  const out = [
    ev({ type: "thread.started", thread_id: "t-1" }),
    ev({ type: "turn.started" }),
    ev({ type: "item.completed", item: { id: "i0", type: "agent_message", text: "ok" } }),
    ev({ type: "turn.completed", usage: { input_tokens: 100, cached_input_tokens: 40, cache_write_input_tokens: 0, output_tokens: 5 } }),
  ].join("\n") + "\n";
  const r = parseExecJson(out);
  assert.equal(r.threadId, "t-1");
  assert.equal(r.turns.length, 1);
  assert.deepEqual(r.turns[0].usage, { input: 100, cached: 40, output: 5 });
  assert.equal(r.finalText, "ok");
});

test("parseExecJson: a line that is not JSON is an error, not skipped", () => {
  assert.throws(() => parseExecJson("not json\n"), /not JSON/);
});

test("hitRatio: cached / input for one usage row; 0 when input is 0", () => {
  assert.equal(hitRatio({ input: 200, cached: 150, output: 1 }), 0.75);
  assert.equal(hitRatio({ input: 0, cached: 0, output: 0 }), 0);
});

test("requestsFromRollout: token_usage_record rows in ordinal order with turn id", () => {
  const lines = [
    { ordinal: 20, type: "token_usage_record", payload: { turn_id: "a", usage: { input_tokens: 300, cached_input_tokens: 128, output_tokens: 4 } } },
    { ordinal: 3, type: "session_meta", payload: {} },
    { ordinal: 6, type: "token_usage_record", payload: { turn_id: "a", usage: { input_tokens: 200, cached_input_tokens: 0, output_tokens: 9 } } },
    { ordinal: 30, type: "token_usage_record", payload: { turn_id: "b", usage: { input_tokens: 500, cached_input_tokens: 256, output_tokens: 2 } } },
  ].map(ev).join("\n");
  assert.deepEqual(requestsFromRollout(lines), [
    { turnId: "a", input: 200, cached: 0, output: 9 },
    { turnId: "a", input: 300, cached: 128, output: 4 },
    { turnId: "b", input: 500, cached: 256, output: 2 },
  ]);
});

test("findBreaks: a break is old prefix written again: prev input - cached > 1024", () => {
  const reqs = [
    { turnId: "a", input: 10000, cached: 0, output: 10 },
    { turnId: "a", input: 12000, cached: 9984, output: 10 },   // prefix mostly read: no break
    { turnId: "b", input: 15000, cached: 4096, output: 10 },   // 12000 - 4096 = 7904 > 1024: break
    { turnId: "b", input: 15500, cached: 14976, output: 10 },  // 15000 - 14976 = 24: no break
  ];
  const b = findBreaks(reqs);
  assert.equal(b.length, 1);
  assert.deepEqual(b[0], { index: 2, turnId: "b", rewritten: 7904 });
});

test("findBreaks: exactly 1024 is not a break; the first request never is", () => {
  assert.deepEqual(findBreaks([{ turnId: "a", input: 5000, cached: 0, output: 1 }]), []);
  const r = [{ turnId: "a", input: 5000, cached: 0, output: 1 }, { turnId: "a", input: 6000, cached: 3976, output: 1 }];
  assert.deepEqual(findBreaks(r), []);
});

test("crossSessionRead: second session's first-request cached over first session's first-request input", () => {
  const a = [{ turnId: "a", input: 14000, cached: 0, output: 3 }];
  const b = [{ turnId: "b", input: 14100, cached: 13952, output: 3 }];
  const r = crossSessionRead(a, b);
  assert.equal(r.cachedB, 13952);
  assert.equal(r.prefixA, 14000);
  assert.ok(Math.abs(r.fraction - 13952 / 14000) < 1e-12);
});
