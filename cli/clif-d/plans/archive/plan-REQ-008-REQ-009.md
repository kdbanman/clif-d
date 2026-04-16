# Compact Archive: req ls and req show (core infrastructure)

**Requirements:** REQ-008, REQ-009
**Implementation commit:** eae67755fe92851a19cf3d8586ba4a4155d7ae33
**Lifecycle commit (PRD + plan move):** 2fb0a90
**Date archived:** 2026-04-16
**Source plan:** previously at `cli/clif-d/plans/executed/plan-REQ-008-REQ-009.md` (deleted; recover via `git log --diff-filter=D -- cli/clif-d/plans/executed/plan-REQ-008-REQ-009.md`)

## Summary

First implementation plan. Replaced the stub at `bin/clif-d` with the core infrastructure that every subsequent command reuses: `loadPrd`, `resolvePrdPath`, a two-level `<domain> <verb>` router, `parseFlags`, and `selectFields` with a canonical schema field order. Shipped `req ls` (filter by `--status`, `--abstraction`, sort by `--priority`, select via `--fields` / `--deps`, switch between `--json` and `--plain`) and `req show REQ-ID` (full requirement object by ID). Test infrastructure was extracted into `cli/test/helpers.js` (the `run()` subprocess helper and `withFixture()` temp-PRD builder) and seeded `cli/test/req-ls.test.js` and `cli/test/req-show.test.js`. Error paths return exit 1 (unknown ID) or exit 2 (PRD not found / unparseable / usage error) per CTX-005.

## Acceptance criteria

- [x] REQ-008: `req ls --status=not_started --abstraction=low` returns a JSON array of matching requirements with default fields (exit 0; `[]` when no matches) -- verified by `cli/test/req-ls.test.js`.
- [x] REQ-009: `req show REQ-007` returns the full requirement object (exit 0); unknown ID exits 1 -- verified by `cli/test/req-show.test.js`.

## Pointers for deep dive

- Implementation: `git show eae67755fe92851a19cf3d8586ba4a4155d7ae33` (PR kdbanman/clif-d#3)
- Lifecycle: `git show 2fb0a90` (PRD status updates, plan move to `executed/`)
- Test files: `cli/test/req-ls.test.js`, `cli/test/req-show.test.js`, `cli/test/helpers.js`
- Lessons promoted from this plan: see `cli/clif-d/lessons.md` entry "TypeScript `noUncheckedIndexedAccess` and `process.exit` narrowing" (2026-04-16)
