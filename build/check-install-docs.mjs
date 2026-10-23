#!/usr/bin/env node
// build/check-install-docs.mjs — every command and config line in a fenced block of docs/install/*.md must run as copied (owner rule 2026-10-21).
// A fenced line fails on: a user path (/Users/you, /home/you, C:\Users\you, Users\\you), a <placeholder>,
// `npx context-mode` (v2 has no npm; ADR-0011/0013), or a path to .context-mode-app that does not start with
// $HOME, ~, %USERPROFILE%, $env:USERPROFILE or an agent variable ({env:HOME}, ${extensionPath}, ${CLAUDE_PLUGIN_ROOT}).
// A quoted bare ".context-mode-app" segment is allowed: the node one-liners join it to os.homedir().
// In a config fence (json, jsonc, toml, yaml) no shell runs, so $HOME, ~ and %USERPROFILE% do not expand there:
// only an agent variable ({env:HOME}, ${extensionPath}, ${CLAUDE_PLUGIN_ROOT}) passes.
// Shell fences also fail on forms that do not expand as copied: a quoted "~/..." in sh (the shell keeps the ~),
// $env:USERPROFILE in sh, and ~ or %USERPROFILE% in powershell (Windows PowerShell 5.1 passes them to git/node as is).
// A fenced `npm i -g context-mode` without a version tag fails (@next = v2 preview, @1 = v1): latest is v1 until the owner moves it (ADR-0019 D2). The default run also checks README.md.
// Any fenced line with "change this", "your path" or "edit this" fails: the reader must not edit a block.
// D-INST-4 (npm route): a fenced `context-mode setup|doctor|upgrade` line may use only flags that command has (checkLines);
// checkPages: README.md names Node 24.15.0, the two-command install and the uninstall command; each agent page names `context-mode setup` and has a "## Upgrade from v1" heading.
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
const AGENT_VAR_BEFORE = /(\{env:HOME\}|\{env:USERPROFILE\}|\$\{extensionPath\}|\$\{CLAUDE_PLUGIN_ROOT\})(\\|\/|\$\{\/\})$/;
const CONFIG_LANG = /^(json|jsonc|json5|toml|ya?ml)$/i;
const SH_LANG = /^(sh|bash|zsh|shell|console)$/i;
const PS_LANG = /^(powershell|pwsh|ps1)$/i;
const EDIT_HINT = /change this|edit this|your (own )?path|replace (this|with your)/i;

const CLI_FLAGS = new Set(["--list", "--dry-run", "--remove", "--repair", "--agents", "--yes", "-y", "--no-input", "--json", "-q", "--quiet",
  "--verbose", "--debug", "--no-color", "-h", "--help", "--tag"]); // setup, doctor and upgrade --help
const CLI_CMD = /(?:^|[&|;]\s*|^\s*)context-mode\s+(setup|doctor|upgrade)\b([^&|;\n]*)/g;

export function checkPages(pages) {
  const bad = [];
  for (const [name, text] of Object.entries(pages)) {
    if (name === "README.md") {
      if (!text.includes("24.15.0")) bad.push("README.md needs Node 24.15.0");
      if (!text.includes("npm i -g context-mode@next && context-mode setup")) bad.push("README.md needs the two-command install");
      if (!text.includes("context-mode setup --remove && npm rm -g context-mode")) bad.push("README.md needs the uninstall command");
    } else {
      if (!text.includes("context-mode setup")) bad.push(`${name} needs context-mode setup`);
      if (!text.split("\n").includes("## Upgrade from v1")) bad.push(`${name} needs a ## Upgrade from v1 heading`);
    }
  }
  return bad;
}

export function checkLines(name, text) {
  const bad = [];
  let fence = null;
  let config = false;
  let lang = "";
  text.split("\n").forEach((line, i) => {
    const m = /^\s*(`{3,})\s*([\w+-]*)/.exec(line);
    if (m) {
      if (fence === null) { fence = m[1]; lang = m[2]; config = CONFIG_LANG.test(m[2]); }
      else if (line.trim().startsWith(fence)) { fence = null; config = false; lang = ""; }
      return;
    }
    if (fence === null) return;
    const at = `${name}:${i + 1}`;
    if (/<[A-Za-z.][^<>\n]*>/.test(line) || /\.\.\.>/.test(line)) bad.push(`${at} placeholder: ${line.trim()}`);
    if (/npx\s+(-y\s+)?context-mode/.test(line)) bad.push(`${at} npx context-mode: ${line.trim()}`);
    // v2 preview is on dist-tag next; a bare install gets v1 until the owner moves latest (ADR-0019 D2).
    if (/\bnpm\s+(i|install|add)\b[^\n&;|]*\bcontext-mode(?![\w./@-])/.test(line)) bad.push(`${at} npm install of context-mode needs a version tag (@next for v2, @1 for v1): ${line.trim()}`);
    for (const c of line.matchAll(CLI_CMD)) {
      for (const f of c[2].match(/(?:^|\s)(--?[A-Za-z][\w-]*)/g) ?? []) if (!CLI_FLAGS.has(f.trim())) bad.push(`${at} unknown flag ${f.trim()} for context-mode ${c[1]}: ${line.trim()}`);
    }
    if (USER_PATH.test(line)) bad.push(`${at} user path: ${line.trim()}`);
    if (EDIT_HINT.test(line)) bad.push(`${at} edit step: ${line.trim()}`);
    if (SH_LANG.test(lang)) {
      if (/["']~[\/\\]/.test(line)) bad.push(`${at} quoted ~ does not expand in sh, use "$HOME/...": ${line.trim()}`);
      if (/\$env:USERPROFILE|%USERPROFILE%/.test(line)) bad.push(`${at} Windows variable in an sh block: ${line.trim()}`);
    }
    if (PS_LANG.test(lang)) {
      if (/(^|[\s"'=(])~[\/\\]/.test(line)) bad.push(`${at} ~ does not expand for git/node in PowerShell 5.1, use $env:USERPROFILE: ${line.trim()}`);
      if (/%USERPROFILE%/.test(line)) bad.push(`${at} %USERPROFILE% does not expand in PowerShell, use $env:USERPROFILE: ${line.trim()}`);
    }
    for (const a of line.matchAll(APP)) {
      const before = line.slice(0, a.index);
      const quotedBare = OK_BEFORE[1].test(before) && /^\.context-mode-app["'`]/.test(line.slice(a.index));
      if (config) {
        if (!AGENT_VAR_BEFORE.test(before)) bad.push(`${at} .context-mode-app path in a config block needs an agent variable ({env:HOME}, \${extensionPath}): ${line.trim()}`);
        continue;
      }
      if (!OK_BEFORE[0].test(before) && !quotedBare) bad.push(`${at} .context-mode-app path without $HOME/~/%USERPROFILE%/agent variable: ${line.trim()}`);
    }
  });
  return bad;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = readdirSync(DIR).filter((f) => f.endsWith(".md")).sort();
  const bad = files.flatMap((f) => checkLines(f, readFileSync(path.join(DIR, f), "utf8")));
  if (!process.argv[2]) { // default run also checks the root README fences (v2 preview install, ADR-0019)
    const readme = path.join(DIR, "..", "..", "README.md");
    bad.push(...checkLines("README.md", readFileSync(readme, "utf8")));
    files.push("README.md");
  }
  for (const b of bad) console.log("  " + b);
  console.log(`${bad.length ? "FAIL" : "PASS"} install-docs ${files.length} files`);
  process.exit(bad.length ? 1 : 0);
}
