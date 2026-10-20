// W1-core PORT of tests/stale-detection.test.ts, tests/core/echo-commands.test.ts, tests/executor/win-sandbox-782-788.test.ts (#788)
// to the v2 tool handlers. v2 has no search-time stale check (ADR-0016: one path, no fallback); a changed file is
// refreshed by ctx_index(path) again; the store only appends, so the old text stays.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, realpathSync, existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { ctxIndex } from "../../../src/core/tools/index.ts";
import { ctxSearch } from "../../../src/core/tools/search.ts";
import { ctxExecute } from "../../../src/core/tools/execute.ts";
import { ctxBatch } from "../../../src/core/tools/batch.ts";

function ctxFor(root) {
  const k = "1".repeat(16);
  return { project: { projectKey: k, projectDir: join(root, "projects", k), dbPath: join(root, "projects", k, "context.db"), worktree: root, containmentRoot: root, agent: "claude-code", source: "env:CLAUDE_PROJECT_DIR" }, sessionId: "s1", turn: 1, signal: new AbortController().signal };
}
const search = (ctx, q) => ctxSearch.handler({ queries: [q] }, ctx);

test("[W1-core] stale-detection: re-indexing a changed file adds the new text (old text kept, new token found)", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "cm-stale-")));
  try {
    const ctx = ctxFor(root);
    writeFileSync(join(root, "a.md"), "# T\n\nalphaoldtoken here\n");
    await ctxIndex.handler({ path: "a.md" }, ctx);
    assert.ok((await search(ctx, "alphaoldtoken")).text.includes("alphaoldtoken here"));
    writeFileSync(join(root, "a.md"), "# T\n\nbetanewtoken here\n");
    assert.equal((await ctxIndex.handler({ path: "a.md" }, ctx)).isError, false);
    assert.ok((await search(ctx, "betanewtoken")).text.includes("betanewtoken here"));
    // v2 is append-only (no data loss): the earlier text stays searchable. v1 deleted it (D-M7-CLN-3).
    assert.ok((await search(ctx, "alphaoldtoken")).text.includes("alphaoldtoken here"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("[W1-core] stale-detection: inline content index never reads a file; a deleted file does not break search", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "cm-stale2-")));
  try {
    const ctx = ctxFor(root);
    await ctxIndex.handler({ content: "inlinetokenzed body", source: "inl" }, ctx);
    writeFileSync(join(root, "gone.md"), "# G\n\ngonetokenzed body\n");
    await ctxIndex.handler({ path: "gone.md" }, ctx);
    unlinkSync(join(root, "gone.md"));
    assert.ok((await search(ctx, "inlinetokenzed")).text.includes("inlinetokenzed body"));
    const gone = await search(ctx, "gonetokenzed");
    assert.equal(gone.isError, false);
    assert.ok(gone.text.includes("gonetokenzed body"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// #717 / #736: the ran code and commands are echoed so the user can audit them.
test("[W1-core] #717: ctx_execute summary:true echoes the language and the code before stdout", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "cm-echo-")));
  try {
    const out = await ctxExecute.handler({ language: "shell", code: "echo hi-echo", summary: true }, ctxFor(root));
    assert.equal(out.isError, false);
    assert.ok(out.text.includes("```shell\necho hi-echo\n```"));
    assert.ok(out.text.indexOf("```shell") < out.text.lastIndexOf("hi-echo"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("[W1-core] #736: ctx_batch section names each command's output; summary line counts commands", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "cm-echo2-")));
  try {
    const out = await ctxBatch.handler({ commands: ["echo alpha", "echo beta"], queries: ["alpha"] }, ctxFor(root));
    assert.equal(out.isError, false);
    assert.ok(out.text.startsWith("2 command(s)"));
    assert.ok(out.text.includes("alpha"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// #788(a)(b): non-shell runtimes run in the project root; the sandbox temp dir is removed after the run.
test("[W1-core] #788: python/javascript run in the project root and leave no temp dir behind", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "cm-788-")));
  try {
    const out = await ctxExecute.handler({ language: "javascript", code: "console.log('CWD=' + process.cwd()); console.log('S=' + process.argv[1]);" }, ctxFor(root));
    const line = (k) => out.text.split("\n").find((l) => l.startsWith(k)).slice(k.length);
    assert.equal(realpathSync(line("CWD=")), root);
    assert.equal(existsSync(dirname(line("S="))), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
