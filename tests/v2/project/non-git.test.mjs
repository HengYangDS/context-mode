// D-M7-NG-1: one fixed project rule (impl/02 §2). A .git found walking up from the project dir ->
// the project is the git common dir, worktree = the dir that holds that .git (unchanged). No .git up
// to the filesystem root -> the project is realpath(dir) and worktree = containmentRoot = realpath(dir).
// The project source per agent (CLAUDE_PROJECT_DIR, --workspace-folder, cwd, ...) is unchanged.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveProject } from "../../../src/core/project/resolve.ts";
import { sha256Hex } from "../../../src/core/project/sha256.ts";

const keyOf = (p) => sha256Hex(p).slice(0, 16);

function withTmp(fn) {
  const base = mkdtempSync(join(tmpdir(), "cm-ng-"));
  try {
    return fn(base);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

test("D-M7-NG-1: a non-git dir is a project keyed by its realpath", () => {
  withTmp((base) => {
    const real = realpathSync.native(base);
    const ctx = resolveProject("codex", { env: {}, argv: ["--agent", "codex"], cwd: base });
    assert.equal(ctx.worktree, real);
    assert.equal(ctx.projectKey, keyOf(real));
    assert.equal(ctx.containmentRoot, real);
    assert.equal(ctx.source, "arg:--agent+cwd");
    assert.equal(ctx.dbPath.endsWith(join(ctx.projectKey, "context.db")), true);
  });
});

test("D-M7-NG-1: claude-code with CLAUDE_PROJECT_DIR on a non-git dir resolves that dir", () => {
  withTmp((base) => {
    const real = realpathSync.native(base);
    const ctx = resolveProject("claude-code", { env: { CLAUDE_PROJECT_DIR: base }, argv: [], cwd: tmpdir() });
    assert.equal(ctx.worktree, real);
    assert.equal(ctx.projectKey, keyOf(real));
    assert.equal(ctx.source, "env:CLAUDE_PROJECT_DIR");
  });
});

test("D-M7-NG-1: a nested non-git dir is its own project, not its non-git parent", () => {
  withTmp((base) => {
    const nested = join(base, "a", "b", "c");
    mkdirSync(nested, { recursive: true });
    const outer = resolveProject("codex", { env: {}, argv: [], cwd: base });
    const inner = resolveProject("codex", { env: {}, argv: [], cwd: nested });
    assert.equal(inner.worktree, realpathSync.native(nested));
    assert.equal(inner.projectKey, keyOf(realpathSync.native(nested)));
    assert.notEqual(inner.projectKey, outer.projectKey);
    assert.equal(inner.containmentRoot, realpathSync.native(nested));
  });
});

test("D-M7-NG-1: a symlink to a non-git dir gets the same key as the dir", () => {
  withTmp((base) => {
    const dir = join(base, "d");
    mkdirSync(dir);
    symlinkSync(dir, join(base, "link"));
    const viaDir = resolveProject("codex", { env: {}, argv: [], cwd: dir });
    const viaLink = resolveProject("codex", { env: {}, argv: [], cwd: join(base, "link") });
    assert.equal(viaLink.projectKey, viaDir.projectKey);
    assert.equal(viaLink.worktree, viaDir.worktree);
  });
});

test("D-M7-NG-1: a dir below a git repo still resolves to the repo (git rule unchanged)", () => {
  withTmp((base) => {
    const repo = join(base, "repo");
    mkdirSync(join(repo, "src", "deep"), { recursive: true });
    execFileSync("git", ["init", "-q", repo]);
    const commonDir = realpathSync.native(join(repo, ".git"));
    const ctx = resolveProject("codex", { env: {}, argv: [], cwd: join(repo, "src", "deep") });
    assert.equal(ctx.worktree, realpathSync.native(repo));
    assert.equal(ctx.projectKey, keyOf(commonDir));
    assert.equal(ctx.containmentRoot, realpathSync.native(base));
  });
});

test("D-M7-NG-1: a linked worktree still shares the main repo key (git rule unchanged)", () => {
  withTmp((base) => {
    const repo = join(base, "repo");
    const wt = join(base, "wt");
    mkdirSync(repo);
    execFileSync("git", ["init", "-q", repo]);
    execFileSync("git", ["-c", "user.email=t@example.com", "-c", "user.name=t", "commit", "--allow-empty", "-m", "i", "-q"], { cwd: repo });
    execFileSync("git", ["worktree", "add", "-q", wt, "-b", "wt"], { cwd: repo });
    const main = resolveProject("codex", { env: {}, argv: [], cwd: repo });
    const linked = resolveProject("codex", { env: {}, argv: [], cwd: wt });
    assert.equal(linked.projectKey, main.projectKey);
    assert.equal(linked.projectKey, keyOf(realpathSync.native(join(repo, ".git"))));
    assert.equal(linked.worktree, realpathSync.native(wt));
    assert.equal(linked.containmentRoot, main.containmentRoot);
  });
});

test("D-M7-NG-1: the filesystem root as project dir is a project keyed by its realpath", (t) => {
  const root = realpathSync.native("/");
  if (existsSync(join(root, ".git"))) return t.skip("the filesystem root is a git repo on this machine");
  const ctx = resolveProject("codex", { env: {}, argv: [], cwd: "/" });
  assert.equal(ctx.worktree, root);
  assert.equal(ctx.projectKey, keyOf(root));
  assert.equal(ctx.containmentRoot, root);
});
