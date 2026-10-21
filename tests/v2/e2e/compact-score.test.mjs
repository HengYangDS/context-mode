// T-CMP thresholds (DECISIONS-r9 §V T-CMP): arm a call >= 70%, correct >= 80% and >= arm c;
// arm d correct >= 70%; ctx_resume(seq) returns the row 10/10.
import { test } from "node:test";
import assert from "node:assert/strict";
import { verdict, exactMatch } from "../../../e2e/live/compact/score.mjs";

const run = (o = {}) => ({ factInSummary: false, calledTool: true, correct: true, resumeSeqOk: true, ...o });
const n = (k, o) => Array.from({ length: k }, () => run(o));
const mix = (good, total, o) => [...n(good, o), ...n(total - good, { ...o, correct: false })];

function base() {
  return { a: n(10), b: n(10), c: n(10), d: n(10), e: n(10) };
}

test("all good passes", () => assert.equal(verdict(base()).pass, true));

test("arm a call rate 7/10 passes, 6/10 fails", () => {
  const ok = base(); ok.a = [...n(7), ...n(3, { calledTool: false })];
  assert.equal(verdict(ok).pass, true);
  const bad = base(); bad.a = [...n(6), ...n(4, { calledTool: false })];
  assert.equal(verdict(bad).pass, false);
});

test("call rate counts only runs where the fact is missing from the summary", () => {
  const r = base(); r.a = [...n(7), ...n(3, { calledTool: false, factInSummary: true })];
  assert.equal(verdict(r).pass, true);
});

test("arm a correct 8/10 passes, 7/10 fails", () => {
  const ok = base(); ok.a = mix(8, 10); ok.c = mix(8, 10); // a >= c (DECISIONS-r9 T-CMP)
  assert.equal(verdict(ok).pass, true);
  const bad = base(); bad.a = mix(7, 10); bad.c = mix(7, 10);
  assert.equal(verdict(bad).pass, false);
});

test("arm a correct must be >= arm c", () => {
  const r = base(); r.a = mix(8, 10); r.c = mix(9, 10);
  assert.equal(verdict(r).pass, false);
});

test("arm d correct 7/10 passes, 6/10 fails", () => {
  const ok = base(); ok.d = mix(7, 10);
  assert.equal(verdict(ok).pass, true);
  const bad = base(); bad.d = mix(6, 10);
  assert.equal(verdict(bad).pass, false);
});

test("ctx_resume(seq) must succeed 10/10", () => {
  const r = base(); r.a = [...n(9), run({ resumeSeqOk: false })];
  assert.equal(verdict(r).pass, false);
});

test("verdict lists named checks", () => {
  const v = verdict(base());
  assert.ok(Array.isArray(v.checks) && v.checks.length >= 5);
  for (const c of v.checks) assert.ok(typeof c.name === "string" && typeof c.pass === "boolean");
});

test("exactMatch is case-sensitive by default (path, id, number)", () => {
  assert.equal(exactMatch("packages/cli/lib/Config/layered-loader.mjs", "packages/cli/lib/config/layered-loader.mjs"), false);
  assert.equal(exactMatch("7350", "7350"), true);
});

test("exactMatch with caseSensitive:false folds case only (prose answer)", () => {
  const opt = { caseSensitive: false };
  assert.equal(exactMatch("Newline-delimited JSON (NDJSON)", "newline-delimited JSON", opt), true);
  assert.equal(exactMatch("CSV", "newline-delimited JSON", opt), false);
  assert.equal(exactMatch("One JSON array", "newline-delimited JSON", opt), false);
});

test("session-03 key is prose (case-insensitive), session-01/02 keys stay case-sensitive", async () => {
  const { FIXTURES } = await import("../../../e2e/live/compact/fixtures.mjs");
  const by = Object.fromEntries(FIXTURES.map((f) => [f.id, f.answer]));
  assert.equal(by["session-03"].caseSensitive, false);
  assert.notEqual(by["session-01"].caseSensitive, false);
  assert.notEqual(by["session-02"].caseSensitive, false);
});
