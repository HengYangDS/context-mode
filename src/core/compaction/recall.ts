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
  if (order.length === 0) return NONE;

  let used = bytesOf(RECALL_OPEN_TAG) + 1 + bytesOf(RECALL_CLOSE_TAG);
  const taken: JournalRow[] = [];
  for (const { r } of order) {
    const cost = bytesOf(recallLine(r)) + 1;
    if (used + cost > RECALL_BUDGET_BYTES) continue; // skip, a smaller row may still fit
    used += cost;
    taken.push(r);
  }
  if (taken.length === 0) return NONE;
  taken.sort((a, b) => a.seq - b.seq);
  return { text: [RECALL_OPEN_TAG, ...taken.map(recallLine), RECALL_CLOSE_TAG].join("\n"), seqs: taken.map((r) => r.seq) };
}
