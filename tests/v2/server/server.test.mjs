// Unit tests for src/entries/server.ts (impl/11 §5) and src/core/lifecycle/exit.ts (impl/11 §4).
import { test } from "node:test";
import assert from "node:assert/strict";
import { installExitGuard } from "../../../src/core/lifecycle/exit.ts";
import { INSTRUCTIONS } from "../../../src/entries/server.ts";
import * as C from "../../../src/core/contracts/constants.ts";

test("INSTRUCTIONS is a non-empty string under INSTRUCTIONS_CAP", () => {
  assert.equal(typeof INSTRUCTIONS, "string");
  assert.ok(INSTRUCTIONS.length > 0);
  assert.ok(INSTRUCTIONS.length <= C.INSTRUCTIONS_CAP);
});

test("INSTRUCTIONS carries no case-sensitive lint-banned words (ADR-0005)", () => {
  for (const banned of ["MUST", "NEVER", "ALWAYS", "CRITICAL", "MANDATORY", "IMPORTANT", "REQUIRED", "DO NOT"]) {
    assert.ok(!INSTRUCTIONS.includes(banned), banned);
  }
});

test("installExitGuard registers nothing on stdin when isTTY is true", () => {
  const before = process.stdin.listenerCount("end");
  installExitGuard({ onShutdown: () => {}, isTTY: true });
  assert.equal(process.stdin.listenerCount("end"), before);
});

test("installExitGuard attaches an 'end' listener when isTTY is false", () => {
  const beforeListeners = process.stdin.listeners("end");
  installExitGuard({ onShutdown: () => {}, isTTY: false });
  const afterListeners = process.stdin.listeners("end");
  assert.equal(afterListeners.length, beforeListeners.length + 1);
  // Remove the listener this test added, so a later 'end' emit does not fire it (D-M2-F1-1).
  process.stdin.removeListener("end", afterListeners.find((l) => !beforeListeners.includes(l)));
});

// The real guard sends SIGTERM to process.pid on 'end' (impl/11 §4 step 4), which would kill
// this test runner. So process.kill and setTimeout are mocked: the test checks onShutdown, the
// SIGTERM sent at once, and the SIGKILL sent after EXIT_SIGKILL_MS (D-M2-F1-1).
test("installExitGuard calls onShutdown on stdin 'end', then SIGTERM, then SIGKILL", (t) => {
  const kills = [];
  t.mock.method(process, "kill", (pid, sig) => { kills.push([pid, sig]); return true; });
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let called = false;
  installExitGuard({ onShutdown: () => { called = true; }, isTTY: false });
  process.stdin.emit("end");
  assert.equal(called, true);
  assert.deepEqual(kills, [[process.pid, "SIGTERM"]]);
  t.mock.timers.tick(C.EXIT_SIGKILL_MS - 1);
  assert.deepEqual(kills, [[process.pid, "SIGTERM"]]);
  t.mock.timers.tick(1);
  assert.deepEqual(kills, [[process.pid, "SIGTERM"], [process.pid, "SIGKILL"]]);
});

// D-CR2-SID-1: the MCP server uses the session id the hooks journal under, when the host exposes it.
test("sessionIdOf: _meta first, then the host session env, then mcp:<serverId>", async () => {
  const { sessionIdOf } = await import("../../../src/entries/server.ts");
  const env = { CLAUDE_CODE_SESSION_ID: "280ff837-09ba-4152-bb02-89ec3a42eca9" };
  assert.equal(sessionIdOf({ sessionId: "m-1" }, "claude-code", env, "srv"), "m-1");
  assert.equal(sessionIdOf(undefined, "claude-code", env, "srv"), "280ff837-09ba-4152-bb02-89ec3a42eca9");
  assert.equal(sessionIdOf(undefined, "claude-code", {}, "srv"), "mcp:srv");
  assert.equal(sessionIdOf(undefined, "claude-code", { CLAUDE_CODE_SESSION_ID: "" }, "srv"), "mcp:srv");
  // A host without a session env keeps the process-local id.
  assert.equal(sessionIdOf(undefined, "gemini", env, "srv"), "mcp:srv");
  assert.equal(sessionIdOf(undefined, undefined, env, "srv"), "mcp:srv");
});
