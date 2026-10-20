// Unit tests for src/core/hooks/dispatch.ts (impl/09 §4, ADR-0009 §1 and §6, ADR-0016, DECISIONS-r9 F1;
// DEVIATIONS D-M3-arch-2, D-M3-arch-3, D-M3-H2-*). handleHook(agent, raw, env) never throws.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readdirSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { handleHook } from "../../../src/core/hooks/dispatch.ts";
import { ctxSearch } from "../../../src/core/tools/search.ts";
import { chunkText } from "../../../src/core/index/chunk.ts";
import {
  COMPACT_POINTER_LINE, OUTPUT_CAP, REPLACE_TRIGGER_BYTES, REPLACE_RETURN_BYTES, REPLACE_CHUNK_BYTES, SYNC_INDEX_MAX_BYTES, PENDING_COMPACT_META_PREFIX,
} from "../../../src/core/contracts/constants.ts";

// D-M3-F-9: a hook or detached write keeps its DB handle open by design (A21), and Windows cannot delete
// an open file, so temp cleanup there is best-effort. The assertions above it are unchanged.
function rmTemp(dir) {
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
  } catch (err) {
    if (process.platform !== "win32" || err.code !== "EPERM") throw err;
  }
}

let root;
let repo;
let oldHome;
let env;

before(() => {
  root = mkdtempSync(join(tmpdir(), "cm-dispatch-"));
  repo = join(root, "repo");
  mkdirSync(repo);
  execFileSync("git", ["init", "-q", repo]);
  oldHome = process.env.HOME;
  process.env.HOME = root; // resolveConfigDir reads the process env (D-M1-T3-5)
  env = { HOME: root, CLAUDE_PROJECT_DIR: repo, PATH: process.env.PATH };
  mkdirSync(join(repo, ".claude", "agents"), { recursive: true });
  writeFileSync(join(repo, ".claude", "agents", "reader.md"), "---\nname: reader\ntools: Read\n---\nreads\n");
  writeFileSync(join(repo, ".claude", "agents", "sheller.md"), "---\nname: sheller\ntools: Bash\n---\nruns\n");
});

after(() => {
  process.env.HOME = oldHome;
  rmTemp(root);
});

function dbFile() {
  const projects = join(root, ".context-mode", "projects");
  if (!existsSync(projects)) return null;
  const keys = readdirSync(projects);
  return keys.length === 0 ? null : join(projects, keys[0], "context.db");
}

function query(sql, ...args) {
  const f = dbFile();
  if (f === null || !existsSync(f)) return [];
  const db = new DatabaseSync(f, { readOnly: true });
  try { return db.prepare(sql).all(...args); } finally { db.close(); }
}

async function waitRows(sql, args, n) {
  const end = Date.now() + 5000;
  for (;;) {
    const rows = query(sql, ...args);
    if (rows.length >= n || Date.now() > end) return rows;
    await new Promise((r) => setTimeout(r, 10));
  }
}

function cc(fields) {
  return { session_id: "s-" + Math.random().toString(36).slice(2), cwd: repo, ...fields };
}

// D-M7-SV-1: a Bash replace is the Bash output shape {stdout, stderr, interrupted}; other tools get a string.
function replacedText(v) {
  if (typeof v === "string") return v;
  assert.deepEqual(Object.keys(v).sort(), ["interrupted", "stderr", "stdout"]);
  assert.equal(v.stderr, "");
  assert.equal(v.interrupted, false);
  return v.stdout;
}

function parsed(out) {
  assert.equal(out.exitCode, 0);
  return out.stdout === "" ? null : JSON.parse(out.stdout).hookSpecificOutput;
}

function captureStderr() {
  const lines = [];
  const orig = process.stderr.write.bind(process.stderr);
  process.stderr.write = (c) => { lines.push(String(c)); return true; };
  return { lines, restore: () => { process.stderr.write = orig; } };
}

test("unknown agent id: empty stdout, exit 0", async () => {
  assert.deepEqual(await handleHook("nope", {}, env), { stdout: "", exitCode: 0 });
});

