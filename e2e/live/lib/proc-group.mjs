// D-CR3-WATCHDOG-1: process-group spawn and kill for live runners. `child.kill()` signals only the direct
// child; a model-run grandchild (`find /`) keeps the stdout pipe open, so "close" never fires and the run
// hangs. spawnGroup starts the child as a process-group leader (detached: true on POSIX); killGroup sends
// SIGKILL to the whole group (negative pid). New runs only: the frozen runners (e2e/live/compact-hard/run.mjs,
// bench/m2/eval.mjs) import no shared harness and stay unchanged; see docs/v2/spikes/compact/RESULT.md.
import { spawn } from "node:child_process";

/** spawn() with the child as the leader of its own process group (POSIX). */
export function spawnGroup(cmd, args, opts = {}) {
  return spawn(cmd, args, { ...opts, detached: process.platform !== "win32" });
}

/** SIGKILL the child's whole process group. Returns false when no such group is left. */
export function killGroup(child, signal = "SIGKILL") {
  if (child.pid === undefined) return false;
  try {
    if (process.platform === "win32") return child.kill(signal);
    process.kill(-child.pid, signal);
    return true;
  } catch {
    return false;
  }
}

/** Arm a watchdog: after `ms` kill the group and call onFire(). Returns a disarm function. */
export function watchdog(child, ms, onFire = () => {}) {
  const t = setTimeout(() => { killGroup(child); onFire(); }, ms);
  child.once("close", () => clearTimeout(t));
  return () => clearTimeout(t);
}
