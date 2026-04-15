# Lessons Learned: REQ-024 / REQ-026 / REQ-028 / REQ-029

**Implementation commit:** c7b115dd7ee73be2a191db54dd9e5c60fa438f7e
**Plan:** `cli/clif-d/plans/executed/plan-REQ-024-REQ-026-REQ-028-REQ-029.md`

## Summary

Ten-step refactor went smoothly overall. Most steps were straightforward Red-Green-Refactor. A few points worth recording:

## Plan deviation: REQ-029 semantic shift for `req next` dangling-dep test

The plan's Step 8 verify section said "if any test relied on a subtly-invalid fixture, fix the fixture, not the validator." One existing test in `cli/test/req-next.test.js` was titled "treats dangling dependency ID as unmet" -- it asserted that `req next` would simply skip a requirement whose dependency pointed to a nonexistent REQ-ID and pick a different one. Under REQ-029 (structural validation on every load), that behavior is no longer correct: a dangling dependency is a structural error that halts the command with exit 1.

The test's *semantic intent* (tolerance for dangling refs) was what REQ-029 explicitly invalidates, so "fix the fixture" did not apply. I rewrote the test to assert the new contract (exit 1 + `/Dangling dependency/` substring) and renamed it to reference REQ-029. This was a real behavior change, not a fixture tidy-up, and deserved the rename.

## Decision: strict flag validation requires per-command known-flags specs

Step 9 of the plan asked for unknown-flag and empty-flag-value handling to exit 2. `parseFlags` has no command context, so I introduced a `COMMAND_FLAG_SPECS` table and a small `enforceKnownFlags(flags, allowed, commandLabel)` helper called in the main dispatcher after the help short-circuit. Duplicate-flag policy was documented as last-wins (current `Map.set` semantics in `parseFlags`).

This also let the dispatcher collapse ten near-identical `if (--help) printXxxHelp(); exit(0);` blocks into a single `writeHelp(commandLabel)` call, which partially overlapped with Step 10's duplication review.

## Refactor: `requireReqIdPositional` helper

Step 10 flagged five handlers (reqShow/reqStart/reqDone/reqBlock/reqEdit) that shared a five-line "missing REQ-ID argument" block with identical error text. Lifted to a single helper. Kept the different `Usage:` strings since each command has distinct usage.

## ESLint `curly` rule on one-liner returns

Twice during the refactor I wrote `if (x) return "";` inside Sort.byPriority / Format.toPlain and hit an ESLint `curly` violation. Rule is strict: any `if` body must be braced. Fixed both by expanding to block form.

## TypeScript narrowing with `HELP_SPECS[key]`

`HELP_SPECS[key]` has type `HelpSpec | undefined` because the key parameter is a `string`. `writeHelp` uses a `/** @type {HelpSpec} */` cast since the caller contract is that `key` is always a valid entry. Clear precedent for this style is already in the file (e.g. `positionals[0]`).

## No other surprises

Test-export seam (Step 1) worked first try. `CLIF_D_TEST_EXPORTS` + `require.main === module` is a clean pattern for CJS -- ESM tests in `cli/` use `createRequire(import.meta.url)` with the `cli/clif-d.js -> ../bin/clif-d` symlink. Test suite grew from 58 to 215 tests, all green at every step.
