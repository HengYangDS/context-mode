#!/usr/bin/env node
// build/check-install-docs.mjs — docs/install/*.md: a fenced code block must hold no <placeholder> and no `npx context-mode`/`npx -y context-mode` (v2 has no npm; ADR-0011/0013).
// Usage: node build/check-install-docs.mjs. Prints "PASS|FAIL install-docs <n> files"; exit 1 on FAIL.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), "docs", "install");
const files = readdirSync(DIR).filter((f) => f.endsWith(".md")).sort();
const bad = [];
for (const f of files) {
  let fence = null;
  readFileSync(path.join(DIR, f), "utf8").split("\n").forEach((line, i) => {
    const m = /^\s*(`{3,})/.exec(line);
    if (m) { fence = fence === null ? m[1] : (line.trim().startsWith(fence) ? null : fence); return; }
    if (fence === null) return;
    if (/<[A-Za-z.][^<>\n]*>/.test(line) || /\.\.\.>/.test(line)) bad.push(`${f}:${i + 1} placeholder: ${line.trim()}`);
    if (/npx\s+(-y\s+)?context-mode/.test(line)) bad.push(`${f}:${i + 1} npx context-mode: ${line.trim()}`);
  });
}
for (const b of bad) console.log("  " + b);
console.log(`${bad.length ? "FAIL" : "PASS"} install-docs ${files.length} files`);
process.exit(bad.length ? 1 : 0);