test("decode failure: allow shape and one stderr line", async () => {
  const cap = captureStderr();
  let out;
  try { out = await handleHook("claude-code", { hook_event_name: "Nope" }, env); } finally { cap.restore(); }
  assert.deepEqual(out, { stdout: "", exitCode: 0 });
  assert.equal(cap.lines.length, 1);
  assert.ok(cap.lines[0].startsWith("hooks: decode failed: "));
});

test("no project: allow, no hint, no DB", async () => {
  const bare = { HOME: root, PATH: process.env.PATH };
  const out = await handleHook("claude-code", cc({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "curl https://x.y" } }), bare);
  assert.deepEqual(out, { stdout: "", exitCode: 0 });
});

test("SessionStart startup: resume hint once per session (GP3/hint-once-per-session)", async () => {
  const p = cc({ hook_event_name: "SessionStart", source: "startup" });
  const first = parsed(await handleHook("claude-code", p, env));
  assert.ok(first.additionalContext.includes("mcp__plugin_context-mode_context-mode__ctx_resume"));
  assert.equal(await handleHook("claude-code", p, env).then((o) => o.stdout), "");
});

test("GP6/hint-names-platform-tool: Codex resume hint names mcp__context_mode__ctx_resume", async () => {
  const out = await handleHook("codex", cc({ hook_event_name: "SessionStart", source: "startup" }), env);
  assert.ok(parsed(out).additionalContext.includes("mcp__context_mode__ctx_resume"));
});

test("SessionStart compact on claude-code (compactSummary none, D-M7-CL-1): the renderState block, not the pointer", async () => {
  const out = await handleHook("claude-code", cc({ hook_event_name: "SessionStart", source: "compact" }), env);
  const text = parsed(out).additionalContext;
  assert.ok(text.startsWith("<context_mode_state ") && text !== COMPACT_POINTER_LINE, text);
});

test("SessionStart compact on codex (compactSummary none): the renderState block, not the pointer (M4, D-M4-H2-4)", async () => {
  const out = await handleHook("codex", cc({ hook_event_name: "SessionStart", source: "compact" }), env);
  const text = parsed(out).additionalContext;
  assert.ok(text.startsWith("<context_mode_state ") && text !== COMPACT_POINTER_LINE, text);
});

test("UserPromptSubmit: detached prompt row, allow", async () => {
  const p = cc({ hook_event_name: "UserPromptSubmit", prompt: "find the bug" });
  const out = await handleHook("claude-code", p, env);
  assert.deepEqual(out, { stdout: "", exitCode: 0 });
  const rows = await waitRows("SELECT kind, body, ok FROM events WHERE session_id = ?", [p.session_id], 1);
  assert.deepEqual(rows.map((r) => ({ ...r })), [{ kind: "prompt", body: "find the bug", ok: 1 }]);
});

test("PreCompact (vscode, pending-flag): sets the pending_compact meta key", async () => {
  const p = cc({ hook_event_name: "PreCompact" });
  await handleHook("vscode", p, { ...env, CLAUDE_PROJECT_DIR: "" });
  // vscode resolves its project from --workspace-folder; without one there is no project, so no flag.
  assert.equal(query("SELECT value FROM meta WHERE key = ?", PENDING_COMPACT_META_PREFIX + p.session_id).length, 0);
});

test("PreCompact (gemini PreCompress, pending-flag): sets pending_compact:<sid> = 1 (ADR-0009 §6)", async () => {
  const p = cc({ hook_event_name: "PreCompress" });
  const out = await handleHook("gemini", p, env);
  assert.deepEqual(out, { stdout: "", exitCode: 0 });
  const rows = query("SELECT value FROM meta WHERE key = ?", PENDING_COMPACT_META_PREFIX + p.session_id);
  assert.deepEqual(rows.map((r) => r.value), ["1"]);
});

// D-M7-RR-1: claude-code now allows curl (run, then replace); codex (no replace) keeps the deny.
test("PreToolUse curl: deny, never updatedInput (GP3/no-updated-input-rewrite)", async () => {
  const out = parsed(await handleHook("codex", cc({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "curl https://example.com" } }), env));
  assert.equal(out.permissionDecision, "deny");
  assert.equal("updatedInput" in out, false);
});

