// src/setup/engine.ts
// ADR-0019 section 3 steps: preflight, detect, plan, apply, verify, rollback per agent, summary. No UI here.
// Owner decisions D3 (hook overhead budget) and D4 (v1 forms replaced by the absolute form).
import { spawn, spawnSync } from "node:child_process";
import { accessSync, constants as fsc, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

import { AGENT_HOME_DIR, TOOL_ORDER, UPGRADE_REPORT_ONLY_REASONS } from "../core/contracts/constants.ts";
import { CtxError } from "../core/contracts/errors.ts";
import type { AgentId, V1Finding } from "../core/contracts/types.ts";
import { detectV1 } from "../core/ops/detect-v1.ts";
import { editHostConfigText } from "../core/ops/host-config.ts";
import { BACKUP_DIR, LOCK_FILE, STATE_DIR, assertWritable, buildRegistry, hookCommandString } from "./registry.ts";
import type { CheckRow, HookFile, SetupContext } from "./registry.ts";

export const OVERHEAD_P95_MS = 15; // D3: hook wall minus bare node wall, p95, same host and run
/** CI-only knob: shared runners add jitter the D3 budget was not measured on. Unset means the 15 ms budget. */
function overheadBudgetMs(env: SetupContext["env"]): number {
  const n = Number(env.CM_HOOK_OVERHEAD_BUDGET_MS);
  return Number.isFinite(n) && n >= OVERHEAD_P95_MS ? n : OVERHEAD_P95_MS;
}
const HOOK_SAMPLES = 9;
const HOOK_ROUNDS = 5; // noise only adds time: a real overhead over budget fails every round
const P95 = 0.95;
const VERIFY_TIMEOUT_MS = 10_000;
const MANIFEST = "manifest.json";
const MANIFEST_DONE = "manifest.removed.json";
const FILES = "files";
const V1_HOOK_MARK = "context-mode hook";

export type AgentStatus = "PASS" | "FAIL" | "SKIPPED";
export interface Change { file?: string; path?: string; before?: unknown; after?: unknown; command?: string[]; }
export interface Check { name: string; ok: boolean; detail?: string; overheadP95Ms?: number; wallP95Ms?: number; bareP95Ms?: number; }
export interface AgentResult {
  id: AgentId; status: AgentStatus; reason?: string; v1: V1Finding[]; changes: Change[]; checks: Check[]; rolledBack?: boolean;
}
export interface SetupResult { exitCode: number; agents: AgentResult[]; backupDir?: string; error?: string; }
export interface SetupOptions extends SetupContext {
  agents?: AgentId[]; runId?: string; dryRun?: boolean;
  /** D7 Ctrl-C: on abort the agent in progress is rolled back and the lock released, synchronously. */
  signal?: AbortSignal;
  /** Live checklist: called before and after each agent. */
  onAgent?: (id: AgentId, phase: "start" | "done", res?: AgentResult) => void;
}

interface Entry { agent: AgentId; file?: string; existed?: boolean; backup?: string; undo?: { bin: string; args: string[] }; }
interface Manifest { runId: string; path: string; entries: Entry[]; }

// ---------- small helpers ----------

const WIN_EXT = ".COM;.EXE;.BAT;.CMD";

/** PATH lookup the way the host shell does it. On Windows, npm installs an agent CLI as `<bin>.cmd` (next to an
 *  extensionless sh script that cmd.exe cannot run), so only PATHEXT names match there. Env keys are matched without
 *  case, since Windows spells PATH as `Path`. */
export function whichBin(bin: string, env: SetupContext["env"], platform: NodeJS.Platform = process.platform): string | undefined {
  const get = (k: string): string | undefined => env[Object.keys(env).find((x) => x.toUpperCase() === k) ?? k];
  const win = platform === "win32";
  const exts = win ? (get("PATHEXT") || WIN_EXT).split(";").filter(Boolean) : [""];
  const names = win && path.extname(bin) ? [bin] : exts.map((e) => bin + e.toLowerCase());
  for (const dir of (get("PATH") ?? "").split(win ? ";" : ":").filter(Boolean)) {
    for (const n of names) {
      const f = path.join(dir, n);
      try { accessSync(f, fsc.X_OK); if (statSync(f).isFile()) return f; } catch { /* next */ }
    }
  }
  return undefined;
}
const which = whichBin;

/** cmd.exe line for a .cmd/.bat shim: Node refuses to spawn those without a shell (CVE-2024-27980). Each argument is
 *  quoted, so paths with spaces survive; the outer quotes are the /s form. */
export function winCmdLine(file: string, args: string[]): string {
  const q = (a: string): string => (a === "" || /[\s"&|<>^()%!]/.test(a) ? `"${a.replace(/"/g, '""')}"` : a);
  return `"${[file, ...args].map(q).join(" ")}"`;
}

/** Runs an agent CLI found on PATH; a Windows .cmd/.bat shim goes through cmd.exe. */
function runBin(bin: string, args: string[], env: SetupContext["env"]): ReturnType<typeof spawnSync> {
  const file = which(bin, env) ?? bin;
  if (process.platform === "win32" && /\.(cmd|bat)$/i.test(file)) {
    return spawnSync(env.ComSpec || "cmd.exe", ["/d", "/s", "/c", winCmdLine(file, args)],
      { env, encoding: "utf8", timeout: VERIFY_TIMEOUT_MS, windowsVerbatimArguments: true, windowsHide: true });
  }
  return spawnSync(file, args, { env, encoding: "utf8", timeout: VERIFY_TIMEOUT_MS, windowsHide: true });
}

function readOr(file: string): string | undefined { return existsSync(file) ? readFileSync(file, "utf8") : undefined; }

function atomicWrite(file: string, text: string): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.cm-tmp-${process.pid}`);
  writeFileSync(tmp, text);
  renameSync(tmp, file);
}

function pidAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch (e) { return (e as NodeJS.ErrnoException).code === "EPERM"; }
}

function p95(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(s.length * P95) - 1)];
}

// The agent id is not repeated here: the CLI lines already start with it (`FAIL <id>: <reason>. Fix: ...`).
function parseFail(_row: CheckRow, file: string): string { return `${file} does not parse; left as is. Fix the file, then re-run setup`; }

// ---------- plan ----------

interface FileEdit { file: string; before: string | undefined; after: string; changes: Change[]; }
interface Plan { edits: FileEdit[]; cli: string[][]; }

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

/** Rewrite (D4) or drop v1 hook commands in a hooks/settings JSON file; other entries stay as they are. */
function planHookFile(row: CheckRow, hf: HookFile): FileEdit | undefined {
  const before = readOr(hf.file);
  if (before === undefined) return undefined;
  let doc: unknown;
  try { doc = JSON.parse(before); } catch { throw new Error(parseFail(row, hf.file)); }
  if (!isObj(doc) || !isObj(doc.hooks)) return undefined;
  const changes: Change[] = [];
  const want = hookCommandString(row);
  for (const [event, groups] of Object.entries(doc.hooks)) {
    if (!Array.isArray(groups)) continue;
    for (let g = groups.length - 1; g >= 0; g--) {
      const list = isObj(groups[g]) ? (groups[g] as Json).hooks : undefined;
      if (!Array.isArray(list)) continue;
      for (let h = list.length - 1; h >= 0; h--) {
        const cmd = isObj(list[h]) ? (list[h] as Json).command : undefined;
        if (typeof cmd !== "string" || !cmd.includes(V1_HOOK_MARK)) continue;
        const at = `hooks.${event}[${g}].hooks[${h}].command`;
        if (hf.mode === "rewrite") { (list[h] as Json).command = want; changes.push({ file: hf.file, path: at, before: cmd, after: want }); }
        else { list.splice(h, 1); changes.push({ file: hf.file, path: at, before: cmd, after: null }); }
      }
      if (list.length === 0) groups.splice(g, 1);
    }
  }
  return changes.length ? { file: hf.file, before, after: JSON.stringify(doc, null, 2) + "\n", changes } : undefined;
}

function planRow(row: CheckRow, listed: boolean): Plan {
  const edits: FileEdit[] = [];
  if (row.config) {
    const c = row.config;
    const before = readOr(c.file);
    let res;
    try { res = editHostConfigText(row.id, c.file, before ?? "", c.format, [[c.key, c.value]]); }
    catch (e) { if (e instanceof CtxError) throw new Error(parseFail(row, c.file)); throw e; }
    if (res.edits.length) edits.push({ file: c.file, before, after: res.text, changes: res.edits.map((e) => ({ file: c.file, ...e })) });
  }
  for (const hf of row.hookFiles) { const e = planHookFile(row, hf); if (e) edits.push(e); }
  const cli = row.config || !row.cli || listed ? [] : row.cli.install;
  return { edits, cli };
}

// ---------- verify ----------

function listCheck(row: CheckRow, env: SetupContext["env"]): Check | undefined {
  const l = row.listCommand;
  if (!l || !which(l.bin, env)) return undefined;
  const r = runBin(l.bin, l.args, env);
  const ok = r.status === 0 && `${r.stdout}`.includes("context-mode");
  return { name: "list", ok, detail: ok ? undefined : `${l.bin} ${l.args.join(" ")} does not list context-mode` };
}

function mcpCheck(cmd: string[], env: SetupContext["env"]): Promise<Check> {
  return new Promise((resolve) => {
    // Own process group on POSIX: a terminal Ctrl-C then reaches only the CLI, whose SIGINT handler rolls back and
    // exits 130. Otherwise the server dies first and this check reports a FAIL before the handler runs.
    const child = spawn(cmd[0], cmd.slice(1), { env, stdio: ["pipe", "pipe", "ignore"], detached: process.platform !== "win32" });
    const reap = (): void => { child.kill(); };
    process.once("exit", reap);
    let buf = "";
    let init = false;
    const done = (ok: boolean, detail?: string): void => { clearTimeout(timer); process.off("exit", reap); child.kill(); resolve({ name: "mcp", ok, detail }); };
    const timer = setTimeout(() => done(false, "no MCP answer before timeout"), VERIFY_TIMEOUT_MS);
    child.on("error", (e) => done(false, e.message));
    child.on("exit", (code) => done(false, `server exited (${code}) before tools/list`));
    child.stdout.on("data", (d: Buffer) => {
      buf += d.toString();
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
        let m: Json; try { m = JSON.parse(line); } catch { continue; }
        if (m.id === 1 && !init) {
          init = true;
          child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
          child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }) + "\n");
        } else if (m.id === 2) {
          const tools = isObj(m.result) && Array.isArray(m.result.tools) ? m.result.tools.map((t: Json) => t.name) : [];
          const want = [...TOOL_ORDER].sort();
          const got = [...tools].sort();
          const ok = JSON.stringify(got) === JSON.stringify(want);
          done(ok, ok ? undefined : `tools/list returned ${got.join(",")}, expected ${want.join(",")}`);
        }
      }
    });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {
      protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "context-mode-setup", version: "2.0.0" } } }) + "\n");
  });
}

