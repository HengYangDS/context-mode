// D-DU-DENY-1: the Read deny is one line built from the src/prompt/hooks/read-deny.md template:
// the exact ctx_execute call for this file, no prose from the tool descriptions. Golden text + byte cap.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { READ_DENY_MESSAGE, READ_DENY_TEMPLATE } from "../../../src/core/policy/read-deny.ts";
import { READ_DENY_FIXED_CAP } from "../../../src/core/contracts/constants.ts";
import { lintHookText } from "../../../docs/v2/prompt/lint.mjs";

const SRC = new URL("../../../src/prompt/hooks/read-deny.md", import.meta.url);

test("D-DU-DENY-1: golden Read deny text", () => {
  assert.equal(READ_DENY_MESSAGE("/repo/big.log", 307200),
    'context-mode: 307200-byte file, over the one-read limit. Run ctx_execute(language, code, file="/repo/big.log") ' +
    "and print only the answer.");
});

test("D-DU-DENY-1: the template is src/prompt/hooks/read-deny.md, one line, path once", () => {
  assert.equal(READ_DENY_TEMPLATE, readFileSync(SRC, "utf8"));
  const m = READ_DENY_MESSAGE("a b.txt", 16385);
  assert.equal(m.includes("\n"), false);
  assert.equal(m.split("a b.txt").length, 2);
  assert.ok(m.includes('file="a b.txt"'));
  assert.ok(m.includes("16385"));
});

test("D-DU-DENY-1: byte cap on the fixed text (placeholders removed)", () => {
  const fixed = READ_DENY_TEMPLATE.split("{path}").join("").split("{size}").join("");
  assert.ok(Buffer.byteLength(fixed) <= READ_DENY_FIXED_CAP, `${Buffer.byteLength(fixed)} > ${READ_DENY_FIXED_CAP}`);
  assert.ok(READ_DENY_FIXED_CAP <= 120);
  // json-1 shape: 90-byte path, 6-digit size; the old text was 465 B here.
  const json1 = READ_DENY_MESSAGE("/" + "p".repeat(89), 501233);
  assert.ok(Buffer.byteLength(json1) <= 220, String(Buffer.byteLength(json1)));
});

test("D-DU-DENY-1: the prompt lint covers the hook template, and fails a bad one", () => {
  const names = ["ctx_execute", "ctx_search"];
  assert.deepEqual(lintHookText("read-deny", READ_DENY_TEMPLATE, names), []);
  assert.ok(lintHookText("x", "You MUST run ctx_nope", names).length >= 2);
  assert.ok(lintHookText("x", "two\nlines", names).length >= 1);
  assert.ok(lintHookText("x", "run mcp__plugin_context-mode_context-mode__ctx_execute", names).length >= 1);
});
