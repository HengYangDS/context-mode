// W1-core PORT of tests/security.test.ts, tests/core/deny-policy.test.ts, tests/security/project-boundary-852.test.ts
// to the v2 decide() surface (ADR-0008, impl/08 §4, §6). Same inputs as v1; v2 verdict shape ({kind}).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decide } from "../../../src/core/policy/decide.ts";
import { matchesAnyDenyPattern } from "../../../src/core/policy/user-deny.ts";
import { getAdapter } from "../../../src/adapters/table.ts";

const CC = getAdapter("claude-code");
const RULES = ["Bash(sudo *)", "Bash(rm -rf /*)"];
const ev = (name, input, cwd = "/tmp") => ({ event: "PreToolUse", agent: "claude-code", sessionId: "s", cwd, tool: { name, canonicalName: name, input } });
const bash = (command, deny = RULES) => decide(ev("Bash", { command }), CC, deny);

// security.test.ts "Chained Command Evaluation" + "Chained Command Splitting" + "extractSubshellCommands"
for (const c of [
  "echo ok && sudo rm -rf /", "cd /tmp; sudo apt install vim", "cat file | rm -rf /etc",
  "git status\nsudo rm -rf /", "echo a & sudo ls", "git status $(sudo rm -rf /)", "git status `sudo rm -rf /`",
  "git status $(sudo rm -rf / | cat)", "echo \"$(sudo rm -rf /)\"", "echo $(printf '(x)' | cat) && sudo ls",
  "git checkout $(echo $(sudo ls))", "git status \\\\$(sudo rm -rf /)", "echo $(( $(sudo rm -rf /) + 1 ))",
  "echo $(( `sudo ls` + 1 ))", "SUDO rm -rf /",
]) {
  test(`[W1-core] deny rule holds across chain/subshell/quote forms: ${JSON.stringify(c)}`, () => {
    assert.equal(bash(c).kind, "deny");
  });
}
for (const c of [
  "echo hello && git status", "echo hello \"&& sudo ls\"", "echo 'test; sudo ls'", "echo '$(sudo rm -rf /)'",
  "echo $((1 + 2))", "echo hello \\& sudo ls", "sudoedit x", "git status",
]) {
  test(`[W1-core] safe forms are not denied: ${JSON.stringify(c)}`, () => {
    assert.equal(bash(c).kind, "allow");
  });
}
test("[W1-core] deny reason names the matched user pattern", () => {
  const d = bash("echo ok && sudo ls");
  assert.equal(d.kind, "deny");
  assert.ok(d.reason.includes("Bash(sudo *)"));
});
test("[W1-core] colon format Bash(tree:*) is a prefix rule (parseBashPattern parity)", () => {
  assert.notEqual(matchesAnyDenyPattern("tree -L 2", ["Bash(tree:*)"]), null);
  assert.equal(matchesAnyDenyPattern("treetop", ["Bash(tree:*)"]), null);
  assert.equal(matchesAnyDenyPattern("x", ["Read(.env)", "notapattern", "Bash("]), null);
});

// security.test.ts "evaluateFilePath" + deny-policy.test.ts Windows glob rows
const readHit = (path, glob, projectDir = "/tmp/p") => matchesAnyDenyPattern(path, ["Read(" + glob + ")"], { tool: "Read", projectDir });
test("[W1-core] Read(**/.env) matches nested and top-level .env", () => {
  assert.notEqual(readHit("/tmp/p/deep/nested/.env", "**/.env"), null);
  assert.notEqual(readHit("/tmp/p/.env", "**/.env"), null);
});
test("[W1-core] Read(**/*credentials*) matches secrets/credentials.json, not readme.md", () => {
  assert.notEqual(readHit("/tmp/p/secrets/credentials.json", "**/*credentials*"), null);
  assert.equal(readHit("/tmp/p/readme.md", "**/*credentials*"), null);
});
test("[W1-core] Windows backslash glob matches a backslash candidate", () => {
  assert.notEqual(readHit("C:\\Users\\runner\\proj\\secret.env", "C:\\Users\\runner\\proj\\secret.env"), null);
});
test("[W1-core] a ../ traversal into a denied absolute dir is resolved before the match (v1 projectRoot fix)", () => {
  const d = decide(ev("Read", { file_path: "../.ssh/id_rsa" }, "/tmp/p"), CC, ["Read(//tmp/.ssh/**)"]);
  assert.equal(d.kind, "deny");
  assert.equal(decide(ev("Read", { file_path: "/tmp/p/x" }, "/tmp/p"), CC, ["Read(//tmp/.ssh/**)"]).kind, "allow");
});

// project-boundary-852: v2 containment is src/core/project/contain.ts isInside (tests/v2/store/contain.test.mjs
// covers it); the ctx_execute file argument boundary is checked here end to end.
test("[W1-core] #852: ctx_execute file outside the project is refused, inside is allowed (symlink escape too)", async () => {
  const { ctxExecute } = await import("../../../src/core/tools/execute.ts");
  const root = realpathSync(mkdtempSync(join(tmpdir(), "cm-852-")));
  const outside = realpathSync(mkdtempSync(join(tmpdir(), "cm-852o-")));
  try {
    writeFileSync(join(root, "in.txt"), "x");
    writeFileSync(join(outside, "out.txt"), "y");
    symlinkSync(outside, join(root, "link"));
    const k = "1".repeat(16);
    const ctx = { project: { projectKey: k, projectDir: join(root, "p"), dbPath: join(root, "p", "c.db"), worktree: root, containmentRoot: root, agent: "claude-code", source: "env:CLAUDE_PROJECT_DIR" }, sessionId: "s", turn: 1, signal: new AbortController().signal };
    const run = (file) => ctxExecute.handler({ language: "shell", code: "echo ok", file }, ctx);
    assert.equal((await run("in.txt")).isError, false);
    assert.equal((await run(join(outside, "out.txt"))).isError, true);
    assert.equal((await run("../" + outside.split("/").pop() + "/out.txt")).isError, true);
    assert.equal((await run("link/out.txt")).isError, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});
