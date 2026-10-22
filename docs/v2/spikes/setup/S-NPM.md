# Spike S-NPM: npm trusted publishing and provenance for `context-mode`

Date: 2026-10-22. ADR: 0019. Status: partial pass (see verdict).

## Question

Can `release.yml` publish `context-mode` to npm with trusted publishing (OIDC, no long-lived token) and provenance, and does the npm tarball equal the `release` build (`SHA256SUMS`)?

## Sources (read 2026-10-22)

- https://docs.npmjs.com/trusted-publishers
  - needs npm CLI 11.5.1+ and Node 22.14.0+; workflow needs `id-token: write`.
  - the trusted publisher is set on npmjs.com with owner, repo, and workflow file name (file name only, with `.yml`).
  - the config must see a first successful publish within 2 days of creation.
  - provenance is automatic when: publish via OIDC, public repo, public package.
  - self-hosted runners are not supported. A reusable workflow is checked by the caller's name; `id-token: write` is needed in parent and child. Up to 10 publishers per package.
- https://docs.npmjs.com/generating-provenance-statements
  - npm 9.5.0+; `repository` in package.json must be public and match the repo (case-sensitive); GitHub Actions or GitLab cloud runners; `npm publish --provenance`; first publish of a scoped package needs `--access public`.

## Method

Own clone of `v2-design` at `d36e46f9`, temp HOME and npm cache. Node v26.8.1, npm 11.19.0.
1. `node build/build.mjs --out release-out --sha <sha> --version 2.0.0`.
2. Copy `release-out` to a temp dir; add a stub `cli.mjs`; replace `package.json` with the ADR-0019 shape (name, version, `bin`, no `dependencies`, no `scripts`, `pi` key, plus `repository`, `license`, `type: module`).
3. `npm pack --json`, `npm publish --dry-run --provenance --tag next`, unpack the tarball and compare hashes with `release-out/SHA256SUMS`.
Nothing was published. No login. Real global prefix and real agent dirs untouched.

## Raw results

- Build output: 24 files, 4.5 MB (`du`), `SHA256SUMS` has 23 lines (every file except itself).
- `npm pack`: `context-mode-2.0.0.tgz`, 25 files, 911399 bytes packed, 4533139 unpacked.
- Tarball file list = the 24 build files with `package.json` replaced, plus `cli.mjs`:
  `.claude-plugin/plugin.json, SHA256SUMS, cli.mjs, copilot/plugin.json, fixtures/hook-roundtrip.json, gemini-extension.json, hook.mjs, hooks/{claude-code,codex,copilot-cli,hooks,kiro,qwen,vscode,zcode}.json, opencode/plugin.js, package.json, pi/index.js, qwen-extension.json, run.mjs, search.mjs, server.mjs, skills/ctx-{doctor,stats,upgrade}/SKILL.md`.
- Hash compare: the 22 files other than `package.json`, `cli.mjs`, `SHA256SUMS` are byte-identical to `SHA256SUMS` (`diff` empty).
- `npm publish --dry-run --provenance --tag next`: ends with `+ context-mode@2.0.0`, "Publishing ... with tag next (dry-run)". No error.

## Findings

1. **Tarball does not equal `SHA256SUMS` as built today.** Differences: (a) the build writes `package.json` with `"private": true` and no `bin`, `repository`, `license`; `npm publish` refuses a private package, so the published `package.json` must differ; (b) there is no `cli.mjs` in the build; (c) `SHA256SUMS` is not in its own list. With the ADR shape the hashes of `package.json` and `cli.mjs` are not in `SHA256SUMS`. Fix: the build emits the npm-ready `package.json` and `cli.mjs` into `release-out` before step 8 (hashing). Then tarball files = `release-out` files, and the gate is a plain compare. This also changes what the `release` branch carries (see ADR change).
2. **`bin` value.** With `"bin": {"context-mode": "./cli.mjs"}` (the ADR text), `npm publish` warned `"bin[context-mode]" script name cli.mjs was invalid and removed` and auto-corrected the manifest (npm 11.19.0). With `"cli.mjs"` (no `./`) there was no warning. Use `cli.mjs`. Add a gate: `npm pkg fix` must be a no-op (compare `npm pack --json` manifest to the file).
3. **Provenance cannot be fully proven locally.** `--provenance` outside GitHub Actions passed under `--dry-run`, but the OIDC exchange and the sigstore statement only run in a real publish in Actions. The ADR pass ("dry-run publish with provenance from `release.yml`") cannot be met without a real publish. The only way short of that is a real `next` publish by the owner flow below. This spike did not publish (rule).
4. `release.yml` already runs Node 24.15.0 and has `id-token: write` in `build` (for `attest-build-provenance`). I did not verify the npm version bundled with Node 24.15.0; the job must check `npm -v >= 11.5.1` and run `npm i -g npm@^11.5.1` if lower.
5. `ci.yml` is called as a reusable workflow, not the publish file. Publish job lives directly in `release.yml`, so the trusted publisher workflow name is `release.yml` (no reusable-workflow issue).
6. Provenance needs a public repo and `repository.url` equal to `github.com/mksglu/context-mode` (case-sensitive).

