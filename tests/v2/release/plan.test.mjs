// Unit tests for scripts/release/plan.mjs (impl/13 §10, A11, DEVIATIONS D-M6-arch-4).
// Each test seeds a scratch git repo and runs the real script in it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const PLAN = path.join(REPO, "scripts", "release", "plan.mjs");
const GIT_ID = ["-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", "-c", "init.defaultBranch=main"];

function git(dir, ...args) {
  const r = spawnSync("git", [...GIT_ID, ...args], { cwd: dir, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}

function commit(dir, subject) {
  git(dir, "commit", "--allow-empty", "-q", "-m", subject);
  return git(dir, "rev-parse", "HEAD");
}

// A work repo with a local bare `origin` (plan.mjs reads the pushed tags there; D-FU-RF-1).
function seed(t) {
  const root = mkdtempSync(path.join(tmpdir(), "cm-v2-plan-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bare = path.join(root, "origin.git");
  const dir = path.join(root, "work");
  git(root, "init", "-q", "--bare", bare);
  git(root, "init", "-q", dir);
  git(dir, "remote", "add", "origin", bare);
  return dir;
}

// release branch commit: plugin.json at `version` and the Source-Commit trailer. Makes the branch as an
// orphan, or adds a child when it exists. tag: "annotated" (pushed v<version>), "lightweight", or "none"
// (a rehearsal commit: nothing pushed to origin).
function release(dir, version, sourceSha, { tag = "annotated" } = {}) {
  const exists = spawnSync("git", ["rev-parse", "--verify", "--quiet", "refs/heads/release"], { cwd: dir }).status === 0;
  if (exists) {
    git(dir, "checkout", "-q", "release");
  } else {
    git(dir, "checkout", "-q", "--orphan", "release");
    git(dir, "rm", "-rq", "--cached", "--ignore-unmatch", ".");
  }
  mkdirSync(path.join(dir, ".claude-plugin"), { recursive: true });
  writeFileSync(path.join(dir, ".claude-plugin", "plugin.json"), JSON.stringify({ name: "context-mode", version }));
  git(dir, "add", ".claude-plugin/plugin.json");
  git(dir, "commit", "-q", "-m", `release ${version}\n\nSource-Commit: ${sourceSha}`);
  rmSync(path.join(dir, ".claude-plugin"), { recursive: true, force: true });
  if (tag === "annotated") git(dir, "tag", "-a", `v${version}`, "-m", `v${version}`, "release");
  if (tag === "lightweight") git(dir, "tag", `v${version}`, "release");
  if (tag !== "none") git(dir, "push", "-q", "origin", `refs/tags/v${version}`);
  git(dir, "checkout", "-q", "main");
}

function plan(dir, ...args) {
  const r = spawnSync(process.execPath, [PLAN, ...args], { cwd: dir, encoding: "utf8" });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function released(t, version, after, opts) {
  const dir = seed(t);
  commit(dir, "feat: old feature");
  const src = commit(dir, "fix: old fix");
  release(dir, version, src, opts);
  for (const s of after) commit(dir, s);
  return dir;
}

function versionOf(stdout) {
  return stdout.split("\n")[0];
}

test("[M6] release/plan: no release branch -> first release 2.0.0 (A11)", (t) => {
  const dir = seed(t);
  commit(dir, "chore: init");
  commit(dir, "feat: first");
  const r = plan(dir);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(versionOf(r.stdout), "version=2.0.0");
});

test("[M6] release/plan: fix/perf since Source-Commit -> patch", (t) => {
  const r = plan(released(t, "2.0.0", ["fix: a", "perf(store): b", "docs: c"]));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(versionOf(r.stdout), "version=2.0.1");
});

test("[M6] release/plan: feat -> minor, patch resets", (t) => {
  const r = plan(released(t, "2.3.4", ["fix: a", "feat(tools): b"]));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(versionOf(r.stdout), "version=2.4.0");
});

test("[M6] release/plan: feat! and fix(core)! -> major", (t) => {
  for (const s of ["feat!: drop x", "fix(core)!: change y"]) {
    const r = plan(released(t, "2.3.4", ["feat: a", s]));
    assert.equal(r.status, 0, r.stderr);
    assert.equal(versionOf(r.stdout), "version=3.0.0");
  }
});

test("[M6] release/plan: commits before the Source-Commit trailer are not counted", (t) => {
  // "feat: old feature" sits before the trailer sha; only the fix after it counts.
  const r = plan(released(t, "2.0.0", ["fix: only this"]));
  assert.equal(versionOf(r.stdout), "version=2.0.1");
  assert.ok(!r.stdout.includes("old feature"));
});

test("[M6] release/plan: no releasable commit -> exit 1, one stderr line", (t) => {
  const dir = released(t, "2.0.0", ["docs: a", "chore: b", "featx: c"]);
  const src = git(dir, "log", "-1", "--format=%B", "release").split("Source-Commit: ")[1].trim();
  const r = plan(dir);
  assert.equal(r.status, 1);
  assert.equal(r.stdout, "");
  assert.equal(r.stderr, `release failed: no releasable commits since ${src}\n`);
});

test("[M6] release/plan: GITHUB_OUTPUT form, notes grouped by type", (t) => {
  const r = plan(released(t, "2.0.0", ["fix: f1", "feat(a): n1", "perf: p1", "feat!: b1", "chore: skip me"]));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, [
    "version=3.0.0",
    "notes<<EOF",
    "### Breaking", "- feat!: b1", "",
    "### Features", "- feat(a): n1", "",
    "### Fixes", "- fix: f1", "",
    "### Performance", "- perf: p1",
    "EOF", "",
  ].join("\n"));
});

test("[M6] release/plan: --dry-run prints text, --skip-live adds the line", (t) => {
  const r = plan(released(t, "2.0.0", ["fix: f1"]), "--dry-run", "--skip-live");
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, [
    "version: 2.0.1", "",
    "### Fixes", "- fix: f1", "",
    "Live E2E skipped for this release.", "",
  ].join("\n"));
});

test("[M6] release/plan: unknown flag -> exit 1", (t) => {
  const r = plan(released(t, "2.0.0", ["fix: f1"]), "--bogus");
  assert.equal(r.status, 1);
  assert.equal(r.stderr, "release failed: unknown argument --bogus\n");
});

// D-FU-RF-1: the last release is the newest annotated v2+ tag on origin that the release branch contains.

test("[M6] release/plan: rehearsal release branch (no pushed tag) -> 2.0.0 over all history", (t) => {
  const dir = released(t, "2.0.0", ["fix: after the rehearsal"], { tag: "none" });
  const r = plan(dir);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(versionOf(r.stdout), "version=2.0.0");
  assert.ok(r.stdout.includes("- feat: old feature"), "range is the whole history, not since the rehearsal trailer");
  assert.ok(r.stdout.includes("- fix: after the rehearsal"));
});

test("[M6] release/plan: rehearsal branch with only docs commits after it still plans 2.0.0", (t) => {
  const r = plan(released(t, "2.0.0", ["docs: a"], { tag: "none" }));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(versionOf(r.stdout), "version=2.0.0");
});

test("[M6] release/plan: tagged v2.0.0 on origin + new commits -> next version", (t) => {
  const dir = released(t, "2.0.0", ["feat: new"]);
  const r = plan(dir);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(versionOf(r.stdout), "version=2.1.0");
});

test("[M6] release/plan: the newest tagged release on the branch is the base, an untagged commit after it is ignored", (t) => {
  const dir = released(t, "2.0.0", []);
  const src2 = commit(dir, "fix: second release source");
  release(dir, "2.0.1", src2);
  const src3 = commit(dir, "docs: later");
  release(dir, "2.0.2", src3, { tag: "none" }); // a rehearsal commit on top of the tagged release
  commit(dir, "fix: newest");
  const r = plan(dir, "--dry-run");
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, ["version: 2.0.2", "", "### Fixes", "- fix: newest", ""].join("\n"));
});

test("[M6] release/plan: tagged release v2.0.0 that the release branch does not contain -> refuse", (t) => {
  const dir = released(t, "2.0.0", ["fix: a"]);
  const tagged = git(dir, "rev-parse", "v2.0.0^{commit}");
  git(dir, "branch", "-D", "release");
  release(dir, "2.0.0", commit(dir, "fix: other source"), { tag: "none" }); // a new orphan release branch
  const r = plan(dir);
  assert.equal(r.status, 1);
  assert.equal(r.stdout, "");
  assert.equal(r.stderr, `release failed: tagged release v2.0.0 (${tagged}) is not in release; refusing\n`);
});

test("[M6] release/plan: tagged release on origin but no release branch -> refuse", (t) => {
  const dir = released(t, "2.0.0", ["fix: a"]);
  git(dir, "branch", "-D", "release");
  const r = plan(dir);
  assert.equal(r.status, 1);
  assert.ok(r.stderr.startsWith("release failed: tagged release v2.0.0 ("), r.stderr);
});

test("[M6] release/plan: v1 tags and lightweight v2 tags on origin are not releases", (t) => {
  const dir = seed(t);
  commit(dir, "chore: init");
  git(dir, "tag", "-a", "v1.0.0", "-m", "v1.0.0");
  git(dir, "push", "-q", "origin", "refs/tags/v1.0.0");
  const src = commit(dir, "feat: first");
  const noBranch = plan(dir);
  assert.equal(noBranch.status, 0, noBranch.stderr);
  assert.equal(versionOf(noBranch.stdout), "version=2.0.0");
  release(dir, "2.0.0", src, { tag: "lightweight" }); // pushed as a lightweight tag: not a release
  const r = plan(dir);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(versionOf(r.stdout), "version=2.0.0");
});

test("[M6] release/plan: origin that cannot be read -> exit 1, one stderr line", (t) => {
  const dir = released(t, "2.0.0", ["fix: a"]);
  git(dir, "remote", "set-url", "origin", path.join(dir, "no-such-remote"));
  const r = plan(dir);
  assert.equal(r.status, 1);
  assert.equal(r.stdout, "");
  assert.ok(r.stderr.startsWith("release failed: git ls-remote origin: "), r.stderr);
  assert.equal(r.stderr.trim().split("\n").length, 1);
});
