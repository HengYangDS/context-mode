// [W1-session-journal] Ported from tests/session/{extract-git-commit,parse-git-invocation}.test.ts.
// v1 had `git` / `git_commit` / `cwd` event types. v2 keeps one closed set of journal kinds
// (ADR-0009 §1, schema CHECK on events.kind): git runs are plain `cmd` rows with key = tool + canonical
// command, so the commit message and `-C <dir>` text stay in the key. Claude Code restores git status
// itself after compaction (ADR-0009 §0 context), so no git-specific kind exists. See DEVIATIONS D-M7-CLN-2.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { openDb, closeDb } from "../../../src/core/store/db.ts";
import { appendEvent, canonicalKey } from "../../../src/core/journal/append.ts";
import { readSessionEvents } from "../../../src/core/journal/read.ts";

async function freshDb() {
  const root = mkdtempSync(join(tmpdir(), "cm-journal-ported-"));
  const key = "g".repeat(16);
  const project = {
    projectKey: key, projectDir: join(root, "projects", key), dbPath: join(root, "projects", key, "context.db"),
    worktree: root, containmentRoot: root, agent: "claude-code", source: "env:CLAUDE_PROJECT_DIR",
  };
  return { db: await openDb(project), root };
}

function cmdRow(command, overrides) {
  return {
    session_id: "s1", worktree: "/w", agent: "claude-code", kind: "cmd", tool: "Bash",
    key: canonicalKey("Bash", command), path: null, ok: 1, exit_code: null, bytes: 0, body: "", turn: 1,
    sandbox_bytes: 0, returned_bytes: 0, ...overrides,
  };
}

test("[W1-session-journal] git commit message survives in the cmd key (extract-git-commit)", () => {
  assert.equal(canonicalKey("Bash", `git commit -m "feat: x"`), `Bash:git commit -m "feat: x"`);
  assert.equal(canonicalKey("Bash", `git commit -m 'single quoted'`), `Bash:git commit -m 'single quoted'`);
  assert.equal(canonicalKey("Bash", `git commit -am "stage+commit"`), `Bash:git commit -am "stage+commit"`);
  assert.equal(canonicalKey("Bash", `git commit --message=longform`), `Bash:git commit --message=longform`);
  assert.equal(canonicalKey("Bash", `git commit -m "fix: navbar — handle long URLs"`), `Bash:git commit -m "fix: navbar — handle long URLs"`);
  assert.equal(canonicalKey("Bash", `GIT_AUTHOR_DATE=now git commit -m "with env"`), `Bash:GIT_AUTHOR_DATE=now git commit -m "with env"`);
});

test("[W1-session-journal] whitespace in a commit message is kept, outside quotes is folded", () => {
  assert.equal(canonicalKey("Bash", `git   commit  -m "a   b"`), `Bash:git commit -m "a   b"`);
});

test("[W1-session-journal] -C / --directory forms stay verbatim in the key (parse-git-invocation)", () => {
  for (const c of ["git -C ~/repos/myrepo status", "git --directory=/abs/x log", "git --directory /abs/x log",
    "git -C ~ status", "git -C ~someoneelse/foo status", "git -C relative/path status", "git --directory=~/abs status"]) {
    assert.equal(canonicalKey("Bash", c), "Bash:" + c);
  }
});

test("[W1-session-journal] a git commit is stored as a cmd row, not a git_commit row", async () => {
  const { db, root } = await freshDb();
  try {
    appendEvent(db, cmdRow(`git -C ~/repos commit -m "feat: x"`));
    appendEvent(db, cmdRow(`git push origin main`));
    const rows = readSessionEvents(db, "s1");
    assert.deepEqual(rows.map((r) => r.kind), ["cmd", "cmd"]);
    assert.equal(rows[0].key, `Bash:git -C ~/repos commit -m "feat: x"`);
    assert.deepEqual(readSessionEvents(db, "s1", "cmd").length, 2);
  } finally {
    closeDb(db);
    rmSync(root, { recursive: true, force: true });
  }
});

test("[W1-session-journal] the closed kind set rejects v1 git / git_commit / cwd / rule kinds", async () => {
  const { db, root } = await freshDb();
  try {
    for (const kind of ["git", "git_commit", "cwd", "rule", "intent", "role"]) {
      assert.throws(() => appendEvent(db, cmdRow("git status", { kind })), undefined, kind);
    }
    assert.equal(readSessionEvents(db, "s1").length, 0);
  } finally {
    closeDb(db);
    rmSync(root, { recursive: true, force: true });
  }
});