function hookRound(row: CheckRow, env: SetupContext["env"]): Check {
  const cmd = row.hookCommand as string[];
  const input = JSON.stringify(row.goldenPayload);
  const wall: number[] = [];
  const bare: number[] = [];
  for (let i = 0; i < HOOK_SAMPLES; i++) { // interleaved so host load hits both series alike (D3)
    let t = performance.now();
    const r = spawnSync(cmd[0], cmd.slice(1), { env, input, encoding: "utf8", timeout: VERIFY_TIMEOUT_MS });
    wall.push(performance.now() - t);
    if (r.status !== 0) return { name: "hook", ok: false, detail: `hook exited ${r.status}: ${`${r.stderr}`.trim()}` };
    const out = `${r.stdout}`.trim(); // the golden payload is a harmless shell call: no answer, or one JSON object
    if (out) { let j: unknown; try { j = JSON.parse(out); } catch { /* below */ } if (!isObj(j)) return { name: "hook", ok: false, detail: `hook answer is not a JSON object: ${out.slice(0, 200)}` }; }
    t = performance.now();
    spawnSync(cmd[0], ["-e", ""], { env, timeout: VERIFY_TIMEOUT_MS });
    bare.push(performance.now() - t);
  }
  const wallP95Ms = Math.round(p95(wall));
  const bareP95Ms = Math.round(p95(bare));
  const overheadP95Ms = Math.max(0, wallP95Ms - bareP95Ms);
  const budget = overheadBudgetMs(env);
  const ok = overheadP95Ms <= budget;
  return { name: "hook", ok, overheadP95Ms, wallP95Ms, bareP95Ms, detail: ok ? undefined : `hook overhead p95 ${overheadP95Ms} ms > ${budget} ms` };
}

