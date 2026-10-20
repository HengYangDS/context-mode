// [W1-session-journal] Ported from tests/session/detect-locale-esm.test.ts.
// v1 detected a locale (CONTEXT_MODE_LOCALE, AppleLocale, LANG) for Intl date formatting; LANG=C.UTF-8
// crashed `new Intl.DateTimeFormat("C")` on Linux CI (fix 9cc6873c). v2 compaction output has no locale
// use at all (ADR-0009 §4-§5: integers and fixed text only). The case that must hold: the block is
// byte-identical under any locale env, and rendering never throws under POSIX locale values.
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderState } from "../../../src/core/compaction/render.ts";

function row(partial) {
  return {
    seq: 1, session_id: "s1", worktree: "/w", agent: "claude-code",
    kind: "prompt", tool: null, key: null, path: null, ok: 1, exit_code: null,
    bytes: 0, body: "", turn: 1, sandbox_bytes: 0, returned_bytes: 0, created_at: 1700000000000, accessed_at: 1700000000000,
    ...partial,
  };
}

const rows = [
  row({ seq: 1, kind: "prompt", body: "ilk istek", turn: 1 }),
  row({ seq: 2, kind: "edit", tool: "Edit", path: "src/a.ts", turn: 1 }),
  row({ seq: 3, kind: "cmd", tool: "Bash", key: "Bash:npm test", ok: 0, turn: 2 }),
  row({ seq: 4, kind: "prompt", body: "son istek", turn: 2 }),
];

function renderUnder(env) {
  const saved = {};
  for (const k of Object.keys(env)) {
    saved[k] = process.env[k];
    if (env[k] === undefined) delete process.env[k];
    else process.env[k] = env[k];
  }
  try {
    return renderState(rows, 2);
  } finally {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

test("[W1-session-journal] renderState output does not depend on locale env", () => {
  const base = renderUnder({ CONTEXT_MODE_LOCALE: undefined, LANG: undefined, LC_ALL: undefined });
  for (const env of [
    { CONTEXT_MODE_LOCALE: "tr-TR", LANG: undefined, LC_ALL: undefined },
    { CONTEXT_MODE_LOCALE: undefined, LANG: "C.UTF-8", LC_ALL: undefined },
    { CONTEXT_MODE_LOCALE: undefined, LANG: "POSIX", LC_ALL: "C" },
    { CONTEXT_MODE_LOCALE: undefined, LANG: "xx_XX.UTF-8", LC_ALL: undefined },
  ]) {
    assert.equal(renderUnder(env), base, JSON.stringify(env));
  }
  assert.ok(base.length > 0);
});
