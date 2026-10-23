// tests/v2/setup/engine.test.mjs
// Spec: docs/v2/adr/0019-interactive-setup-and-npm-channel.md section 3 (setup flow) and Owner decisions D3, D4;
// docs/v2/spikes/setup/S-V1.md (v1 entries). E2E style: temp HOME, a fake package dir (server.mjs answers MCP
// initialize + tools/list, hook.mjs answers a hook call), fake agent binaries on a temp PATH.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { ADAPTERS } from "../../../src/adapters/table.ts";
import { TOOL_ORDER } from "../../../src/core/contracts/constants.ts";
import { assertWritable, buildRegistry, runRemove, runSetup, whichBin, winCmdLine, LOCK_FILE, BACKUP_DIR } from "../../../src/setup/index.ts";

const NODE = process.execPath;

function fakePkg(root, { tools = TOOL_ORDER } = {}) {
  const dir = path.join(root, "pkg");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "server.mjs"), `
import { createInterface } from "node:readline";
const tools = ${JSON.stringify([...tools])};
const rl = createInterface({ input: process.stdin });
rl.on("line", (l) => {
  const m = JSON.parse(l);
  if (m.id === undefined) return;
  const result = m.method === "initialize"
    ? { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "context-mode", version: "2.0.0" } }
    : { tools: tools.map((name) => ({ name, inputSchema: { type: "object" } })) };
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: m.id, result }) + "\\n");
});
`);
  writeFileSync(path.join(dir, "hook.mjs"), `let s = ""; process.stdin.on("data", (d) => { s += d; }); process.stdin.on("end", () => { JSON.parse(s); });\n`);
  writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "context-mode", version: "2.0.0" }));
  return dir;
}

function fakeBin(root, name, script) {
  const dir = path.join(root, "bin");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  writeFileSync(file, `#!/bin/sh\n${script}\n`);
  chmodSync(file, 0o755);
  return dir;
}

