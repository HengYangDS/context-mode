// D-CI-PERF-7: the built hook bundle on a PreToolUse hook call must not load the stream stack, readline or fs/promises. A static ESM
// `import ... from "node:fs"` anywhere in the hook graph makes the loader build them (about 3 ms per call on Windows).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..", "..");
// The preload writes with fs, not process.stderr: touching process.stderr would itself build the stream stack.
const PRELOAD = `process.on("exit", () => require("node:fs").writeFileSync(process.env.CM_MODLOAD_OUT, JSON.stringify(process.moduleLoadList)));`;
const BARE = new Set(JSON.parse(spawnSync(process.execPath, ["-p", "JSON.stringify(process.moduleLoadList)"], { encoding: "utf8" }).stdout));

test("PreToolUse hook call does not load stream, readline or fs/promises", () => {
  const input = JSON.stringify({ hook_event_name: "PreToolUse", session_id: "mod-load", cwd: process.cwd(), tool_name: "Bash", tool_input: { command: "true" } });
  const dir = mkdtempSync(join(tmpdir(), "cm-modload-"));
  const out = join(dir, "out");
  const b = spawnSync(process.execPath, [join(ROOT, "build", "build.mjs"), "--out", out], { encoding: "utf8", cwd: ROOT });
  assert.equal(b.status, 0, b.stderr);
  const pre = join(dir, "pre.cjs");
  writeFileSync(pre, PRELOAD);
  const r = spawnSync(process.execPath, ["--require", pre, join(out, "hook.mjs"), "--agent", "claude-code"], { input, encoding: "utf8", env: { ...process.env, CM_MODLOAD_OUT: join(dir, "loaded.json") } });
  assert.equal(r.status, 0, r.stderr);
  const loaded = JSON.parse(readFileSync(join(dir, "loaded.json"), "utf8")).filter((m) => !BARE.has(m));
  rmSync(dir, { recursive: true, force: true });
  for (const m of ["NativeModule stream", "NativeModule readline/interface", "NativeModule internal/fs/promises"]) {
    assert.ok(!loaded.includes(m), `${m} is loaded by the hook call`);
  }
});
