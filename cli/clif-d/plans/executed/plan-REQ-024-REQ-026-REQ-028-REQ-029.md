# Implementation Plan: Internal modularity refactor, structural validation on load, error-path coverage

**Requirements:** REQ-024 (high-level NFR), REQ-026, REQ-028, REQ-029
**PRD:** `cli-prd.json`
**Backpressure:** `cli/clif-d/backpressure.md`
**Preceding plans:**
- `cli/clif-d/plans/executed/plan-REQ-008-REQ-009.md` -- established arg parsing, PRD loading, routing, JSON output.
- `cli/clif-d/plans/executed/plan-REQ-010.md` -- `req next` with priority/dependency logic.
- `cli/clif-d/plans/executed/plan-REQ-011-REQ-012-REQ-013.md` -- status mutation commands and the read-validate-write cycle.

**Date:** 2026-04-14
**Status:** Executed
**Implementation commit:** c7b115dd7ee73be2a191db54dd9e5c60fa438f7e

## 1. Objective

Restructure `bin/clif-d` so that shared logic lives in named, frozen namespace objects (module-object pattern per ARCH-004), expose those namespaces under a test-mode guard so pure helpers can be unit-tested directly (ARCH-005), run full structural validation of the PRD on every read/mutation (REQ-029 / ARCH-003), and extend the test suite to cover every documented error path (REQ-028). When complete, the CLI is organized around reusable helpers instead of duplicated handler bodies, every command refuses to operate on a structurally invalid PRD with a specific diagnostic, and every documented nonzero exit code is reached by at least one test.

## 2. Context Summary

### REQ-024 -- Internal modularity and code-reuse quality (high-level NFR)

Shared operations (lookup-by-ID, status-transition validation, field projection, filtering, output formatting) must be implemented once and invoked by all callers. Long procedures that mix filtering, sorting, projection, and output must be decomposed into focused units. Pure logic must be separated from I/O so it can be exercised without subprocess invocation.

### REQ-026 -- Reorganize CLI around module-object helpers with test-export seam

**Acceptance criteria (Given-When-Then):**
- **Given:** The CLI currently contains multiple command handlers that duplicate lookup, validation, filtering, and formatting logic, and exposes nothing for direct unit testing.
- **When:** The refactor is complete.
- **Then:** Shared helpers are grouped into frozen namespace objects inside `bin/clif-d`; no multi-step logic appears inline in more than one handler; handlers are short compositions over helpers; under a documented test-mode environment variable the file exports its namespaces so a test in `cli/test/` can import and call helpers directly; every existing subprocess-level test still passes without modification.

### REQ-028 -- Error-path and boundary-case test coverage

**Acceptance criteria (Given-When-Then):**
- **Given:** The current test suite covers happy paths and basic exit codes but not all error paths.
- **When:** The coverage extension is complete.
- **Then:** For every command, each documented nonzero exit code has at least one test that triggers it. Tests exist for: malformed JSON input, missing PRD file, unreadable PRD file, empty flag values, duplicate flags, unknown flags, dependency cycles, dangling cross-references, and duplicate IDs. Each test asserts both the exit code and a stable, informative stderr substring.

### REQ-029 -- Structural validation on every PRD load

**Acceptance criteria (Given-When-Then):**
- **Given:** A PRD file containing a dependency cycle, a dangling dependency reference, or a duplicate ID.
- **When:** The agent runs any command that loads that PRD (ls, show, next, start, done, block, or any future command).
- **Then:** The command exits with code 1 and stderr identifies the specific invariant that failed. The command does not produce partial stdout output and does not modify the PRD. A test fixture exists for each invariant, exercised against at least one read command and one mutation command.

Depends on REQ-014 (the `validate` command). REQ-014 is not yet implemented but the validation *logic* -- the same checks REQ-014 will run -- is what this plan introduces; REQ-014 can later be implemented as a thin wrapper that invokes those helpers and reports instead of exiting.

### Relevant architecture

