// D-CMP-PUSH-1: query-driven push after a compaction. The first UserPromptSubmit after a compaction runs the
// store search (BM25 + trigram + RRF, ftsRank) over this session's stored outputs; this module turns the hit
// chunks into whole lines with their structure and picks them by relevance with MMR under a byte budget.
// Pure: no DB. Lines are never cut; a block that does not fit is left out whole.
//
// Item of a hit line h: its indent ancestors (each earlier line with a smaller indent than the last one
// taken, up to PUSH_MAX_ANCESTORS: the JSON key path, the "not ok" line of a test), h, and h's indent block
// (the next lines with a larger indent) when the whole block fits PUSH_BLOCK_BYTES.
// rel(i) = BM25 of the item text against the query (rankTexts "any", the store tokenizer).
// MMR: next = argmax  PUSH_LAMBDA * rel(i)/rel(top) - (1 - PUSH_LAMBDA) * max_j Jaccard(lines(i), lines(j)).
// Items under PUSH_MIN_REL * rel(top) are never picked; nothing goes out when rel(top) < RECALL_MIN_SCORE.
import {
  PUSH_BLOCK_BYTES, PUSH_BUDGET_BYTES, PUSH_CLOSE_TAG, PUSH_LAMBDA, PUSH_MAX_ANCESTORS, PUSH_MIN_REL, PUSH_OPEN_TAG,
  RECALL_MIN_SCORE,
} from "../contracts/constants.ts";
import { rankTexts } from "../store/fts.ts";

export interface PushSource {
  label: string;
  text: string; // the stored output, chunks joined in ord order
  hits: number[]; // char offsets of the hit chunks, best first
}

interface Item { src: number; lines: number[]; text: string; rel: number; }

const GAP = "...";

function bytesOf(s: string): number {
  return Buffer.byteLength(s, "utf8");
}

function indentOf(line: string): number {
  let n = 0;
  while (n < line.length && (line[n] === " " || line[n] === "\t")) n += 1;
  return n === line.length ? -1 : n; // -1 = blank line
}

function lineAt(starts: number[], off: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= off) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function itemLines(lines: string[], ind: number[], h: number): number[] {
  const out = [h];
  let cur = ind[h];
  for (let i = h - 1; i >= 0 && cur > 0 && out.length <= PUSH_MAX_ANCESTORS; i -= 1) {
    if (ind[i] >= 0 && ind[i] < cur) {
      out.push(i);
      cur = ind[i];
    }
  }
  const block: number[] = [];
  let bytes = 0;
  for (let i = h + 1; i < lines.length && ind[i] > ind[h]; i += 1) {
    block.push(i);
    bytes += bytesOf(lines[i]) + 1;
    if (bytes > PUSH_BLOCK_BYTES) break;
  }
  if (bytes <= PUSH_BLOCK_BYTES) out.push(...block);
  return out.sort((a, b) => a - b);
}

function jaccard(a: ReadonlySet<number>, b: readonly number[]): number {
  let inter = 0;
  for (const x of b) if (a.has(x)) inter += 1;
  return inter / (a.size + b.length - inter);
}

/** The push block for `query`, or "" when nothing is relevant enough. */
export function pickPush(sources: readonly PushSource[], query: string, budget: number = PUSH_BUDGET_BYTES): string {
  if (query.trim() === "") return "";
  const split = sources.map((s) => {
    const lines = s.text.split("\n");
    const starts: number[] = [];
    let off = 0;
    for (const l of lines) {
      starts.push(off);
      off += l.length + 1;
    }
    return { lines, starts, ind: lines.map(indentOf) };
  });
  const items: Item[] = [];
  const seen = new Set<string>();
  sources.forEach((s, si) => {
    const { lines, starts, ind } = split[si];
    for (const off of s.hits) {
      const h = lineAt(starts, off);
      if (ind[h] < 0 || seen.has(si + ":" + h)) continue;
      seen.add(si + ":" + h);
      const ls = itemLines(lines, ind, h);
      items.push({ src: si, lines: ls, text: ls.map((i) => lines[i]).join("\n"), rel: 0 });
    }
  });
  if (items.length === 0) return "";
  const rel = rankTexts(items.map((i) => i.text), query, "any");
  items.forEach((it, i) => { it.rel = rel[i]; });
  const top = Math.max(...items.map((i) => i.rel));
  if (!(top >= RECALL_MIN_SCORE)) return "";

  const picked = sources.map(() => new Set<number>());
  const pickedItems: Item[] = [];
  const order: number[] = []; // source order = order of first pick
  const fixed = bytesOf(PUSH_OPEN_TAG) + 1 + bytesOf(PUSH_CLOSE_TAG);
  const render = (): string => {
    const parts: string[] = [];
    for (const si of order) {
      const ls = [...picked[si]].sort((a, b) => a - b);
      parts.push("source: " + sources[si].label);
      ls.forEach((l, k) => {
        if (k > 0 && l !== ls[k - 1] + 1) parts.push(GAP);
        parts.push(split[si].lines[l]);
      });
    }
    return parts.join("\n");
  };
  let pool = items.filter((i) => i.rel >= PUSH_MIN_REL * top);
  while (pool.length > 0) {
    let best = -1;
    let bestScore = -Infinity;
    pool.forEach((it, k) => {
      let sim = 0;
      for (const p of pickedItems) if (p.src === it.src) sim = Math.max(sim, jaccard(new Set(p.lines), it.lines));
      const m = PUSH_LAMBDA * (it.rel / top) - (1 - PUSH_LAMBDA) * sim;
      if (m > bestScore) { bestScore = m; best = k; }
    });
    const it = pool[best];
    pool = pool.filter((_, k) => k !== best);
    const before = new Set(picked[it.src]);
    const newSrc = !order.includes(it.src);
    for (const l of it.lines) picked[it.src].add(l);
    if (newSrc) order.push(it.src);
    if (fixed + bytesOf(render()) + 1 > budget) {
      picked[it.src] = before;
      if (newSrc) order.pop();
      continue;
    }
    pickedItems.push(it);
  }
  if (pickedItems.length === 0) return "";
  return PUSH_OPEN_TAG + "\n" + render() + "\n" + PUSH_CLOSE_TAG;
}