/** D3 gate: best of HOOK_ROUNDS rounds; a hook that exits non-zero fails at once. */
function hookCheck(row: CheckRow, env: SetupContext["env"]): Check {
  let best: Check | undefined;
  for (let i = 0; i < HOOK_ROUNDS; i++) {
    const c = hookRound(row, env);
    if (c.overheadP95Ms === undefined) return c;
    if (!best || c.overheadP95Ms < (best.overheadP95Ms as number)) best = c;
    if (c.ok) break;
  }
  return best as Check;
}

function parseCheck(row: CheckRow): Check {
  const c = row.config;
  if (!c) return { name: "parse", ok: true };
  try {
    const r = editHostConfigText(row.id, c.file, readFileSync(c.file, "utf8"), c.format, [[c.key, c.value]]);
    return { name: "parse", ok: r.edits.length === 0, detail: r.edits.length ? "entry differs after write" : undefined };
  } catch (e) { return { name: "parse", ok: false, detail: (e as Error).message }; }
}

async function verifyRow(row: CheckRow, env: SetupContext["env"]): Promise<Check[]> {
  const checks: Check[] = [parseCheck(row)];
  const l = listCheck(row, env);
  if (l) checks.push(l);
  checks.push(await mcpCheck(row.serverCommand, env));
  if (row.hookCommand) checks.push(hookCheck(row, env));
  return checks;
}