- **ARCH-003 -- Read-validate-write cycle:** Every mutation reads, parses, validates the resulting PRD (schema + domain rules including referential integrity, acyclicity, status transitions), then atomically writes. This plan extends validation to cover the *input* side too: the PRD must be valid *before* any command operates on it, not only after a proposed mutation.
- **ARCH-004 -- Module-object internal structure:** Related pure helpers grouped into named frozen namespace objects. Command handlers become thin orchestrators. Example shape (illustrative, not prescriptive):
  ```js
  const Filters = Object.freeze({
    byStatus(reqs, statuses) { ... },
    byAbstraction(reqs, level) { ... },
  });
  ```
- **ARCH-005 -- Pure-helper testability seam:** An env-guarded export at the bottom of the file, e.g.
  ```js
  if (process.env.CLIF_D_TEST_EXPORTS) {
    module.exports = { Filters, Lifecycle, Validation, ... };
  }
  ```
  Production is untouched; tests set the env var before requiring the file.

### Relevant context

- **CTX-002:** Single-file distribution. The refactor must not introduce additional files in `bin/`.
- **CTX-010:** All guardrails must pass.
- **CTX-012:** Internal modularity discipline. The single-file constraint is not a license for a single flat script.
- **CTX-003:** PRD schema at `skills/create-initial-prd/assets/prd-schema.json` is the schema-conformance oracle.
- **CTX-008:** Dependencies must form a DAG. Acyclicity is a hard invariant.

### Known areas of duplication and god-functions in the current file

Identified during the quality review that motivated these requirements. Use as a starting map; search exhaustively during implementation:
- The "requirement not found" block appears across `req start`, `req done`, `req block`, `req show` -- candidate for a single `findRequirementOrExit(prd, reqId)` helper in a `Lookup` namespace.
- `req ls` mixes filter / sort / field-projection / output formatting -- decompose into a `Filters` namespace, a `Projection` namespace, and a `Format` namespace.
- `req next` priority tiebreaker -- extract a pure `selectBestCandidate(eligible)` helper with the priority-undefined-last rule documented in JSDoc.
- Status transition preconditions are repeated across start/done/block -- extract into a `Lifecycle` namespace (`canStart`, `canComplete`, `canBlock`).
- Seven near-identical help-text printers -- collapse into a single builder.

### Error handling conventions

- Exit 0 = success. Exit 1 = logic/validation error. Exit 2 = usage error or unreadable/unparseable PRD.
- Data on stdout (JSON by default). Errors on stderr.
- `process.exit()` is permitted (CTX-005, see backpressure.md Relaxations).
- Structural validation failures on load (new in this plan) exit 1 (logic error -- the PRD is bad, not the invocation).

### Quality guardrails (run from `cli/`)

- `npm run check` -- aggregate (format:check, lint, typecheck, test). Must pass before commit.
- `npm run format` -- Prettier write. Run manually if format:check fails.
- Pre-commit hook runs `npm run check` automatically via husky.

### Preceding implementation summary

`bin/clif-d` currently contains: flag parser, PRD loader (JSON parse only), section dividers delineating handlers, atomic writer (temp + rename), per-command handlers for `req ls`, `req show`, `req next`, `req start`, `req done`, `req block`, and per-command help printers. All checks (Prettier, ESLint, tsc checkJs, node:test) pass at HEAD. 58 tests in `cli/test/` covering happy paths and basic exit codes using a `run()` subprocess helper and `withFixture()` PRD fixture helper.

## 3. Prerequisites

- REQ-008 through REQ-013 implemented (done).
- `cli/test/` harness with `run()` and `withFixture()` exists and is used by all current tests.
- Backpressure toolchain (Prettier, ESLint, tsc, node:test, husky) operational.
- No new npm dependencies are required for this plan. (REQ-027 is a separate plan that adds tooling-level gates.)

## 4. Implementation Steps

The ordering is: (A) introduce the test-export seam and one namespace as a proof-of-concept, so subsequent refactors can be verified with fast direct tests; (B) migrate handlers to namespaces one logical group at a time, each with its own pure-helper tests; (C) add structural validation on load, reusing the validation namespace built in (B); (D) fill error-path coverage.

Each step must leave the suite green. Do not proceed to step N+1 with a red bar.

### Step 1: Introduce the test-export seam

