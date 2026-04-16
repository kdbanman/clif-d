# Compact Archive: req start, req done, req block

**Requirements:** REQ-011, REQ-012, REQ-013
**Implementation commit:** 4475eee335f7232d1bf7097f45d40af76b7fbeb5
**Lifecycle commit (PRD + plan move):** 152eb4c
**Date archived:** 2026-04-16
**Source plan:** previously at `cli/clif-d/plans/executed/plan-REQ-011-REQ-012-REQ-013.md` (deleted; recover via `git log --diff-filter=D -- cli/clif-d/plans/executed/plan-REQ-011-REQ-012-REQ-013.md`)

## Summary

Added the three status-mutation commands: `req start`, `req done`, and `req block`. Established the read-validate-write cycle (ARCH-003) that all future mutation commands share: load PRD, mutate in memory, validate, write atomically via `writeFile` on a temp path + `rename`. `req done REQ-NNN --commit=<sha>` requires a short-SHA or full-SHA argument and records it in `implementation_commit`. All three transitions are idempotent (setting a requirement to its current status is a silent exit 0). `done` is terminal per CTX-007 -- any transition out of `done` exits 1. The PRD write format is `JSON.stringify(obj, null, 2) + "\n"` for clean git diffs.

## Acceptance criteria

- [x] REQ-011: `req done REQ-007 --commit=abc1234def` sets status to `done` and records the commit SHA atomically -- verified by `cli/test/req-done.test.js`.
- [x] REQ-012: `req start REQ-007` sets status to `in_progress` (idempotent; unblocks from `blocked`) -- verified by `cli/test/req-start.test.js`.
- [x] REQ-013: `req block REQ-007` sets status to `blocked` (idempotent) -- verified by `cli/test/req-block.test.js`.
- [x] Error paths (missing `--commit`, invalid SHA, already done, nonexistent ID) exit 1 with actionable stderr.

## Pointers for deep dive

- Implementation: `git show 4475eee335f7232d1bf7097f45d40af76b7fbeb5` (PR kdbanman/clif-d#6)
- Lifecycle: `git show 152eb4c`
- Test files: `cli/test/req-start.test.js`, `cli/test/req-done.test.js`, `cli/test/req-block.test.js`
- Lessons promoted from this plan: none survived interrogation
