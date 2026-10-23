// README agent tables come from the adapter table (src/adapters/table.ts) and the setup registry
// (src/setup/registry.ts). build/readme-agents.mjs renders them; build/check-readme.mjs fails when the README
// copy differs (D-README-1).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { agentRows, renderAgentTables, checkAgentTables, MARKERS } from "../../../build/readme-agents.mjs";
import { ADAPTERS } from "../../../src/adapters/table.ts";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const README = readFileSync(path.join(REPO, "README.md"), "utf8");

test("readme-agents: one row per adapter, sorted by name", () => {
  const rows = agentRows();
  assert.deepEqual(rows.map((r) => r.id).sort(), ADAPTERS.map((a) => a.id).sort());
  const names = rows.map((r) => r.name);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
});

test("readme-agents: full = setup installs the agent's package (marketplace, extension, in-process via the agent CLI)", () => {
  const full = agentRows().filter((r) => r.support === "full").map((r) => r.id).sort();
  assert.deepEqual(full, ["claude-code", "gemini", "pi", "qwen"]);
  for (const r of agentRows()) assert.ok(["full", "MCP only"].includes(r.support), r.id);
});

test("readme-agents: the README holds the rendered tables between the markers", () => {
  assert.deepEqual(checkAgentTables(README), []);
  for (const [start, end] of Object.values(MARKERS)) {
    assert.equal(README.split(start).length - 1, 1, `README has ${start} once`);
    assert.equal(README.split(end).length - 1, 1, `README has ${end} once`);
  }
});

test("readme-agents: a hand edit or a missing block fails the check", () => {
  const tables = renderAgentTables();
  const edited = README.replace("| Codex | MCP only |", "| Codex | full |");
  assert.notEqual(edited, README, "fixture edit did not apply");
  assert.ok(checkAgentTables(edited).some((p) => p.includes("install")), checkAgentTables(edited).join("\n"));
  const missing = README.split(MARKERS.upgrade[0]).join("");
  assert.ok(checkAgentTables(missing).some((p) => p.includes("upgrade")), checkAgentTables(missing).join("\n"));
  assert.ok(tables.install.includes("(docs/install/codex.md#install)") && tables.upgrade.includes("(docs/install/codex.md#upgrade-from-v1)"));
});
