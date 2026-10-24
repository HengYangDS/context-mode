// D-CMP-PUSH-1: pickPush turns hit lines into whole lines with their indent ancestors, under the byte budget.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickPush } from "../../../src/core/compaction/push.ts";
import { PUSH_BUDGET_BYTES, PUSH_CLOSE_TAG, PUSH_OPEN_TAG } from "../../../src/core/contracts/constants.ts";

const text = ['{', '  "ledger": {', '    "image": {', '      "tag": "v6.14.93-6315de5"', '    }', '  }', '}', ''].join("\n");

test("push keeps the hit line whole with its key path", () => {
  const off = text.indexOf('      "tag"');
  const out = pickPush([{ label: "cmd:Bash:cat", text, hits: [off] }], "ledger image tag");
  assert.ok(out.startsWith(PUSH_OPEN_TAG) && out.endsWith(PUSH_CLOSE_TAG));
  assert.ok(out.includes('      "tag": "v6.14.93-6315de5"'), "the value line is whole");
  assert.ok(out.includes('  "ledger": {'), "the indent ancestor is kept");
  assert.ok(out.includes("source: cmd:Bash:cat"));
});

test("push stays under the byte budget and is empty with no query", () => {
  const lines = Array.from({ length: 3000 }, (_, i) => "line " + i + " ledger tag value " + i);
  const big = lines.join("\n");
  let off = 0;
  const hits = lines.map((l) => { const o = off; off += l.length + 1; return o; });
  const out = pickPush([{ label: "x", text: big, hits }], "ledger tag");
  assert.ok(Buffer.byteLength(out) <= PUSH_BUDGET_BYTES);
  for (const l of out.split("\n").slice(2, -1)) assert.ok(l === "..." || lines.includes(l), "no line is cut");
  assert.equal(pickPush([{ label: "x", text: big, hits }], "  "), "");
});
