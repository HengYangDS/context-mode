// impl/05 §5, DECISIONS-r9 F1 (in-memory form), ADR-0016 (whole chunks, budgeted greedy, equal score
// -> newest first), ADR-0009 §4 (an item that does not fit is skipped; smaller ones may still fit),
// DEVIATIONS D-M2-6, D-M2-T3-1 (rankTexts), D-M2-T8-1.
// Reduction is selection of whole chunks; nothing is cut. The full text stays indexed and `more`
// names the search that reaches every chunk that was not selected.
import type { Chunk, DbHandle } from "../contracts/types.ts";
import { rankTexts } from "../store/fts.ts";

export interface Selection { text: string; more: string | null; }

const READ_CHUNKS = "SELECT ord, body FROM chunks WHERE source_id = ?";
const READ_LABEL = "SELECT label FROM sources WHERE id = ?";
// Selected chunks are joined by one newline; its byte is charged to the budget.
const SEP = "\n";
const SEP_BYTES = 1;

/** DB form: the chunks of one stored source, selected against `intent` within `budget` bytes. */
export function selectChunks(db: DbHandle, sourceId: number, intent: string, budget: number): Selection {
  const rows = db.raw.prepare(READ_CHUNKS).all(sourceId) as unknown as Array<{ ord: number; body: string }>;
  if (rows.length === 0) return { text: "", more: null };
  const chunks: Chunk[] = rows.map((r) => ({ ord: Number(r.ord), text: r.body, bytes: Buffer.byteLength(r.body, "utf8") }));
  const row = db.raw.prepare(READ_LABEL).get(sourceId) as { label: string } | undefined;
  return select(chunks, intent, budget, row?.label);
}

/**
 * In-memory form (DECISIONS-r9 F1): same scoring, selection, `more` rule and shape, no DB access.
 * `source` is the label the caller will store the chunks under; it goes into the `more` line.
 */
// `rankQuery` (D-M7-SV-5): when given, chunks rank by any word of it instead of all words of `intent`;
// the `more` line still names `intent`.
export function selectChunksInMemory(chunks: Chunk[], intent: string, budget: number, source?: string, rankQuery?: string): Selection {
  return select(chunks, intent, budget, source, rankQuery);
}

function select(chunks: Chunk[], intent: string, budget: number, label: string | undefined, rankQuery?: string): Selection {
  if (chunks.length === 0) return { text: "", more: null };
  // Step 2: one BM25 for both forms, the store's own (same tokenizer as the chunks table).
  const texts = chunks.map((c) => c.text);
  const scores = rankQuery === undefined ? rankTexts(texts, intent) : rankTexts(texts, rankQuery, "any");
  // Step 3: score descending; equal score -> later chunk first (ADR-0016 "newest first").
  const order = chunks.map((_, i) => i).sort((a, b) => scores[b] - scores[a] || chunks[b].ord - chunks[a].ord);
  promoteNeighbour(order, chunks, scores);
  const picked: Chunk[] = [];
  let used = 0;
  let skipped = false;
  for (const i of order) {
    const cost = chunks[i].bytes + (picked.length > 0 ? SEP_BYTES : 0);
    if (used + cost > budget) {
      skipped = true;
      continue;
    }
    picked.push(chunks[i]);
    used += cost;
  }
  // Step 5: reading order, not score order.
  picked.sort((a, b) => a.ord - b.ord);
  const text = picked.map((c) => c.text).join(SEP);
  // Step 4.
  return { text, more: skipped ? moreLine(intent, label) : null };
}

// D-M7-SV-8: small replace chunks cut one record into several chunks, so the best chunk often holds only
// half of what the user asked for (big-json: "priority": true in one chunk, its "amount" in the chunk
// before). The best chunk's adjacent chunk (ord +-1) with the higher score > 0 moves to second place,
// ahead of equal or weaker matches elsewhere. Equal neighbour scores -> the later chunk (newest first).
// No match (best score 0) -> no change. Still whole chunks only, BM25-scored, within the same budget.
function promoteNeighbour(order: number[], chunks: Chunk[], scores: number[]): void {
  if (order.length < 3) return;
  const best = order[0];
  if (scores[best] <= 0) return;
  let pick = -1;
  for (let j = 0; j < chunks.length; j++) {
    if (j === best || Math.abs(chunks[j].ord - chunks[best].ord) !== 1 || scores[j] <= 0) continue;
    if (pick < 0 || scores[j] > scores[pick] || (scores[j] === scores[pick] && chunks[j].ord > chunks[pick].ord)) pick = j;
  }
  if (pick < 0) return;
  order.splice(order.indexOf(pick), 1);
  order.splice(1, 0, pick);
}

function moreLine(intent: string, label: string | undefined): string {
  const source = label === undefined ? "" : ", source:" + JSON.stringify(label);
  return "ctx_search({queries:[" + JSON.stringify(intent) + "]" + source + "})";
}
