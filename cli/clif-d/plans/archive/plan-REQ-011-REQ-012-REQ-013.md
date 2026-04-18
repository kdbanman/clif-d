# Archived: REQ-011, REQ-012, REQ-013 -- Status Mutation Commands

**Requirements:** REQ-011, REQ-012, REQ-013
**Implementation commit:** `4475eee335f7232d1bf7097f45d40af76b7fbeb5` (2026-04-14)
**Lifecycle commit:** `152eb4c5fa06e6b7f18f495a67b116dd812d1461` (mark done, move plan to executed)
**Date archived:** 2026-04-18

## Summary

Shipped the first write-path commands for `bin/clif-d`: `req done <REQ-ID> --commit=<sha>` / `-c <sha>`, `req start <REQ-ID>`, and `req block <REQ-ID>`. Established the read-validate-write cycle (ARCH-003) that every future mutation command reuses: atomic write to `<prdPath>.tmp.<pid>` then `fs.renameSync` to the target, so the PRD is never half-written on disk. Transition rule: `done` is terminal; every other status can transition to every other non-done status (including `blocked -> in_progress` via `req start`, i.e. unblocking). Transitions to the current state are idempotent, not errors. `req done` validates the commit SHA as 7-40 hex characters before mutating. stdout always carries the updated requirement object on success; stderr carries actionable validation messages on exit 1. PRD-preserving serialization: the full top-level object is written back, not just `requirements`, and other fields (context, architecture, untouched requirements) survive round-trip.

## Acceptance criteria

- [x] REQ-011: `req done <REQ-ID> --commit=<sha>` sets status to `done` and `implementation_commit` to the SHA, writes atomically, outputs updated object, exit 0. Validates SHA format, missing flag, already-done, unknown ID.
- [x] REQ-012: `req start <REQ-ID>` sets status to `in_progress`, writes atomically, outputs updated object, exit 0. Rejects transitions from `done`.
- [x] REQ-013: `req block <REQ-ID>` sets status to `blocked`, writes atomically, outputs updated object, exit 0. Rejects transitions from `done`.

## Pointers for deep dive

- Implementation diff: `git show 4475eee3`
- Tests: `cli/test/req-start.test.js`, `cli/test/req-done.test.js`, `cli/test/req-block.test.js`
- Lessons promoted to a permanent home: one. The `flagsWithValues` set in `bin/clif-d` carries a 3-line reminder that new short-form flags must be registered there and that `--key=value`-only tests will not catch a missing short form -- cover short forms with their own positional test. See the comment at the declaration of `flagsWithValues`. Originating lesson: `lessons-REQ-011-REQ-012-REQ-013.md`, section "Short-flag parsing requires dual registration" (preserved in git history).
- All other lessons (transient TypeScript strict-mode pitfalls, etc.) were silently pre-filtered or discarded on interrogation: git history preserves them.
