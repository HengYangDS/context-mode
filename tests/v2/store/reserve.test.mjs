// D-R4-RESERVE-1: a source reserved for a detached write (reserveSource) is deleted again when its chunk
// or line unit write fails, so no 0-chunk orphan row stays in sources.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { openDb, closeDb } from "../../../src/core/store/db.ts";
import { reserveSource, finishReserved, ensureUnits } from "../../../src/core/store/fts.ts";

function project(root) {
  return {
    projectKey: "r".repeat(16),
    projectDir: join(root, "p"),
    dbPath: join(root, "p", "context.db"),
    worktree: root,
    containmentRoot: root,
    agent: "claude-code",
    source: "env:CLAUDE_PROJECT_DIR",
  };
}

const src = (root) => ({ projectKey: "r".repeat(16), sessionId: "s1", worktree: root, agent: "claude-code", kind: "content", label: "cat big.log#1", bytes: 0, chunkCount: 0, createdAt: Date.now() });

test("D-R4-RESERVE-1: a forced chunk write failure deletes the reserved source row and leaves no orphan", async () => {
  const root = mkdtempSync(join(tmpdir(), "cm-reserve-"));
  try {
    const db = await openDb(project(root));
    const chunks = [{ ord: 0, text: Symbol("not bindable"), bytes: 4 }];
    const id = reserveSource(db, src(root), chunks);
    assert.throws(() => finishReserved(db, id, src(root), chunks, []));
    const left = db.raw.prepare("SELECT COUNT(*) AS n FROM sources WHERE id = ?").get(id).n;
    assert.equal(left, 0, "the reserved row is deleted after the failed write");
    const orphans = db.raw.prepare("SELECT COUNT(*) AS n FROM sources WHERE chunk_count = 0").get().n;
    assert.equal(orphans, 0, "no 0-chunk orphan remains");
    closeDb(db);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("D-R4-RESERVE-1: a successful finishReserved stores the chunks under the reserved id", async () => {
  const root = mkdtempSync(join(tmpdir(), "cm-reserve-ok-"));
  try {
    const db = await openDb(project(root));
    const chunks = [{ ord: 0, text: "alpha beta", bytes: 10 }];
    const id = reserveSource(db, src(root), chunks);
    finishReserved(db, id, src(root), chunks);
    assert.equal(db.raw.prepare("SELECT COUNT(*) AS n FROM chunks WHERE source_id = ?").get(id).n, 1);
    assert.equal(db.raw.prepare("SELECT COUNT(*) AS n FROM line_units WHERE source_id = ?").get(id).n, 0, "du-units: no units at write time");
    ensureUnits(db, "s1");
    assert.equal(db.raw.prepare("SELECT COUNT(*) AS n FROM line_units WHERE source_id = ?").get(id).n, 1, "du-units: the first need builds them");
    closeDb(db);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
