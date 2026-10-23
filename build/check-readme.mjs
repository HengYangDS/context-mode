#!/usr/bin/env node
// build/check-readme.mjs — ADR-0015 CI cap: README.md must have at most README_MAX_LINES lines.
// D-README-1: also fails when the README agent tables differ from build/readme-agents.mjs (adapter table + setup registry).
// Usage: node build/check-readme.mjs. Prints "PASS|FAIL readme-lines <n>/<max>" and "PASS|FAIL readme-agents"; exit 1 on FAIL.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { README_MAX_LINES } from "../src/core/contracts/constants.ts";
import { checkAgentTables } from "./readme-agents.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const text = readFileSync(path.join(REPO_ROOT, "README.md"), "utf8");
const lines = text.endsWith("\n") ? text.split("\n").length - 1 : text.split("\n").length;
const ok = lines <= README_MAX_LINES;
console.log(`${ok ? "PASS" : "FAIL"} readme-lines ${lines}/${README_MAX_LINES}`);
const agents = checkAgentTables(text);
for (const b of agents) console.log("  " + b);
console.log(`${agents.length ? "FAIL" : "PASS"} readme-agents`);
process.exit(ok && !agents.length ? 0 : 1);
