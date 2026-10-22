// tests/v2/cli/cli.test.mjs
// Spec: docs/v2/adr/0019-interactive-setup-and-npm-channel.md sections 4-8 and Owner decisions D4-D7.
// E2E style: build the real release tree once, copy the bundled cli.mjs next to a fake server.mjs and hook.mjs
// (the CLI finds its siblings from its own path), then drive `context-mode` with a temp HOME and a temp PATH.
// Interactive runs go through a real pty (python3 pty, tests/v2/cli/pty-run.py).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ADAPTERS } from "../../../src/adapters/table.ts";
import { TOOL_ORDER } from "../../../src/core/contracts/constants.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..", "..");
const GOLDEN = path.join(REPO, "e2e", "golden", "cli");
const PTY = path.join(HERE, "pty-run.py");
const ESC = "\x1b";
let scratch;
let out;

before(() => {
  scratch = mkdtempSync(path.join(tmpdir(), "cm-v2-cli-"));
  out = path.join(scratch, "out");
  const r = spawnSync(process.execPath, [path.join(REPO, "build", "build.mjs"), "--out", out, "--version", "2.0.0"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
});
after(() => rmSync(scratch, { recursive: true, force: true }));

const FAKE_SERVER = `
import { createInterface } from "node:readline";
if (process.env.CM_FAKE_BROKEN) process.exit(3);
const tools = ${JSON.stringify([...TOOL_ORDER])};
const delay = process.env.CM_FAKE_SLOW ? 4000 : 0;
const rl = createInterface({ input: process.stdin });
rl.on("line", (l) => {
  const m = JSON.parse(l);
  if (m.id === undefined) return;
  const result = m.method === "initialize"
    ? { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "context-mode", version: "2.0.0" } }
    : { tools: tools.map((name) => ({ name, inputSchema: { type: "object" } })) };
  setTimeout(() => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: m.id, result }) + "\\n"), delay);
});
`;
const FAKE_HOOK = `let s = ""; process.stdin.on("data", (d) => { s += d; }); process.stdin.on("end", () => { JSON.parse(s); });\n`;

/** A fake installed package: the real bundled cli.mjs next to fake server.mjs and hook.mjs. */
function makePkg(dir) {
  mkdirSync(dir, { recursive: true });
  copyFileSync(path.join(out, "cli.mjs"), path.join(dir, "cli.mjs"));
  writeFileSync(path.join(dir, "server.mjs"), FAKE_SERVER);
  writeFileSync(path.join(dir, "hook.mjs"), FAKE_HOOK);
  writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "context-mode", version: "2.0.0", type: "module" }));
  return dir;
}

function sandbox(t) {
  const root = mkdtempSync(path.join(scratch, "sb-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const home = path.join(root, "home");
  const bin = path.join(root, "bin");
  mkdirSync(home, { recursive: true });
  mkdirSync(bin, { recursive: true });
  const pkg = makePkg(path.join(root, "pkg"));
  const env = { PATH: [bin, "/usr/bin", "/bin"].join(path.delimiter), HOME: home, NO_COLOR: "1", LOG: path.join(root, "calls.log") };
  return { root, home, bin, pkg, env };
}

function fakeBin(s, name, script) {
  const file = path.join(s.bin, name);
  writeFileSync(file, `#!/bin/sh\n${script}\n`);
  chmodSync(file, 0o755);
}

function run(s, args, { env = {}, input = "", timeout = 60_000 } = {}) {
  const r = spawnSync(process.execPath, [path.join(s.pkg, "cli.mjs"), ...args], { encoding: "utf8", input, timeout, env: { ...s.env, ...env } });
  assert.equal(r.error, undefined, `context-mode ${args.join(" ")} did not finish: ${r.error}`);
  return r;
}

function pty(s, args, steps, { env = {}, timeout = 40 } = {}) {
  const spec = { argv: [process.execPath, path.join(s.pkg, "cli.mjs"), ...args], env: { ...s.env, TERM: "xterm-256color", ...env }, steps, timeout };
  const r = spawnSync("python3", ["-I", PTY, JSON.stringify(spec)], { encoding: "utf8", timeout: (timeout + 20) * 1000 });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

/** Every file under dir with its bytes, so a test can prove nothing changed. */
function snapshot(dir) {
  const outMap = {};
  const walk = (d) => {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f); else outMap[path.relative(dir, f)] = readFileSync(f, "utf8");
    }
  };
  walk(dir);
  return outMap;
}

const CODEX_V1 = `model = "o3"\n\n[mcp_servers.context-mode]\ncommand = "context-mode"\n`;
function codexHome(s, text = CODEX_V1) {
  const f = path.join(s.home, ".codex", "config.toml");
  mkdirSync(path.dirname(f), { recursive: true });
  writeFileSync(f, text);
  return f;
}

// ---------- D7: help, exit codes, streams ----------

for (const [name, args] of [["main", ["--help"]], ["setup", ["setup", "--help"]], ["doctor", ["doctor", "--help"]], ["upgrade", ["upgrade", "--help"]]]) {
  test(`[M7] cli/help-golden: context-mode ${args.join(" ")} equals e2e/golden/cli/help-${name}.txt`, (t) => {
    const s = sandbox(t);
    const r = run(s, args);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stderr, "");
    assert.equal(r.stdout, readFileSync(path.join(GOLDEN, `help-${name}.txt`), "utf8"));
    assert.match(r.stdout, /Examples:/);
    assert.match(r.stdout, /Exit codes:[\s\S]*0[\s\S]*1[\s\S]*2[\s\S]*130/);
  });
}

