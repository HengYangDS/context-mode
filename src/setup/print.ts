// src/setup/print.ts: `context-mode setup --print <id>`, the manual step for one agent with absolute paths filled
// in (owner 2026-10-25: users never type paths, JSON or scripts). Built from the same registry row setup applies,
// so the printed step and the applied step cannot drift. Writes nothing.
import { editHostConfigText } from "../core/ops/host-config.ts";
import type { CheckRow } from "./registry.ts";

export type PrintStep =
  | { kind: "config"; file: string; format: string; key: readonly string[]; block: string }
  | { kind: "run"; argv: string[]; input?: string };
export interface PrintPlan { agent: string; steps: PrintStep[]; verify: string; }

/** One shell word: left bare when safe, else single-quoted (POSIX shells; PowerShell reads '...' the same). */
export function shellWord(s: string): string {
  return /^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replaceAll("'", `'"'"'`)}'`;
}

export function printPlan(row: CheckRow): PrintPlan {
  const steps: PrintStep[] = [];
  if (row.config) {
    const c = row.config;
    const block = editHostConfigText(row.id, c.file, "", c.format, [[c.key, c.value]]).text;
    steps.push({ kind: "config", file: c.file, format: c.format, key: c.key, block });
  } else if (row.cli) {
    for (const args of row.cli.install) steps.push({ kind: "run", argv: [row.cli.bin, ...args], ...(row.cli.input ? { input: row.cli.input } : {}) });
  }
  return { agent: row.id, steps, verify: `context-mode doctor --agents ${row.id}` };
}

export function printText(p: PrintPlan): string {
  const tail = `\nThen restart ${p.agent} and check it: ${p.verify}\n`;
  const cfg = p.steps.find((s) => s.kind === "config");
  if (cfg && cfg.kind === "config") {
    return `Manual setup for ${p.agent}. Put this in ${cfg.file}\n(if the file exists, add the context-mode entry and keep the rest):\n\n${cfg.block}${tail}`;
  }
  const runs = p.steps.filter((s): s is Extract<PrintStep, { kind: "run" }> => s.kind === "run");
  if (!runs.length) return `${p.agent} has no manual step. Run: context-mode setup --agents ${p.agent}\n`;
  const ask = runs.find((s) => s.input)?.input?.trim();
  const extra = ask ? `${runs[0].argv[0]} asks to confirm: answer ${ask}.\n` : "";
  return `Manual setup for ${p.agent}. Run:\n\n${runs.map((s) => s.argv.map(shellWord).join(" ")).join("\n")}\n${extra}${tail}`;
}