// ---------- apply, backup, rollback ----------

class Run {
  manifest?: Manifest;
  readonly root: string;
  readonly runId: string;
  constructor(root: string, runId: string) { this.root = root; this.runId = runId; }
  get dir(): string { return path.join(this.root, BACKUP_DIR, this.runId); }
  private save(): void { if (this.manifest) atomicWrite(path.join(this.dir, MANIFEST), JSON.stringify(this.manifest, null, 2)); }
  record(e: Entry, bytes?: string): void {
    if (!this.manifest) this.manifest = { runId: this.runId, path: this.dir, entries: [] };
    if (bytes !== undefined) {
      const rel = path.join(FILES, String(this.manifest.entries.length));
      atomicWrite(path.join(this.dir, rel), bytes);
      e.backup = rel;
    }
    this.manifest.entries.push(e);
    this.save();
  }
  rollback(agent: AgentId, env: SetupContext["env"]): void {
    if (!this.manifest) return;
    undo(this.dir, this.manifest.entries.filter((e) => e.agent === agent), env);
    this.manifest.entries = this.manifest.entries.filter((e) => e.agent !== agent);
    this.save();
  }
}

function undo(dir: string, entries: Entry[], env: SetupContext["env"]): void {
  for (const e of [...entries].reverse()) {
    if (e.undo) { runBin(e.undo.bin, e.undo.args, env); continue; }
    if (!e.file) continue;
    if (e.existed && e.backup) atomicWrite(e.file, readFileSync(path.join(dir, e.backup), "utf8"));
    else if (existsSync(e.file)) unlinkSync(e.file);
  }
}

function takeLock(root: string, runId: string): string | undefined {
  const file = path.join(root, LOCK_FILE);
  mkdirSync(root, { recursive: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    try { writeFileSync(file, JSON.stringify({ pid: process.pid, runId }), { flag: "wx" }); return undefined; }
    catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      let pid = 0;
      try { pid = Number(JSON.parse(readFileSync(file, "utf8")).pid); } catch { /* unreadable lock = stale */ }
      if (pid && pidAlive(pid)) return `setup lock ${file} is held by pid ${pid}; wait for that run or remove the lock`;
      rmSync(file, { force: true }); // stale lock from a dead run
    }
  }
  return `setup lock ${file} could not be taken`;
}

