// Search layer 1 (docs/v2/spikes/search/DIAGNOSIS.md §5 step 2): heading-aware markdown chunking.
// A fenced code block is never split below the hard cap; chunks split on headings and carry the
// heading path as `title`; a code block over the cap splits on blank lines with the fence repeated.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkText } from "../../../src/core/index/chunk.ts";
import * as C from "../../../src/core/contracts/constants.ts";

const FENCE = "```js\nconst a = 1;\n\nconst b = 2;\n\n\nconsole.log(a + b);\n```";

test("[search-L1] md: a fenced block with blank lines inside stays in one chunk", () => {
  const md = "# Setup\n\nIntro text.\n\n" + FENCE + "\n\nAfter the code.";
  const chunks = chunkText(md, "md");
  assert.equal(chunks.filter((c) => c.text.includes(FENCE)).length, 1);
});

test("[search-L1] md: chunks split on headings and carry the heading path as title", () => {
  const md = "# Guide\n\nTop para.\n\n## Install\n\nRun the installer.\n\n### Linux\n\nUse apt.\n\n## Usage\n\nCall it.";
  const chunks = chunkText(md, "md");
  assert.deepEqual(chunks.map((c) => c.title), ["Guide", "Guide > Install", "Guide > Install > Linux", "Guide > Usage"]);
  assert.deepEqual(chunks.map((c) => c.ord), [0, 1, 2, 3]);
  assert.ok(chunks[1].text.startsWith("## Install"));
  assert.ok(chunks[1].text.includes("Run the installer."));
  assert.ok(!chunks[1].text.includes("Use apt."));
});

test("[search-L1] md: a heading inside a fence is code, not a split point", () => {
  const md = "# Real\n\n```sh\n# not a heading\necho hi\n```";
  const chunks = chunkText(md, "md");
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].title, "Real");
});

test("[search-L1] md: a code block under the cap stays whole even when its section is over the cap", () => {
  const prose = ("word ".repeat(150) + "\n\n").repeat(5); // about 3.8 KB of prose
  const code = "```py\n" + "x = 1\n".repeat(400) + "```"; // about 2.4 KB
  const md = "## Big\n\n" + prose + code + "\n\nTail.";
  const chunks = chunkText(md, "md");
  assert.equal(chunks.filter((c) => c.text.includes(code)).length, 1);
  for (const c of chunks) assert.ok(c.bytes <= C.MAX_CHUNK_BYTES, "chunk over cap: " + c.bytes);
});

test("[search-L1] md: a code block over the cap splits on blank lines, each piece fenced again", () => {
  const parts = [];
  for (let i = 0; i < 12; i++) parts.push("function f" + i + "() {\n" + "  return " + i + ";\n".repeat(1) + "  // pad ".repeat(60) + "\n}");
  const inner = parts.join("\n\n");
  const md = "# Long\n\n```ts\n" + inner + "\n```\n";
  assert.ok(Buffer.byteLength(inner) > C.MAX_CHUNK_BYTES);
  const chunks = chunkText(md, "md");
  const code = chunks.filter((c) => c.text.includes("function f"));
  assert.ok(code.length >= 2);
  for (const c of chunks) assert.ok(c.bytes <= C.MAX_CHUNK_BYTES);
  for (const c of code) {
    const start = c.text.indexOf("```ts\n");
    assert.ok(start >= 0, "piece lacks the opener");
    assert.ok(c.text.trimEnd().endsWith("```"), "piece lacks the closing fence");
  }
  // Every function body sits whole in one piece: no split inside a blank-line block.
  for (const p of parts) assert.equal(code.filter((c) => c.text.includes(p)).length, 1);
  for (const c of chunks) assert.equal(c.bytes, Buffer.byteLength(c.text, "utf8"));
  for (const c of code) assert.equal(c.title, "Long");
});

test("[search-L1] md without headings keeps an empty title", () => {
  const chunks = chunkText("plain para\n\nsecond para", "md");
  assert.ok(chunks.length >= 1);
  for (const c of chunks) assert.equal(c.title ?? "", "");
});
