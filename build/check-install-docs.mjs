#!/usr/bin/env node
// build/check-install-docs.mjs — every command and config line in a fenced block of docs/install/*.md must run as copied (owner rule 2026-10-21).
// A fenced line fails on: a user path (/Users/you, /home/you, C:\Users\you, Users\\you), a <placeholder>,
// `npx context-mode` (v2 has no npm; ADR-0011/0013), or a path to .context-mode-app that does not start with
// $HOME, ~, %USERPROFILE%, $env:USERPROFILE or an agent variable ({env:HOME}, ${extensionPath}, ${CLAUDE_PLUGIN_ROOT}).
// A quoted bare ".context-mode-app" segment is allowed: the node one-liners join it to os.homedir().
// Usage: node build/check-install-docs.mjs [dir]   (default: docs/install). Prints "PASS|FAIL install-docs <n> files"; exit 1 on FAIL.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = process.argv[2] ? path.resolve(process.argv[2]) : path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), "docs", "install");
const USER_PATH = /\/Users\/you\b|\/home\/you\b|C:\\+Users\\+you\b|Users\\\\you\b/i;
const APP = /\.context-mode-app/g;
// Allowed text right before ".context-mode-app".
const OK_BEFORE = [
  /(\$HOME|\$\{HOME\}|~|%USERPROFILE%|\$env:USERPROFILE|\{env:HOME\}|\{env:USERPROFILE\}|\$\{extensionPath\}|\$\{CLAUDE_PLUGIN_ROOT\})(\\|\/|\$\{\/\})$/,
  /["'`]$/, // quoted bare segment: p.join(os.homedir(), ".context-mode-app")
];

export function checkLines(name, text) {
  const bad = [];
  let fence = null;
  text.split("\n").forEach((line, i) => {
    const m = /^\s*(`{3,})/.exec(line);
    if (m) { fence = fence === null ? m[1] : (line.trim().startsWith(fence) ? null : fence); return; }
    if (fence === null) return;
    const at = `${name}:${i + 1}`;
    if (/<[A-Za-z.][^<>\n]*>/.test(line) || /\.\.\.>/.test(line)) bad.push(`${at} placeholder: ${line.trim()}`);
    if (/npx\s+(-y\s+)?context-mode/.test(line)) bad.push(`${at} npx context-mode: ${line.trim()}`);
    if (USER_PATH.test(line)) bad.push(`${at} user path: ${line.trim()}`);
    for (const a of line.matchAll(APP)) {
      const before = line.slice(0, a.index);
      const quotedBare = OK_BEFORE[1].test(before) && /^\.context-mode-app["'`]/.test(line.slice(a.index));
      if (!OK_BEFORE[0].test(before) && !quotedBare) bad.push(`${at} .context-mode-app path without $HOME/~/%USERPROFILE%/agent variable: ${line.trim()}`);
    }
  });
  return bad;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = readdirSync(DIR).filter((f) => f.endsWith(".md")).sort();
  const bad = files.flatMap((f) => checkLines(f, readFileSync(path.join(DIR, f), "utf8")));
  for (const b of bad) console.log("  " + b);
  console.log(`${bad.length ? "FAIL" : "PASS"} install-docs ${files.length} files`);
  process.exit(bad.length ? 1 : 0);
}
