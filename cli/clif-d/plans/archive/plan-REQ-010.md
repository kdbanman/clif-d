# Compact Archive: req next

**Requirements:** REQ-010
**Implementation commit:** bd465f0817f2d4c0add53337e69ab3d37849521b
**Lifecycle commit (PRD + plan move):** 3bfecd1
**Date archived:** 2026-04-16
**Source plan:** previously at `cli/clif-d/plans/executed/plan-REQ-010.md` (deleted; recover via `git log --diff-filter=D -- cli/clif-d/plans/executed/plan-REQ-010.md`)

## Summary

Added the `req next` command. Returns the highest-priority `not_started` requirement whose dependencies are all `done`, as a full requirement JSON object on stdout. Replaces the multi-step scan-and-check procedure that `plan-requirement` used to run manually. Tie-breaking is PRD insertion order (stable across invocations). Dangling dependency IDs are treated as unmet rather than errors -- `req next` is a query, not a validator. Exit 1 when no eligible requirement exists (all done, all blocked, empty requirements array). Exit 2 on missing or unparseable PRD.

## Acceptance criteria

- [x] REQ-010: With REQ-001 done and REQ-002 (pri 1, deps [REQ-001]) + REQ-003 (pri 2, no deps) both `not_started`, `clif-d req next` returns the full REQ-002 JSON object, exit 0 -- verified by `cli/test/req-next.test.js`.
- [x] Exit 1 when no requirement is eligible -- verified by `cli/test/req-next.test.js`.
- [x] Exit 2 when PRD is missing or unparseable -- covered by shared `loadPrd` tests.

## Pointers for deep dive

- Implementation: `git show bd465f0817f2d4c0add53337e69ab3d37849521b` (PR kdbanman/clif-d#5)
- Lifecycle: `git show 3bfecd1`
- Test file: `cli/test/req-next.test.js`
- Lessons promoted from this plan: none survived interrogation