function sandbox(t) {
  const root = mkdtempSync(path.join(tmpdir(), "cm-setup-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const home = path.join(root, "home");
  mkdirSync(home, { recursive: true });
  const bin = path.join(root, "bin");
  mkdirSync(bin, { recursive: true });
  // The D3 timing budget is gated by e2e/checks/setup-hook-overhead.mjs; shared runners jitter past 15 ms here.
  return { root, home, bin, pkgDir: fakePkg(root),
    env: { PATH: [bin, "/usr/bin", "/bin"].join(path.delimiter), HOME: home, CM_HOOK_OVERHEAD_BUDGET_MS: "60000" } };
}

function put(file, text) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
  return file;
}

const CODEX_V1 = `model = "o3"\n\n[mcp_servers.context-mode]\ncommand = "context-mode"\n`;
const KIRO_USER = `{\n  "mcpServers": {\n    "other": { "command": "other-server" }\n  }\n}\n`;
const CODEX_HOOKS_V1 = JSON.stringify({ hooks: { PreToolUse: [{ hooks: [{ type: "command", command: "context-mode hook codex PreToolUse" }] }], Stop: [{ hooks: [{ type: "command", command: "my-own-hook" }] }] } }, null, 2) + "\n";

test("registry: one check row per adapter row, built from src/adapters/table.ts", () => {
  const reg = buildRegistry({ home: "/h", pkgDir: "/abs/pkg", env: {} });
  assert.deepEqual(reg.map((r) => r.id), ADAPTERS.map((a) => a.id));
  for (const r of reg) {
    const row = ADAPTERS.find((a) => a.id === r.id);
    assert.equal(r.installMode, row.installMode);
    assert.ok(r.goldenPayload && typeof r.goldenPayload === "object", `${r.id} golden payload`);
    for (const p of r.allowedWrites) assert.ok(path.isAbsolute(p), `${r.id} write path absolute`);
    const text = JSON.stringify(r);
    assert.ok(!/\bnpx\b/.test(text), `${r.id}: never npx`);
  }
});

test("registry: server and hook commands are absolute node + absolute file, never the bin name", () => {
  const reg = buildRegistry({ home: "/h", pkgDir: "/abs/pkg", env: {} });
  for (const r of reg.filter((x) => x.hookCommand)) {
    assert.deepEqual(r.hookCommand, [NODE, path.join("/abs/pkg", "hook.mjs"), "--agent", r.id]);
  }
  const codex = reg.find((r) => r.id === "codex");
  assert.deepEqual(codex.serverCommand, [NODE, path.join("/abs/pkg", "server.mjs"), "--agent", "codex"]);
});

test("instruction files: the allowlist guard refuses every routing-instruction file", () => {
  const reg = buildRegistry({ home: "/h", pkgDir: "/abs/pkg", env: {} });
  for (const name of ["CLAUDE.md", "AGENTS.md", "AGENTS.override.md", "GEMINI.md", "QWEN.md", "copilot-instructions.md", "KIRO.md"]) {
    assert.throws(() => assertWritable(reg.find((r) => r.id === "codex"), path.join("/h/.codex", name)), /not allowed/);
  }
  assert.throws(() => assertWritable(reg.find((r) => r.id === "codex"), "/h/.bashrc"), /not allowed/);
  assert.doesNotThrow(() => assertWritable(reg.find((r) => r.id === "codex"), path.join("/h", ".codex", "config.toml")));
});

test("setup: replaces v1 entries, keeps user keys, verifies, backs up, releases the lock", async (t) => {
  const s = sandbox(t);
  const codexToml = put(path.join(s.home, ".codex", "config.toml"), CODEX_V1);
  const codexHooks = put(path.join(s.home, ".codex", "hooks.json"), CODEX_HOOKS_V1);
  const kiro = put(path.join(s.home, ".kiro", "settings", "mcp.json"), KIRO_USER);
  const res = await runSetup({ home: s.home, pkgDir: s.pkgDir, env: s.env, agents: ["codex", "kiro"], runId: "r1" });
  assert.equal(res.exitCode, 0, JSON.stringify(res, null, 2));
  const byId = Object.fromEntries(res.agents.map((a) => [a.id, a]));
  assert.equal(byId.codex.status, "PASS");
  assert.equal(byId.kiro.status, "PASS");
  assert.ok(byId.codex.v1.length > 0, "v1 entries detected");
  const toml = readFileSync(codexToml, "utf8");
  assert.match(toml, /model = "o3"/);
  assert.ok(toml.includes(JSON.stringify(NODE)), "absolute node");
  assert.ok(toml.includes(JSON.stringify(path.join(s.pkgDir, "server.mjs"))), "absolute server.mjs");
  const hooks = JSON.parse(readFileSync(codexHooks, "utf8"));
  assert.equal(hooks.hooks.PreToolUse[0].hooks[0].command, `"${NODE}" "${path.join(s.pkgDir, "hook.mjs")}" --agent codex`);
  assert.equal(hooks.hooks.Stop[0].hooks[0].command, "my-own-hook");
  const k = JSON.parse(readFileSync(kiro, "utf8"));
  assert.deepEqual(k.mcpServers.other, { command: "other-server" });
  assert.deepEqual(k.mcpServers["context-mode"], { command: NODE, args: [path.join(s.pkgDir, "server.mjs"), "--agent", "kiro"] });
  for (const id of ["codex", "kiro"]) {
    const names = byId[id].checks.map((c) => c.name);
    for (const n of ["parse", "mcp", "hook"]) assert.ok(names.includes(n), `${id} check ${n}`);
    assert.ok(byId[id].checks.every((c) => c.ok), JSON.stringify(byId[id].checks));
    const hook = byId[id].checks.find((c) => c.name === "hook");
    assert.ok(typeof hook.overheadP95Ms === "number" && typeof hook.wallP95Ms === "number" && typeof hook.bareP95Ms === "number");
  }
  assert.equal(res.backupDir, path.join(s.home, ".context-mode", BACKUP_DIR, "r1"));
  assert.equal(readFileSync(path.join(res.backupDir, "files", "0"), "utf8").length > 0, true);
  assert.equal(existsSync(path.join(s.home, ".context-mode", LOCK_FILE)), false);
});

test("setup: second run changes nothing and makes no backup", async (t) => {
  const s = sandbox(t);
  const codexToml = put(path.join(s.home, ".codex", "config.toml"), CODEX_V1);
  await runSetup({ home: s.home, pkgDir: s.pkgDir, env: s.env, agents: ["codex"], runId: "a" });
  const after1 = readFileSync(codexToml, "utf8");
  const res = await runSetup({ home: s.home, pkgDir: s.pkgDir, env: s.env, agents: ["codex"], runId: "b" });
  assert.equal(res.exitCode, 0);
  assert.deepEqual(res.agents[0].changes, []);
  assert.equal(readFileSync(codexToml, "utf8"), after1);
  assert.equal(existsSync(path.join(s.home, ".context-mode", BACKUP_DIR, "b")), false);
});

test("setup --remove restores every touched file byte for byte, and deletes files setup created", async (t) => {
  const s = sandbox(t);
  const codexToml = put(path.join(s.home, ".codex", "config.toml"), CODEX_V1);
  const kiro = path.join(s.home, ".kiro", "settings", "mcp.json");
  await runSetup({ home: s.home, pkgDir: s.pkgDir, env: s.env, agents: ["codex", "kiro"], runId: "r1" });
  assert.ok(existsSync(kiro));
  const rm = runRemove({ home: s.home });
  assert.equal(rm.exitCode, 0);
  assert.equal(readFileSync(codexToml, "utf8"), CODEX_V1);
  assert.equal(existsSync(kiro), false);
});

test("setup: a file that does not parse is refused and left as is", async (t) => {
  const s = sandbox(t);
  const kiro = put(path.join(s.home, ".kiro", "settings", "mcp.json"), "{ not json");
  const res = await runSetup({ home: s.home, pkgDir: s.pkgDir, env: s.env, agents: ["kiro"], runId: "r" });
  assert.equal(res.exitCode, 1);
  assert.equal(res.agents[0].status, "FAIL");
  assert.match(res.agents[0].reason, /does not parse/);
  assert.equal(readFileSync(kiro, "utf8"), "{ not json");
});

test("setup: a held lock stops the run before any write", async (t) => {
  const s = sandbox(t);
  put(path.join(s.home, ".context-mode", LOCK_FILE), JSON.stringify({ pid: process.pid, runId: "other" }));
  const codexToml = put(path.join(s.home, ".codex", "config.toml"), CODEX_V1);
  const res = await runSetup({ home: s.home, pkgDir: s.pkgDir, env: s.env, agents: ["codex"], runId: "r" });
  assert.equal(res.exitCode, 1);
  assert.match(res.error, /lock/);
  assert.equal(readFileSync(codexToml, "utf8"), CODEX_V1);
});

test("setup: a failed verify rolls that agent back byte for byte", async (t) => {
  const s = sandbox(t);
  const pkgDir = fakePkg(path.join(s.root, "bad"), { tools: ["ctx_execute"] });
  const codexToml = put(path.join(s.home, ".codex", "config.toml"), CODEX_V1);
  const res = await runSetup({ home: s.home, pkgDir, env: s.env, agents: ["codex"], runId: "r" });
  assert.equal(res.exitCode, 1);
  assert.equal(res.agents[0].status, "FAIL");
  assert.equal(res.agents[0].rolledBack, true);
  assert.equal(readFileSync(codexToml, "utf8"), CODEX_V1);
});

test("setup --dry-run returns the plan and writes nothing", async (t) => {
  const s = sandbox(t);
  const codexToml = put(path.join(s.home, ".codex", "config.toml"), CODEX_V1);
  const res = await runSetup({ home: s.home, pkgDir: s.pkgDir, env: s.env, agents: ["codex"], runId: "r", dryRun: true });
  assert.equal(res.exitCode, 0);
  assert.ok(res.agents[0].changes.length > 0);
  assert.equal(readFileSync(codexToml, "utf8"), CODEX_V1);
  assert.equal(existsSync(path.join(s.home, ".context-mode")), false);
});

test("setup: CLI agents use the agent's own command; missing binary is SKIPPED with the reason", { skip: process.platform === "win32" && "fake agent binaries are sh scripts" }, async (t) => {
  const s = sandbox(t);
  const log = path.join(s.root, "claude.log");
  const state = path.join(s.root, "claude.state");
  fakeBin(s.root, "claude", `echo "$@" >> "${log}"
case "$1 $2" in
  "plugin list") if [ -f "${state}" ]; then echo "context-mode@context-mode 2.0.0"; fi ;;
  "plugin install") touch "${state}" ;;
esac
exit 0`);
  const res = await runSetup({ home: s.home, pkgDir: s.pkgDir, env: s.env, agents: ["claude-code", "gemini"], runId: "r" });
  const byId = Object.fromEntries(res.agents.map((a) => [a.id, a]));
  assert.equal(byId["claude-code"].status, "PASS", JSON.stringify(byId["claude-code"], null, 2));
  assert.ok(readFileSync(log, "utf8").includes("plugin install context-mode@context-mode"));
  assert.ok(byId["claude-code"].checks.find((c) => c.name === "list").ok);
  assert.equal(byId.gemini.status, "SKIPPED");
  assert.match(byId.gemini.reason, /not on PATH/);
  assert.equal(readdirSync(s.home).includes(".gemini"), false);
});

test("[M7] setup/doctor: a report-only v1 finding (shared OS temp file) does not fail an agent that is set up", async (t) => {
  const { runDoctor } = await import("../../../src/setup/index.ts");
  const root = mkdtempSync(path.join(tmpdir(), "cm-doctor-tmp-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const home = path.join(root, "home");
  mkdirSync(home, { recursive: true });
  const pkgDir = fakePkg(root);
  const env = { ...process.env, HOME: home, PATH: path.dirname(NODE) };
  // A context-mode-* file in the OS temp dir is a v1 footprint, report only (UPGRADE_REPORT_ONLY_REASONS).
  const stray = path.join(tmpdir(), `context-mode-doctor-test-${process.pid}.db`);
  writeFileSync(stray, "");
  t.after(() => rmSync(stray, { force: true }));
  const opts = { home, pkgDir, env, agents: ["vscode"] };
  assert.equal((await runSetup(opts)).exitCode, 0);
  const res = await runDoctor(opts);
  assert.equal(res.exitCode, 0, JSON.stringify(res.agents));
  assert.ok(res.agents[0].v1.length > 0, "the temp finding is still reported");
});

test("whichBin: on Windows only PATHEXT names match (npm's <bin>.cmd shim), PATH key in any case", (t) => {
  const s = sandbox(t);
  writeFileSync(path.join(s.bin, "claude"), "#!/bin/sh\n"); // npm also writes an sh script cmd.exe cannot run
  chmodSync(path.join(s.bin, "claude"), 0o755);
  assert.equal(whichBin("claude", { Path: s.bin, PATHEXT: ".EXE;.CMD" }, "win32"), undefined, "extensionless file is not a Windows command");
  writeFileSync(path.join(s.bin, "claude.cmd"), "@echo off\r\n");
  chmodSync(path.join(s.bin, "claude.cmd"), 0o755);
  assert.equal(whichBin("claude", { Path: s.bin, PATHEXT: ".EXE;.CMD" }, "win32"), path.join(s.bin, "claude.cmd"));
  assert.equal(whichBin("claude", { PATH: s.bin }, "win32"), path.join(s.bin, "claude.cmd"), "default PATHEXT has .CMD");
  // A POSIX PATH splits on ":", which cannot hold a Windows drive path (C:\\...), so these two run on POSIX hosts only.
  if (process.platform !== "win32") {
    assert.equal(whichBin("claude", { PATH: s.bin }, "linux"), path.join(s.bin, "claude"));
    assert.equal(whichBin("nope", { PATH: s.bin }, "linux"), undefined);
  }
  mkdirSync(path.join(s.bin, "dir.cmd"));
  assert.equal(whichBin("dir", { PATH: s.bin }, "win32"), undefined, "a directory is not a command");
});

test("winCmdLine: quotes each argument for cmd.exe /d /s /c", () => {
  assert.equal(winCmdLine("C:\\a b\\claude.cmd", ["plugin", "add", "C:\\x y", ""]), '""C:\\a b\\claude.cmd" plugin add "C:\\x y" """');
  assert.equal(winCmdLine("c.cmd", ['say "hi"']), '"c.cmd "say ""hi""""');
});

// D-INST-1: `gemini extensions install <dir>` asks "trust this folder?" and waits for a key even with --consent, so a
// non-interactive setup hung. ADR-0019 section 3 step 4 names `extensions link` (gemini: --consent; qwen: `y` on stdin).
test("registry: gemini and qwen link the package dir; qwen answers its prompt on stdin (D-INST-1)", () => {
  const rows = Object.fromEntries(buildRegistry({ home: "/h", pkgDir: "/p/context-mode", env: {} }).map((r) => [r.id, r]));
  assert.deepEqual(rows.gemini.cli.install, [["extensions", "link", "/p/context-mode", "--consent"]]);
  assert.deepEqual(rows.qwen.cli.install, [["extensions", "link", "/p/context-mode"]]);
  assert.equal(rows.qwen.cli.input, "y\n");
  assert.equal(rows.gemini.cli.input, undefined);
});

test("setup: a CLI agent that needs an answer on stdin gets it (D-INST-1)", { skip: process.platform === "win32" && "fake agent binaries are sh scripts" }, async (t) => {
  const s = sandbox(t);
  const log = path.join(s.root, "qwen.log");
  const state = path.join(s.root, "qwen.state");
  fakeBin(s.root, "qwen", `echo "$@" >> "${log}"
case "$1 $2" in
  "extensions list") if [ -f "${state}" ]; then echo "context-mode (2.0.0)"; fi ;;
  "extensions link") read a; echo "answer=$a" >> "${log}"; if [ "$a" = y ]; then touch "${state}"; else exit 1; fi ;;
esac
exit 0`);
  const res = await runSetup({ home: s.home, pkgDir: s.pkgDir, env: s.env, agents: ["qwen"], runId: "r" });
  assert.equal(res.agents[0].status, "PASS", JSON.stringify(res.agents[0], null, 2));
  const text = readFileSync(log, "utf8");
  assert.ok(text.includes("extensions link "), text);
  assert.ok(text.includes("answer=y"), text);
});