test("[M7] cli/help-short: -h works on every command and writes nothing", (t) => {
  const s = sandbox(t);
  for (const cmd of ["setup", "doctor", "upgrade"]) {
    const r = run(s, [cmd, "-h"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, new RegExp(`Usage: context-mode ${cmd}`));
  }
  assert.deepEqual(snapshot(s.home), {});
});

test("[M7] cli/typo-command: an unknown command suggests the closest one, exit 2", (t) => {
  const s = sandbox(t);
  const r = run(s, ["setpu"]);
  assert.equal(r.status, 2);
  assert.equal(r.stdout, "");
  assert.match(r.stderr, /unknown command "setpu"/);
  assert.match(r.stderr, /Did you mean "setup"\?/);
});

test("[M7] cli/typo-flag: an unknown flag suggests the closest one, exit 2, nothing written", (t) => {
  const s = sandbox(t);
  codexHome(s);
  const before = snapshot(s.home);
  const r = run(s, ["setup", "--dryrun"]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unknown option "--dryrun"/);
  assert.match(r.stderr, /Did you mean "--dry-run"\?/);
  assert.deepEqual(snapshot(s.home), before);
});

test("[M7] cli/exit-usage: unknown agent in --agents and a missing flag value are usage errors (2)", (t) => {
  const s = sandbox(t);
  const a = run(s, ["setup", "--yes", "--agents", "codexx"]);
  assert.equal(a.status, 2);
  assert.match(a.stderr, /unknown agent "codexx"/);
  assert.match(a.stderr, /Did you mean "codex"\?/);
  const b = run(s, ["setup", "--agents"]);
  assert.equal(b.status, 2);
  assert.match(b.stderr, /--agents needs a value/);
});

test("[M7] cli/exit-ok: setup --yes --agents codex applies, verifies, exit 0; results on stdout", (t) => {
  const s = sandbox(t);
  const f = codexHome(s);
  const r = run(s, ["setup", "--yes", "--agents", "codex"]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /codex\s+PASS/);
  const toml = readFileSync(f, "utf8");
  assert.match(toml, /model = "o3"/, "user keys kept");
  assert.match(toml, new RegExp(path.join(s.pkg, "server.mjs").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("[M7] cli/exit-fail: a failing verify step is exit 1, the agent is rolled back byte for byte", (t) => {
  const s = sandbox(t);
  const f = codexHome(s);
  const r = run(s, ["setup", "--yes", "--agents", "codex"], { env: { CM_FAKE_BROKEN: "1" } });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /codex\s+FAIL/);
  assert.equal(readFileSync(f, "utf8"), CODEX_V1);
  // D7 errors: what failed, why, the exact command that fixes it.
  assert.match(r.stderr, /Fix: context-mode setup --agents codex/);
  assert.equal(existsSync(path.join(s.home, ".context-mode", "setup.lock")), false);
});

test("[M7] cli/json: --json writes only one JSON document to stdout", (t) => {
  const s = sandbox(t);
  codexHome(s);
  const r = run(s, ["setup", "--yes", "--json", "--agents", "codex"]);
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(r.stdout);
  assert.equal(j.exitCode, 0);
  assert.equal(j.agents[0].id, "codex");
  assert.equal(j.agents[0].status, "PASS");
});

test("[M7] cli/dry-run: setup --dry-run shows the plan and writes nothing", (t) => {
  const s = sandbox(t);
  codexHome(s);
  const before = snapshot(s.home);
  const r = run(s, ["setup", "--dry-run", "--agents", "codex"]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /codex/);
  assert.match(r.stdout, /config\.toml/);
  assert.deepEqual(snapshot(s.home), before);
});

test("[M7] cli/no-tty: setup without --yes and without a TTY never blocks: plan shown, exit 2, nothing written", (t) => {
  const s = sandbox(t);
  codexHome(s);
  const before = snapshot(s.home);
  for (const args of [["setup"], ["setup", "--no-input"], ["setup", "--remove"]]) {
    const r = run(s, args, { timeout: 15_000 });
    assert.equal(r.status, 2, `${args.join(" ")}: ${r.stderr}`);
    assert.match(r.stderr, /--yes/);
  }
  assert.deepEqual(snapshot(s.home), before);
});

test("[M7] cli/no-color: NO_COLOR output has no escape codes (help, list, setup fail, doctor)", (t) => {
  const s = sandbox(t);
  codexHome(s);
  for (const [args, env] of [[["--help"], {}], [["setup", "--list"], {}], [["setup", "--yes", "--agents", "codex"], { CM_FAKE_BROKEN: "1" }], [["doctor"], {}], [["setup", "--list"], { NO_COLOR: "", TERM: "dumb" }], [["doctor", "--no-color"], { NO_COLOR: "" }]]) {
    const r = run(s, args, { env });
    assert.ok(!r.stdout.includes(ESC) && !r.stderr.includes(ESC), `${args.join(" ")} printed an escape code`);
  }
});

test("[M7] cli/list: setup --list prints every supported agent with its support level and writes nothing", (t) => {
  const s = sandbox(t);
  codexHome(s);
  const before = snapshot(s.home);
  const r = run(s, ["setup", "--list"]);
  assert.equal(r.status, 0, r.stderr);
  for (const a of ADAPTERS) assert.match(r.stdout, new RegExp(`^${a.id}\\s`, "m"));
  assert.match(r.stdout, /full|MCP only/);
  assert.match(r.stdout, /^codex\s+.*detected/m);
  assert.deepEqual(snapshot(s.home), before);
  const j = JSON.parse(run(s, ["setup", "--list", "--json"]).stdout);
  assert.equal(j.agents.length, ADAPTERS.length);
});

test("[M7] cli/remove: setup --remove --yes puts every touched file back byte for byte", (t) => {
  const s = sandbox(t);
  const f = codexHome(s);
  assert.equal(run(s, ["setup", "--yes", "--agents", "codex"]).status, 0);
  assert.notEqual(readFileSync(f, "utf8"), CODEX_V1);
  const r = run(s, ["setup", "--remove", "--yes"]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readFileSync(f, "utf8"), CODEX_V1);
});

// ---------- doctor ----------

test("[M7] cli/doctor: read-only; v1 form reported with the exact command; PASS after setup", (t) => {
  const s = sandbox(t);
  codexHome(s);
  const before = snapshot(s.home);
  const r = run(s, ["doctor"]);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /codex\s+FAIL/);
  assert.match(r.stdout + r.stderr, /v1 form, run context-mode setup/);
  assert.match(r.stderr, /Fix: context-mode setup --agents codex/);
  assert.deepEqual(snapshot(s.home), before, "doctor must not write");
  assert.equal(run(s, ["setup", "--yes", "--agents", "codex"]).status, 0);
  const ok = run(s, ["doctor", "--json"]);
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.equal(JSON.parse(ok.stdout).agents.find((a) => a.id === "codex").status, "PASS");
});

// ---------- upgrade ----------

test("[M7] cli/upgrade: npm i -g context-mode@<tag>, then the new package runs setup --repair", (t) => {
  const s = sandbox(t);
  const f = codexHome(s);
  const root = path.join(s.root, "npmroot");
  cpSync(s.pkg, path.join(root, "context-mode"), { recursive: true });
  fakeBin(s, "npm", `echo "npm $*" >> "$LOG"\nif [ "$1" = root ]; then echo "${root}"; fi\nexit 0`);
  const dry = run(s, ["upgrade", "--dry-run", "--tag", "next"]);
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /npm i -g context-mode@next/);
  assert.equal(existsSync(s.env.LOG), false, "--dry-run runs nothing");
  const r = run(s, ["upgrade", "--yes", "--tag", "next"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const log = readFileSync(s.env.LOG, "utf8");
  assert.match(log, /npm i -g context-mode@next/);
  assert.match(readFileSync(f, "utf8"), new RegExp(path.join(root, "context-mode", "server.mjs").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("[M7] cli/upgrade-fail: npm failing is exit 1 with the command to retry", (t) => {
  const s = sandbox(t);
  fakeBin(s, "npm", `echo "E404" >&2\nexit 1`);
  const r = run(s, ["upgrade", "--yes"]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Fix: npm i -g context-mode@latest/);
});

// ---------- D6 issue report ----------

test("[M7] cli/report-no-input: a FAIL without a TTY writes the redacted report, prints the command, sends nothing", (t) => {
  const s = sandbox(t);
  codexHome(s);
  fakeBin(s, "gh", `echo "gh $*" >> "$LOG"\nexit 0`);
  const r = run(s, ["setup", "--yes", "--agents", "codex"], { env: { CM_FAKE_BROKEN: "1" } });
  assert.equal(r.status, 1);
  assert.ok(!existsSync(s.env.LOG) || !readFileSync(s.env.LOG, "utf8").includes("issue"), "never sends without a keypress");
  const dir = path.join(s.home, ".context-mode", "reports");
  const [file] = readdirSync(dir);
  const report = readFileSync(path.join(dir, file), "utf8");
  assert.ok(!report.includes(s.home), "home dir is redacted");
  assert.match(report, /fingerprint: [0-9a-f]{12}/);
  assert.match(report, /codex/);
  assert.match(r.stderr, /gh issue create --repo mksglu\/context-mode/);
});

// ---------- pty: interactive flow, D6 consent, Ctrl-C ----------

const hasPython = spawnSync("python3", ["-c", "import pty"]).status === 0 && process.platform !== "win32";

test("[M7] cli/pty-interactive: multi-select, plan, confirm, live checklist, summary table", { skip: !hasPython }, (t) => {
  const s = sandbox(t);
  const f = codexHome(s);
  const r = pty(s, ["setup"], [
    { expect: "Select agents", send: "\r" },
    { expect: "Apply", send: "y" },
  ]);
  assert.deepEqual(r.pending, [], r.out);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /codex/);
  assert.match(r.out, /PASS/);
  assert.match(readFileSync(f, "utf8"), /server\.mjs/);
});

test("[M7] cli/pty-cancel: Escape at the agent prompt cancels with exit 130, nothing written", { skip: !hasPython }, (t) => {
  const s = sandbox(t);
  codexHome(s);
  const before = snapshot(s.home);
  const r = pty(s, ["setup"], [{ expect: "Select agents", send: "\x1b" }]);
  assert.equal(r.code, 130, r.out);
  assert.deepEqual(snapshot(s.home), before);
});

test("[M7] cli/pty-report: on FAIL the report is shown and asked once; n sends nothing, y runs gh issue create", { skip: !hasPython }, (t) => {
  const s = sandbox(t);
  codexHome(s);
  fakeBin(s, "gh", `echo "gh $*" >> "$LOG"\nexit 0`);
  const no = pty(s, ["setup", "--agents", "codex"], [{ expect: "Apply", send: "y" }, { expect: "Open an issue", send: "n" }], { env: { CM_FAKE_BROKEN: "1" } });
  assert.equal(no.code, 1, no.out);
  assert.match(no.out, /fingerprint/);
  assert.ok(!existsSync(s.env.LOG) || !readFileSync(s.env.LOG, "utf8").includes("issue create"));
  const yes = pty(s, ["setup", "--agents", "codex"], [{ expect: "Apply", send: "y" }, { expect: "Open an issue", send: "y" }], { env: { CM_FAKE_BROKEN: "1" } });
  assert.equal(yes.code, 1, yes.out);
  assert.match(readFileSync(s.env.LOG, "utf8"), /gh issue create --repo mksglu\/context-mode/);
});

test("[M7] cli/pty-ctrl-c: Ctrl-C mid-apply exits 130 and leaves files byte-identical or fully applied", { skip: !hasPython }, (t) => {
  const s = sandbox(t);
  const f = codexHome(s);
  const r = pty(s, ["setup", "--yes", "--agents", "codex"], [{ expect: "codex", send: "\x03", delay: 1.0 }], { env: { CM_FAKE_SLOW: "1" } });
  assert.equal(r.code, 130, r.out);
  const now = readFileSync(f, "utf8");
  assert.ok(now === CODEX_V1 || now.includes(path.join(s.pkg, "server.mjs")), `half-applied file:\n${now}`);
  assert.equal(existsSync(path.join(s.home, ".context-mode", "setup.lock")), false, "lock released");
});
