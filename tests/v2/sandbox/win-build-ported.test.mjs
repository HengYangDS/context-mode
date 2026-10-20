// W1-core PORT of tests/executor/win-sandbox-782-788.test.ts #782 (rewriteWindowsBuildTools), same cases.
import { test } from "node:test";
import assert from "node:assert/strict";
import { rewriteWindowsBuildTools as rw } from "../../../src/core/sandbox/win-build.ts";

test("[W1-core] #782: bare mvn becomes mvn.cmd on win32", () => {
  assert.equal(rw("mvn clean install", "win32"), "mvn.cmd clean install");
});
test("[W1-core] #782: mvn after && ; newline is rewritten", () => {
  assert.equal(rw("cd app && mvn -version", "win32"), "cd app && mvn.cmd -version");
  assert.equal(rw("mvn test; echo done", "win32"), "mvn.cmd test; echo done");
  assert.equal(rw("echo a\nmvn package", "win32"), "echo a\nmvn.cmd package");
});
test("[W1-core] #782: other platforms are untouched", () => {
  assert.equal(rw("mvn clean install", "linux"), "mvn clean install");
  assert.equal(rw("mvn clean install", "darwin"), "mvn clean install");
});
test("[W1-core] #782: mvn.cmd, mvnw, mvnd, mymvn are not rewritten", () => {
  assert.equal(rw("mvn.cmd clean install", "win32"), "mvn.cmd clean install");
  assert.equal(rw("./mvnw clean", "win32"), "./mvnw clean");
  assert.equal(rw("mymvn run", "win32"), "mymvn run");
  assert.equal(rw("mvnd build", "win32"), "mvnd build");
});
