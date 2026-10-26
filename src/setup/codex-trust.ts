// src/setup/codex-trust.ts
// Codex 0.164.0 runs a hooks.json hook only when config.toml holds
// [hooks.state."<realpath of hooks.json>:<snake_event>:<group>:<handler>"] trusted_hash = "sha256:<hex>".
// The hex is sha256 of the sorted-key JSON {event_name, matcher?, hooks:[{...handler, async:false}]}; checked against
// currentHash from `codex app-server` hooks/list (D-HA-CODEX-TRUST-1). Only context-mode's own handlers are trusted.
import { createHash } from "node:crypto";
import { existsSync, realpathSync } from "node:fs";
import path from "node:path";

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const TRUST_KEY = ["hooks", "state"] as const;
/** The change path every trust edit starts with (editHostConfigText joins the key path with "."). */
export const CODEX_TRUST_PATH = TRUST_KEY.join(".") + ".";
const HASH_FIELD = "trusted_hash";
const HASH_PREFIX = "sha256:";

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (!isObj(v)) return v;
  return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
}

/** PreToolUse -> pre_tool_use (Codex's own event key form). */
function snake(name: string): string {
  let out = "";
  for (const ch of name) {
    const upper = ch >= "A" && ch <= "Z";
    out += upper ? (out === "" ? "" : "_") + ch.toLowerCase() : ch;
  }
  return out;
}

/** The real path of `file`, also when it or its parents do not exist yet (Codex keys use the real path). */
function realFile(file: string): string {
  let dir = path.resolve(file);
  const rest: string[] = [];
  while (!existsSync(dir) && path.dirname(dir) !== dir) { rest.unshift(path.basename(dir)); dir = path.dirname(dir); }
  return path.join(realpathSync(dir), ...rest);
}

/** The [hooks.state."<key>"] tables that trust every handler whose command is `command` in the hooks.json `doc`. */
export function codexTrustEntries(hooksFile: string, doc: unknown, command: string): [readonly string[], unknown][] {
  const out: [readonly string[], unknown][] = [];
  if (!isObj(doc) || !isObj(doc.hooks)) return out;
  const real = realFile(hooksFile);
  for (const [event, groups] of Object.entries(doc.hooks)) {
    if (!Array.isArray(groups)) continue;
    groups.forEach((g, gi) => {
      if (!isObj(g) || !Array.isArray(g.hooks)) return;
      g.hooks.forEach((h, hi) => {
        if (!isObj(h) || h.command !== command) return;
        const id: Json = { event_name: snake(event), hooks: [{ ...h, async: false }] };
        if (g.matcher !== undefined) id.matcher = g.matcher;
        const hash = HASH_PREFIX + createHash("sha256").update(JSON.stringify(sortKeys(id))).digest("hex");
        out.push([[...TRUST_KEY, `${real}:${snake(event)}:${gi}:${hi}`], { [HASH_FIELD]: hash }]);
      });
    });
  }
  return out;
}
