// Unit tests for src/core/index/cdc.ts: FastCDC-style content-defined chunking and the session dedup
// measure (docs/v2/spikes/m2/b-dedup.md). Exact: the chunks always join back to the input bytes.
import { test } from "node:test";
import assert from "node:assert/strict";

import { cdcChunks, dedupGain, CDC_MIN, CDC_AVG, CDC_MAX } from "../../../src/core/index/cdc.ts";

function noise(n, seed) {
  let s = seed >>> 0;
  const b = Buffer.alloc(n);
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    b[i] = 97 + (s >>> 24) % 26;
  }
  return b;
}

test("cdc: chunks join back to the exact input, sizes within [min, max] except the last", () => {
  const buf = noise(50000, 1);
  const cuts = cdcChunks(buf);
  assert.equal(Buffer.concat(cuts.map(([a, b]) => buf.subarray(a, b))).equals(buf), true);
  assert.equal(cuts[0][0], 0);
  assert.equal(cuts.at(-1)[1], buf.length);
  for (let i = 0; i < cuts.length; i++) {
    const len = cuts[i][1] - cuts[i][0];
    assert.ok(len <= CDC_MAX, "max " + len);
    if (i < cuts.length - 1) assert.ok(len >= CDC_MIN, "min " + len);
    if (i > 0) assert.equal(cuts[i][0], cuts[i - 1][1]);
  }
  const mean = buf.length / cuts.length;
  assert.ok(mean > CDC_AVG / 2 && mean < CDC_AVG * 2, "mean " + mean);
});

test("cdc: deterministic, and an input under min is one chunk; empty is no chunk", () => {
  const buf = noise(9000, 7);
  assert.deepEqual(cdcChunks(buf), cdcChunks(Buffer.from(buf)));
  assert.deepEqual(cdcChunks(Buffer.alloc(0)), []);
  assert.deepEqual(cdcChunks(Buffer.from("abc")), [[0, 3]]);
});

test("cdc: an insert near the start moves only the chunks around it (content-defined, not fixed offsets)", () => {
  const base = noise(40000, 3);
  const edited = Buffer.concat([base.subarray(0, 100), Buffer.from("INSERTED-BYTES"), base.subarray(100)]);
  const set = new Set(cdcChunks(base).map(([a, b]) => base.subarray(a, b).toString("latin1")));
  const after = cdcChunks(edited).map(([a, b]) => edited.subarray(a, b).toString("latin1"));
  const shared = after.filter((c) => set.has(c)).reduce((n, c) => n + c.length, 0);
  assert.ok(shared / edited.length > 0.9, "shared " + shared / edited.length);
});

test("dedupGain: a repeat saves its bytes minus the reference cost; new text saves nothing", () => {
  const a = noise(6000, 11).toString("latin1");
  const b = noise(6000, 12).toString("latin1");
  const g = dedupGain([a, b, a], 24);
  assert.equal(g.total, 18000);
  assert.ok(g.saved > 6000 - 24 * 40, "saved " + g.saved);
  assert.ok(g.saved <= 6000);
  assert.equal(dedupGain([a, b], 24).saved, 0);
  assert.equal(dedupGain([], 24).saved, 0);
});

test("dedupGain: a chunk repeated inside one output counts only after its first copy", () => {
  const a = noise(5000, 21).toString("latin1");
  const g = dedupGain([a + a], 24);
  assert.ok(g.saved > 3000 && g.saved <= 5000, "saved " + g.saved);
});
