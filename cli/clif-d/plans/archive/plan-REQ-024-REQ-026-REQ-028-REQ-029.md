# Compact Archive: modularity refactor, validate-on-load, error-path coverage

**Requirements:** REQ-024, REQ-026, REQ-028, REQ-029
**Implementation commit:** c7b115dd7ee73be2a191db54dd9e5c60fa438f7e
**Lifecycle commit (PRD + plan move):** 5ccee5b
**Date archived:** 2026-04-16
**Source plan:** previously at `cli/clif-d/plans/executed/plan-REQ-024-REQ-026-REQ-028-REQ-029.md` (deleted; recover via `git log --diff-filter=D -- cli/clif-d/plans/executed/plan-REQ-024-REQ-026-REQ-028-REQ-029.md`)

## Summary

Ten-step refactor that reshaped `bin/clif-d` around frozen namespace objects (`Flags`, `Prd`, `Projection`, `Sort`, `Filter`, `Format`, `Validation`, etc.) per ARCH-004, added a `CLIF_D_TEST_EXPORTS=1` env-var seam so pure helpers can be unit-tested directly (ARCH-005), wired the `Validation` namespace from REQ-014 into `loadPrd` so every command refuses to operate on a structurally invalid PRD, and expanded the test suite from 58 to 215 tests covering every documented nonzero exit path. Introduced `COMMAND_FLAG_SPECS` as a per-command allow-list and `enforceKnownFlags` to reject unknown flags with exit 2. Plan-deviation note: an existing `req next` test titled "treats dangling dependency ID as unmet" was rewritten rather than fixture-patched, because REQ-029's validate-on-load explicitly invalidates the behavior that test asserted. The mutation half of the read-validate-write cycle now refuses to write a PRD that fails structural validation -- on a pre-mutation failure, the file is unchanged byte-for-byte.

## Acceptance criteria

- [x] REQ-024: Shared operations live in reusable helpers; long procedures decomposed; pure logic exercisable without subprocess -- verified by every `cli/test/internals-*.test.js` file.
- [x] REQ-026: Helpers grouped into frozen namespace objects; test-export seam under `CLIF_D_TEST_EXPORTS` env var -- verified by `cli/test/internals.test.js` and all direct-import tests.
- [x] REQ-028: Every documented nonzero exit code reached by at least one test; malformed JSON, missing file, empty flag values, duplicate flags, unknown flags, cycles, dangling refs, duplicate IDs all covered -- verified by `cli/test/errors.test.js` and `cli/test/internals-validation.test.js`.
- [x] REQ-029: Structural validation runs on every load; mutations refuse to write on a structurally invalid PRD; file unchanged -- verified by `cli/test/load-validation.test.js` (before/after byte comparison).

## Pointers for deep dive

- Implementation: `git show c7b115dd7ee73be2a191db54dd9e5c60fa438f7e` (PR kdbanman/clif-d#11)
- Lifecycle: `git show 5ccee5b`
- Test files: `cli/test/internals.test.js`, `cli/test/internals-lookup.test.js`, `cli/test/internals-lifecycle.test.js`, `cli/test/internals-ls.test.js`, `cli/test/internals-next.test.js`, `cli/test/internals-help.test.js`, `cli/test/internals-validation.test.js`, `cli/test/load-validation.test.js`, `cli/test/errors.test.js`
- Lessons promoted from this plan: none survived interrogation (see README TODOs for derived improvements)
