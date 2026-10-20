// PORT of tests/adapters/pi-{bridge-parent-death,help-skip-bootstrap,no-orphan-on-help,mcp-bridge-env-scrub,
// mcp-bridge,extension-workspace-resolve}.test.ts (#534, #809, #545), cleanup-plan W1-adapters.
// v2 Pi is in-process (ADR-0001 §3, ADR-0016): there is no MCP bridge child, so no orphan, parent-death poll
// or env scrub can exist. What stays true is pinned here: loading the extension does no work (no tool
// registration, no child process) until a real agent turn, and the project comes from ctx.cwd, never ~/.pi.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, mkdirSync, rmSync, realpathSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

import piExtension from "../../../src/entries/pi.ts";
import { resolveProject } from "../../../src/core/project/resolve.ts";

function mockPi() {
  const handlers = {};
  const registered = [];
  return {
    handlers, registered,
    on: (name, fn) => { (handlers[name] ??= []).push(fn); },
    registerTool: (t) => { registered.push(t.name); },
  };
}

test("#534/#809 pi-help-skip-bootstrap: loading the extension registers no tool and runs no hook", () => {
  const pi = mockPi();
  piExtension(pi);
  assert.deepEqual(pi.registered, []);
  assert.ok(pi.handlers.before_agent_start?.length >= 1, "bootstrap is bound to before_agent_start");
});

test("#534 pi-no-orphan-on-help: the Pi entry has no child-process import, so no bridge child can orphan", () => {
  const src = readFileSync(new URL("../../../src/entries/pi.ts", import.meta.url), "utf8");
  assert.doesNotMatch(src, /node:child_process|from "child_process"|\bspawn\(|\bfork\(|server\.bundle/);
});

test("#534 pi-bridge-parent-death: tools register in-process on the first agent turn, once", async () => {
  const pi = mockPi();
  piExtension(pi);
  const ctx = { cwd: tmpdir(), sessionManager: { getSessionId: () => "pi-ported-1" } };
  const turn = pi.handlers.before_agent_start[0];
  await turn({ systemPrompt: "" }, ctx);
  const first = pi.registered.length;
  assert.ok(first > 0, "ctx_* tools registered");
  await turn({ systemPrompt: "" }, ctx);
  assert.equal(pi.registered.length, first, "registered once, not per turn");
});

test("#545 pi-extension-workspace-resolve: project comes from ctx.cwd, and PI_* / foreign env vars do not move it", () => {
  const root = mkdtempSync(join(tmpdir(), "cm-pi-ws-"));
  try {
    const repo = join(root, "repo");
    mkdirSync(repo);
    execFileSync("git", ["init", "-q", repo]);
    const env = { PI_CONFIG_DIR: join(homedir(), ".pi"), CLAUDE_PROJECT_DIR: "/foreign/leak", GEMINI_PROJECT_DIR: "/foreign/leak2" };
    const ctx = resolveProject("pi", { env, argv: [], cwd: join(homedir(), ".pi"), piCwd: repo });
    assert.equal(ctx.worktree, realpathSync.native(repo));
    assert.equal(ctx.source, "pi:ctx.cwd");
    assert.ok(!ctx.worktree.startsWith(join(homedir(), ".pi")), "never rooted under ~/.pi");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
