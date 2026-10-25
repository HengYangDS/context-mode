// Cache-break analysis over `claude -p --output-format stream-json --verbose` usage (docs/v2/spikes/cache).
// Pure functions, no I/O, no regex, no truncation: every call's usage is kept whole.
// Claude Code reports per model call: input_tokens (uncached), cache_read_input_tokens, cache_creation_input_tokens.
// The prompt of a call = input + cache_read + cache_creation. Call k should read the whole prompt of call k-1
// (its prefix); whatever part of that prompt it did not read was written again. That part is `rewritten`.
// A cache break = rewritten > 1024 tokens (owner definition), except the first call after /compact, where the
// host replaces the history on purpose (listed apart as postCompact, never counted as a break).
export const BREAK_TOKENS = 1024;

export const promptTokens = (u) => u.input + u.cacheRead + u.cacheCreation;

/**
 * Parse the stream-json lines of ONE turn (one `result` event). Records are per content block, so records with the
 * same message id are one model call: the later record wins. Sub-agent messages (parent_tool_use_id) are counted
 * apart and not analysed. Every non-empty line must be JSON.
 */
export function parseTurn(text) {
  const byId = new Map();
  const subIds = new Set();
  const hooks = [];
  let sessionId = null, costUsd = 0, isError = false, resultText = "", compacted = false, pending = false;
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    const e = JSON.parse(line);
    if (e.session_id !== undefined) sessionId = e.session_id;
    if (e.type === "system" && e.subtype === "compact_boundary") { compacted = true; pending = true; }
    else if (e.type === "system" && e.subtype === "hook_response") hooks.push({ event: String(e.hook_event ?? e.hook_name ?? ""), bytes: Buffer.byteLength(String(e.stdout ?? e.output ?? "")) });
    else if (e.type === "assistant") {
      const m = e.message ?? {};
      if (e.parent_tool_use_id) { subIds.add(m.id); continue; }
      const u = m.usage ?? {};
      const row = { id: m.id, input: u.input_tokens ?? 0, cacheRead: u.cache_read_input_tokens ?? 0, cacheCreation: u.cache_creation_input_tokens ?? 0, output: u.output_tokens ?? 0, afterCompact: false };
      const old = byId.get(m.id);
      if (old === undefined) { row.afterCompact = pending; pending = false; byId.set(m.id, row); }
      else byId.set(m.id, { ...row, afterCompact: old.afterCompact });
    } else if (e.type === "result") {
      costUsd = Number(e.total_cost_usd ?? 0);
      isError = e.is_error === true;
      resultText = String(e.result ?? "");
    }
  }
  return { calls: [...byId.values()], subagentCalls: subIds.size, sessionId, costUsd, isError, resultText, compacted, hooks };
}

const ratio = (read, creation, input) => { const d = read + creation + input; return d === 0 ? 0 : read / d; };

/** Breaks, post-compact rewrites, hit ratio per turn and first prefix of one session (array of parsed turns). */
export function analyzeSession(turns) {
  const breaks = [], postCompact = [], perTurn = [];
  let prev = null, carry = false, firstPrefix = null;
  turns.forEach((t, ti) => {
    let read = 0, creation = 0, input = 0;
    t.calls.forEach((c, ci) => {
      read += c.cacheRead; creation += c.cacheCreation; input += c.input;
      if (firstPrefix === null) firstPrefix = promptTokens(c);
      const exempt = c.afterCompact || carry;
      carry = false;
      if (prev !== null) {
        const rewritten = promptTokens(prev) - c.cacheRead;
        const row = { turn: ti, call: ci, rewritten, prevPrompt: promptTokens(prev), cacheRead: c.cacheRead, cacheCreation: c.cacheCreation };
        if (exempt) postCompact.push(row);
        else if (rewritten > BREAK_TOKENS) breaks.push(row);
      }
      prev = c;
    });
    if (t.compacted === true && !t.calls.some((c) => c.afterCompact)) carry = true;
    perTurn.push({ turn: ti, calls: t.calls.length, input, cacheRead: read, cacheCreation: creation, hitRatio: ratio(read, creation, input) });
  });
  return { breaks, postCompact, perTurn, firstPrefix };
}

/** Second fresh session in the same project: its first call's cache_read as a share of the first session's first prompt. */
export function crossSession(a, b) {
  const aPrefix = promptTokens(a.calls[0]);
  const bRead = b.calls[0].cacheRead;
  return { aPrefix, bRead, bCreation: b.calls[0].cacheCreation, share: aPrefix === 0 ? 0 : bRead / aPrefix };
}
