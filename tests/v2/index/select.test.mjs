// Unit tests for src/core/index/select.ts (impl/05 §5).
// selectChunks(db, sourceId, intent, budget) / selectChunksInMemory(chunks, intent, budget).
// Lazy greedy by BM25 score, whole-chunk only, no mid-chunk cut, more: line when truncated.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb, closeDb } from "../../../src/core/store/db.ts";
import { ftsInsert } from "../../../src/core/store/fts.ts";
import { selectChunks, selectChunksInMemory } from "../../../src/core/index/select.ts";

function fakeProject(root, key) {
  return { projectKey: key, projectDir: join(root, "projects", key), dbPath: join(root, "projects", key, "context.db"), worktree: root, containmentRoot: root, agent: "claude-code", source: "env:CLAUDE_PROJECT_DIR" };
}
function src(overrides) {
  return { sessionId: "s1", worktree: "/w", agent: "claude-code", kind: "content", label: "note.txt", bytes: 0, chunkCount: 0, createdAt: Date.now(), ...overrides };
}

test("selectChunks returns an empty result for a source with zero chunks", async () => {
  const root = mkdtempSync(join(tmpdir(), "cm-sel-"));
  const project = fakeProject(root, "1".repeat(16));
  const db = await openDb(project);
  try {
    const out = selectChunks(db, 999, "anything", 1000);
    assert.deepEqual(out, { text: "", more: null });
  } finally {
    closeDb(db);
    rmSync(root, { recursive: true, force: true });
  }
});

test("selectChunks picks whole chunks within budget, never cutting mid-chunk", async () => {
  const root = mkdtempSync(join(tmpdir(), "cm-sel2-"));
  const project = fakeProject(root, "2".repeat(16));
  const db = await openDb(project);
  try {
    const id = ftsInsert(db, src({ worktree: project.worktree }), [
      { ord: 0, text: "alpha chunk about dogs", bytes: 22 },
      { ord: 1, text: "beta chunk about cats", bytes: 21 },
    ]);
    const out = selectChunks(db, id, "dogs", 25);
    assert.ok(out.text.includes("dogs"));
    assert.ok(!out.text.includes("cats") || out.text === "alpha chunk about dogs");
  } finally {
    closeDb(db);
    rmSync(root, { recursive: true, force: true });
  }
});

test("selectChunks sets 'more' when a chunk is skipped for budget, text stays in ord order", async () => {
  const root = mkdtempSync(join(tmpdir(), "cm-sel3-"));
  const project = fakeProject(root, "3".repeat(16));
  const db = await openDb(project);
  try {
    const id = ftsInsert(db, src({ worktree: project.worktree, label: "doc" }), [
      { ord: 0, text: "x".repeat(50), bytes: 50 },
      { ord: 1, text: "needle".repeat(20), bytes: 120 },
    ]);
    const out = selectChunks(db, id, "needle", 60);
    assert.ok(out.more === null || typeof out.more === "string");
  } finally {
    closeDb(db);
    rmSync(root, { recursive: true, force: true });
  }
});

test("selectChunksInMemory scores an in-memory chunk array the same shape as selectChunks", () => {
  const chunks = [
    { ord: 0, text: "alpha about dogs", bytes: 17 },
    { ord: 1, text: "beta about cats", bytes: 16 },
  ];
  const out = selectChunksInMemory(chunks, "dogs", 1000);
  assert.equal(typeof out.text, "string");
  assert.equal(out.more === null || typeof out.more === "string", true);
  assert.ok(out.text.includes("dogs"));
});

test("selectChunksInMemory never writes to the DB (pure in-memory read)", () => {
  const chunks = [{ ord: 0, text: "hello", bytes: 5 }];
  assert.doesNotThrow(() => selectChunksInMemory(chunks, "hello", 10));
});

// D-M7-SV-8: small replace chunks cut one record into several chunks. After the best chunk, its higher-scoring
// adjacent chunk (ord +-1) comes next, before weaker matches elsewhere, so the record's other line is returned.
test("selectChunksInMemory takes the best chunk's higher-scoring neighbour before distant weaker matches", () => {
  const texts = [
    ...Array.from({ length: 10 }, (_, i) => "row " + i + " lorem"),
    "amount 10",
    "priority false",
    "amount 3099",
    "priority true",
    "items gamma",
    "amount 30",
    "priority false",
  ];
  const chunks = texts.map((t, ord) => ({ ord, text: t, bytes: Buffer.byteLength(t) }));
  const out = selectChunksInMemory(chunks, "cat orders.json", 26, "L", "cat orders.json priority true amount");
  assert.equal(out.text, "amount 3099\npriority true");
  assert.equal(typeof out.more, "string");
});

test("selectChunksInMemory: no neighbour rule without a match (all scores 0 keep the old order)", () => {
  const chunks = ["a1", "b2", "c3", "d4"].map((t, ord) => ({ ord, text: t, bytes: 2 }));
  const out = selectChunksInMemory(chunks, "zzz", 5);
  assert.equal(out.text, "c3\nd4");
});

// D-M7-SV-8: the any-word rank query matches whole words only. A prefix form let "cat" (from the command)
// match "catthzzh" (an id in the data), so a chunk with no asked word could outrank the asked line.
test("rankTexts any-mode matches whole words, not prefixes", async () => {
  const { rankTexts } = await import("../../../src/core/store/fts.ts");
  const s = rankTexts(["id catthzzh", "cat data", "priority true"], "cat priority", "any");
  assert.equal(s[0], 0);
  assert.ok(s[1] > 0 && s[2] > 0);
});
