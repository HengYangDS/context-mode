// D-SEARCH-7 (owner decision 2026-10-23): reply snippets are the stored chunk text, never entity-encoded;
// the window is chosen by matched-term score and grows to whole blocks (a whole fenced block when the
// best block is code; whole lines otherwise). Fences over SNIPPET_CODE_MAX_BYTES return their best lines
// with the fence lines and a "[lines a-b of N]" marker, never a cut inside a line.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { openDb, closeDb } from "../../../src/core/store/db.ts";
import { ftsInsert, ftsQuery, highlight } from "../../../src/core/store/fts.ts";
import * as C from "../../../src/core/contracts/constants.ts";

const bytes = (s) => Buffer.byteLength(s, "utf8");
const filler = (tag, n) => Array.from({ length: n }, (_, i) => `${tag} paragraph ${i} holds plain words about weather and tea.`).join("\n\n");

test("[search-L5] SNIPPET_CODE_MAX_BYTES fits one chunk and leaves room for 7 code hits in one reply", () => {
  assert.equal(C.SNIPPET_CODE_MAX_BYTES, 2048);
  assert.ok(C.SNIPPET_CODE_MAX_BYTES <= C.MAX_CHUNK_BYTES);
  assert.ok(C.SNIPPET_CODE_MAX_BYTES * 7 <= C.OUTPUT_CAP);
  assert.ok(C.SNIPPET_MAX_BYTES <= C.SNIPPET_CODE_MAX_BYTES);
});

test("[search-L5] highlight returns the stored text verbatim: no & < > entity encoding", () => {
  const row = "if (a < b && c > d) { return '<b>x</b>'; }";
  assert.equal(highlight(row, "return", C.SNIPPET_MAX_BYTES), row);
  assert.ok(!highlight(row, "return").includes("&lt;"));
  assert.ok(!highlight(row, "return").includes("&amp;"));
});

test("[search-L5] a fenced block the best match sits in comes back whole, over the prose cap", () => {
  const code = Array.from({ length: 30 }, (_, i) => `  const v${i} = items.filter((x) => x.id < ${i} && x.ok);`).join("\n");
  const fence = "```ts\nfunction pickItems(items) {\n" + code + "\n  return zebraTotal(items);\n}\n```";
  assert.ok(bytes(fence) > C.SNIPPET_MAX_BYTES && bytes(fence) <= C.SNIPPET_CODE_MAX_BYTES, String(bytes(fence)));
  const body = filler("lead", 6) + "\n\n" + fence + "\n\n" + filler("tail", 4);
  const out = highlight(body, "zebraTotal items", C.SNIPPET_MAX_BYTES);
  assert.ok(out.includes(fence), out);
  assert.ok(bytes(out) <= C.SNIPPET_CODE_MAX_BYTES);
  assert.ok(body.includes(out), "snippet is one contiguous slice of the stored text");
});

test("[search-L5] a fence over the code cap returns its best whole lines, the fence lines and a lines marker", () => {
  const lines = Array.from({ length: 120 }, (_, i) => (i === 80 ? "  return needleFn(x);" : `  step${i}(x); // plain filler line number ${i}`));
  const fence = "```js\n" + lines.join("\n") + "\n```";
  assert.ok(bytes(fence) > C.SNIPPET_CODE_MAX_BYTES);
  const out = highlight("Intro text.\n\n" + fence, "needleFn", C.SNIPPET_MAX_BYTES);
  assert.ok(bytes(out) <= C.SNIPPET_CODE_MAX_BYTES, String(bytes(out)));
  const outLines = out.split("\n");
  assert.equal(outLines[0], "```js");
  assert.equal(outLines[outLines.length - 2], "```");
  const m = /^\[lines (\d+)-(\d+) of 120\]$/.exec(outLines[outLines.length - 1]);
  assert.ok(m, out.slice(-80));
  const a = Number(m[1]);
  const b = Number(m[2]);
  assert.ok(a <= 81 && b >= 81, `${a}-${b}`);
  assert.deepEqual(outLines.slice(1, -2), lines.slice(a - 1, b), "whole source lines, in order, nothing cut");
});

test("[search-L5] prose window moves to the best paragraph and keeps whole lines", () => {
  const target = "The zebra crossing rule: walk when the light is green.";
  const body = filler("lead", 30) + "\n\n" + target + "\n\n" + filler("tail", 30);
  const out = highlight(body, "zebra crossing", C.SNIPPET_MAX_BYTES);
  assert.ok(out.includes(target), out);
  assert.ok(bytes(out) <= C.SNIPPET_MAX_BYTES);
  const at = body.indexOf(out);
  assert.ok(at >= 0);
  assert.ok(at === 0 || body[at - 1] === "\n", "starts at a line start");
  assert.ok(at + out.length === body.length || body[at + out.length] === "\n", "ends at a line end");
});

test("[search-L5] exact symbol match beats the same words spread over prose", () => {
  const spread = "create a connection, then create the connection pool and close the connection.";
  const exact = "const c = createConnection(serverUrl, roomId);";
  const body = spread + "\n\n" + filler("mid", 25) + "\n\n" + exact + "\n\n" + filler("end", 5);
  const out = highlight(body, "createConnection", C.SNIPPET_MAX_BYTES);
  assert.ok(out.includes("createConnection(serverUrl, roomId)"), out);
});

test("[search-L5] snake_case and dotted query words match their parts and the whole symbol", () => {
  const body = filler("lead", 25) + "\n\n" + "```ts\nassertEquals(func_data.message, 'Hello bar!');\n```" + "\n\n" + filler("tail", 5);
  const out = highlight(body, "assertEquals func_data.message", C.SNIPPET_MAX_BYTES);
  assert.ok(out.includes("assertEquals(func_data.message, 'Hello bar!')"), out);
});

test("[search-L5] ftsQuery hit returns a whole fence with < > & intact", async () => {
  const root = mkdtempSync(join(tmpdir(), "cm-snip-"));
  const projectKey = "c".repeat(16);
  const project = { projectKey, projectDir: join(root, "projects", projectKey), dbPath: join(root, "projects", projectKey, "context.db"),
    worktree: root, containmentRoot: root, agent: "claude-code", source: "env:CLAUDE_PROJECT_DIR" };
  const db = await openDb(project);
  try {
    const fence = "```ts\n" + Array.from({ length: 25 }, (_, i) => `if (a${i} < b && c > d) total += a${i} & 0xff;`).join("\n") + "\n```";
    assert.ok(bytes(fence) > C.SNIPPET_MAX_BYTES);
    const text = filler("lead", 3) + "\n\n" + fence;
    ftsInsert(db, { projectKey: project.projectKey, sessionId: "s1", worktree: root, agent: "claude-code", kind: "content", label: "code.md", bytes: 0, chunkCount: 1, createdAt: Date.now() },
      [{ ord: 0, text, bytes: bytes(text) }]);
    const hits = ftsQuery(db, "total 0xff", "project", project, "s1", 10, 0);
    assert.equal(hits.length, 1);
    assert.ok(hits[0].snippet.includes(fence), hits[0].snippet);
  } finally {
    closeDb(db);
    rmSync(root, { recursive: true, force: true });
  }
});
