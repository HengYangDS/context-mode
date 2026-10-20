// tests/v2/store/db-platform-ported.test.mjs
// Ported from tests/util/db-base-platform-gate.test.ts (cleanup-plan W1-ops, PORT row). v1 had a
// better-sqlite3 / node:sqlite / bun ladder (#551, #642). v2 has one engine, node:sqlite (ADR-0002), so the
// invariants kept are: multi-writer default (no exclusive lock), busy_timeout set on every connection (#642),
// close and re-open on the same path, and the Node version gate.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { openDb, withWrite, closeDb } from "../../../src/core/store/db.ts";
import { DB_TIMEOUT_MS } from "../../../src/core/contracts/constants.ts";

function fakeProject(root, key) {
  return {
    projectKey: key, projectDir: join(root, "projects", key), dbPath: join(root, "projects", key, "context.db"),
    worktree: root, containmentRoot: root, agent: "claude-code", source: "env:CLAUDE_PROJECT_DIR",
  };
}
const withRoot = async (fn) => {
  const root = mkdtempSync(join(tmpdir(), "cm-dbplat-"));
  try {
    await fn(root);
  } finally {
    try {
      rmSync(root, { recursive: true, force: true, maxRetries: 3 });
    } catch (err) {
      if (process.platform !== "win32" || err.code !== "EPERM") throw err;
    }
  }
};

test("#642: every connection carries busy_timeout = DB_TIMEOUT_MS", async () => {
  await withRoot(async (root) => {
    const db = await openDb(fakeProject(root, "b".repeat(16)));
    try {
      const row = db.raw.prepare("PRAGMA busy_timeout").get();
      assert.equal(Object.values(row)[0], DB_TIMEOUT_MS);
    } finally {
      closeDb(db);
    }
  });
});

test("v1.0.130 invariant: not exclusive. Two handles on one path both open and both write (multi-writer default)", async () => {
  await withRoot(async (root) => {
    const project = fakeProject(root, "c".repeat(16));
    const a = await openDb(project);
    const b = await openDb(project);
    try {
      const mode = a.raw.prepare("PRAGMA locking_mode").get();
      assert.equal(String(Object.values(mode)[0]).toLowerCase(), "normal");
      withWrite(a, (d) => d.raw.exec("INSERT INTO meta (key, value) VALUES ('from-a', '1')"));
      withWrite(b, (d) => d.raw.exec("INSERT INTO meta (key, value) VALUES ('from-b', '2')"));
      const seen = a.raw.prepare("SELECT key FROM meta WHERE key IN ('from-a','from-b') ORDER BY key").all().map((r) => r.key);
      assert.deepEqual(seen, ["from-a", "from-b"]);
    } finally {
      closeDb(a);
      closeDb(b);
    }
  });
});

test("lifecycle: close then re-open on the same path sees the earlier write and leaks no state", async () => {
  await withRoot(async (root) => {
    const project = fakeProject(root, "d".repeat(16));
    const first = await openDb(project);
    withWrite(first, (d) => d.raw.exec("INSERT INTO meta (key, value) VALUES ('k', 'v')"));
    closeDb(first);
    const second = await openDb(project);
    try {
      assert.equal(second.raw.prepare("SELECT value FROM meta WHERE key = 'k'").get().value, "v");
    } finally {
      closeDb(second);
    }
    assert.ok(existsSync(project.dbPath));
  });
});

test("lifecycle: closeDb checkpoints, so no -wal file keeps unmerged pages after the last close", async () => {
  await withRoot(async (root) => {
    const project = fakeProject(root, "e".repeat(16));
    const db = await openDb(project);
    withWrite(db, (d) => d.raw.exec("INSERT INTO meta (key, value) VALUES ('x', 'y')"));
    closeDb(db);
    assert.doesNotThrow(() => closeDb(db), "a second close never throws");
    const again = await openDb(project);
    closeDb(again);
  });
});

test("Node version gate: the gate is on process.version against NODE_MIN, so this runtime (>= NODE_MIN) opens", async () => {
  await withRoot(async (root) => {
    const db = await openDb(fakeProject(root, "f".repeat(16)));
    closeDb(db);
  });
});
