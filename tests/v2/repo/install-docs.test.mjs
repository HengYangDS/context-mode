// build/check-install-docs.mjs: docs/install/*.md fenced blocks must run as copied (owner rule 2026-10-21).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkLines } from "../../../build/check-install-docs.mjs";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "docs", "install");

test("install-docs: a bad sample fails on every rule", () => {
  const bad = ["```json", '{"args":["/Users/you/.context-mode-app/server.mjs"]}', "npx -y context-mode", "node <path>/server.mjs",
    "node /opt/.context-mode-app/server.mjs", "C:\\Users\\you\\x", "```", "/Users/you outside a fence"].join("\n");
  const out = checkLines("a.md", bad).join("\n");
  for (const s of ["a.md:2 user path", "a.md:3 npx context-mode", "a.md:4 placeholder", "a.md:5 .context-mode-app path", "a.md:6 user path"]) assert.ok(out.includes(s), s);
  assert.ok(!out.includes("a.md:8"), "text outside a fence is not checked");
});

test("install-docs: more user paths and placeholders fail", () => {
  const bad = ["```sh", "ls /home/you/.context-mode-app", '"Users\\\\you\\\\x"', "node <...>/server.mjs", "npx context-mode", "```"].join("\n");
  const out = checkLines("c.md", bad).join("\n");
  for (const s of ["c.md:2 user path", "c.md:3 user path", "c.md:4 placeholder", "c.md:5 npx context-mode"]) assert.ok(out.includes(s), s);
});

test("install-docs: config blocks need an agent variable, not $HOME or ~", () => {
  const cfg = ["```json", '{"command":["node","~/.context-mode-app/server.mjs"]}', '{"args":["$HOME/.context-mode-app/server.mjs"]}',
    '{"command":["node","{env:HOME}/.context-mode-app/server.mjs"]}', '{"args":["${extensionPath}${/}.context-mode-app"]}', "```"].join("\n");
  const out = checkLines("d.md", cfg);
  assert.equal(out.length, 2, out.join("\n"));
  assert.ok(out[0].startsWith("d.md:2 ") && out[1].startsWith("d.md:3 "));
});

test("install-docs: allowed path forms pass", () => {
  const ok = ["```sh", "git clone x ~/.context-mode-app", 'node "$HOME/.context-mode-app/server.mjs"', 'git -C "$env:USERPROFILE\\.context-mode-app" pull',
    '"{env:HOME}/.context-mode-app/server.mjs"', 'a=p.join(h,".context-mode-app")', "```"].join("\n");
  assert.deepEqual(checkLines("b.md", ok), []);
});

test("install-docs: the real docs pass", () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith(".md"));
  assert.ok(files.length >= 11);
  assert.deepEqual(files.flatMap((f) => checkLines(f, readFileSync(path.join(DIR, f), "utf8"))), []);
});
