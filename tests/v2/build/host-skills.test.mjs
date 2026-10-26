// D-HQ-SKILLS-2: for every host, the skill text that host ends up with names that host's real tool name and no
// other host's. Package hosts read the built dir of their skill channel; home-dir hosts get what setup writes
// (renderSkill of the built package's skill source with the host prefixes, as planSkills does).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ADAPTERS } from "../../../src/adapters/table.ts";
import { TOOL_ORDER } from "../../../src/core/contracts/constants.ts";
import { buildRegistry, renderSkill } from "../../../src/setup/registry.ts";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SKILLS = ["ctx-doctor", "ctx-stats", "ctx-upgrade"];
const SOURCE = Object.fromEntries(SKILLS.map((s) => [s, readFileSync(path.join(REPO, "skills", s, "SKILL.md"), "utf8")]));

function built(t) {
  const out = mkdtempSync(path.join(tmpdir(), "cm-v2-host-skills-"));
  t.after(() => rmSync(out, { recursive: true, force: true }));
  const r = spawnSync(process.execPath, [path.join(REPO, "build", "build.mjs"), "--out", out], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return out;
}

// The tool names the source skill text uses, and the names a host may have in its text.
const toolsIn = (text) => TOOL_ORDER.filter((tool) => text.includes(tool));

function shipped(out, id) {
  const reg = buildRegistry({ home: path.join(out, "no-home"), pkgDir: out, env: {} }).find((r) => r.id === id);
  const s = reg.skillInstall;
  if (s.kind === "package") {
    return { prefixes: [ADAPTERS.find((a) => a.id === id).toolNamePrefix],
      texts: Object.fromEntries(SKILLS.map((n) => [n, readFileSync(path.join(out, s.via, n, "SKILL.md"), "utf8")])) };
  }
  return { prefixes: s.prefixes, texts: Object.fromEntries(s.files.map((f) => [f.name, renderSkill(readFileSync(f.src, "utf8"), s.prefixes)])) };
}

test("[D-HQ-SKILLS-2] every host's shipped skill text names exactly its own real tool names", (t) => {
  const out = built(t);
  for (const row of ADAPTERS) {
    const { prefixes, texts } = shipped(out, row.id);
    assert.deepEqual(Object.keys(texts).sort(), SKILLS, row.id);
    for (const name of SKILLS) {
      let rest = texts[name];
      for (const tool of toolsIn(SOURCE[name])) {
        for (const p of prefixes) {
          assert.ok(rest.includes(p + tool), `${row.id} ${name} names ${p + tool}`);
          rest = rest.split(p + tool).join("");
        }
      }
      assert.equal(rest.includes("ctx_"), false, `${row.id} ${name} names a tool that is not this host's: ${rest}`);
    }
  }
});

test("[D-HQ-SKILLS-2] claude-code ships its own skills dir and the plugin reads only that dir", (t) => {
  const out = built(t);
  const claude = ADAPTERS.find((a) => a.id === "claude-code");
  assert.equal(claude.skillChannel.path, "claude-code/skills");
  const plugin = JSON.parse(readFileSync(path.join(out, ".claude-plugin", "plugin.json"), "utf8"));
  assert.equal(plugin.skills, "./claude-code/skills");
  // Claude Code adds a plugin.json skills dir to the default skills/ (which holds Gemini's text), so the marketplace entry
  // lists the dir too; for a source "./" entry that stops the default scan (plugins reference, checked on claude 2.1.274).
  const entry = JSON.parse(readFileSync(path.join(out, ".claude-plugin", "marketplace.json"), "utf8")).plugins[0];
  assert.equal(entry.skills, "./claude-code/skills");
});
