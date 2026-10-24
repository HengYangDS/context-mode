// DECISIONS-r11 (B) turn-boundary recall ("push, not pull"). After a compaction a model does not call a
// tool for state it does not know it lost (0 of 50 clean T-CMP sessions), so the hook pushes the rows the
// next prompt asks about. Pure over JournalRow[]: BM25 (rankTexts, the store's tokenizer) of each row's
// text against the prompt; whole rows only, never cut; nothing when the top score is under RECALL_MIN_SCORE.
import { RECALL_BUDGET_BYTES, RECALL_CLOSE_TAG, RECALL_MIN_SCORE, RECALL_OPEN_TAG } from "../contracts/constants.ts";
import type { JournalRow } from "../contracts/types.ts";
import { rankTexts } from "../store/fts.ts";

export interface Recall {
  text: string; // "" = inject nothing
  seqs: number[]; // rows injected, seq ascending
}

const NONE: Recall = { text: "", seqs: [] };

function bytesOf(s: string): number {
  return Buffer.byteLength(s, "utf8");
}

/** The row's searchable text: key, path and body, as stored. */
function textOf(r: JournalRow): string {
  return [r.key ?? "", r.path ?? "", r.body].filter((t) => t !== "").join("\n");
}

/** One whole row: "#seq kind tool: text". The text is never cut (a row that does not fit is skipped). */
export function recallLine(r: JournalRow): string {
  return "#" + r.seq + " " + r.kind + (r.tool === null ? "" : " " + r.tool) + ": " + textOf(r);
}

/**
 * rows: candidates (any order); prompt: this turn's text; seen: seqs already injected in this session.
 * The current prompt's own row (kind "prompt", same body) is never a candidate.
 */
export function pickRecall(rows: readonly JournalRow[], prompt: string, seen: ReadonlySet<number>): Recall {
  if (prompt.trim() === "") return NONE;
  const pool = rows.filter((r) => !seen.has(r.seq) && r.kind !== "cost" && !(r.kind === "prompt" && r.body === prompt) && textOf(r) !== "");
  if (pool.length === 0) return NONE;
  const scores = rankTexts(pool.map(textOf), prompt, "any");
  const order = pool
    .map((r, i) => ({ r, score: scores[i] as number }))
    .filter((x) => x.score >= RECALL_MIN_SCORE)
    .sort((a, b) => b.score - a.score || b.r.seq - a.r.seq);

  let used = bytesOf(RECALL_OPEN_TAG) + 1 + bytesOf(RECALL_CLOSE_TAG);
  const taken: JournalRow[] = [];
  for (const { r } of order) {
    const cost = bytesOf(recallLine(r)) + 1;
    if (used + cost > RECALL_BUDGET_BYTES) continue; // skip, a smaller row may still fit
    used += cost;
    taken.push(r);
  }
  taken.sort((a, b) => a.seq - b.seq);
  // a-ledger (D-FU-CMP-LEDGER-1): a row too large to go out whole is ranked line by line instead.
  const big = pool.filter((r) => bytesOf(recallLine(r)) + 1 > RECALL_BUDGET_BYTES);
  const lines = pickLines(big, prompt, RECALL_BUDGET_BYTES - used);
  if (taken.length === 0 && lines.length === 0) return NONE;
  return { text: [RECALL_OPEN_TAG, ...taken.map(recallLine), ...lines, RECALL_CLOSE_TAG].join("\n"), seqs: taken.map((r) => r.seq) };
}

/** Leading spaces and tabs: the nesting depth of a line in JSON, YAML, test reports and indented logs. */
function indentOf(line: string): number {
  let n = 0;
  while (n < line.length && (line[n] === " " || line[n] === "\t")) n++;
  return n;
}

interface LineCandidate { seq: number; no: number; text: string; context: string[] }

/**
 * Each non-blank line of a row, with its context: the nearest earlier lines with less indentation (one
 * stack pass, O(lines)). A JSON value gets its key path, a test failure detail gets its test line.
 */
function lineCandidates(r: JournalRow): LineCandidate[] {
  const out: LineCandidate[] = [];
  const stack: Array<{ indent: number; text: string }> = [];
  const all = r.body.split("\n");
  for (let i = 0; i < all.length; i++) {
    const raw = all[i] as string;
    const text = raw.trim();
    if (text === "") continue;
    const indent = indentOf(raw);
    while (stack.length > 0 && (stack[stack.length - 1] as { indent: number }).indent >= indent) stack.pop();
    out.push({ seq: r.seq, no: i + 1, text, context: stack.map((e) => e.text) });
    stack.push({ indent, text });
  }
  return out;
}

/** "#seq L<n>: ctx > ... > line"; whole lines only. */
function lineOut(c: LineCandidate): string {
  return "#" + c.seq + " L" + c.no + ": " + [...c.context, c.text].join(" > ");
}

/**
 * BM25 of every line (with its context) of the oversize rows against the prompt, in one corpus, so a
 * term rare in the output (a req id, a path, a seed) ranks its line first. Lines at or over RECALL_MIN_SCORE,
 * best first (ties: older row, earlier line), whole lines within `budget`, the same rendered line once.
 */
function pickLines(rows: readonly JournalRow[], prompt: string, budget: number): string[] {
  if (rows.length === 0 || budget <= 0) return [];
  const cands = rows.flatMap(lineCandidates);
  if (cands.length === 0) return [];
  const scores = rankTexts(cands.map((c) => [...c.context, c.text].join("\n")), prompt, "any");
  const order = cands
    .map((c, i) => ({ c, score: scores[i] as number }))
    .filter((x) => x.score >= RECALL_MIN_SCORE)
    .sort((a, b) => b.score - a.score || a.c.seq - b.c.seq || a.c.no - b.c.no);
  const shown = new Set<string>();
  const out: string[] = [];
  let used = 0;
  for (const { c } of order) {
    const body = [...c.context, c.text].join(" > ");
    if (shown.has(body)) continue;
    const line = lineOut(c);
    const cost = bytesOf(line) + 1;
    if (used + cost > budget) continue;
    used += cost;
    shown.add(body);
    out.push(line);
  }
  return out;
}