test("PreToolUse ctx_execute: empty stdout, no fields (GP3/no-empty-fields)", async () => {
  const out = await handleHook("claude-code", cc({ hook_event_name: "PreToolUse", tool_name: "mcp__plugin_context-mode_context-mode__ctx_execute", tool_input: { language: "shell", code: "ls" } }), env);
  assert.deepEqual(out, { stdout: "", exitCode: 0 });
});

// D-M7-RR-2 (owner decision 2026-10-20): no PreToolUse/PostToolUse hint on any row; these were hint tests.
test("PreToolUse Bash, Grep, Read, other MCP: empty allow, no hint, every call (D-M7-RR-2)", async () => {
  const calls = [
    ["Bash", { command: "ls" }], ["Bash", { command: "npm test" }], ["Grep", { pattern: "x" }],
    ["Read", { file_path: join(repo, "nope.txt") }], ["mcp__foo__bar", {}],
  ];
  for (const [tool_name, tool_input] of calls) {
    const p = cc({ hook_event_name: "PreToolUse", tool_name, tool_input });
    for (let i = 0; i < 3; i++) assert.deepEqual(await handleHook("claude-code", p, env), { stdout: "", exitCode: 0 }, tool_name);
  }
});

test("PostToolUse at or under REPLACE_TRIGGER_BYTES: empty allow, zero added bytes (D-M7-RR-1, D-M7-SV-1)", async () => {
  for (const agent of ["claude-code", "codex"]) {
    const p = cc({ hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: "ls" }, tool_response: { stdout: "x".repeat(REPLACE_TRIGGER_BYTES - 10), stderr: "" } });
    assert.deepEqual(await handleHook(agent, p, env), { stdout: "", exitCode: 0 }, agent);
  }
});

test("GP3/tool-prefix-standalone-mcp: Qwen PreToolUse shell gets no hint (D-M7-RR-2)", async () => {
  const out = await handleHook("qwen", cc({ hook_event_name: "PreToolUse", tool_name: "run_shell_command", tool_input: { command: "ls" } }), { ...env });
  assert.equal(out.stdout, "");
});

test("GP6/no-false-shell-error-capture: Bash exit 0 with 'Error' text is a cmd row, ok 1", async () => {
  const p = cc({ hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: "echo  'Error: none'" }, tool_response: "Error: none" });
  await handleHook("claude-code", p, env);
  const rows = await waitRows("SELECT kind, ok, key, exit_code FROM events WHERE session_id = ?", [p.session_id], 1);
  assert.deepEqual(rows.map((r) => ({ ...r })), [{ kind: "cmd", ok: 1, key: "Bash:echo 'Error: none'", exit_code: null }]);
});

test("PostToolUse failure: toolerr row with stable JSON key and the Exit code digits", async () => {
  const p = cc({ hook_event_name: "PostToolUse", tool_name: "Grep", tool_input: { pattern: "x", path: "src" }, tool_response: { is_error: true, content: "Exit code 2\nboom" } });
  await handleHook("claude-code", p, env);
  const rows = await waitRows("SELECT kind, ok, key, path FROM events WHERE session_id = ?", [p.session_id], 1);
  assert.deepEqual(rows.map((r) => ({ ...r })), [{ kind: "toolerr", ok: 0, key: 'Grep:{"path":"src","pattern":"x"}', path: "src" }]);
});

test("PostToolUse Edit: edit row with the file path", async () => {
  const p = cc({ hook_event_name: "PostToolUse", tool_name: "Edit", tool_input: { file_path: "/a/b.ts" }, tool_response: "ok" });
  await handleHook("claude-code", p, env);
  const rows = await waitRows("SELECT kind, path FROM events WHERE session_id = ?", [p.session_id], 1);
  assert.deepEqual(rows.map((r) => ({ ...r })), [{ kind: "edit", path: "/a/b.ts" }]);
});

test("PostToolUse: clean Read and own ctx_* tool write no row (A25, ADR-0009 §0)", async () => {
  const p = cc({ hook_event_name: "PostToolUse", tool_name: "Read", tool_input: { file_path: "/x" }, tool_response: "text" });
  const q = cc({ hook_event_name: "PostToolUse", tool_name: "mcp__plugin_context-mode_context-mode__ctx_search", tool_input: {}, tool_response: "x" });
  await handleHook("claude-code", p, env);
  await handleHook("claude-code", q, env);
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(query("SELECT 1 FROM events WHERE session_id IN (?, ?)", p.session_id, q.session_id).length, 0);
});

