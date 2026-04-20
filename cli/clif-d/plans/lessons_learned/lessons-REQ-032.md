# Lessons Learned: REQ-032

**Plan:** `cli/clif-d/plans/executed/plan-REQ-032.md`
**Implementation commits:**
- `71b3cf3` create-initial-prd
- `3e52fce` create-architecture
- `d80981c` design-backpressure
- `58b113c` bootstrap-dev-environment
- `3e90979` plan-requirement
- `fc589c5` implement-plan
**Lifecycle commit:** (this commit)

## Summary

Nothing notable. The sweep was mechanical: per-skill surgical edits, one
commit per step, verification by grep against the per-step patterns
named in the plan's §2 and §6. Every edit landed cleanly on the first
pass; the pre-commit hook (`cd cli && npm run check`) ran and passed on
every commit since touching `skills/*.md` does not exercise the CLI
test suite but the hook runs it anyway.

## Minor deviations from the plan

- **Plan step numbers are 1-based in `skills/bootstrap-dev-environment/SKILL.md`.**
  Plan step 5a quoted the target instruction as "step 10" of the
  Generation process, but the actual file numbers it as step 11 (with
  five Backpressure Implementation sub-steps inserted earlier). Preserved
  the existing "11." numbering rather than renumbering the whole list.

- **Merged Part A pointer into end of Part A rather than as a freestanding
  paragraph.** Plan step 3b asked for a "one-paragraph note at the end of
  Part A (before Part B begins)". Implemented as a one-sentence
  continuation appended to step 5 of Part A rather than a separate
  paragraph, since that step already ends with a review-for-completeness
  directive and the pointer is a natural follow-on.

- **Kept the "Important: Do not perform the scaffolding yourself"
  block in create-architecture.** The plan's 3a replacement stopped at
  the `clif-d req dep add` paragraph; the existing "Important" block
  that immediately follows was not listed for deletion and is still
  load-bearing (it explains *why* scaffolding goes through the PRD at
  all), so it was preserved verbatim.

## Observations on the CLI migration pattern

- The "read-then-write" pattern for `clif-d req edit` context_refs /
  architecture_refs came up in three skills (create-architecture,
  design-backpressure, bootstrap-dev-environment). The gotcha paragraph
  is almost identical across all three. If the skill library grows much
  more, factoring it into a shared reference file becomes attractive --
  but per CLAUDE.md, skills should stay self-contained for now, so the
  duplication is intentional.

- `clif-d ctx ls | grep -i <keyword>` as a pre-check for existing CTX
  items is a cheap idempotence guard; worth adopting anywhere a CTX item
  is conceptually singleton (backpressure, dev-environment, and similar
  top-level constraints).