**Test first:**
- File: `cli/test/internals.test.js` (new).
- Description: With `CLIF_D_TEST_EXPORTS=1`, `require('../clif-d.js')` returns an object. Without the env var, requiring the file should not crash but should not export anything meaningful (the existing subprocess tests already prove production behavior). For this step, the exported object only needs a sentinel (e.g. `__testMode: true`) until real namespaces are added.
- Test shape: spawn a child `node` with env set, have it `require` the symlink and print `Object.keys(require(...))` to stdout, assert the sentinel is present.

**Implement:**
- File: `bin/clif-d`.
- Add at the very bottom (after all current code): `if (process.env.CLIF_D_TEST_EXPORTS) module.exports = { __testMode: true };`.
- Guard the CLI dispatch so it only runs when invoked as a script, not when required as a module -- standard `if (require.main === module) { ... }` pattern, or equivalent. This is the only structural change to the production path; verify every existing subprocess test still passes.

**Verify:**
- `cd cli && npm test` -- 58 existing tests plus the new one pass.
- `npm run check` passes.

### Step 2: Extract and test the `Lookup` namespace

**Test first:**
- File: `cli/test/internals-lookup.test.js` (new).
- Description: Direct unit tests for `Lookup.findRequirement(prd, reqId)` returning the requirement, and `Lookup.findRequirementOrExit(prd, reqId, exitFn)` invoking `exitFn` with exit code 1 and writing a stable message to stderr when missing.
- Use a passed-in `exitFn` and a stderr-capture buffer to keep the helper pure-ish and testable without touching real `process.exit`.

**Implement:**
- File: `bin/clif-d`.
- Create a frozen `Lookup` namespace near the top of the logic sections.
- Migrate every handler that currently has an inline "find requirement or error" block to call `Lookup.findRequirementOrExit`. Grep for the canonical "not found" message string to locate all sites; expect to find them in `req show`, `req start`, `req done`, `req block` at minimum.
- Add `Lookup` to the test-mode export.

**Verify:**
- All existing subprocess tests still pass unchanged.
- New direct tests pass.
- `npm run check` passes.

### Step 3: Extract and test the `Lifecycle` namespace

**Test first:**
- File: `cli/test/internals-lifecycle.test.js` (new).
- Description: Pure tests for transition predicates (`canStart`, `canComplete`, `canBlock`) covering every combination of current status (absent, `not_started`, `in_progress`, `done`, `blocked`) against each target transition. Each returns either `{ ok: true }` or `{ ok: false, reason: "<stable message>" }`.

**Implement:**
- File: `bin/clif-d`.
- Create a frozen `Lifecycle` namespace containing the transition predicates and a single `applyTransition(req, target, extras)` that mutates in place (or returns a new req) after checking.
- Rewrite `req start`, `req done`, `req block` handlers to call the namespace. All existing subprocess tests (lifecycle happy paths, idempotency, rejection of invalid transitions) must continue to pass with no changes.
- Export `Lifecycle` under the test-mode seam.

**Verify:** as above.

### Step 4: Extract and test the `Filters`, `Projection`, `Format` namespaces, and decompose `req ls`

**Test first:**
- File: `cli/test/internals-ls.test.js` (new).
- Unit tests for:
  - `Filters.byStatus(reqs, statuses)` -- including the "absent status treated as not_started" rule.
  - `Filters.byAbstraction(reqs, level)`.
  - `Projection.selectFields(req, fields)` -- including default field set.
  - `Format.toPlain(reqs)` -- stable tabular output shape.
  - A `Sort.byPriority(reqs)` helper that places undefined-priority last.

**Implement:**
- File: `bin/clif-d`.
- Create the four frozen namespaces.
- Rewrite the `req ls` handler as a thin composition: parse flags -> `Filters.byStatus` -> `Filters.byAbstraction` -> `Sort.byPriority` (if requested) -> `Projection.selectFields` -> format (`Format.toPlain` or JSON) -> stdout.
- All existing `req ls` subprocess tests must pass without modification.

**Verify:** as above.

### Step 5: Extract and test `selectBestCandidate` for `req next`

**Test first:**
- File: extend `cli/test/internals-ls.test.js` or new `internals-next.test.js`.
- Description: Direct unit tests for `selectBestCandidate(eligibleReqs)` covering: single candidate, multiple candidates with clear priority, tie with one undefined priority, all undefined priorities (stable by insertion order), empty input (returns null/undefined per contract, documented).

