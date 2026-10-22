// GP1 — release tree cases for M6 (14a rows, DEVIATIONS D-M6-arch-1). Reads release-out/ that
// build/build.mjs wrote (gate gp-cases layer builds it first). covers: build/build.mjs, build/manifests.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = path.join(REPO_ROOT, "release-out");
const MANIFESTS = [".claude-plugin/plugin.json", "gemini-extension.json", "qwen-extension.json", "copilot/plugin.json"];
const PLUGIN_ROOT = "${CLAUDE_PLUGIN_ROOT}/";
// Files the bundles load next to themselves at run time (hook.mjs -> run.mjs/search.mjs wrappers,
// D5 fixture, in-process entries, command skills).
const SIDE_FILES = ["run.mjs", "search.mjs", "fixtures/hook-roundtrip.json", "pi/index.js", "opencode/plugin.js",
  "skills/ctx-stats/SKILL.md", "skills/ctx-doctor/SKILL.md", "skills/ctx-upgrade/SKILL.md"];

const readJson = (rel) => JSON.parse(readFileSync(path.join(OUT, rel), "utf8"));
const listed = () => readFileSync(path.join(OUT, "SHA256SUMS"), "utf8").split("\n").filter((l) => l !== "").map((l) => l.split("  ")[1]);
const hookFiles = () => readdirSync(path.join(OUT, "hooks")).map((f) => "hooks/" + f);
// Every "command" string anywhere in a hook file.
function commands(value, out = []) {
  if (Array.isArray(value)) value.forEach((v) => commands(v, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (k === "command" && typeof v === "string") out.push(v);
      else commands(v, out);
    }
  }
  return out;
}
const servers = () => MANIFESTS.flatMap((m) => Object.values(readJson(m).mcpServers));
const EXTENSION_ROOT = "${extensionPath}${/}"; // qwen-extension.json server path (D-FU-RM-QWEN-1)
const strip = (raw) => {
  const p = raw.split('"').join("");
  if (p.startsWith(EXTENSION_ROOT)) return p.slice(EXTENSION_ROOT.length);
  return p.startsWith(PLUGIN_ROOT) ? p.slice(PLUGIN_ROOT.length) : p;
};

test("[M6] GP1/npm-pack-includes-runtime-files: every file a manifest or bundle names at runtime is in SHA256SUMS (#889)", () => {
  assert.ok(existsSync(path.join(OUT, "SHA256SUMS")), "release-out/SHA256SUMS missing (run build/build.mjs first)");
  const sums = new Set(listed());
  const named = new Set(SIDE_FILES);
  for (const m of MANIFESTS) {
    named.add(m);
    const hooks = readJson(m).hooks;
    if (typeof hooks === "string") named.add(hooks.startsWith("./") ? hooks.slice(2) : hooks); // qwen names "hooks/qwen.json" (D-FU-RM-QWEN-1)
  }
  for (const s of servers()) named.add(strip(s.args[0]));
  for (const h of hookFiles()) {
    named.add(h);
    for (const c of commands(readJson(h))) named.add(strip(c.split(" ")[1]));
  }
  for (const f of named) assert.ok(sums.has(f), `${f} named at runtime but not in SHA256SUMS`);
});

test("[M6] GP1/plugin-json-unpinned-node: every manifest MCP command is the bare node (#1090)", () => {
  for (const s of servers()) assert.equal(s.command, "node");
});

test("[M6] GP1/stable-interpreter-path: every written hook command starts with the bare node, never a pinned path (#1183)", () => {
  for (const h of hookFiles()) {
    const cs = commands(readJson(h));
    assert.ok(cs.length > 0, h);
    for (const c of cs) {
      assert.equal(c.split(" ")[0], "node", `${h}: ${c}`);
      assert.ok(!c.includes(process.execPath), `${h}: pinned ${process.execPath}`);
    }
  }
});

// #511 (ported from tests/util/no-dynamic-require.test.ts, cleanup-plan W1-ops). v1 asserted the SOURCE
// pattern; v2 asserts the built artifact, because the bundles are ESM (build/build.mjs format "esm") and an
// esbuild `__require` shim throws `Dynamic require of "node:..." is not supported` at run time under Node ESM.
// A bare `require("node:...")` is allowed only inside a string literal (the detached-child CJS source), which
// is spawned as its own CJS process and never loaded as part of the bundle.
const BUNDLES = ["hook.mjs", "run.mjs", "search.mjs", "server.mjs", "pi/index.js", "opencode/plugin.js"];
const jsFiles = (dir) => readdirSync(path.join(OUT, dir)).filter((f) => /\.(m?js)$/.test(f)).map((f) => (dir === "" ? f : dir + "/" + f));

test("[M7] GP1/no-dynamic-require: no bundle holds an esbuild __require shim, and a bare require(\"node:...\") sits only inside a string literal (#511)", () => {
  assert.ok(existsSync(path.join(OUT, "SHA256SUMS")), "release-out missing (run build/build.mjs first)");
  const files = new Set([...BUNDLES, ...jsFiles("hooks"), ...jsFiles("pi"), ...jsFiles("opencode")]);
  for (const f of files) {
    const src = readFileSync(path.join(OUT, f), "utf8");
    assert.ok(!/\b__require\b/.test(src), `${f}: esbuild __require shim`);
    assert.ok(!src.includes("Dynamic require of"), `${f}: Dynamic require shim text`);
    for (const [i, line] of src.split("\n").entries()) {
      if (!/\brequire\(["']node:/.test(line)) continue;
      const t = line.trim();
      assert.ok(t.startsWith("'") || t.startsWith('"') || t.startsWith("`"), `${f}:${i + 1}: bare require("node:...") outside a string literal: ${t.slice(0, 100)}`);
    }
  }
});
