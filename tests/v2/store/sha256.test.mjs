// Unit tests for src/core/project/sha256.ts (DEVIATIONS D-M7-HP-2): same digest as node:crypto.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { sha256Hex } from "../../../src/core/project/sha256.ts";

const ref = (s) => createHash("sha256").update(s).digest("hex");

test("sha256Hex: FIPS 180-4 known answers", () => {
  assert.equal(sha256Hex(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(sha256Hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"), "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
});

test("sha256Hex equals node:crypto for every length 0..300 and non-ASCII paths", () => {
  for (let n = 0; n <= 300; n++) assert.equal(sha256Hex("a".repeat(n)), ref("a".repeat(n)), `length ${n}`);
  for (const s of ["/Users/x/repo/.git", "C:\\Users\\Ö\\repo\\.git", "/tmp/プロジェクト/.git", "/tmp/😀/.git"]) assert.equal(sha256Hex(s), ref(s));
});
