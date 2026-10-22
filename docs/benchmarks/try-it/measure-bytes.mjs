#!/usr/bin/env node
// Reads the private stream-json transcripts once and writes tool-result-bytes.json (public, no ids, no text).
// Usage: node measure-bytes.mjs <private-root>
//   <private-root>/<prompt>/[priv/]runs.jsonl      private run ledger (session id per run)
//   <private-root>/<prompt>/[priv/]transcripts/<prompt>-<role>-<cycle>-<attempt>-<arm>.jsonl
// Per session it records: the byte sum over every tool_result block the model was sent (UTF-8 bytes of the text;
// a non-text block counts as the bytes of its JSON), the number of tool_result blocks, tool calls by kind,
// compact_boundary events, and the oracle reason from the run ledger. Every transcript must match its run row by session id, turns and client cost
// (fail closed). The output carries the SHA-256 of each transcript, so a holder of the transcripts can check it.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROMPTS = ["repo-research", "git-history", "web-scrape", "large-json", "docs-search", "session-continuity"];
const root = process.argv[2];
if (!root) throw new Error("usage: node measure-bytes.mjs <private-root>");
const fail = (m) => { throw new Error("measure-bytes: " + m); };
const B = (s) => Buffer.byteLength(s, "utf8");

function blockBytes(c) {
  if (typeof c.content === "string") return B(c.content);
  if (Array.isArray(c.content)) return c.content.reduce((s, x) => s + (x.type === "text" ? B(x.text) : B(JSON.stringify(x))), 0);
  if (c.content == null) return 0;
  return B(JSON.stringify(c.content));
}

const out = { schema: "context-mode.tryit-tool-result-bytes/1",
  method: "Sum over every tool_result block in the session transcript (stream-json user events): UTF-8 bytes of each text part; a non-text part counts as the bytes of its JSON. Tool calls: tool_use blocks in assistant events. compact_boundary: system events of that subtype.",
  sessions: [] };
for (const w of PROMPTS) {
  const base = existsSync(join(root, w, "priv", "runs.jsonl")) ? join(root, w, "priv") : join(root, w);
  const pub = readFileSync(join(HERE, "runs", w + ".jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const priv = readFileSync(join(base, "runs.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.cycle_done);
  for (const r of pub) {
    const p = priv.filter((x) => x.cycle === r.cycle && x.arm === r.arm && x.role === r.role && x.attempt === r.attempt);
    if (p.length !== 1) fail(`${w} ${r.role} ${r.cycle} ${r.arm}: ${p.length} private rows`);
    if (p[0].usd !== r.usd || p[0].turns !== r.turns || p[0].success !== r.success) fail(`${w} ${r.cycle} ${r.arm}: public and private rows differ`);
    if (typeof p[0].oracle !== "string") fail(`${w} ${r.cycle} ${r.arm}: no oracle reason in the run ledger`);
    const f = join(base, "transcripts", `${w}-${r.role}-${r.cycle}-${r.attempt}-${r.arm}.jsonl`);
    const raw = readFileSync(f);
    const ev = raw.toString("utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    const init = ev.find((e) => e.type === "system" && e.subtype === "init");
    const res = ev.filter((e) => e.type === "result");
    if (!init || res.length !== 1) fail(`${f}: no init or not one result event`);
    if (p[0].session && init.session_id !== p[0].session) fail(`${f}: session id differs from the run ledger`);
    if (res[0].num_turns !== r.turns) fail(`${f}: turns ${res[0].num_turns} != ${r.turns}`);
    let bytes = 0, blocks = 0, compact = 0; const calls = {};
    for (const e of ev) {
      if (e.type === "system" && e.subtype === "compact_boundary") compact++;
      const content = e.message?.content;
      if (!Array.isArray(content)) continue;
      if (e.type === "user") for (const c of content) if (c.type === "tool_result") { bytes += blockBytes(c); blocks++; }
      if (e.type === "assistant") for (const c of content) if (c.type === "tool_use") calls[c.name] = (calls[c.name] || 0) + 1;
    }
    out.sessions.push({ w, cycle: r.cycle, arm: r.arm, role: r.role, attempt: r.attempt, oracle: p[0].oracle,
      tool_result_bytes: bytes, tool_result_blocks: blocks, tool_calls: calls, compact_boundary: compact,
      transcript_sha256: createHash("sha256").update(raw).digest("hex") });
  }
}
writeFileSync(join(HERE, "tool-result-bytes.json"), JSON.stringify(out, null, 1) + "\n");
console.log("sessions", out.sessions.length);
