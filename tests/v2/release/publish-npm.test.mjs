// release.yml publish-npm job (ADR-0019 D1/D2) and check-npm-tarball.mjs. Text checks: no YAML parser is a dependency.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const yml = readFileSync(path.join(REPO, ".github", "workflows", "release.yml"), "utf8");
const job = yml.slice(yml.indexOf("\n  publish-npm:"), yml.indexOf("\n  rollback:"));

test("release.yml: publish-npm job has the ADR-0019 shape", () => {
  assert.ok(job.length > 50, "job exists, placed before rollback");
  for (const s of ["environment: npm-publish", "id-token: write", "contents: read", 'node-version: "24.15.0"', "11.5.1",
    "check-npm-tarball.mjs", "npm publish --provenance --access public --tag next"]) assert.ok(job.includes(s), s);
  assert.ok(!/NODE_AUTH_TOKEN|NPM_TOKEN/.test(yml), "no token: trusted publishing only");
  assert.ok(!/--tag latest/.test(yml), "CI never moves latest");
  assert.ok(/needs:\s*\[[^\]]*publish-promote/.test(job), "runs after the release job");
  assert.ok(/startsWith\(github\.ref, 'refs\/tags\/v2\.'\)/.test(job) && /inputs\.publish/.test(job), "only a v2.* tag or publish=true");
});

test("release.yml: publish input exists and is a boolean defaulting to false", () => {
  assert.match(yml, /publish:\n\s+description:[^\n]*\n\s+required: false\n\s+type: boolean\n\s+default: false/);
  assert.match(yml, /tags:\s*\n\s*- "v2\.\*"/);
});

test("release.yml: no ${{ }} inside a run text of publish-npm", () => {
  const runs = job.split("\n").filter((l) => /^\s+run:/.test(l));
  for (const r of runs) assert.ok(!r.includes("${{"), r);
});

function sha(b) { return createHash("sha256").update(b).digest("hex"); }
function tree(files) {
  const d = mkdtempSync(path.join(tmpdir(), "cm-v2-tarball-"));
  const sums = [];
  for (const [n, c] of Object.entries(files)) { mkdirSync(path.dirname(path.join(d, n)), { recursive: true }); writeFileSync(path.join(d, n), c); sums.push(`${sha(c)}  ${n}`); }
  writeFileSync(path.join(d, "SHA256SUMS"), sums.join("\n") + "\n");
  return d;
}
const PKG = JSON.stringify({ name: "context-mode", version: "2.0.0", type: "module", bin: { "context-mode": "cli.mjs" } }, null, 2) + "\n";
const run = (d) => spawnSync(process.execPath, [path.join(REPO, "scripts", "release", "check-npm-tarball.mjs"), d], { encoding: "utf8", env: { ...process.env, npm_config_cache: path.join(d, "..", "cm-npm-cache") } });

test("check-npm-tarball: passes when the tarball equals SHA256SUMS", (t) => {
  const d = tree({ "package.json": PKG, "cli.mjs": "#!/usr/bin/env node\n", "server.mjs": "x\n" });
  t.after(() => rmSync(d, { recursive: true, force: true }));
  const r = run(d);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test("check-npm-tarball: fails when a file differs from SHA256SUMS", (t) => {
  const d = tree({ "package.json": PKG, "cli.mjs": "#!/usr/bin/env node\n", "server.mjs": "x\n" });
  t.after(() => rmSync(d, { recursive: true, force: true }));
  writeFileSync(path.join(d, "server.mjs"), "changed\n");
  const r = run(d);
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout + r.stderr, /server\.mjs/);
});
