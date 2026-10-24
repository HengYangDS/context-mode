// D-CI-PERF-7: a PreToolUse hook call must not load the stream stack, readline or fs/promises. A static ESM
// `import ... from "node:fs"` anywhere in the hook graph makes the loader build them (about 3 ms per call on Windows).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ENTRY = join(import.meta.dirname, "..", "..", "..", "src", "entries", "hook.ts");
const PRELOAD = `process.on("exit", () => process.stderr.write("LOADED:" + JSON.stringify(process.moduleLoadList)));`;
const BARE = new Set(JSON.parse(spawnSync(process.execPath, ["-p", "JSON.stringify(process.moduleLoadList)"], { encoding: "utf8" }).stdout));

test("PreToolUse hook call does not load stream, readline or fs/promises", () => {
  const input = JSON.stringify({ hook_event_name: "PreToolUse", session_id: "mod-load", cwd: process.cwd(), tool_name: "Bash", tool_input: { command: "true" } });
  const dir = mkdtempSync(join(tmpdir(), "cm-modload-"));
  const pre = join(dir, "pre.cjs");
  writeFileSync(pre, PRELOAD);
  const r = spawnSync(process.execPath, ["--require", pre, ENTRY, "--agent", "claude-code"], { input, encoding: "utf8" });
  rmSync(dir, { recursive: true, force: true });
  assert.equal(r.status, 0, r.stderr);
  const loaded = JSON.parse(r.stderr.split("LOADED:")[1]).filter((m) => !BARE.has(m));
  for (const m of ["NativeModule stream", "NativeModule readline/interface", "NativeModule internal/fs/promises"]) {
    assert.ok(!loaded.includes(m), `${m} is loaded by the hook call`);
  }
});
