# Compact Archive: req add, req edit, req dep add/rm

**Requirements:** REQ-015, REQ-016, REQ-017
**Implementation commit:** 08e665e
**Lifecycle commit (PRD + plan move):** da511ad
**Date archived:** 2026-04-16
**Source plan:** previously at `cli/clif-d/plans/executed/plan-REQ-015-REQ-016-REQ-017.md` (deleted; recover via `git log --diff-filter=D -- cli/clif-d/plans/executed/plan-REQ-015-REQ-016-REQ-017.md`)

## Summary

Added the remaining mutation commands that skills need to build and refine the PRD programmatically: `req add` (stdin-piped requirement JSON, auto-assigned REQ-ID), `req edit REQ-ID` (stdin-piped field subset, replace semantics), `req dep add REQ-ID DEP-ID`, and `req dep rm REQ-ID DEP-ID`. All mutations share the read-validate-write cycle from the status-mutation plan and run the full validator (including acyclicity) before writing. `req add` auto-assigns the next REQ-ID via `nextReqId`, validates the incoming object against the schema, and rejects `status: "done"` without an `implementation_commit`. `req edit` uses replace semantics on every field (including arrays) -- incremental dependency edits go through `req dep add/rm`. `req dep add` refuses edges that would introduce a cycle or a self-loop; `req dep rm` tolerates orphaned DEP-IDs so it can clean up references to deleted requirements.

## Acceptance criteria

- [x] REQ-015: Piping a valid requirement body without `id` to `req add` appends a new requirement with the next REQ-NNN id, validates refs and cycles, and returns the full object -- verified by `cli/test/req-add.test.js`.
- [x] REQ-016: Piping `{"architecture_refs": ["ARCH-001", "ARCH-002"]}` to `req edit REQ-003` replaces that field, leaves others intact, returns the full updated requirement -- verified by `cli/test/req-edit.test.js`.
- [x] REQ-017: `req dep add REQ-005 REQ-003` adds the edge with acyclicity enforced -- verified by `cli/test/req-dep-add.test.js`; `req dep rm` verified by `cli/test/req-dep-rm.test.js`.
- [x] Duplicate-edge adds, self-loops, and cycle-forming adds all exit 1 with actionable stderr.

## Pointers for deep dive

- Implementation: `git show 08e665e` (PR kdbanman/clif-d#9)
- Lifecycle: `git show da511ad`
- Test files: `cli/test/req-add.test.js`, `cli/test/req-edit.test.js`, `cli/test/req-dep-add.test.js`, `cli/test/req-dep-rm.test.js`, `cli/test/helpers.test.js`
- Lessons promoted from this plan: none survived interrogation
