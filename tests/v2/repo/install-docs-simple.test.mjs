// build/check-install-docs.mjs simple rules (owner 2026-10-25): users never type paths, JSON or scripts.
// A docs code block must not hold `node -e`, `npm root -g`, `$(...)` or a path under a home dir; a shell line is
// at most 100 chars; every install page names the two-command path or `context-mode setup --agents`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkSimpleLines, checkSimplePages, docFiles } from "../../../build/check-install-docs.mjs";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const DIR = path.join(REPO, "docs", "install");

test("install-docs-simple: scripts, npm root -g, $(...) and home paths in a code block fail", () => {
  const bad = ["```sh", "node -e 'require(\"fs\")'", 'claude mcp add x -- node "$(npm root -g)/context-mode/server.mjs"',
    "ls $(pwd)", "cat ~/.vscode/mcp.json", 'node "$HOME/.context-mode-app/server.mjs"', "type %USERPROFILE%\\x", "```",
    "```json", '{"command":"/Users/me/.nvm/bin/node"}', '{"args":["{env:HOME}/x"]}', "```",
    "```powershell", 'node "$env:USERPROFILE\\x"', "```", "outside a fence: node -e 1 and ~/.codex"].join("\n");
  const out = checkSimpleLines("s.md", bad).join("\n");
  for (const s of ["s.md:2 node -e", "s.md:3 npm root -g", "s.md:3 $(...)", "s.md:4 $(...)", "s.md:5 home path", "s.md:6 home path",
    "s.md:7 home path", "s.md:10 home path", "s.md:11 home path", "s.md:14 home path"]) assert.ok(out.includes(s), s + "\n" + out);
  assert.ok(!out.includes("s.md:16"), "text outside a fence is not checked");
});

test("install-docs-simple: a shell line over 100 chars fails; 100 passes", () => {
  const long = "context-mode setup --agents " + "x".repeat(73); // 101
  const ok = "context-mode setup --agents " + "x".repeat(72); // 100
  const out = checkSimpleLines("l.md", ["```sh", long, ok, "```", "```powershell", long, "```", "```", long, "```"].join("\n")).join("\n");
  assert.ok(out.includes("l.md:2 line over 100 chars"), out);
  assert.ok(!out.includes("l.md:3"), out);
  assert.ok(out.includes("l.md:6 line over 100 chars") && out.includes("l.md:9 line over 100 chars"), out);
});

test("install-docs-simple: the simple forms pass", () => {
  const ok = ["```sh", "npm i -g context-mode@next", "context-mode setup", "context-mode setup --agents codex",
    "context-mode setup --print codex", "claude plugin marketplace add mksglu/context-mode", "context-mode doctor", "```"].join("\n");
  assert.deepEqual(checkSimpleLines("ok.md", ok), []);
});

test("install-docs-simple: every page has the two-command path or setup --agents", () => {
  const two = "```sh\nnpm i -g context-mode@next\ncontext-mode setup\n```\n";
  assert.deepEqual(checkSimplePages({ "README.md": two, "codex.md": "```sh\ncontext-mode setup --agents codex\n```\n" }), []);
  const out = checkSimplePages({ "README.md": "```sh\nnpm i -g context-mode@next\n```\n", "codex.md": "run context-mode setup\n" }).join("\n");
  assert.ok(out.includes("README.md needs the two-command path"), out);
  assert.ok(out.includes("codex.md needs the two-command path or context-mode setup --agents"), out);
});

test("install-docs-simple: every agent page names setup --print and setup --remove --agents for its id", () => {
  const page = "```sh\ncontext-mode setup --agents codex\n```\nRun context-mode setup --print codex.\n```sh\ncontext-mode setup --remove --agents codex\n```\n";
  assert.deepEqual(checkSimplePages({ "codex.md": page }), []);
  const out = checkSimplePages({ "codex.md": "```sh\ncontext-mode setup --agents codex\n```\n" }).join("\n");
  assert.ok(out.includes("codex.md needs context-mode setup --print codex"), out);
  assert.ok(out.includes("codex.md needs context-mode setup --remove --agents codex"), out);
});

test("install-docs-simple: the real docs pass (install pages, README, top-level docs, CONTRIBUTING)", () => {
  const files = docFiles(REPO);
  assert.ok(files.length >= 13, files.join(","));
  const bad = files.flatMap((f) => checkSimpleLines(path.relative(REPO, f), readFileSync(f, "utf8")));
  assert.deepEqual(bad, []);
  const pages = Object.fromEntries(readdirSync(DIR).filter((f) => f.endsWith(".md")).map((f) => [f, readFileSync(path.join(DIR, f), "utf8")]));
  pages["README.md"] = readFileSync(path.join(REPO, "README.md"), "utf8");
  assert.deepEqual(checkSimplePages(pages), []);
});