## Proposal: `release.yml` job (not applied)

```yaml
  publish-npm:
    needs: [plan, build, smoke, publish-promote]
    if: ${{ inputs.mode != 'rollback' }}
    runs-on: ubuntu-latest          # cloud runner only
    timeout-minutes: 10
    environment: npm-publish        # owner adds a required reviewer
    permissions:
      contents: read
      id-token: write               # OIDC for trusted publishing + provenance
    steps:
      - uses: actions/download-artifact@v4
        with: { name: release-out, path: release-out }
      - uses: actions/setup-node@v4
        with:
          node-version: "24.15.0"
          registry-url: "https://registry.npmjs.org"
      - name: npm must be 11.5.1 or newer
        run: |
          v="$(npm -v)"
          if [ "$(printf '%s\n11.5.1\n' "$v" | sort -V | head -1)" != "11.5.1" ]; then npm i -g npm@^11.5.1; fi
          npm -v
      - name: tarball must equal SHA256SUMS
        working-directory: release-out
        run: node ../scripts/release/check-npm-tarball.mjs   # new: npm pack, untar, compare file list and hashes, fail on any diff, fail if `npm pkg fix` changes anything
      - name: publish with provenance, dist-tag next
        working-directory: release-out
        env:
          VERSION: ${{ needs.plan.outputs.version }}
        run: npm publish --provenance --access public --tag next
```

No `NODE_AUTH_TOKEN`, no `NPM_TOKEN` secret. Never `latest` from CI. Order: after `publish-promote`, so a git tag exists before npm; npm publish is irreversible (unpublish limits), so a failure here leaves git ahead of npm and the rerun must be idempotent (skip if `npm view context-mode@$VERSION` exists).

## One-time owner steps on npmjs.com

1. Sign in as the `context-mode` package owner (2FA on).
2. Package `context-mode` > Settings > Trusted Publisher > GitHub Actions: owner `mksglu`, repository `context-mode`, workflow `release.yml`, environment `npm-publish`. Save. The first successful publish must come within 2 days.
3. Same page: set publishing access to "Require two-factor authentication and disallow tokens".
4. Revoke every old automation or granular token for the package.
5. On GitHub: create environment `npm-publish` with the owner as required reviewer.
6. After the first `next` publish: check the provenance badge on the package page and `npm view context-mode@2.0.0 dist.attestations`.
7. Moving `latest` stays a manual `npm dist-tag add context-mode@2.0.0 latest` by the owner (ADR-0019).

## Verdict against ADR-0019 pass

"a dry-run publish with provenance from release.yml on a test package": local dry-run with the ADR shape passes (25 files, 911 kB). The in-Actions OIDC and provenance part is unproven until a real publish. Result: pass=false for the full criterion; the design is supported by the docs and the dry-run.

## ADR-0019 must change

- `bin` is `cli.mjs`, not `./cli.mjs`.
- The `package.json` shape adds `repository`, `license`, `type`; drops `private`. Build emits it and `cli.mjs` before hashing, so one `SHA256SUMS` covers the tarball (the `release` branch then carries a publishable `package.json`; update the "no package.json on release" supersede note).
- Pass column for S-NPM: "real publish of a `next` pre-release by the owner flow, provenance visible", since a dry-run cannot test OIDC.
- Add the owner steps and `environment: npm-publish`; add an npm >= 11.5.1 check; make the publish step idempotent.
