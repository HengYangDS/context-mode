// r3-ledger: line units (index/units.ts) and unit recall (compaction/recall.ts pickUnits).
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildUnits } from "../../../src/core/index/units.ts";
import { pickRecall, pickUnits, unitLine } from "../../../src/core/compaction/recall.ts";
import { RECALL_BUDGET_BYTES, RECALL_MIN_SCORE } from "../../../src/core/contracts/constants.ts";

test("[r3] units/json: a nested key keeps its parent lines, whole", () => {
  const text = JSON.stringify({ regions: { "us-east-1": { services: { ledger: { replicas: 0 } } } } }, null, 2);
  const u = buildUnits(text).find((x) => x.body.endsWith('"replicas": 0'));
  assert.ok(u);
  assert.deepEqual(u.body.split("\n").map((l) => l.trim()), ["{", '"regions": {', '"us-east-1": {', '"services": {', '"ledger": {', '"replicas": 0']);
});

test("[r3] units/tap: a diagnostic keeps its not ok line; a sibling test closes it", () => {
  const units = buildUnits("not ok 7 - parse dates\n  ---\n  message: bad tz\n  ...\nok 8 - next");
  assert.equal(units.find((u) => u.body.endsWith("message: bad tz")).body, "not ok 7 - parse dates\n  message: bad tz");
  assert.equal(units.find((u) => u.ord === 4).body, "ok 8 - next");
});

test("[r3] units/flat-log: each log line is its own unit; blank lines make none; ord is the line index", () => {
  const units = buildUnits("a 1\n\nb 2\r\nc 3");
  assert.deepEqual(units, [{ ord: 0, body: "a 1" }, { ord: 2, body: "b 2" }, { ord: 3, body: "c 3" }]);
});

test("[r3] units/222KB: one pass stays linear (2000-line log under 50 ms)", () => {
  const text = Array.from({ length: 2000 }, (_, i) => `2026-10-04T03:03:${i} INFO svc=gateway req=${i.toString(16)} latency=${i}ms GET /v1/users 200 ` + "x".repeat(80)).join("\n");
  const t0 = process.hrtime.bigint();
  const units = buildUnits(text);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.equal(units.length, 2000);
  assert.ok(ms < 50, String(ms));
});

const U = (ord, body, score, sourceId = 1) => ({ sourceId, ord, label: "bash:cat", body, score });

test("[r3] pickUnits: whole units inside the budget, best first, seen and low scores out", () => {
  const big = U(9, "z".repeat(RECALL_BUDGET_BYTES), 20);
  const out = pickUnits([U(1, "fatal at line 812", 12), big, U(2, "noise", RECALL_MIN_SCORE - 1), U(3, "seen one", 15)], new Set(["1:3"]), RECALL_BUDGET_BYTES);
  assert.deepEqual(out.map((u) => u.ord), [1]);
});

test("[r3] pickUnits/MMR: a near-copy of a taken unit ranks below a different unit", () => {
  const out = pickUnits([U(1, "replicas 0 ledger us-east-1", 10), U(2, "replicas 0 ledger us-east-1 zone", 9.9), U(3, "fatal error at req 1bec", 9.5)], new Set(), 100);
  assert.deepEqual(out.map((u) => u.ord), [1, 3]);
});

test("[r3] pickRecall: a row over the budget is skipped but its units fill the block", () => {
  const row = { seq: 5, session_id: "s", worktree: "/w", agent: "claude-code", kind: "tool", tool: "Bash", key: null, path: null, ok: 1, exit_code: 0, bytes: 1, body: "replicas ".repeat(400), turn: 1 };
  const r = pickRecall([row], "which service has replicas 0", new Set(), [U(4, '"ledger": {\n  "replicas": 0', 11)], new Set());
  assert.deepEqual(r.seqs, []);
  assert.deepEqual(r.units, ["1:4"]);
  assert.ok(r.text.includes(unitLine(U(4, '"ledger": {\n  "replicas": 0', 11))));
  assert.ok(Buffer.byteLength(r.text) <= RECALL_BUDGET_BYTES);
});
