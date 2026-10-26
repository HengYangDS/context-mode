# Release on demand from main, drop the `release` branch

Status: decided by the owner, 2026-10-26. Not started.

## Decision
- Fixes land on `main` as soon as they are done. They pile up there.
- A release happens only when the owner says "release". The `/release` skill then runs `release.yml`: tag, build, `npm publish --provenance`, GitHub release.
- npm is the only channel. The git `release` branch goes away after v2 is `latest` on npm.

## Steps
1. Publish `2.0.0-next.1` to npm `next` (the branch can still exist then; v1 is not affected).
2. Probe: Claude Code marketplace with `source: "npm"` and `context-mode@next` in a temp HOME. Pass = plugin installs, hooks fire, skills load, an update arrives.
3. If the probe passes: ADR-0022 supersedes the `release` branch parts of ADR-0002, 0011, 0013, 0019.
   - `ctx_upgrade` (`src/core/ops/release-fetch.ts`) and `doctor` (`src/core/ops/doctor-env.ts`) read npm, not `git ls-remote release`.
   - `scripts/release/plan.mjs` and `publish.mjs` find releases by tags on `main`; no stage/promote branch moves.
   - Drop the Gemini/Qwen git-route install from `docs/install/{gemini,qwen}.md` and `docs/install/README.md`.
   - `gh release create` gets `--prerelease` while the version has `-next`.
4. When v2 is `latest`: delete the `release` branch on origin.
5. If the probe fails: keep the branch for the Claude Code marketplace only; everything else still moves to npm.