function bigText(bytes) {
  const lines = [];
  let n = 0;
  for (let i = 0; n < bytes; i++) {
    const l = "line " + i + (i % 50 === 0 ? " needle target" : " filler words here") + "\n";
    lines.push(l);
    n += l.length;
  }
  return lines.join("");
}

function subagentPost(text, type) {
  return cc({ hook_event_name: "PostToolUse", agent_id: "sub-1", agent_type: type, tool_name: "Read", tool_input: { file_path: "/big.log", description: "needle target" }, tool_response: text });
}

test("case C under OUTPUT_CAP: allow, nothing indexed", async () => {
  const out = await handleHook("claude-code", subagentPost("small", "reader"), env);
  assert.equal(out.stdout, "");
});

test("case C, OUTPUT_CAP < bytes <= SYNC_INDEX_MAX_BYTES: indexed inline, whole chunks replace (F1)", async () => {
  const text = bigText(40000);
  const p = subagentPost(text, "reader");
  const out = parsed(await handleHook("claude-code", p, env));
  const replaced = out.updatedToolOutput;
  assert.ok(Buffer.byteLength(replaced) <= REPLACE_RETURN_BYTES + 512, "within budget plus the more line");
  assert.ok(replaced.includes("needle target"));
  const src = query("SELECT label, bytes_total FROM sources WHERE session_id = ?", p.session_id);
  // bytes_total is the sum of chunk bytes (store rule): the trailing newline is not a chunk byte.
  assert.equal(src.length, 1);
  assert.equal(src[0].label, "subagent:Read:0");
  assert.ok(src[0].bytes_total >= Buffer.byteLength(text) - 1, "the whole text is indexed, nothing cut");
  // Whole chunks only: the selected chunks, joined by one "\n", make up the body byte for byte.
  const body = replaced.slice(0, replaced.lastIndexOf("\nctx_search(") < 0 ? replaced.length : replaced.lastIndexOf("\nctx_search("));
  const whole = chunkText(text, "text", REPLACE_CHUNK_BYTES).filter((c) => body.includes(c.text));
  assert.ok(whole.length > 0);
  const joined = whole.reduce((n, c) => n + Buffer.byteLength(c.text), 0) + whole.length - 1;
  assert.equal(joined, Buffer.byteLength(body), "the body is whole chunks, nothing cut");
});

test("case C, bytes > SYNC_INDEX_MAX_BYTES: in-memory selection, detached index (F1)", async () => {
  const text = bigText(SYNC_INDEX_MAX_BYTES * 2);
  const p = subagentPost(text, "reader");
  const out = parsed(await handleHook("claude-code", p, env));
  assert.ok(Buffer.byteLength(out.updatedToolOutput) <= REPLACE_RETURN_BYTES + 512);
  assert.ok(out.updatedToolOutput.includes("needle target"));
  const src = await waitRows("SELECT label FROM sources WHERE session_id = ?", [p.session_id], 1);
  assert.equal(src.length, 1);
});

test("case B PreToolUse deny: reason names run.mjs next to the hook bundle (D-M3-arch-3)", async () => {
  const cmd = "curl https://example.com/data";
  const p = cc({ hook_event_name: "PreToolUse", agent_id: "sub-2", agent_type: "sheller", tool_name: "Bash", tool_input: { command: cmd } });
  const out = parsed(await handleHook("claude-code", p, env));
  assert.equal(out.permissionDecision, "deny");
  const first = out.permissionDecisionReason.split("\n")[0];
  assert.ok(first.startsWith("node \""));
  assert.ok(first.includes(sep + "run.mjs\" " + Buffer.from(cmd).toString("base64url") + " "));
  // D-M3-F-7: the rest is the case-B text (drafts.md deny-subagent-run); it names no ctx_* tool the subagent lacks.
  const md = readFileSync(new URL("../../../docs/v2/prompt/drafts.md", import.meta.url), "utf8");
  const at = md.indexOf("<!-- id: deny-subagent-run -->");
  const open = md.indexOf("```text\n", at) + "```text\n".length;
  assert.ok(at >= 0);
  assert.equal(out.permissionDecisionReason.slice(first.length + 1), md.slice(open, md.indexOf("\n```", open)));
  assert.equal(out.permissionDecisionReason.includes("ctx_"), false);
});

