// Unit tests for src/core/index/shape.ts (D-M2-SHAPE-1): parser-found shape -> rare units, whole, in budget.
import { test } from "node:test";
import assert from "node:assert/strict";
import { shapeDigest, jsonShape, lineShape } from "../../../src/core/index/shape.ts";

const log = (n, rare) => Array.from({ length: n }, (_, i) => (i === rare ? "FAIL suite/x/case_" + i + "_zz expected 3 got 4" : "ok   suite/a/case_" + i + " (" + (i % 90) + "ms) t" + i)).join("\n") + "\n";

test("lines: the one rare line comes back whole with its line number", () => {
  const d = shapeDigest(log(500, 321), "FAIL case", 96);
  assert.ok(d !== null);
  assert.ok(d.includes("322: FAIL suite/x/case_321_zz expected 3 got 4"));
  assert.ok(Buffer.byteLength(d) <= 96);
});

test("lines: a rare token at a skewed position makes its line rare (degraded among healthy)", () => {
  const t = Array.from({ length: 200 }, (_, i) => "node n" + i + " status " + (i === 77 ? "degraded" : "healthy")).join("\n");
  const d = shapeDigest(t, "degraded node", 96);
  assert.ok(d !== null && d.includes("78: node n77 status degraded"), String(d));
});

test("lines: no named rare unit, free text, or too few lines -> null (BM25 path)", () => {
  assert.equal(shapeDigest(log(500, 321), "zebra", 96), null);
  assert.equal(shapeDigest(log(10, 3), "FAIL", 96), null);
  const prose = Array.from({ length: 300 }, (_, i) => ["alpha", "beta", "gamma", "delta"].slice(0, 1 + (i % 4)).join(" ") + " word" + String.fromCharCode(97 + (i % 26)) + " more" + String.fromCharCode(97 + ((i * 7) % 26))).join("\n");
  assert.equal(lineShape(prose), null);
  const numbers = Array.from({ length: 300 }, (_, i) => String(i * 7)).join("\n");
  assert.equal(lineShape(numbers), null, "a template with no literal token is data, not a log");
});

test("JSON: the row with the skewed value comes back with whole fields; the skewed field always shows", () => {
  const rows = Array.from({ length: 400 }, (_, i) => ({ id: "ord-" + i, amount: i * 3, priority: i === 211, note: "long note words here and there " + i }));
  const s = jsonShape(JSON.stringify(rows, null, 2), "priority amount");
  assert.ok(s !== null && s.units.length === 1);
  const d = shapeDigest(JSON.stringify(rows, null, 2), "priority true amount", 96);
  assert.ok(d !== null && Buffer.byteLength(d) <= 96, String(d));
  const body = d.split("\n").find((l) => l.startsWith("[211] "));
  const row = JSON.parse(body.slice(6));
  assert.equal(row.priority, true);
  assert.equal(row.amount, 633);
  for (const [k, v] of Object.entries(row)) assert.deepEqual(v, rows[211][k], "field " + k + " is whole");
});

test("JSON: not an array of objects, or no skewed key -> null", () => {
  assert.equal(jsonShape("{\"a\":1}", "a"), null);
  assert.equal(jsonShape("[1,2,3]", "a"), null);
  assert.equal(jsonShape(JSON.stringify(Array.from({ length: 50 }, (_, i) => ({ v: i }))), "v"), null);
  assert.equal(jsonShape("[not json", "a"), null);
});

test("budget: a rare unit that does not fit is skipped, never cut", () => {
  const t = Array.from({ length: 100 }, (_, i) => (i === 50 ? "FAIL " + "x".repeat(200) : "ok case " + i)).join("\n");
  assert.equal(shapeDigest(t, "FAIL", 96), null);
});

test("JSON: a categorical key (few values, none dominant) makes its one-off value rare (D-M2-MCP-2)", () => {
  const st = ["open", "in_progress", "review"];
  const rows = Array.from({ length: 180 }, (_, i) => ({ key: "TIX-" + i, title: "task " + i + " words", status: i === 97 ? "blocked" : st[i % 3], labels: ["a", "b"] }));
  const d = shapeDigest(JSON.stringify(rows, null, 2), "ticket with status blocked", 256);
  assert.ok(d !== null && d.includes("[97] ") && d.includes("TIX-97"), String(d));
  assert.equal(jsonShape(JSON.stringify(rows.map((r, i) => ({ ...r, status: st[i % 3] }))), "status"), null, "no one-off value -> no shape");
  const many = rows.map((r, i) => ({ ...r, status: "s" + (i % 40) }));
  assert.equal(jsonShape(JSON.stringify(many), "status"), null, "a key with many values is not categorical");
});

// D-M2-JSON-1: the digest header names the schema (keys) and the counts, when it fits.
test("JSON digest header: schema keys and counts, then the rare row whole", () => {
  const rows = Array.from({ length: 400 }, (_, i) => ({ id: "ord-" + i, amount: i * 3, priority: i === 211, note: "long note words here and there " + i }));
  const d = shapeDigest(JSON.stringify(rows, null, 2), "priority true amount", 400);
  assert.ok(d !== null);
  const head = d.split("\n")[0];
  assert.equal(head, "400 objects {id,amount,priority,note}, 1 rare:");
  assert.ok(d.includes('[211] {"id":"ord-211","amount":633,"priority":true,'), d);
});

// D-M2-JSON-2: no skewed key, but the query names a numeric key: the rows at its two extremes, whole.
test("JSON digest: a named numeric key gives its max and min rows (highest score)", () => {
  const rows = Array.from({ length: 300 }, (_, i) => ({ id: "rec-" + i, score: (i * 7919) % 10007, tags: ["a", "b"], note: "n" + i }));
  let hi = 0, lo = 0;
  rows.forEach((r, i) => { if (r.score > rows[hi].score) hi = i; if (r.score < rows[lo].score) lo = i; });
  const d = shapeDigest(JSON.stringify(rows, null, 2), "which record id has the highest score", 256);
  assert.ok(d !== null && Buffer.byteLength(d) <= 256, String(d));
  assert.ok(d.includes("[" + hi + "] " + JSON.stringify(rows[hi])), "max row whole: " + d);
  assert.ok(d.includes("[" + lo + "] " + JSON.stringify(rows[lo])), "min row whole: " + d);
  assert.equal(jsonShape(JSON.stringify(rows), "score"), null, "jsonShape (skew) is unchanged");
  assert.equal(shapeDigest(JSON.stringify(rows, null, 2), "which record is newest", 256), null, "no numeric key named: no digest");
});
