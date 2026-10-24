// Unit tests for src/core/store/words.ts: one char-by-char word tokenizer for recall and the trigram query.
// A word char is a letter or a digit (Unicode L or N) or "_". NUL and whitespace are separators. Nothing else
// is a word char, so every other code point separates words, as the old /[^\p{L}\p{N}_]+/u split did.
import { test } from "node:test";
import assert from "node:assert/strict";
import { blankTokens, isWordChar, wordTokens } from "../../../src/core/store/words.ts";

test("ASCII: lowercase words split on punctuation and spaces; _ joins", () => {
  assert.deepEqual(wordTokens("hello, world! foo-bar_baz 42".toLowerCase()), ["hello", "world", "foo", "bar_baz", "42"]);
});

test("Turkish: dotted and dotless i keep their letters, the combining dot separates", () => {
  assert.deepEqual(wordTokens("ışİğ"), ["ışİğ"]);
  assert.deepEqual(wordTokens("ışİğ".toLowerCase()), ["ışi", "ğ"]); // U+0307 (Mn) after the i separates, as the old regex did
});

test("Cyrillic letters are word chars", () => {
  assert.deepEqual(wordTokens("Привет, мир".toLowerCase()), ["привет", "мир"]);
});

test("snake_case stays one token", () => {
  assert.deepEqual(wordTokens("snake_case_name"), ["snake_case_name"]);
});

test("punctuation and symbols separate", () => {
  assert.deepEqual(wordTokens("a.b/c:d(e)f;g"), ["a", "b", "c", "d", "e", "f", "g"]);
  assert.deepEqual(wordTokens("a😀b"), ["a", "b"]);
});

test("NUL and whitespace separate", () => {
  assert.deepEqual(wordTokens("a\u0000b"), ["a", "b"]);
  assert.deepEqual(wordTokens("a\tb\nc d e"), ["a", "b", "c", "d", "e"]);
});

test("non-ASCII digits are word chars; a combining mark separates", () => {
  assert.deepEqual(wordTokens("٣ ok"), ["٣", "ok"]);
  assert.deepEqual(wordTokens("é"), ["e"]);
});

test("empty and separator-only input give no tokens", () => {
  assert.deepEqual(wordTokens(""), []);
  assert.deepEqual(wordTokens(" \u0000 .,! "), []);
});

test("isWordChar matches /[\\p{L}\\p{N}_]/u on every code point", () => {
  const re = /[\p{L}\p{N}_]/u;
  for (let cp = 0; cp <= 0x10ffff; cp++) {
    if (cp >= 0xd800 && cp <= 0xdfff) continue; // lone surrogates are not characters
    const ch = String.fromCodePoint(cp);
    assert.equal(isWordChar(cp), re.test(ch), "code point U+" + cp.toString(16));
  }
});

test("blankTokens splits on NUL and whitespace only; punctuation stays inside a token", () => {
  assert.deepEqual(blankTokens("foo.bar, baz"), ["foo.bar,", "baz"]);
  assert.deepEqual(blankTokens("a\u0000b　c﻿d"), ["a", "b", "c", "d"]);
  assert.deepEqual(blankTokens("ışİğ  snake_case"), ["ışİğ", "snake_case"]);
  assert.deepEqual(blankTokens(" \t\n "), []);
});
