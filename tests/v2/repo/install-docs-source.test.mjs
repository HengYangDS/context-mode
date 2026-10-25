// New-user finding (2026-10-25): `npm pack` at the repo root gives a package with no bin, so `context-mode` is missing.
// The repo root is the dev package. The user package is the release tree from build/build.mjs. The docs must say so.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const read = (...p) => readFileSync(path.join(REPO, ...p), "utf8");

test("install-docs-source: the install README has a From source section with the build and the local install", () => {
  const text = read("docs", "install", "README.md");
  assert.match(text, /^## From source$/m);
  const section = text.split(/^## From source$/m)[1].split(/^## /m)[0];
  assert.ok(section.includes("node build/build.mjs --out release-out"), section);
  assert.ok(section.includes("npm i -g ./release-out"), section);
  assert.ok(section.includes("context-mode --version"), section);
  assert.match(section, /repo root[^\n]*no `?bin`?|no `?bin`?[^\n]*repo root/i, "must say the repo root has no bin");
});

test("install-docs-source: a missing command has a Troubleshooting step", () => {
  const text = read("docs", "install", "README.md");
  const t = text.split(/^## Troubleshooting$/m)[1].split(/^## /m)[0];
  assert.ok(t.includes("command not found"), t);
  assert.ok(t.includes("npm prefix -g"), t);
});

test("install-docs-source: package.json has a build:release script for the user package", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts["build:release"], "node build/build.mjs --out release-out");
});
