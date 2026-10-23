// Unit tests for src/core/hooks/io.ts readStdin (DEVIATIONS D-CI-PERF-6): the bytes on stdin come back unchanged,
// and the read does not build the process.stdin stream stack (net, stream, pipe_wrap) on a pipe.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const IO = join(import.meta.dirname, "..", "..", "..", "src", "core", "hooks", "io.ts");
const PROBE = `const { readStdin } = await import(${JSON.stringify(IO)});
const before = new Set(process.moduleLoadList);
const s = await readStdin();
const added = process.moduleLoadList.filter((m) => !before.has(m));
process.stderr.write(JSON.stringify({ len: Buffer.byteLength(s), net: added.includes("NativeModule net"), stream: added.includes("NativeModule stream") }));
process.stdout.write(s);`;

function run(input) {
  return spawnSync(process.execPath, ["--input-type=module", "-e", PROBE], { input, encoding: "utf8", maxBuffer: 1 << 26 });
}

for (const [name, input] of [["empty", ""], ["small JSON", JSON.stringify({ hook_event_name: "PreToolUse", tool_input: { command: "ls ü 😀" } })], ["1 MiB", "x".repeat(1 << 20)]]) {
  test(`readStdin returns the stdin bytes unchanged: ${name}`, () => {
    const r = run(input);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, input);
    assert.equal(JSON.parse(r.stderr).len, Buffer.byteLength(input));
  });
}

test("readStdin on a pipe loads no net or stream module (D-CI-PERF-6)", () => {
  const r = run("{}");
  assert.equal(r.status, 0, r.stderr);
  const info = JSON.parse(r.stderr);
  assert.equal(info.net, false, "net loaded: stdin went through the process.stdin stream");
  assert.equal(info.stream, false, "stream loaded: stdin went through the process.stdin stream");
});
