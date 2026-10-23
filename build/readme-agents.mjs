#!/usr/bin/env node
// build/readme-agents.mjs — D-README-1: renders the two README agent tables (install, upgrade) from the adapter
// table (src/adapters/table.ts) and the setup registry (src/setup/registry.ts).
// Agent name = the "# Install context-mode v2 on <name>" heading of docs/install/<id>.md.
// Support "full" = setup installs the agent's own package through the agent CLI (installMode marketplace,
// extension or in-process, and the registry row has a CLI plan); every other row is "MCP only".
// Usage: node build/readme-agents.mjs [--write]. Without --write it prints the tables; --write puts them into
// README.md between the markers. build/check-readme.mjs calls checkAgentTables() and fails on any problem.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ADAPTERS } from "../src/adapters/table.ts";
import { buildRegistry } from "../src/setup/registry.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const README = path.join(REPO_ROOT, "README.md");
const TITLE_PREFIX = "# Install context-mode v2 on ";
const PACKAGE_MODES = new Set(["marketplace", "extension", "in-process"]);
const SECTIONS = { install: { heading: "## Install", anchor: "install" }, upgrade: { heading: "## Upgrade from v1", anchor: "upgrade-from-v1" } };

export const MARKERS = Object.freeze(Object.fromEntries(Object.keys(SECTIONS).map((k) => [k, Object.freeze([
  `<!-- agents:${k}:start (node build/readme-agents.mjs --write) -->`,
  `<!-- agents:${k}:end -->`,
])])));

function pageOf(id) {
  const rel = `docs/install/${id}.md`;
  const lines = readFileSync(path.join(REPO_ROOT, rel), "utf8").split("\n");
  const title = lines[0] ?? "";
  if (!title.startsWith(TITLE_PREFIX)) throw new Error(`${rel}: first line must start with "${TITLE_PREFIX}"`);
  for (const { heading } of Object.values(SECTIONS)) {
    if (!lines.includes(heading)) throw new Error(`${rel}: no "${heading}" heading`);
  }
  return { rel, name: title.slice(TITLE_PREFIX.length).trim() };
}

/** One row per adapter, sorted by agent name. */
export function agentRows() {
  // Paths are not used here; the registry only needs a context to build its rows.
  const registry = buildRegistry({ home: path.join(REPO_ROOT, ".readme-home"), pkgDir: REPO_ROOT, env: {} });
  const byId = new Map(registry.map((r) => [r.id, r]));
  return ADAPTERS.map((a) => {
    const reg = byId.get(a.id);
    if (!reg) throw new Error(`setup registry has no row for ${a.id}`);
    const { rel, name } = pageOf(a.id);
    const support = PACKAGE_MODES.has(a.installMode) && reg.cli ? "full" : "MCP only";
    return { id: a.id, name, support, page: rel };
  }).sort((x, y) => x.name.localeCompare(y.name));
}

/** The two tables as markdown, without the markers. */
export function renderAgentTables() {
  const rows = agentRows();
  const out = {};
  for (const [key, { anchor }] of Object.entries(SECTIONS)) {
    out[key] = ["| Agent | Support | Guide |", "|---|---|---|",
      ...rows.map((r) => `| ${r.name} | ${r.support} | [${r.page}](${r.page}#${anchor}) |`)].join("\n");
  }
  return out;
}

function block(key, table) {
  const [start, end] = MARKERS[key];
  return `${start}\n${table}\n${end}`;
}

/** Problems with the README copy of the tables; [] when both match the rendered tables. */
export function checkAgentTables(text) {
  const tables = renderAgentTables();
  const problems = [];
  for (const key of Object.keys(SECTIONS)) {
    const [start, end] = MARKERS[key];
    const starts = text.split(start).length - 1;
    const ends = text.split(end).length - 1;
    if (starts !== 1 || ends !== 1) {
      problems.push(`${key}: README needs each marker once (start ${starts}, end ${ends}); run node build/readme-agents.mjs --write`);
      continue;
    }
    if (!text.includes(block(key, tables[key]))) {
      problems.push(`${key}: README table differs from build/readme-agents.mjs; run node build/readme-agents.mjs --write`);
    }
  }
  return problems;
}

/** README text with both blocks replaced by the rendered tables. Throws when a marker is missing. */
export function writeAgentTables(text) {
  const tables = renderAgentTables();
  let out = text;
  for (const key of Object.keys(SECTIONS)) {
    const [start, end] = MARKERS[key];
    const i = out.indexOf(start);
    const j = out.indexOf(end, i);
    if (i < 0 || j < 0) throw new Error(`README.md has no ${key} markers`);
    out = out.slice(0, i) + block(key, tables[key]) + out.slice(j + end.length);
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--write")) {
    const text = readFileSync(README, "utf8");
    const next = writeAgentTables(text);
    if (next !== text) writeFileSync(README, next);
    console.log(next === text ? "readme-agents: README.md already up to date" : "readme-agents: README.md updated");
  } else {
    const t = renderAgentTables();
    console.log(`${t.install}\n\n${t.upgrade}`);
  }
}
