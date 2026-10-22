// GP11 — release build audit (14a GP11/npm-audit-zero-high-critical, DEVIATIONS D-M6-arch-1): the release
// tree ships zero runtime dependencies, so npm audit --omit=dev has nothing to find. covers: build/build.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".."), "release-out");

function names(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    out.push(e.name);
    if (e.isDirectory()) names(path.join(dir, e.name), out);
  }
  return out;
}

// D-FU-RM-PI-1 (ADR-0002 GS7 amended): one root package.json is allowed, the Pi-only shape (name, version, private,
// type, pi). It must carry no dependency key and no scripts; no package.json below the root.
const ALLOWED_ROOT_KEYS = ["name", "pi", "private", "type", "version"];

test("[M6] GP11/npm-audit-zero-high-critical: release-out has no runtime dependencies, no node_modules, no nested package.json (#1225)", () => {
  assert.ok(existsSync(OUT), "release-out missing (run build/build.mjs first)");
  const all = names(OUT);
  assert.equal(all.filter((n) => n === "package.json").length, existsSync(path.join(OUT, "package.json")) ? 1 : 0, "package.json below the release-out root");
  assert.ok(!all.includes("node_modules"), "node_modules in release-out");
  assert.ok(!all.includes("package-lock.json"), "package-lock.json in release-out");
  const rootPkg = path.join(OUT, "package.json");
  if (existsSync(rootPkg)) {
    const pkg = JSON.parse(readFileSync(rootPkg, "utf8"));
    assert.deepEqual(Object.keys(pkg).sort(), ALLOWED_ROOT_KEYS, "release-out/package.json keys");
    for (const k of ["dependencies", "optionalDependencies", "peerDependencies", "bundleDependencies", "bundledDependencies", "scripts"]) {
      assert.ok(!(k in pkg), `release-out/package.json has ${k}`);
    }
    assert.equal(pkg.private, true, "release-out/package.json private must be true");
  }
});
