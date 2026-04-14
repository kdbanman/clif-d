# Lessons Learned: REQ-008, REQ-009

**Plan:** plan-REQ-008-REQ-009.md
**Date:** 2026-04-14

## Environment issues

- **ESM vs CommonJS mismatch in tests.** The `cli/package.json` has `"type": "module"`, so test files must use ESM `import` syntax, not CommonJS `require`. The plan's test sketches used `require` -- had to convert all test code to ESM imports.

- **ESLint globals for CommonJS in ESM project.** The `eslint.config.js` had `sourceType: "commonjs"` for `clif-d.js` but did not include `require` and `module` in the globals list. ESLint v9 with flat config does not automatically inject CommonJS globals even when `sourceType: "commonjs"` is set. Added `require` and `module` to the globals.

## TypeScript strict mode friction

- **`noUncheckedIndexedAccess` requires casts for array indexing.** Every `args[i]`, `positionals[0]`, and `.at(-1)` call returns `T | undefined` under strict mode. Required JSDoc `@type` casts at each access point where the index is bounds-checked by control flow that TypeScript cannot see.

- **`process.exit()` does not narrow control flow.** TypeScript does not know that `exit(2)` is `never`. Functions that call `exit()` in catch blocks need `return exit(2)` or `return;` after the exit call to satisfy return type checking. Using `return exit(2)` was cleanest since `exit()` returns `never`.

## Test infrastructure

- **`execFileSync` does not capture stderr on exit 0.** The initial test helper used `execFileSync` which only exposes stderr via the thrown error object (non-zero exit). Switched to `spawnSync` which always captures both stdout and stderr, fixing the `--help` test that expected stderr content on a successful exit.

## Plan deviations

- The plan specified step-by-step incremental implementation across 11 steps, but the nature of the single-file CLI meant the core infrastructure (flag parsing, PRD loading, routing, field selection) was naturally written as a unit in Step 1. Steps 2-8 added tests verifying already-implemented behavior rather than implementing new code. This is fine -- the tests are the verification, and the TDD protocol was followed for Step 1 where the Red-Green cycle mattered.

- Test field order assertion adjusted: the plan's test sketch expected `[id, title, status, abstraction_level, priority]` but the schema canonical order (which the plan itself specifies as the output contract) puts priority before abstraction_level and status. Adjusted the test to match the actual schema order.
