import { readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
const R = "" + new URL("../../../..", import.meta.url).pathname.replace(/\/$/, "") + "";
const { chunkText } = await import(R + "/src/core/index/chunk.ts");
const { FTS_TOKENIZE } = await import(R + "/src/core/store/schema.ts");
const scen = JSON.parse(readFileSync(R + "/bench/fixtures/scenarios.json", "utf8"));
const DATA = R + "/bench/fixtures/data";
function content(s) {
  if (s.fixture) return readFileSync(path.join(DATA, s.fixture), "utf8");
  if (s.concat) return s.concat.map((f) => readFileSync(path.join(DATA, f), "utf8") + s.sep).join("");
  return JSON.parse(readFileSync(path.join(DATA, s.mcpTools), "utf8")).map((t) => `### ${t.name}\n\n${t.description}`).join("\n\n---\n\n");
}
const toMatch = (q) => q.split(/\s+/).filter(Boolean).map((w) => `"${w.replaceAll('"','""')}"*`).join(" ");
console.log("tokenizer:", FTS_TOKENIZE);
for (const s of scen.part2) {
  const text = content(s);
  const chunks = chunkText(text, "text");
  const fences = text.match(/```[\s\S]*?```/g) ?? [];
  const whole = fences.filter((f) => chunks.some((c) => c.text.includes(f))).length;
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE VIRTUAL TABLE t USING fts5(body, ${FTS_TOKENIZE})`);
  const ins = db.prepare("INSERT INTO t(rowid, body) VALUES (?, ?)");
  chunks.forEach((c, i) => ins.run(i, c.text));
  const sizes = chunks.map((c) => c.bytes);
  const fenceSplit = chunks.filter((c) => ((c.text.match(/```/g) ?? []).length % 2) === 1).length;
  console.log(`\n## ${s.scenario}: ${text.length} B, ${chunks.length} chunks (min ${Math.min(...sizes)} / median ${sizes.sort((a,b)=>a-b)[sizes.length>>1]} / max ${Math.max(...sizes)} B); fences ${fences.length}, whole in one chunk ${whole}, chunks with odd fence count ${fenceSplit}`);
  for (const q of s.queries) {
    const m = toMatch(q);
    const n = db.prepare("SELECT count(*) n FROM t WHERE t MATCH ?").get(m).n;
    const per = q.split(/\s+/).map((w) => {
      const term = `"${w}"*`;
      let k = 0; try { k = db.prepare("SELECT count(*) n FROM t WHERE t MATCH ?").get(term).n; } catch (e) { k = "ERR"; }
      const tok = db.prepare("SELECT count(*) n FROM t WHERE t MATCH ?").get(`"${w}"`).n;
      return `${w}=${k}(exact ${tok})`;
    }).join(" ");
    const any = db.prepare("SELECT count(*) n FROM t WHERE t MATCH ?").get(m.split(" ").join(" OR ")).n;
    console.log(`  q=${JSON.stringify(q)} MATCH=${m} -> AND rows ${n}, OR rows ${any} | per term: ${per}`);
  }
}
