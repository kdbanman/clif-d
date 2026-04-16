# Compact Archive: backpressure gates for duplication, function size, complexity, depth

**Requirements:** REQ-027
**Implementation commit:** da2b030c912b4f2e756c40fab0e0bb28788ae03b
**Lifecycle commit (PRD + plan move):** 049eb73
**Date archived:** 2026-04-16
**Source plan:** previously at `cli/clif-d/plans/executed/plan-REQ-027.md` (deleted; recover via `git log --diff-filter=D -- cli/clif-d/plans/executed/plan-REQ-027.md`)

## Summary

Added four pre-commit quality gates tuned to the post-REQ-024-refactor baseline: jscpd duplication detection (`minLines: 5`, `minTokens: 50`, `threshold: 0`, `exitCode: 1`) plus ESLint `max-lines-per-function: 115`, `complexity: 30`, `max-depth: 3`. The `threshold: 0` setting is load-bearing -- jscpd's `--threshold` is a fail-the-build duplication percentage, not a reporting threshold, so anything above zero lets same-repo clones slip through. The size/complexity/depth rules are scoped by an ESLint override matching `["clif-d.js", "**/clif-d.js"]`; the second glob lets `cli/test/backpressure-lint.test.js` and `cli/test/backpressure-dup.test.js` assert the gates by writing fixture files named `clif-d.js` into per-case directories under `cli/test/.fixtures-backpressure-*/`. Fixtures must live inside `cli/` because ESLint v9 flat-config silently ignores files outside the config base directory. Plan-deviation: although the plan said "no changes to `bin/clif-d`", turning the gates on at `threshold: 0` uncovered three pre-existing clone pairs and one depth-4 function; these were extracted into `initThreeColorState`, `buildDependencyGraph`, `commitWithCycleCheck`, `Projection.selectFields`, and `validateAcceptanceCriteria` with command-level behavior intact. Every guardrail, threshold, and relaxation is documented in `cli/clif-d/backpressure.md`.

## Acceptance criteria

- [x] A commit with a duplicated multi-line block is blocked with a message naming the duplication -- verified by `cli/test/backpressure-dup.test.js`.
- [x] A commit with a function exceeding the size threshold (115 lines) is blocked with a message naming the function -- verified by `cli/test/backpressure-lint.test.js`.
- [x] A commit with a procedure exceeding the complexity threshold (30) or depth threshold (3) is blocked -- verified by `cli/test/backpressure-lint.test.js`.
- [x] `cli/clif-d/backpressure.md` documents every new guardrail, threshold, and relaxation.

## Pointers for deep dive

- Implementation: `git show da2b030c912b4f2e756c40fab0e0bb28788ae03b` (PR kdbanman/clif-d#12)
- Lifecycle: `git show 049eb73`
- Config files: `cli/.jscpd.json`, `cli/eslint.config.js`
- Test files: `cli/test/backpressure-dup.test.js`, `cli/test/backpressure-lint.test.js`
- Backpressure reference: `cli/clif-d/backpressure.md` (sections 3-4 for thresholds and relaxations; section 8 for the practitioner quick reference)
- Lessons promoted from this plan: none survived interrogation; the jscpd-threshold and ESLint flat-config-base-path insights are already absorbed into `cli/clif-d/backpressure.md` sections 3 and 4
