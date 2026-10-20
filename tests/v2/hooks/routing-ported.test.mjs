// PORT of tests/hooks/{core-routing,integration,require-security,tool-naming}.test.ts (cleanup-plan W1-hooks).
// v1 asserted modify/updatedInput and nudge text; v2 decides deny or allow with no hint (ADR-0008 amendment
// 2026-10-20, D-M7-RR-1/RR-2). Each case keeps the v1 input and the v1 allow/block verdict; the v1 issue is in the name.
import { test } from "node:test";
import assert from "node:assert/strict";
import { decide, denyMessage } from "../../../src/core/policy/decide.ts";
import { getAdapter } from "../../../src/adapters/table.ts";
import { AGENT_IDS } from "../../../src/core/contracts/agents.ts";
import { REQUIRE_SECURITY_ENV, POLICY_UNREADABLE_LINE, USER_DENY_REASON_PREFIX } from "../../../src/core/contracts/constants.ts";

const CODEX = getAdapter("codex"); // no replace row: the size-guess denies stay (ADR-0001)
const CC = getAdapter("claude-code");
const ev = (name, input, extra = {}) => ({ event: "PreToolUse", agent: "codex", sessionId: "s1", cwd: process.cwd(), tool: { name, canonicalName: name, input }, ...extra });
const bash = (command, deny = [], row = CODEX) => decide(ev("Bash", { command }), row, deny);
const kind = (command) => bash(command).kind;

test("core-routing: curl and wget are denied; the reason names the original command", () => {
  for (const c of ["curl https://example.com", "wget https://example.com/file.tar.gz"]) {
    const d = bash(c);
    assert.equal(d.kind, "deny", c);
    assert.ok(d.reason.includes(c), "reason carries the original command: " + c);
  }
});

test("core-routing #166: silent file output is allowed, stdout or non-silent output is denied", () => {
  for (const c of ["curl -sLo out.tar https://x.io/f", "curl -s --output out.tar https://x.io/f",
    "wget -q -O out.tar https://x.io/f", "curl -s https://x.io/f > out.tar",
    "curl -sLo out.tar https://x.io/f && tar xzf out.tar"]) assert.notEqual(kind(c), "deny", c);
  for (const c of ["curl -o - https://x.io/f", "curl -o out.tar https://x.io/f", "curl -s -v -o out.tar https://x.io/f",
    "curl -sLo out.tar https://x.io/f && curl https://x.io/g"]) assert.equal(kind(c), "deny", c);
});

test("core-routing: inline HTTP is denied (node fetch, python requests)", () => {
  assert.equal(kind(`node -e "fetch('https://x.io').then(r=>r.text()).then(console.log)"`), "deny");
  assert.equal(kind(`python3 -c "import requests; print(requests.get('https://x.io').text)"`), "deny");
});

test("core-routing #38 #406: gradle, mvn, sbt build commands are denied (tail-free alternative is ctx_execute)", () => {
  for (const c of ["./gradlew build", "gradle test", "mvn package", "./mvnw verify", "sbt compile", "./sbt test"]) assert.equal(kind(c), "deny", c);
});

test("core-routing: build-tool names inside quotes or longer words are not builds", () => {
  for (const c of ['echo "run gradle build later"', "ls gradle-wrapper-config", "echo mvnDocker"]) assert.notEqual(kind(c), "deny", c);
});

test("core-routing #463: bounded commands and npm install pass with no hint", () => {
  for (const c of ["git status", "mkdir -p out/dir", "npm install", "find / -name x"]) assert.deepEqual(bash(c), { kind: "allow" }, c);
});

test("core-routing/integration #241: Task, TaskCreate, TaskUpdate, Glob, WebSearch, Edit pass through", () => {
  for (const t of ["Task", "TaskCreate", "TaskUpdate", "Glob", "WebSearch", "Edit"]) assert.deepEqual(decide(ev(t, {}), CODEX, []), { kind: "allow" }, t);
});

