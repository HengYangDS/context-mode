// The search, recall and units runtime paths hold no regex: no regex literal and no RegExp call.
// Words are split by src/core/store/words.ts (one char-by-char loop). The TypeScript parser finds the nodes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const FILES = [
  "src/core/store/fts.ts",
  "src/core/store/words.ts",
  "src/core/store/snippet.ts",
  "src/core/index/units.ts",
  "src/core/compaction/recall.ts",
];

function regexNodes(path) {
  const sf = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
  const found = [];
  const visit = (node) => {
    if (node.kind === ts.SyntaxKind.RegularExpressionLiteral) found.push(node.getText(sf));
    if ((ts.isNewExpression(node) || ts.isCallExpression(node)) && ts.isIdentifier(node.expression) && node.expression.text === "RegExp") {
      found.push(node.getText(sf));
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

for (const path of FILES) {
  test("no regex literal or RegExp call in " + path, () => {
    assert.deepEqual(regexNodes(path), []);
  });
}
