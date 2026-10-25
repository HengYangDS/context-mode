// tests/v2/setup/hooks-all.test.mjs
// Spec: docs/v2/adr/0020-hooks-and-skills-on-every-agent.md. Setup writes each agent's one hook channel and one
// skill channel on a fresh HOME; a second run changes nothing; --remove restores every byte.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { getAdapter } from "../../../src/adapters/table.ts";
import { TOOL_ORDER } from "../../../src/core/contracts/constants.ts";
import { generateManifests } from "../../../build/manifests.ts";
import { buildRegistry, printPlan, runRemove, runSetup } from "../../../src/setup/index.ts";

const NODE = process.execPath;
const REPO = path.resolve(import.meta.dirname, "../../..");
const SKILLS = ["ctx-doctor", "ctx-stats", "ctx-upgrade"];

function pkg(root) {
  const dir = path.join(root, "pkg");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "server.mjs"), `
import { createInterface } from "node:readline";
const tools = ${JSON.stringify([...TOOL_ORDER])};
createInterface({ input: process.stdin }).on("line", (l) => {
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
  generateManifests(dir);
  for (const s of SKILLS) cpSync(path.join(REPO, "skills", s), path.join(dir, "skills", s), { recursive: true });
  return dir;
}

function sandbox(t) {
  const root = mkdtempSync(path.join(tmpdir(), "cm-hooks-all-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const home = path.join(root, "home");
  const bin = path.join(root, "bin");
  mkdirSync(home, { recursive: true });
  mkdirSync(bin, { recursive: true });
  // copilot-cli adds its MCP server through its own CLI; a stub that already lists context-mode stands in for it.
  writeFileSync(path.join(bin, "copilot"), "#!/bin/sh\necho context-mode\n", { mode: 0o755 });
  return { root, home, pkgDir: pkg(root),
    env: { PATH: [bin, "/usr/bin", "/bin"].join(path.delimiter), HOME: home, CM_HOOK_OVERHEAD_BUDGET_MS: "60000" } };
}

const hookCmd = (pkgDir, id) => `"${NODE}" "${path.join(pkgDir, "hook.mjs")}" --agent ${id}`;
// Agents setup writes by file (no host CLI needed): their hook file and skill dir sit under HOME.
const FILE_AGENTS = ["codex", "copilot-cli", "vscode", "kiro", "zcode", "opencode"];

function commands(doc) {
  const out = [];
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (k === "command" && typeof x === "string") out.push(x); else walk(x); }
  };
  walk(doc);
  return out;
}

test("ADR-0020: setup writes the hook channel for every file agent with the absolute hook command", async (t) => {
  const s = sandbox(t);
  const res = await runSetup({ home: s.home, pkgDir: s.pkgDir, env: s.env, agents: FILE_AGENTS, runId: "r1" });
  assert.equal(res.exitCode, 0, JSON.stringify(res.agents.map((a) => [a.id, a.status, a.reason])));
  for (const id of ["codex", "copilot-cli", "vscode", "kiro", "zcode"]) {
    const file = path.join(s.home, getAdapter(id).hookChannel.path);
    assert.ok(existsSync(file), id + " hook file " + file);
    const cmds = commands(JSON.parse(readFileSync(file, "utf8")));
    const events = Object.keys(getAdapter(id).eventMap).filter((e) => e !== "Usage").length;
    assert.equal(cmds.filter((c) => c === hookCmd(s.pkgDir, id)).length, events, id + " one command per event");
  }
  const zc = JSON.parse(readFileSync(path.join(s.home, ".zcode", "cli", "config.json"), "utf8"));
  assert.equal(zc.hooks.enabled, true, "zcode hooks.enabled");
  assert.ok(zc.mcpServers["context-mode"], "zcode MCP entry kept next to the hooks");
  const oc = JSON.parse(readFileSync(path.join(s.home, ".config", "opencode", "opencode.json"), "utf8"));
  assert.deepEqual(oc.plugin, [path.join(s.pkgDir, "opencode", "plugin.js")], "opencode plugin entry");
});

test("ADR-0020: setup writes the three skills per agent with that agent's tool name prefix", async (t) => {
  const s = sandbox(t);
  const res = await runSetup({ home: s.home, pkgDir: s.pkgDir, env: s.env, agents: FILE_AGENTS, runId: "r1" });
  assert.equal(res.exitCode, 0, JSON.stringify(res.agents.map((a) => [a.id, a.status, a.reason])));
  for (const id of FILE_AGENTS) {
    const row = getAdapter(id);
    for (const name of SKILLS) {
      const file = path.join(s.home, row.skillChannel.path, name, "SKILL.md");
      assert.ok(existsSync(file), id + " " + file);
      const text = readFileSync(file, "utf8");
      const tool = name.replace("ctx-", "ctx_");
      assert.ok(text.includes(row.toolNamePrefix + tool), id + " " + name + " names " + row.toolNamePrefix + tool);
      assert.ok(text.startsWith("---\nname: " + name + "\n"), id + " frontmatter kept");
    }
  }
});

test("ADR-0020: user hooks in a shared hook file are kept; second run changes nothing; --remove restores bytes", async (t) => {
  const s = sandbox(t);
  const codexHooks = path.join(s.home, ".codex", "hooks.json");
  mkdirSync(path.dirname(codexHooks), { recursive: true });
  const user = JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "my-own-hook" }] }], PreToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: "my-lint" }] }] } }, null, 2) + "\n";
  writeFileSync(codexHooks, user);
  const first = await runSetup({ home: s.home, pkgDir: s.pkgDir, env: s.env, agents: ["codex", "kiro"], runId: "a" });
  assert.equal(first.exitCode, 0, JSON.stringify(first.agents.map((a) => [a.id, a.status, a.reason])));
  const doc = JSON.parse(readFileSync(codexHooks, "utf8"));
  assert.ok(commands(doc).includes("my-own-hook") && commands(doc).includes("my-lint"), "user hooks kept");
  assert.equal(commands(doc).filter((c) => c === hookCmd(s.pkgDir, "codex")).length, 4);
  const after = readFileSync(codexHooks, "utf8");
  const second = await runSetup({ home: s.home, pkgDir: s.pkgDir, env: s.env, agents: ["codex", "kiro"], runId: "b" });
  assert.deepEqual(second.agents.map((a) => a.changes), [[], []], "idempotent");
  assert.equal(readFileSync(codexHooks, "utf8"), after);
  assert.equal(runRemove({ home: s.home }).exitCode, 0);
  assert.equal(readFileSync(codexHooks, "utf8"), user, "byte-exact restore");
  assert.equal(existsSync(path.join(s.home, ".kiro", "hooks", "context-mode.json")), false, "created hook file removed");
  assert.equal(existsSync(path.join(s.home, ".codex", "skills", "ctx-stats", "SKILL.md")), false, "created skill removed");
});

test("ADR-0020: --print lists the hook step and the skill step for every agent", () => {
  for (const row of buildRegistry({ home: "/h", pkgDir: REPO, env: {} })) { // REPO holds skills/ like the package
    const kinds = printPlan(row).steps.map((s) => s.kind);
    assert.ok(row.hookInstall, row.id + " hookInstall");
    assert.ok(row.skillInstall, row.id + " skillInstall");
    if (getAdapter(row.id).hookChannel.kind !== "package") assert.ok(kinds.includes("hook") || kinds.includes("run"), row.id + " hook step");
    if (getAdapter(row.id).skillChannel.kind === "home-dir") assert.ok(kinds.includes("skill"), row.id + " skill step");
  }
});
