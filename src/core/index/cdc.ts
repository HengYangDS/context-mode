// Content-defined chunking (FastCDC-style, gear rolling hash with normalized chunking) and the session
// dedup measure of docs/v2/spikes/m2/b-dedup.md. Exact: the cuts cover the input with no gap and no
// overlap, so the chunks always join back to the same bytes. Deterministic: a fixed gear table.
import { createHash } from "node:crypto";

export const CDC_MIN = 128; // no cut before this many bytes
export const CDC_AVG = 512; // target mean chunk size (normalization point)
export const CDC_MAX = 2048; // forced cut

export interface CdcSizes { min: number; avg: number; max: number; }

// Gear table: 256 fixed 32-bit words from splitmix32 (seed 0). Same table on every run and platform.
const GEAR: Uint32Array = (() => {
  const g = new Uint32Array(256);
  let s = 0;
  for (let i = 0; i < 256; i++) {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    g[i] = (z ^ (z >>> 16)) >>> 0;
  }
  return g;
})();

// A mask with `bits` one-bits (bits <= 16) spread over the high half of the word: the gear hash shifts
// left, so the high bits mix the most recent 32 bytes.
function mask(bits: number): number {
  let m = 0;
  for (let i = 0; i < bits; i++) m |= 1 << (31 - 2 * i);
  return m >>> 0;
}

/**
 * Cut points [start, end) for `buf`. FastCDC normalized chunking: below `avg` the stricter mask
 * (log2(avg) + 1 bits) makes a cut less likely, above it the looser mask (log2(avg) - 1 bits) more likely,
 * so sizes cluster near `avg`. A cut never falls before `min`; one always falls at `max`.
 */
export function cdcChunks(buf: Uint8Array, sizes: CdcSizes = { min: CDC_MIN, avg: CDC_AVG, max: CDC_MAX }): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const bits = Math.round(Math.log2(sizes.avg));
  const maskS = mask(bits + 1);
  const maskL = mask(bits - 1);
  let start = 0;
  while (start < buf.length) {
    const left = buf.length - start;
    if (left <= sizes.min) {
      out.push([start, buf.length]);
      break;
    }
    const end = Math.min(left, sizes.max);
    const norm = Math.min(end, sizes.avg);
    let h = 0;
    let i = sizes.min;
    let cut = end;
    for (; i < norm; i++) {
      h = ((h << 1) + GEAR[buf[start + i]]) >>> 0;
      if ((h & maskS) === 0) { cut = i + 1; break; }
    }
    if (cut === end && i >= norm) {
      for (; i < end; i++) {
        h = ((h << 1) + GEAR[buf[start + i]]) >>> 0;
        if ((h & maskL) === 0) { cut = i + 1; break; }
      }
    }
    out.push([start, start + cut]);
    start += cut;
  }
  return out;
}

export interface DedupGain { total: number; saved: number; runs: number; }

/**
 * Bytes a per-session chunk store would save on `texts` (tool outputs in call order). Every chunk is
 * keyed by its SHA-256. A run of consecutive chunks already in the store becomes one reference of
 * `refCost` bytes (handle + chunk range), so a run saves its bytes minus `refCost`, and only a run larger
 * than `refCost` is replaced. A chunk counts as stored once its first copy is seen, also inside one output.
 */
export function dedupGain(texts: readonly string[], refCost: number, sizes?: CdcSizes): DedupGain {
  const store = new Set<string>();
  let total = 0;
  let saved = 0;
  let runs = 0;
  for (const t of texts) {
    const buf = Buffer.from(t, "utf8");
    total += buf.length;
    let run = 0;
    const close = (): void => {
      if (run > refCost) { saved += run - refCost; runs++; }
      run = 0;
    };
    for (const [a, b] of cdcChunks(buf, sizes)) {
      const key = createHash("sha256").update(buf.subarray(a, b)).digest("base64");
      if (store.has(key)) run += b - a;
      else { close(); store.add(key); }
    }
    close();
  }
  return { total, saved, runs };
}
