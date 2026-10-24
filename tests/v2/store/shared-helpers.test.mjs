// r4g shared helpers (refactor, no behaviour change): recallQueryText and deleteChunkRows (store/fts.ts),
// sourceRowOf (hooks/dispatch.ts). Namespace imports keep each test red on its own until its helper exists.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as fts from "../../../src/core/store/fts.ts";
import * as dispatch from "../../../src/core/hooks/dispatch.ts";
import { openDb, closeDb } from "../../../src/core/store/db.ts";

const KEY = "h".repeat(16);

function project(root) {
  return {
    projectKey: KEY,
    projectDir: join(root, "p"),
    dbPath: join(root, "p", "context.db"),
    worktree: root,
    containmentRoot: root,
    agent: "claude-code",
    source: "env:CLAUDE_PROJECT_DIR",
  };
}

const src = (label) => ({
  projectKey: KEY, sessionId: "s1", worktree: "/w", agent: "claude-code", kind: "content",
  label, bytes: 0, chunkCount: 0, createdAt: 1700000000000,
});

const count = (raw, sql) => Number(raw.prepare(sql).get().n);
const PORTER_NEEDLE = "SELECT COUNT(*) AS n FROM chunks WHERE body LIKE '%needle%'";
const TRI_NEEDLE = "SELECT COUNT(*) AS n FROM chunks_tri WHERE chunks_tri MATCH '\"needle\"'";
const UNITS = "SELECT COUNT(*) AS n FROM line_units";
const CHUNKS = "SELECT COUNT(*) AS n FROM chunks";

test("[H-1] recallQueryText: the prompt alone when it equals the goal, else prompt, one space, goal", () => {
  assert.equal(fts.recallQueryText("fix login", "fix login"), "fix login");
  assert.equal(fts.recallQueryText("fix login", "build the api"), "fix login build the api");
});

test("[H-2] deleteChunkRows: one source id, one label or all; chunk, trigram and line rows leave together", async () => {
  const root = mkdtempSync(join(tmpdir(), "cm-helpers-"));
  try {
    const db = await openDb(project(root));
    const a = fts.ftsInsert(db, src("a.txt"), [{ ord: 0, text: "needle alpha", bytes: 12 }]);
    const b = fts.ftsInsert(db, src("b.txt"), [{ ord: 0, text: "needle beta", bytes: 11 }]);
    fts.insertUnits(db, a, "s1", [{ ord: 0, body: "needle alpha" }]);
    fts.insertUnits(db, b, "s1", [{ ord: 0, body: "needle beta" }]);

    assert.equal(fts.deleteChunkRows(db.raw, { sourceId: a }), 1);
    assert.equal(count(db.raw, CHUNKS), 1);
    assert.equal(count(db.raw, UNITS), 1);
    assert.equal(count(db.raw, TRI_NEEDLE), 1);
    assert.equal(count(db.raw, PORTER_NEEDLE), 1);

    assert.equal(fts.deleteChunkRows(db.raw, { label: "b.txt" }), 1);
    assert.equal(count(db.raw, CHUNKS), 0);
    assert.equal(count(db.raw, UNITS), 0);
    assert.equal(count(db.raw, TRI_NEEDLE), 0);

    const c = fts.ftsInsert(db, src("c.txt"), [{ ord: 0, text: "needle gamma", bytes: 12 }]);
    fts.insertUnits(db, c, "s1", [{ ord: 0, body: "needle gamma" }]);
    assert.equal(fts.deleteChunkRows(db.raw, "all"), 1);
    assert.equal(count(db.raw, CHUNKS), 0);
    assert.equal(count(db.raw, UNITS), 0);
    assert.equal(count(db.raw, TRI_NEEDLE), 0);
    closeDb(db);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("[H-3] sourceRowOf returns only the fields reserveSource stores: no bytes or chunkCount placeholders", () => {
  const row = dispatch.sourceRowOf(project("/w"), "s1", "cat big.log#1");
  assert.deepEqual(Object.keys(row).sort(), ["agent", "createdAt", "kind", "label", "sessionId", "worktree"]);
});
