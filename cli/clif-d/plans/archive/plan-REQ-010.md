# Archived: REQ-010 -- Find Next Implementable Requirement

**Requirements:** REQ-010
**Implementation commit:** `bd465f0817f2d4c0add53337e69ab3d37849521b` (2026-04-14)
**Lifecycle commit:** `3bfecd1bda3e330242a0e8ac6ce31548f04a334d` (mark done, move plan to executed)
**Date archived:** 2026-04-18

## Summary

Shipped `clif-d req next`, the single highest-value command for the plan-requirement skill: it returns the highest-priority `not_started` requirement whose dependencies are all `done`, as a full JSON object on stdout. Eligibility rule: effective status (absent defaults to `not_started`) must be `not_started` AND every ID in `dependencies` must belong to a requirement with status `done` (dangling dep IDs count as unmet, not errors -- `validate` is where dangling refs surface). Selection is by lowest priority number, unranked last, PRD order as the stable tiebreaker. Exit 0 with the object on stdout when a pick exists; exit 1 with a diagnostic on stderr when none do (all done, all blocked, all gated by unmet deps, or empty requirements).

## Acceptance criteria

- [x] REQ-010: Given REQ-001 done, REQ-002 (priority 1, depends on REQ-001) not_started, REQ-003 (priority 2, no deps) not_started, `req next` returns REQ-002 as a full JSON object, exit 0.
- [x] Exit 1 with diagnostic when no requirement is eligible.
- [x] Exit 2 when PRD missing/unparseable (delegated to shared `loadPrd`).

## Pointers for deep dive

- Implementation diff: `git show bd465f08`
- Tests: `cli/test/req-next.test.js`
- Lessons promoted to a permanent home: none. The original executed plan and lessons file were compacted into this entry on 2026-04-18; git history preserves them.
