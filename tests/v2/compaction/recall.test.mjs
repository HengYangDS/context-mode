// [M7] Unit tests for src/core/compaction/recall.ts (DECISIONS-r11 B): BM25 turn-boundary recall, whole rows,
// RECALL_BUDGET_BYTES, RECALL_MIN_SCORE, no repeat of a row already injected.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickRecall, recallLine } from "../../../src/core/compaction/recall.ts";
import { RECALL_BUDGET_BYTES, RECALL_CLOSE_TAG, RECALL_MIN_SCORE, RECALL_OPEN_TAG } from "../../../src/core/contracts/constants.ts";

const bytes = (s) => Buffer.byteLength(s, "utf8");

function row(partial) {
  return {
    seq: 1, session_id: "s1", worktree: "/w", agent: "claude-code",
    kind: "prompt", tool: null, key: null, path: null, ok: 1, exit_code: null,
    bytes: 0, body: "", turn: 1, sandbox_bytes: 0, returned_bytes: 0, created_at: 0, accessed_at: 0,
    ...partial,
  };
}

// A compaction only happens in a long session, so the journal has many rows; BM25 IDF needs that size
// (a 4-row corpus gives every shared term an IDF near 0). The filler is unrelated work of the same session.
const FILLER = [
  "rename the config loader", "Exit code 0\nall 42 tests passed", "update the changelog for the release",
  "bump the version in package.json", "Exit code 0\nbuild finished in 2.1 s", "add a retry to the http client",
  "write docs for the cli flags", "Exit code 0\nlint clean", "move the date helpers to utils",
  "check the coverage report", "split the large router file", "Exit code 0\n12 files formatted",
];
const filler = () => FILLER.map((body, i) => row({ seq: 100 + i, kind: i % 3 === 1 ? "cmd" : "prompt", tool: i % 3 === 1 ? "Bash" : null, body }));

const journal = () => [
  ...filler(),
  row({ seq: 1, kind: "prompt", body: "fix the flaky login test" }),
  row({ seq: 2, kind: "cmd", tool: "Bash", key: "npm test -- login", ok: 0, exit_code: 1,
    body: "Exit code 1\nFAIL tests/login.test.ts\nTimeoutError: waitForSelector #submit exceeded 3000 ms" }),
  row({ seq: 3, kind: "edit", tool: "Edit", path: "src/ui/theme.css", body: "" }),
  row({ seq: 4, kind: "prompt", body: "add a dark mode toggle" }),
];

test("[M7] recall/names-an-earlier-error: the failing row comes back whole", () => {
  const out = pickRecall(journal(), "why did the login test time out on waitForSelector submit", new Set());
  assert.deepEqual(out.seqs, [2]);
  assert.ok(out.text.startsWith(RECALL_OPEN_TAG + "\n") && out.text.endsWith("\n" + RECALL_CLOSE_TAG), out.text);
  assert.ok(out.text.includes(recallLine(journal().find((r) => r.seq === 2))), "the whole row, never cut");
  assert.ok(out.text.includes("TimeoutError: waitForSelector #submit exceeded 3000 ms"));
});

test("[M7] recall/below-threshold: an unrelated prompt adds nothing", () => {
  const out = pickRecall(journal(), "what is the weather", new Set());
  assert.deepEqual(out, { text: "", seqs: [] });
  assert.ok(RECALL_MIN_SCORE > 0);
});

test("[M7] recall/no-repeat: a seq already injected is never picked again", () => {
  const prompt = "why did the login test time out on waitForSelector submit";
  const first = pickRecall(journal(), prompt, new Set());
  assert.deepEqual(first.seqs, [2]);
  const second = pickRecall(journal(), prompt, new Set(first.seqs));
  assert.equal(second.seqs.includes(2), false);
});

test("[M7] recall/own-prompt-not-a-candidate: the prompt's own journal row is skipped", () => {
  const prompt = "fix the flaky login test";
  const out = pickRecall([row({ seq: 9, kind: "prompt", body: prompt })], prompt, new Set());
  assert.deepEqual(out.seqs, []);
});

test("[M7] recall/budget: many matching rows stay within RECALL_BUDGET_BYTES, whole rows only", () => {
  // 24 matching rows of ~100 B (more than the budget) in a session of 264 rows: BM25 IDF stays high
  // only while a term is in few rows, as in a real long session (probe: top score 6.70).
  const rows = [];
  for (let k = 0; k < 20; k++) rows.push(...filler().map((r) => ({ ...r, seq: 1000 + 100 * k + r.seq })));
  for (let i = 1; i <= 24; i++) {
    rows.push(row({ seq: i, kind: "toolerr", tool: "Read", key: "yaml parse " + i, ok: 0,
      body: "yaml parse failed at line " + i + " of config/app.yaml: unexpected token" }));
  }
  const out = pickRecall(rows, "why did the yaml parse fail", new Set());
  assert.ok(out.seqs.length > 1 && out.seqs.length < 24, String(out.seqs.length));
  assert.ok(bytes(out.text) <= RECALL_BUDGET_BYTES, String(bytes(out.text)));
  const expected = [RECALL_OPEN_TAG, ...out.seqs.map((s) => recallLine(rows.find((r) => r.seq === s))), RECALL_CLOSE_TAG].join("\n");
  assert.equal(out.text, expected, "whole rows, seq ascending");
  assert.ok(bytes(expected) + bytes(recallLine(rows[rows.length - 1])) + 1 > RECALL_BUDGET_BYTES || out.seqs.length === 23);
});

test("[M7] recall/row-over-budget-is-skipped-not-cut", () => {
  const big = row({ seq: 1, kind: "toolerr", tool: "Read", key: "parser crash", ok: 0, body: "parser crash " + "q ".repeat(RECALL_BUDGET_BYTES) });
  const small = row({ seq: 2, kind: "toolerr", tool: "Read", key: "parser crash small", ok: 0, body: "parser crash again" });
  const out = pickRecall([...filler(), big, small], "parser crash", new Set());
  assert.deepEqual(out.seqs, [2]);
});

test("[M7] recall/cost-rows-and-empty-prompt-add-nothing", () => {
  assert.deepEqual(pickRecall(journal(), "   ", new Set()).seqs, []);
  assert.deepEqual(pickRecall([row({ seq: 1, kind: "cost", body: "" })], "cost", new Set()).seqs, []);
});

test("[M7] recall/deterministic: same rows, same prompt -> same bytes", () => {
  const p = "why did the login test time out on waitForSelector submit";
  const a = pickRecall(journal(), p, new Set()).text;
  for (let i = 0; i < 5; i++) assert.equal(pickRecall(journal(), p, new Set()).text, a);
});
