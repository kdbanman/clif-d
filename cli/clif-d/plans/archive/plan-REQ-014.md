# Compact Archive: validate command

**Requirements:** REQ-014
**Implementation commit:** 7af96fe
**Lifecycle commit (PRD + plan move):** 8ccd735
**Date archived:** 2026-04-16
**Source plan:** previously at `cli/clif-d/plans/executed/plan-REQ-014.md` (deleted; recover via `git log --diff-filter=D -- cli/clif-d/plans/executed/plan-REQ-014.md`)

## Summary

Added the `validate` command. Runs a battery of structural checks against a PRD and emits all findings in one pass as a JSON array of `{ severity, code, message, path }` issue objects. Checks: JSON parse validity, schema-conformant structure (required fields, valid enums), referential integrity of `dependencies` / `context_refs` / `architecture_refs`, dependency-graph acyclicity (three-colour DFS), ID uniqueness, and status/implementation_commit consistency (`status: "done"` requires `implementation_commit`). The validator is hand-rolled JavaScript rather than a schema library call (CTX-001 -- zero runtime deps). Errors cause exit 1; warnings do not. Missing or unparseable PRD exits 2. The `Validation` namespace introduced here is reused by `plan-REQ-024-REQ-026-REQ-028-REQ-029.md` to enforce structural validation on every PRD load.

## Acceptance criteria

- [x] REQ-014: A PRD with a dangling dependency and a done-without-commit produces exit 1 and a JSON array with at least those two error issues -- verified by `cli/test/validate.test.js`.
- [x] Valid PRD exits 0 with `[]` on stdout.
- [x] File not found exits 2.
- [x] Cycle detection catches `A -> B -> A` and self-loops.
- [x] Warning-only findings do not trigger exit 1.

## Pointers for deep dive

- Implementation: `git show 7af96fe` (PR kdbanman/clif-d#7)
- Lifecycle: `git show 8ccd735`
- Test file: `cli/test/validate.test.js`
- Lessons promoted from this plan: none survived interrogation