**Implement:**
- File: `bin/clif-d`.
- Extract `selectBestCandidate` from the current `req next` handler. Document the tiebreaker rule in a JSDoc block.
- Rewrite `req next` to: load PRD -> filter eligible (not done, not blocked, all deps done) -> `selectBestCandidate` -> output or exit 1.
- Export under the test seam.

**Verify:** existing `req next` tests pass unchanged.

### Step 6: Collapse help-text printers

**Test first:**
- File: `cli/test/internals-help.test.js` (new).
- Description: `Help.renderCommand({ usage, description, flags, exitCodes })` produces the expected shape. Test one representative command's full rendering.

**Implement:**
- File: `bin/clif-d`.
- Replace the ~7 per-command help-text functions with data (one record per command) plus a single renderer. Subprocess tests that assert on help-text substrings should still pass; if any do not, adjust the help data, not the tests.

**Verify:** as above.

### Step 7: Introduce the `Validation` namespace (structural invariants)

**Test first:**
- File: `cli/test/internals-validation.test.js` (new).
- Description: Direct unit tests for each invariant checker. Each returns a list of issues: `[]` when valid, one or more `{ level, id, message }` objects when not. Cover:
  - `Validation.schemaConformance(prd)` -- structural shape (required fields on requirements, context, architecture).
  - `Validation.uniqueIds(prd)` -- duplicate REQ/CTX/ARCH IDs flagged.
  - `Validation.referentialIntegrity(prd)` -- every `dependencies`, `context_refs`, `architecture_refs` entry resolves.
  - `Validation.acyclicDependencies(prd)` -- cycle detection returns the cycle path.
  - `Validation.statusCommitConsistency(prd)` -- status `done` requires `implementation_commit`.
- Fixture strategy: build small in-memory PRDs; do not write to disk for these tests.

**Implement:**
- File: `bin/clif-d`.
- Create the `Validation` namespace. Prefer one function per invariant for testability, plus `Validation.all(prd)` that aggregates issues from all checkers.
- Do NOT yet wire into the load path -- that's step 8. This step just builds and tests the helpers.

**Verify:** npm run check passes.

### Step 8: Wire `Validation.all` into the PRD load path (REQ-029)

**Test first:**
- File: `cli/test/load-validation.test.js` (new).
- Description: Subprocess-level tests verifying that every read and mutation command, invoked against a corrupt PRD, exits 1 with a stderr substring identifying the invariant. Cover:
  - Duplicate IDs: `req ls`, `req show`, `req start <valid-id>`, `req done <valid-id> --commit=...` all exit 1.
  - Dependency cycle: same set exit 1 with "cycle" substring in stderr.
  - Dangling dependency reference: same set exit 1.
  - Missing required field on a requirement (schema violation): same set exit 1.
  - For mutations specifically: assert the PRD file on disk is unchanged (compare before/after bytes).

**Implement:**
- File: `bin/clif-d`.
- Modify the PRD loader so that after JSON.parse succeeds, it calls `Validation.all(prd)`. If the result has any `level: "error"` issues, emit a diagnostic to stderr and exit 1.
- Diagnostic format: one line per error, prefixed with the invariant name and the offending ID when known. Keep the format stable enough for tests to match substrings.
- Leave a future-compatible door for `validate` (REQ-014) to suppress the hard-exit and instead print the issue list; a boolean flag on the loader or a separate entry point.

**Verify:**
- New load-validation tests pass.
- All existing tests pass -- existing fixtures must already be structurally valid; if any test relied on a subtly-invalid fixture, fix the fixture, not the validator.
- `npm run check` passes.

### Step 9: Error-path coverage for commands (REQ-028)

**Test first and implement (these are test-only additions; no production code changes unless a gap is found):**
- File: `cli/test/errors.test.js` (new) or extend per-command test files.
- For each existing command, add one test per documented nonzero exit code not yet covered:
  - Missing PRD file (exit 2).
  - Unreadable PRD file (mode 000 fixture; skip on Windows if needed -- not applicable here).
  - Malformed JSON (exit 2).
  - Unknown flag (exit 2).
  - Empty flag value, e.g. `--status=` (exit 2).
  - Duplicate flag, e.g. `--status=a --status=b` -- document the chosen policy (first-wins or error) and test it.
