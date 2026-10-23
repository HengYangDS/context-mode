// build/check-secrets.mjs: no gateway tenant id (t_ + 8 hex) in a tracked text file (D-FU-OI-TENANT-1).
// Each case runs the real script in a throwaway git repo. The ids below are built from parts, so this file holds none.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SCRIPT = path.join(REPO, "build", "check-secrets.mjs");
const ID = "t" + "_" + "0123abcd";

function run(files, untracked = []) {
  const dir = mkdtempSync(path.join(tmpdir(), "check-secrets-"));
  for (const [p, body] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, p)), { recursive: true });
    writeFileSync(path.join(dir, p), body);
  }
  execFileSync("git", ["init", "-q"], { cwd: dir });
  const add = Object.keys(files).filter((p) => !untracked.includes(p));
  if (add.length) execFileSync("git", ["add", "-f", "--", ...add], { cwd: dir });
  const r = spawnSync(process.execPath, [SCRIPT], { cwd: dir, encoding: "utf8" });
  rmSync(dir, { recursive: true, force: true });
  return { status: r.status, lines: r.stdout.split("\n").filter((l) => l !== "") };
}

test("clean tree: prints 'check-secrets: clean', exit 0", () => {
  const r = run({ "a.md": "nothing here\n", "b.mjs": "const x = 1;\n" });
  assert.equal(r.status, 0);
  assert.deepEqual(r.lines, ["check-secrets: clean"]);
});

test("a tenant id in a tracked file fails with path and line, never the id", () => {
  const r = run({ "docs/x.md": `ok\nowner is ${ID} here\n`, ".github/workflows/w.yml": `rule: "${ID}"\n` });
  assert.equal(r.status, 1);
  assert.deepEqual(r.lines.sort(), [
    "check-secrets: tenant id pattern in .github/workflows/w.yml:1",
    "check-secrets: tenant id pattern in docs/x.md:2",
  ]);
  assert.ok(!r.lines.join("\n").includes(ID));
});

test("longer words and other prefixes are not tenant ids", () => {
  const r = run({ "a.txt": ["get_0123abcd", "t_0123abcdef", "t_0123abc", "t_0123abcg", "split_0123abcd"].join("\n") + "\n" });
  assert.equal(r.status, 0);
});

test("untracked files and binary files are skipped", () => {
  const r = run({ "n.md": `${ID}\n`, "bin.dat": `\0${ID}\n` }, ["n.md"]);
  assert.equal(r.status, 0);
});