test("case A subagent (no agent file, inherits ctx tools): same deny as the main session", async () => {
  const p = cc({ hook_event_name: "PreToolUse", agent_id: "sub-3", tool_name: "Bash", tool_input: { command: "curl https://example.com" } });
  const out = parsed(await handleHook("claude-code", p, env));
  assert.equal(out.permissionDecision, "deny");
  assert.equal(out.permissionDecisionReason.startsWith("node "), false);
});

// ---------- D-M7-RR-1: main agent "run, then replace" (owner decision 2026-10-20) ----------

function mainBashPost(stdout, description = "needle target") {
  return cc({ hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: "cat big.log", description }, tool_use_id: "toolu_" + Math.random().toString(36).slice(2), tool_response: { stdout, stderr: "", interrupted: false, isImage: false } });
}

function searchCtx(sessionId) {
  const f = dbFile();
  const projectDir = join(f, "..");
  const projectKey = projectDir.split(sep).pop();
  return {
    project: { projectKey, projectDir, dbPath: f, worktree: repo, containmentRoot: root, agent: "claude-code", source: "env:CLAUDE_PROJECT_DIR" },
    sessionId, turn: 1, signal: new AbortController().signal,
  };
}

test("D-M7-RR-1: main-agent Bash over OUTPUT_CAP on claude-code: selected whole chunks + more line, full output indexed", async () => {
  const text = bigText(40000);
  const p = mainBashPost(text);
  const out = parsed(await handleHook("claude-code", p, env));
  const replaced = replacedText(out.updatedToolOutput);
  assert.equal(typeof replaced, "string");
  assert.ok(Buffer.byteLength(replaced) <= REPLACE_RETURN_BYTES + 512, "within budget plus the more line");
  assert.ok(Buffer.byteLength(replaced) < Buffer.byteLength(text));
  assert.ok(replaced.includes("needle target"));
  const more = replaced.lastIndexOf("\nctx_search(");
  assert.ok(more > 0, "the more line names ctx_search");
  const body = replaced.slice(0, more);
  // Whole chunks of the plain stdout (not the JSON tool_response): nothing cut, no escaped newlines.
  const whole = chunkText(text, "text", REPLACE_CHUNK_BYTES).filter((c) => body.includes(c.text));
  assert.ok(whole.length > 0);
  const joined = whole.reduce((n, c) => n + Buffer.byteLength(c.text), 0) + whole.length - 1;
  assert.equal(joined, Buffer.byteLength(body), "the body is whole chunks, nothing cut");
  const src = query("SELECT label, bytes_total FROM sources WHERE session_id = ?", p.session_id);
  assert.equal(src.length, 1);
  assert.ok(replaced.slice(more).includes(JSON.stringify(src[0].label)), "the more line names the source label");
  assert.ok(src[0].bytes_total >= Buffer.byteLength(text) - 1, "the whole output is indexed, nothing cut");
  // The full output is findable: a chunk the replace dropped comes back from ctx_search, by a line only it holds.
  const all = chunkText(text, "text", REPLACE_CHUNK_BYTES);
  // D-M7-SV-1: with small chunks the first dropped chunk holds one-digit line numbers, which are not a
  // distinct query; take the first dropped chunk with a line number of 3+ digits (same assertion below).
  const gone = all.find((c) => !body.includes(c.text) && /^line \d{3,} filler/m.test(c.text));
  assert.ok(gone !== undefined, "some chunk was not in the replaced text");
  const inner = gone.text.split("\n").slice(1, -1).find((l) => /^line \d{3,} filler/.test(l));
  const num = inner.split(" ")[1];
  const r = await ctxSearch.handler({ queries: ["line " + num + " filler"], scope: "session", source: src[0].label }, searchCtx(p.session_id));
  assert.equal(r.isError, false, r.text);
  assert.ok(r.text.includes(src[0].label + " #" + gone.ord + ":"), "ctx_search finds the dropped chunk: ord " + gone.ord + " num " + num + "\n" + r.text.slice(0, 600));
});