- If any of these exit with the wrong code or a silent failure, fix the handler. Each test must assert both the exit code and a stable stderr substring.

**Verify:** every documented nonzero exit code for every command is now reached by at least one test. `npm run check` passes.

### Step 10: Final pass -- duplication and function-size review

**Implement:**
- Re-read `bin/clif-d` top to bottom. Flag any remaining multi-step block that appears in more than one handler and lift it into an existing or new namespace.
- Flag any function still mixing multiple concerns (filter + sort + format, or parse + validate + apply) and decompose.
- No new tests required unless new helpers are introduced; in that case add direct tests under the existing conventions.

**Verify:** `npm run check` passes. The file reads as "handlers compose namespaces" rather than "handlers contain logic."

## 5. Acceptance Criteria Verification

- [ ] **REQ-024:** Shared operations implemented once and invoked by all callers -- verified by Steps 2-6 plus Step 10 review; no inline duplication remains.
- [ ] **REQ-024:** Long procedures decomposed into focused units -- verified by Steps 4 (ls) and 5 (next).
- [ ] **REQ-024:** Pure logic separated from I/O and exercisable without subprocess -- verified by every `internals-*.test.js` file (Steps 1-7).
- [ ] **REQ-026:** Shared helpers grouped into frozen namespace objects -- verified by presence of `Object.freeze(...)` namespaces and direct tests that import them.
- [ ] **REQ-026:** Test-export seam under an env var -- verified by Step 1 sentinel test and every subsequent direct test.
- [ ] **REQ-026:** Existing subprocess tests pass unchanged -- verified after each step.
- [ ] **REQ-028:** Every documented nonzero exit code reached by at least one test -- verified by Step 9.
- [ ] **REQ-028:** Tests exist for malformed JSON, missing file, empty flag values, duplicate flags, unknown flags, dependency cycles, dangling references, duplicate IDs -- verified by Step 8 (invariants) and Step 9 (IO and flag errors).
- [ ] **REQ-029:** Structural validation runs on every load -- verified by Step 8 load-validation tests against every existing command.
- [ ] **REQ-029:** Mutations refuse to operate on a structurally invalid PRD; file unchanged -- verified by Step 8 before/after byte comparison.

## 6. Files Created or Modified

| File | Action | Step |
|------|--------|------|
| `bin/clif-d` | Modify (refactor, no feature change; add test-export seam; add validation-on-load) | 1-10 |
| `cli/test/internals.test.js` | Create | 1 |
| `cli/test/internals-lookup.test.js` | Create | 2 |
| `cli/test/internals-lifecycle.test.js` | Create | 3 |
| `cli/test/internals-ls.test.js` | Create | 4 |
| `cli/test/internals-next.test.js` | Create (or extend internals-ls.test.js) | 5 |
| `cli/test/internals-help.test.js` | Create | 6 |
| `cli/test/internals-validation.test.js` | Create | 7 |
| `cli/test/load-validation.test.js` | Create | 8 |
| `cli/test/errors.test.js` | Create (or extend per-command tests) | 9 |

No changes to `cli/package.json`, `cli/eslint.config.js`, `cli/tsconfig.json`, `cli/.husky/`, or any skill files. No changes to `cli-prd.json`.

## 7. Open Questions and Assumptions

- **Assumption (documented policy, set in Step 9):** Duplicate-flag policy is "last wins" unless the implementer finds existing behavior is "first wins"; either is acceptable provided the test matches the actual behavior and the CLI help text reflects the chosen convention.
- **Assumption:** The test-mode env var is named `CLIF_D_TEST_EXPORTS`. If the implementer prefers a different name, it is fine provided it is documented in a comment near the export guard.
- **Assumption:** Structural validation failures on load exit 1 (logic error), not 2. Rationale: the PRD is the thing that is wrong, and 2 is reserved for unreadable/unparseable files; a valid-JSON-but-structurally-broken PRD is a logic-level problem. Revisit only if the wider CLI contract disagrees.
- **Open question (minor):** REQ-014 (the explicit `validate` command) is not in this plan, but Step 7's `Validation` namespace is exactly what REQ-014 will wrap. The plan intentionally leaves a hook (non-hard-exit mode) on the loader so REQ-014's plan can reuse it without further refactoring.
