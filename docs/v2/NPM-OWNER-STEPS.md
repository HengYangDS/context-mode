# npm owner steps for context-mode v2

ADR-0019 D2. Source: `docs/v2/spikes/setup/S-NPM.md`. Only the package owner can do steps 1 to 3. CI never uses a token.

## 1. Trusted publisher on npmjs.com (once)

1. Sign in to npmjs.com as the owner of `context-mode`.
2. Open the package, then Settings, then Trusted Publisher.
3. Pick GitHub Actions and enter:
   - Organization or user: `mksglu`
   - Repository: `context-mode`
   - Workflow filename: `release.yml` (file name only, with `.yml`)
   - Environment: `npm-publish`
4. Under Publishing access pick "Require two-factor authentication and disallow tokens".
5. Revoke old automation tokens.

The package must see a first successful publish within 2 days of this step, or the config expires.

## 2. GitHub environment (once)

Repo Settings, Environments, New environment `npm-publish`. Add the owner as required reviewer. No secrets.

## 3. Publish next

1. Actions, workflow `release`, Run workflow. Set `publish` to true. (A pushed `v2.*` tag also starts the job.)
2. Approve the `npm-publish` environment when asked.
3. The job checks that the tarball equals `SHA256SUMS`, then runs `npm publish --provenance --access public --tag next`.
4. Check:

```sh
npm view context-mode@2.0.0 dist.attestations
npm view context-mode dist-tags
```

`next` must be 2.0.0. `latest` must still be the v1 version. This first publish closes S-NPM.

## 4. Test

```sh
npm i -g context-mode@next && context-mode setup
context-mode doctor
```

## 5. Move latest (owner only, by hand)

Do this only after the preview is good. A local login with two-factor is needed:

```sh
npm dist-tag add context-mode@2.0.0 latest
```

Undo: `npm dist-tag add context-mode@<v1 version> latest`. Then change the README install section.
