// D-V1OUT-1 (owner 2026-10-25): users see one product. The word "v1" must not appear in README.md, docs/install/**,
// src/prompt/**, issue templates or CLI help/output. docs/benchmarks/** and docs/v2/** are exempt.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkNoV1, v1FreeFiles } from "../../../build/check-install-docs.mjs";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

test("v1-out: the word v1 fails in any case; v10, ev1 and @1 pass", () => {
  const out = checkNoV1("a.md", ["fine", "from v1 to new", "V1 leftovers", "rollback-to-v1", "v10 ev1 context-mode@1"].join("\n")).join("\n");
  for (const s of ["a.md:2", "a.md:3", "a.md:4"]) assert.ok(out.includes(s), s + "\n" + out);
  assert.ok(!out.includes("a.md:1") && !out.includes("a.md:5"), out);
});

test("v1-out: the file list covers README, install docs, prompts and issue templates, not benchmarks or docs/v2", () => {
  const files = v1FreeFiles(REPO).map((f) => path.relative(REPO, f).split(path.sep).join("/"));
  for (const must of ["README.md", "docs/install/README.md", "docs/install/codex.md", "src/prompt/instructions.md", ".github/ISSUE_TEMPLATE/bug.yml", "e2e/golden/cli/help-main.txt"]) assert.ok(files.includes(must), must);
  assert.ok(files.every((f) => !f.startsWith("docs/benchmarks/") && !f.startsWith("docs/v2/")), files.join(","));
});

test("v1-out: the real user-facing files have no v1 mention", () => {
  const bad = v1FreeFiles(REPO).flatMap((f) => checkNoV1(path.relative(REPO, f), readFileSync(f, "utf8")));
  assert.deepEqual(bad, []);
});
