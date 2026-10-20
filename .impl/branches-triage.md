# Old impl branches triage (v2-design, 2026-10-20)

Merged (no-ff):
- impl/install-opencode: removed a stale "Verified" table that says no v2 build exists. Still true on v2-design.
- impl/install-pi: same change for pi.md (conflict in the same block; resolved by taking the removal).
- impl/install-zcode: same change for zcode.md.

Partly ported by hand (not merged):
- impl/M5-M5-T1: goldens, registry test, and 4 of 6 GP11 cases already exist on v2-design in a later form (a merge would revert them). Ported the 2 missing cases, codex-hooks-default-true and pi-detect-npm-managed-install, to e2e/cases/GP11-doctor-upgrade.e2e.mjs. GP11 now 13/13 pass. Its upgrade-change-table golden is superseded by the real ctx_upgrade reply.

Obsolete:
- impl/M3-M3-C0: M3 policy constants and parser types (MAX_NEST_DEPTH, READ_DENY_MESSAGE, DENY_*, BOUNDED_*, JQ_WHITELIST, Token, SimpleCommand, ParseErrorConstruct) already exist on v2-design in src/core/contracts.
- impl/M3-M3-K1: scripts/gate.mjs now runs tsc before keep-pass, so the zod3tov4 build fix is not needed; keep-pass is 131/131 green. Its codex README drift note is outside this task.

Remote branches were not deleted.
