// tests/v2/adapters/opencode-plugin-loader.test.mjs
// ADR-0020 (opencode hook channel). OpenCode 1.19.4 loads a plugin module this way (binary, function DT/h2):
// a default export object with id (string) and server(input) is used as is; else every named export must be a
// function, or the load fails with "Plugin export is not a function". This test pins the default export shape.
import { test } from "node:test";
import assert from "node:assert/strict";

test("ADR-0020: opencode plugin default export is { id, server } and server returns the hook object", async () => {
  const mod = await import("../../../src/entries/opencode.ts");
  const d = mod.default;
  assert.ok(d && typeof d === "object", "default export is an object");
  assert.equal(typeof d.id, "string");
  assert.ok(d.id.trim().length > 0);
  assert.equal(typeof d.server, "function");
  assert.equal("tui" in d, false, "server only, never tui");
  const hooks = await d.server({ directory: process.cwd() }, {});
  for (const k of ["chat.message", "tool.execute.before", "tool.execute.after", "experimental.chat.system.transform", "experimental.session.compacting", "event"]) {
    assert.equal(typeof hooks[k], "function", k);
  }
});
