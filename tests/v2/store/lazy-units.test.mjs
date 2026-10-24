// Track B (du-units): line units are built on first need from the stored chunks, once per source.
// Red until src/core/store/fts.ts exports ensureUnits and schema v6 adds sources.units_built.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { openDb, closeDb } from "../../../src/core/store/db.ts";
import * as fts from "../../../src/core/store/fts.ts";
import { SCHEMA_VERSION, applyMigrations, DDL, DDL_V2, DDL_V3, DDL_V4, DDL_V5 } from "../../../src/core/store/schema.ts";
import { chunkText } from "../../../src/core/index/chunk.ts";
import { buildUnits } from "../../../src/core/index/units.ts";
import { serverLog, deployConfig, distManifest, testRun } from "../../../e2e/live/compact-hard/gen.mjs";

function project(root) {
  return { projectKey: "u".repeat(16), projectDir: join(root, "p"), dbPath: join(root, "p", "context.db"), worktree: root, containmentRoot: root, agent: "claude-code", source: "env:CLAUDE_PROJECT_DIR" };
}
const draft = (root, label) => ({ sessionId: "s1", worktree: root, agent: "claude-code", kind: "content", label, createdAt: Date.now() });
const unitRows = (db, id) => db.raw.prepare("SELECT ord, body FROM line_units WHERE source_id = ? ORDER BY ord").all(id).map((r) => ({ ord: Number(r.ord), body: r.body }));

test("du-units: schema v6 adds sources.units_built; a v5 DB migrates and keeps its built sources marked", () => {
  assert.equal(SCHEMA_VERSION, 6);
  const dir = mkdtempSync(join(tmpdir(), "cm-du-schema-"));
  try {
    const db = new DatabaseSync(join(dir, "context.db"));
    for (const sql of [DDL, DDL_V2, DDL_V3, DDL_V4, DDL_V5]) db.exec(sql);
    db.exec("PRAGMA user_version = 5");
    db.exec("INSERT INTO sources(session_id, worktree, agent, kind, label, bytes_total, chunk_count, created_ts, created_at, accessed_ts) VALUES ('s1','w','claude-code','content','x',1,1,0,'',0)");
    applyMigrations(db, 5);
    assert.equal(db.prepare("PRAGMA user_version").get().user_version, 6);
    assert.equal(db.prepare("SELECT units_built FROM sources").get().units_built, 1, "v5 rows already have their units");
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("du-units: storing an output writes chunks only; ensureUnits builds the units once, same as buildUnits(text)", async () => {
  const root = mkdtempSync(join(tmpdir(), "cm-du-build-"));
  try {
    const db = await openDb(project(root));
    const golden = {};
    for (const [name, gen, seed] of [["serverLog", serverLog, 101], ["deployConfig", deployConfig, 202], ["distManifest", distManifest, 303], ["testRun", testRun, 404]]) {
      const text = gen(seed).text;
      const chunks = chunkText(text, "text", 48);
      const id = fts.reserveSource(db, draft(root, name), chunks);
      fts.finishReserved(db, id, draft(root, name), chunks);
      assert.equal(unitRows(db, id).length, 0, name + ": the hook path writes no line units");
      golden[id] = buildUnits(text);
    }
    assert.equal(typeof fts.ensureUnits, "function");
    fts.ensureUnits(db, "s1");
    for (const [id, want] of Object.entries(golden)) {
      assert.deepEqual(unitRows(db, Number(id)), want, "units built from the chunks equal today's units");
      assert.equal(db.raw.prepare("SELECT units_built FROM sources WHERE id = ?").get(Number(id)).units_built, 1);
    }
    const before = db.raw.prepare("SELECT COUNT(*) AS n FROM line_units").get().n;
    fts.ensureUnits(db, "s1");
    assert.equal(db.raw.prepare("SELECT COUNT(*) AS n FROM line_units").get().n, before, "the second call does not rebuild");
    fts.deleteChunkRows(db.raw, "all");
    assert.equal(db.raw.prepare("SELECT COUNT(*) AS n FROM line_units").get().n, 0, "delete still removes built units");
    closeDb(db);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("du-units: a text with blank lines keeps today's unit ord after a rebuild from chunks", async () => {
  const root = mkdtempSync(join(tmpdir(), "cm-du-blank-"));
  try {
    const db = await openDb(project(root));
    const text = "a\nb\n\n\nc\n  d\n\n  e\n";
    const chunks = chunkText(text, "text", 48);
    const id = fts.reserveSource(db, draft(root, "blank"), chunks);
    fts.finishReserved(db, id, draft(root, "blank"), chunks);
    fts.ensureUnits(db, "s1");
    assert.deepEqual(unitRows(db, id), buildUnits(text));
    closeDb(db);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
