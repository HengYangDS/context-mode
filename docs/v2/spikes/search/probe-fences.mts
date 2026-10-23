import { readFileSync } from "node:fs";
import path from "node:path";
const R = "" + new URL("../../../..", import.meta.url).pathname.replace(/\/$/, "") + "";
const { chunkText } = await import(R + "/src/core/index/chunk.ts");
const scen = JSON.parse(readFileSync(R + "/bench/fixtures/scenarios.json", "utf8"));
const DATA = R + "/bench/fixtures/data";
function content(s) {
  if (s.fixture) return readFileSync(path.join(DATA, s.fixture), "utf8");
  if (s.concat) return s.concat.map((f) => readFileSync(path.join(DATA, f), "utf8") + s.sep).join("");
  return JSON.parse(readFileSync(path.join(DATA, s.mcpTools), "utf8")).map((t) => `### ${t.name}\n\n${t.description}`).join("\n\n---\n\n");
}
for (const s of scen.part2) {
  const text = content(s);
  const f = text.match(/```[\s\S]*?```/g) ?? [];
  const sz = f.map((x) => Buffer.byteLength(x)).sort((a,b)=>a-b);
  const md = chunkText(text, "md");
  const wholeMd = f.filter((x) => md.some((c) => c.text.includes(x))).length;
  const under800 = f.filter((x) => Buffer.byteLength(x) <= 800).length;
  console.log(`${s.scenario}: fences ${f.length}, sizes ${sz.join(",")}; <=800B ${under800}; kind md -> ${md.length} chunks, fences whole ${wholeMd}`);
}
const mt = content(scen.part2[6]); console.log(JSON.stringify(mt.slice(0, 260)));
