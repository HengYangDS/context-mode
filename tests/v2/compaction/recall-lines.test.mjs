// [M7] a-ledger (D-FU-CMP-LEDGER-1): a journal row too large for the recall block is ranked line by line.
// Each line is scored with its indentation context (the nearest earlier lines with less indentation), so a
// value in nested output (JSON, test reports) comes back with the keys above it. Whole lines only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickRecall } from "../../../src/core/compaction/recall.ts";
import { RECALL_BUDGET_BYTES } from "../../../src/core/contracts/constants.ts";

const bytes = (s) => Buffer.byteLength(s, "utf8");
const row = (p) => ({ seq: 1, session_id: "s1", worktree: "/w", agent: "claude-code", kind: "cmd", tool: "Bash", key: null, path: null,
  ok: 1, exit_code: null, bytes: 0, body: "", turn: 1, sandbox_bytes: 0, returned_bytes: 0, created_at: 0, accessed_at: 0, ...p });

function deployJson() {
  const regions = {};
  for (const reg of ["us-east-1", "eu-west-3", "ap-south-2", "ap-south-1"]) {
    const services = {};
    for (const s of ["ledger", "billing", "search", "auth"]) {
      services[s] = { replicas: 3, retry: { max: 4, backoff_ms: 100 + reg.length * 7 + s.length }, image: { tag: `v1.${reg.length}.${s.length}-${reg}-${s}` } };
    }
    regions[reg] = { services };
  }
  return JSON.stringify({ regions }, null, 2) + "\n";
}

test("[M7] recall-lines/nested-value: the line comes back whole, with its keys, inside the budget", () => {
  const body = deployJson().repeat(4);
  assert.ok(bytes(body) > RECALL_BUDGET_BYTES);
  const rows = [row({ seq: 7, key: "Bash:cat config/deploy.json", body })];
  const out = pickRecall(rows, "What is the image tag of the ledger service in region ap-south-2?", new Set());
  assert.ok(out.text.includes('"tag": "v1.10.6-ap-south-2-ledger"'), out.text);
  assert.ok(out.text.includes('"ap-south-2": {'), "the key path above the value is shown");
  assert.ok(bytes(out.text) <= RECALL_BUDGET_BYTES, String(bytes(out.text)));
  const lines = new Set(body.split("\n").map((l) => l.trim()));
  for (const l of out.text.split("\n").slice(1, -1)) {
    const last = l.slice(l.lastIndexOf(" > ") >= 0 ? l.lastIndexOf(" > ") + 3 : l.indexOf(": ") + 2);
    assert.ok(lines.has(last), "every shown line is a whole line of the output: " + l);
  }
  assert.deepEqual(out.seqs, [], "a row shown by lines is not marked seen; it can answer the next prompt too");
});

test("[M7] recall-lines/flat-log: the one rare line ranks first and keeps its cat -n number", () => {
  const lines = [];
  for (let i = 1; i <= 400; i++) lines.push(String(i).padStart(6) + "\tINFO req=r" + (1000 + i) + " GET /v1/orders 200");
  lines[211] = String(212).padStart(6) + "\tFATAL req=deadbeef12 code=E9001 writer pool exhausted";
  const out = pickRecall([row({ seq: 3, key: "Bash:cat -n logs/server.log", body: lines.join("\n") + "\n" })], "What was the req id on the only FATAL line?", new Set());
  assert.ok(out.text.includes("212\tFATAL req=deadbeef12"), out.text);
});

test("[M7] recall-lines/indented-child: a failure detail line carries the test line above it", () => {
  const lines = ["# seed 4242"];
  for (let i = 1; i <= 300; i++) lines.push(i === 120 ? "not ok 120 - queue > keeps rows case 120 (5ms)" : `ok ${i} - fts > drops locks case ${i} (3ms)`);
  lines.splice(121, 0, "  error: expected 1111 got 2222", "  at tests/queue/io-120.test.mjs:41:7");
  const out = pickRecall([row({ seq: 5, key: "Bash:cat test-output.txt", body: lines.join("\n") }) ], 'the test "queue > keeps rows case 120" failed with "expected X got Y". What was Y?', new Set());
  assert.ok(out.text.includes("not ok 120 - queue > keeps rows case 120 (5ms) > error: expected 1111 got 2222"), out.text);
});

test("[M7] recall-lines/deterministic and nothing for an unrelated prompt", () => {
  const rows = [row({ seq: 7, body: deployJson().repeat(4) })];
  const p = "retry backoff_ms of billing in eu-west-3";
  const a = pickRecall(rows, p, new Set()).text;
  assert.notEqual(a, "");
  for (let i = 0; i < 3; i++) assert.equal(pickRecall(rows, p, new Set()).text, a);
  assert.equal(pickRecall(rows, "what is the weather", new Set()).text, "");
});
