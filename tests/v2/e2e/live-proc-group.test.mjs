// D-CR3-WATCHDOG-1: e2e/live/lib/proc-group.mjs. A run that spawns `claude -p` in its own process group can
// kill the whole group on timeout, so a model-run grandchild (`find /`) never outlives the session.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnGroup, killGroup } from "../../../e2e/live/lib/proc-group.mjs";

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

test("killGroup reaches the grandchild; the close event fires", { skip: process.platform === "win32" ? "POSIX process groups" : false }, async () => {
  const child = spawnGroup("/bin/sh", ["-c", "sleep 300 & echo $!; wait"], { stdio: ["ignore", "pipe", "ignore"] });
  const grand = await new Promise((res) => { let b = ""; child.stdout.setEncoding("utf8"); child.stdout.on("data", (d) => { b += d; const i = b.indexOf("\n"); if (i > 0) res(Number(b.slice(0, i))); }); });
  assert.ok(grand > 0 && alive(grand), "the grandchild runs");
  const closed = new Promise((res) => child.on("close", res));
  assert.equal(killGroup(child), true);
  await closed;
  for (let i = 0; i < 50 && alive(grand); i++) await new Promise((r) => setTimeout(r, 20));
  assert.equal(alive(grand), false, "the grandchild is gone");
  assert.equal(killGroup(child), false, "a second kill finds no group");
});