// ---------- detect ----------

export function detectAgents(reg: CheckRow[], ctx: SetupContext): AgentId[] {
  return reg.filter((r) => existsSync(path.join(ctx.home, ...AGENT_HOME_DIR[r.id]))
    || (r.listCommand && which(r.listCommand.bin, ctx.env))).map((r) => r.id);
}

// ---------- entry points ----------

export async function runSetup(opts: SetupOptions): Promise<SetupResult> {
  const ctx: SetupContext = { home: opts.home, pkgDir: opts.pkgDir, env: opts.env };
  const runId = opts.runId ?? new Date().toISOString().replace(/[:.]/g, "-");
  const reg = buildRegistry(ctx);
  // preflight
  for (const f of ["server.mjs", "hook.mjs"]) {
    if (!existsSync(path.join(ctx.pkgDir, f))) return { exitCode: 1, agents: [], error: `preflight: ${path.join(ctx.pkgDir, f)} is missing` };
  }
  const ids = opts.agents ?? detectAgents(reg, ctx);
  const root = path.join(ctx.home, STATE_DIR);
  if (!opts.dryRun) {
    const held = takeLock(root, runId);
    if (held) return { exitCode: 1, agents: [], error: held };
  }
  const run = new Run(root, runId);
  const agents: AgentResult[] = [];
  let current: AgentId | undefined;
  const onAbort = (): void => {
    if (current !== undefined && !opts.dryRun) run.rollback(current, ctx.env);
    if (!opts.dryRun) rmSync(path.join(root, LOCK_FILE), { force: true });
  };
  opts.signal?.addEventListener("abort", onAbort, { once: true });
  try {
    for (const id of ids) {
      const row = reg.find((r) => r.id === id);
      if (!row) { agents.push({ id, status: "FAIL", reason: `unknown agent ${id}`, v1: [], changes: [], checks: [] }); continue; }
      current = id;
      opts.onAgent?.(id, "start");
      const res = await setupRow(row, ctx, run, !!opts.dryRun);
      current = undefined;
      agents.push(res);
      opts.onAgent?.(id, "done", res);
    }
  } finally {
    opts.signal?.removeEventListener("abort", onAbort);
    if (!opts.dryRun) rmSync(path.join(root, LOCK_FILE), { force: true });
  }
  return { exitCode: agents.some((a) => a.status === "FAIL") ? 1 : 0, agents, backupDir: run.manifest ? run.dir : undefined };
}

async function setupRow(row: CheckRow, ctx: SetupContext, run: Run, dryRun: boolean): Promise<AgentResult> {
  const res: AgentResult = { id: row.id, status: "PASS", v1: [], changes: [], checks: [] };
  const needsBin = !row.config && row.cli;
  if (needsBin && !which(row.cli!.bin, ctx.env)) return { ...res, status: "SKIPPED", reason: `${row.cli!.bin} not on PATH` };
  if (!row.config && !row.cli) return { ...res, status: "SKIPPED", reason: `${row.id}: no setup path in the registry` };
  let plan: Plan;
  try {
    const listed = needsBin ? listCheck(row, ctx.env)?.ok === true : false;
    plan = planRow(row, listed);
  } catch (e) { return { ...res, status: "FAIL", reason: (e as Error).message }; }
  res.v1 = detectV1(row.id, ctx.home).filter((f) => !(row.config && f.file === row.config.file && !plan.edits.some((e) => e.file === f.file)));
  res.changes = [...plan.edits.flatMap((e) => e.changes), ...plan.cli.map((args) => ({ command: [row.cli!.bin, ...args] }))];
  if (dryRun) return res;
  try {
    for (const e of plan.edits) {
      assertWritable(row, e.file);
      run.record({ agent: row.id, file: e.file, existed: e.before !== undefined }, e.before);
      atomicWrite(e.file, e.after);
    }
    for (const args of plan.cli) {
      const r = runBin(row.cli!.bin, args, ctx.env);
      if (r.status !== 0) throw new Error(`${row.cli!.bin} ${args.join(" ")} exited ${r.status}: ${`${r.stderr}`.trim()}`);
    }
    if (plan.cli.length) for (const args of row.cli!.remove) run.record({ agent: row.id, undo: { bin: row.cli!.bin, args } });
    res.checks = await verifyRow(row, ctx.env);
    const bad = res.checks.filter((c) => !c.ok);
    if (bad.length) throw new Error(bad.map((c) => `${c.name}: ${c.detail}`).join("; "));
  } catch (e) {
    run.rollback(row.id, ctx.env);
    return { ...res, status: "FAIL", reason: (e as Error).message, rolledBack: true };
  }
  return res;
}