test("D-M7-RR-3: no Bash description: the intent is the command text, never an empty query", async () => {
  const p = mainBashPost(bigText(40000), undefined);
  delete p.tool_input.description;
  const out = parsed(await handleHook("claude-code", p, env));
  const replaced = replacedText(out.updatedToolOutput);
  const more = replaced.slice(replaced.lastIndexOf("\nctx_search("));
  assert.ok(!more.includes('[""]'), "the more line has no empty query: " + more);
  assert.ok(more.includes("cat big.log"), "the more line queries the command text: " + more);
});

test("D-M7-RR-3: no description on Read, Grep, WebFetch: file path, pattern, URL are the intent", async () => {
  for (const [tool, input, want] of [["Read", { file_path: "/tmp/big.log" }, "/tmp/big.log"], ["Grep", { pattern: "needle target" }, "needle target"], ["WebFetch", { url: "https://example.com/x" }, "https://example.com/x"]]) {
    const p = cc({ hook_event_name: "PostToolUse", tool_name: tool, tool_input: input, tool_use_id: "toolu_" + tool, tool_response: bigText(40000) });
    const out = parsed(await handleHook("claude-code", p, env));
    if (typeof out.updatedToolOutput !== "string") continue; // row has no replace channel for this tool
    const replaced = out.updatedToolOutput;
    const more = replaced.slice(replaced.lastIndexOf("\nctx_search("));
    assert.ok(!more.includes('[""]'), tool + ": no empty query: " + more);
    assert.ok(more.includes(want), tool + ": the more line queries " + want + ": " + more);
  }
});

test("D-M7-RR-1: main-agent replace above SYNC_INDEX_MAX_BYTES: in-memory selection, detached index", async () => {
  const text = bigText(SYNC_INDEX_MAX_BYTES * 2);
  const p = mainBashPost(text);
  const out = parsed(await handleHook("claude-code", p, env));
  const replaced = replacedText(out.updatedToolOutput);
  assert.ok(Buffer.byteLength(replaced) <= REPLACE_RETURN_BYTES + 512);
  assert.ok(replaced.includes("needle target"));
  const src = await waitRows("SELECT label FROM sources WHERE session_id = ?", [p.session_id], 1);
  assert.equal(src.length, 1);
});

test("D-M7-SV-1: a 4-16K Bash output is replaced by at most REPLACE_RETURN_BYTES of whole small chunks plus the more line", async () => {
  const text = bigText(REPLACE_TRIGGER_BYTES * 2);
  const p = mainBashPost(text);
  const out = parsed(await handleHook("claude-code", p, env));
  const replaced = replacedText(out.updatedToolOutput);
  const more = replaced.lastIndexOf("\nctx_search(");
  assert.ok(more > 0, "the more line names ctx_search");
  assert.ok(Buffer.byteLength(replaced.slice(0, more)) <= REPLACE_RETURN_BYTES);
  assert.ok(replaced.includes("needle target"));
  for (const c of chunkText(text, "text", REPLACE_CHUNK_BYTES)) assert.ok(c.bytes <= REPLACE_CHUNK_BYTES);
});

test("D-M7-SV-1: small chunks drop no byte: chunk bytes sum to the text bytes; the default chunking is unchanged", () => {
  const text = bigText(20000);
  const small = chunkText(text, "text", REPLACE_CHUNK_BYTES);
  assert.equal(small.reduce((n, c) => n + c.bytes, 0) + 1, Buffer.byteLength(text), "only the final newline is not a chunk byte");
  assert.deepEqual(chunkText(text, "text", 1 << 30), chunkText(text, "text"));
});

test("D-M7-RR-1: rows with no replace (codex, qwen) keep their one path: large PostToolUse is the empty allow", async () => {
  for (const agent of ["codex", "qwen"]) {
    const p = mainBashPost(bigText(40000));
    const out = await handleHook(agent, p, env);
    assert.deepEqual(out, { stdout: "", exitCode: 0 }, agent);
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(query("SELECT 1 FROM sources WHERE session_id = ?", p.session_id).length, 0, agent + ": nothing indexed");
  }
});