test("integration WebFetch: denied, and the reason carries the URL", () => {
  const url = "https://example.com/some/page";
  const d = decide(ev("WebFetch", { url }), CODEX, []);
  assert.equal(d.kind, "deny");
  assert.equal(d.reason, denyMessage("webfetch", url, CODEX));
  assert.ok(d.reason.includes(url));
});

test("integration Security: user deny rule on sudo denies Bash and a ctx_execute shell body", () => {
  const rules = ["Bash(sudo:*)"];
  assert.equal(bash("sudo rm -rf /tmp/x", rules).reason, USER_DENY_REASON_PREFIX + "Bash(sudo:*)");
  assert.equal(bash("git status", rules).kind, "allow");
  assert.equal(decide(ev("ctx_execute", { language: "shell", code: "sudo ls" }), CODEX, rules).kind, "deny");
  assert.equal(decide(ev("ctx_execute", { language: "python", code: "print('sudo')" }), CODEX, rules).kind, "allow");
});

test("integration Security: ctx_execute file under a Read deny rule (.env) is denied, a safe path is not", () => {
  const rules = ["Read(.env)", "Read(**/.env)"];
  assert.equal(decide(ev("ctx_execute", { language: "python", code: "x", file: ".env" }), CODEX, rules).kind, "deny");
  assert.equal(decide(ev("ctx_execute", { language: "python", code: "x", file: "src/a.ts" }), CODEX, rules).kind, "allow");
});

test("integration Security: ctx_batch with one denied command is denied, all-allowed passes", () => {
  const rules = ["Bash(sudo:*)"];
  assert.equal(decide(ev("ctx_batch", { commands: ["ls", "sudo id"] }), CODEX, rules).kind, "deny");
  assert.equal(decide(ev("ctx_batch", { commands: ["ls", "pwd"] }), CODEX, rules).kind, "allow");
});

test("require-security #468: env=1 and unreadable policy denies every tool, Read included; env unset fails open", () => {
  const saved = process.env[REQUIRE_SECURITY_ENV];
  const savedWrite = process.stderr.write;
  process.stderr.write = () => true;
  try {
    process.env[REQUIRE_SECURITY_ENV] = "1";
    for (const t of ["Bash", "Read", "Grep"]) assert.deepEqual(decide(ev(t, { command: "ls", file_path: "a" }), CODEX, null), { kind: "deny", reason: POLICY_UNREADABLE_LINE }, t);
    delete process.env[REQUIRE_SECURITY_ENV];
    assert.notEqual(decide(ev("Bash", { command: "ls" }), CODEX, null).kind, "deny");
    process.env[REQUIRE_SECURITY_ENV] = "1";
    assert.notEqual(decide(ev("Bash", { command: "ls" }), CODEX, []).kind, "deny"); // readable policy: normal
  } finally {
    process.stderr.write = savedWrite;
    if (saved === undefined) delete process.env[REQUIRE_SECURITY_ENV]; else process.env[REQUIRE_SECURITY_ENV] = saved;
  }
});

test("tool-naming #529 #683: every agent has a prefix; deny text names ctx_execute with that prefix", () => {
  const want = { "claude-code": "mcp__plugin_context-mode_context-mode__", codex: "mcp__context_mode__", gemini: "mcp_context-mode_",
    kiro: "mcp_context-mode_", vscode: "mcp_context-mode_", pi: "", opencode: "" };
  for (const id of AGENT_IDS) {
    const row = getAdapter(id);
    assert.equal(typeof row.toolNamePrefix, "string", id);
    if (id in want) assert.equal(row.toolNamePrefix, want[id], id);
    const msg = denyMessage("curl", "curl https://x.io", row);
    assert.ok(msg.includes("Tool: " + row.toolNamePrefix + "ctx_execute"), id);
  }
  assert.ok(denyMessage("webfetch", "https://x.io", CC).includes(CC.toolNamePrefix + "ctx_index"));
});