/** doctor (read-only): plan each agent without writing; pending changes or v1 entries are a FAIL that names the
 *  setup command; an agent with nothing to change runs the same verify checks as setup. */
export const V1_FORM_REASON = "v1 form, run context-mode setup";
export const NOT_SET_UP_REASON = "not set up, run context-mode setup";
export async function runDoctor(opts: SetupOptions): Promise<SetupResult> {
  const ctx: SetupContext = { home: opts.home, pkgDir: opts.pkgDir, env: opts.env };
  const reg = buildRegistry(ctx);
  for (const f of ["server.mjs", "hook.mjs"]) {
    if (!existsSync(path.join(ctx.pkgDir, f))) return { exitCode: 1, agents: [], error: `preflight: ${path.join(ctx.pkgDir, f)} is missing` };
  }
  const ids = opts.agents ?? detectAgents(reg, ctx);
  const run = new Run(path.join(ctx.home, STATE_DIR), "doctor"); // dry run: never records or writes
  const agents: AgentResult[] = [];
  for (const id of ids) {
    const row = reg.find((r) => r.id === id);
    if (!row) { agents.push({ id, status: "FAIL", reason: `unknown agent ${id}`, v1: [], changes: [], checks: [] }); continue; }
    opts.onAgent?.(id, "start");
    const res = await setupRow(row, ctx, run, true);
    if (res.status === "PASS") {
      // Report-only findings (shared temp file, user data dir) are never changed by setup, so they cannot be fixed by it.
      if (res.v1.some((f) => !UPGRADE_REPORT_ONLY_REASONS.includes(f.reason))) { res.status = "FAIL"; res.reason = V1_FORM_REASON; }
      else if (res.changes.length) { res.status = "FAIL"; res.reason = NOT_SET_UP_REASON; }
      else {
        res.checks = await verifyRow(row, ctx.env);
        const bad = res.checks.filter((c) => !c.ok);
        if (bad.length) { res.status = "FAIL"; res.reason = bad.map((c) => `${c.name}: ${c.detail}`).join("; "); }
      }
    }
    agents.push(res);
    opts.onAgent?.(id, "done", res);
  }
  return { exitCode: agents.some((a) => a.status === "FAIL") ? 1 : 0, agents };
}

/** setup --remove: undo every recorded run, newest first, so each touched file gets its pre-setup bytes back. */
export function runRemove(opts: { home: string; env?: SetupContext["env"] }): { exitCode: number; restored: number; error?: string } {
  const env = opts.env ?? process.env;
  const root = path.join(opts.home, STATE_DIR);
  const base = path.join(root, BACKUP_DIR);
  if (!existsSync(base)) return { exitCode: 0, restored: 0 };
  const held = takeLock(root, "remove");
  if (held) return { exitCode: 1, restored: 0, error: held };
  let restored = 0;
  try {
    const runs = readdirSync(base).map((r) => path.join(base, r)).filter((d) => existsSync(path.join(d, MANIFEST)))
      .sort().reverse();
    for (const dir of runs) {
      const m = JSON.parse(readFileSync(path.join(dir, MANIFEST), "utf8")) as Manifest;
      undo(dir, m.entries, env);
      restored += m.entries.length;
      renameSync(path.join(dir, MANIFEST), path.join(dir, MANIFEST_DONE));
    }
  } finally { rmSync(path.join(root, LOCK_FILE), { force: true }); }
  return { exitCode: 0, restored };
}