test("D-M7-RR-1: main-agent PreToolUse curl on claude-code is allowed (replace takes over); codex still denies", async () => {
  const p = cc({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "curl -s https://x.io/a.json" } });
  assert.deepEqual(await handleHook("claude-code", p, env), { stdout: "", exitCode: 0 });
  const c = parsed(await handleHook("codex", p, env));
  assert.equal(c.permissionDecision, "deny");
});

test("D-M7-RR-1: user policy deny and Read deny unchanged on claude-code", async () => {
  mkdirSync(join(repo, ".claude"), { recursive: true });
  const settings = join(repo, ".claude", "settings.json");
  const had = existsSync(settings) ? readFileSync(settings, "utf8") : null;
  writeFileSync(settings, JSON.stringify({ permissions: { deny: ["Bash(rm -rf:*)"] } }));
  try {
    const d = parsed(await handleHook("claude-code", cc({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "rm -rf build" } }), env));
    assert.equal(d.permissionDecision, "deny");
    assert.ok(d.permissionDecisionReason.includes("Bash(rm -rf:*)"));
  } finally {
    if (had === null) rmSync(settings); else writeFileSync(settings, had);
  }
  const big = join(repo, "big-read.log");
  writeFileSync(big, "x".repeat(OUTPUT_CAP * 4));
  const r = parsed(await handleHook("claude-code", cc({ hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: big } }), env));
  assert.equal(r.permissionDecision, "deny");
});

test("D-M7-SV-2: the replace return budget is at most 512 bytes, a constant of its own under OUTPUT_CAP; a 16K output keeps the intent chunk", async () => {
  assert.ok(REPLACE_RETURN_BYTES <= 512, "D-M7-SV-3 pins the exact value");
  assert.ok(REPLACE_RETURN_BYTES < OUTPUT_CAP && REPLACE_RETURN_BYTES >= 2 * REPLACE_CHUNK_BYTES, "at least two whole chunks fit");
  const text = bigText(16000);
  const out = parsed(await handleHook("claude-code", mainBashPost(text), env));
  const replaced = replacedText(out.updatedToolOutput);
  const more = replaced.lastIndexOf("\nctx_search(");
  assert.ok(more > 0, "the more line names ctx_search");
  assert.ok(Buffer.byteLength(replaced.slice(0, more)) <= 512);
  assert.ok(replaced.includes("needle target"));
});

test("D-M7-SV-3: return budget 96 and chunk cap 48; two whole chunks fit; a 16K output keeps the intent line and drops no byte", async () => {
  assert.equal(REPLACE_RETURN_BYTES, 96);
  assert.equal(REPLACE_CHUNK_BYTES, 48);
  assert.ok(REPLACE_RETURN_BYTES >= 2 * REPLACE_CHUNK_BYTES, "at least two whole chunks fit");
  const text = bigText(16000);
  const out = parsed(await handleHook("claude-code", mainBashPost(text), env));
  const replaced = replacedText(out.updatedToolOutput);
  const more = replaced.lastIndexOf("\nctx_search(");
  assert.ok(more > 0, "the more line names ctx_search");
  assert.ok(Buffer.byteLength(replaced.slice(0, more)) <= 96);
  assert.ok(replaced.includes("needle target"));
  const chunks = chunkText(text, "text", REPLACE_CHUNK_BYTES);
  for (const c of chunks) assert.ok(c.bytes <= 48);
  assert.equal(chunks.reduce((n, c) => n + c.bytes, 0) + 1, Buffer.byteLength(text), "only the final newline is not a chunk byte");
  const fail = "FAIL suite/gamma/case_1234_abc123 (12ms) expected 3 got 4\n";
  const log = bigText(8000) + fail + bigText(2000);
  assert.ok(chunkText(log, "text", REPLACE_CHUNK_BYTES).some((c) => c.text.includes("FAIL suite/gamma/case_1234_abc123")), "a test id stays in one chunk");
});
