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
