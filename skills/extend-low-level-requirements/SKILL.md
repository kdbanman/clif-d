---
name: extend-low-level-requirements
description: >
  Extend the partial picture of low-level requirements in a CLIF-D PRD with the next slice of
  clear first-step requirements. Use this skill after a round of implementation has landed, when
  executed plans, lessons, and new code have changed what is knowable about the system. Reads
  the PRD to find high-level requirements whose low-level coverage is incomplete, explores the
  current codebase and preceding plans to learn what the implementation now makes clear, and
  appends only those low-level requirements that are unambiguously specifiable right now --
  preserving the bow-wave discipline inherited from create-initial-prd. Never speculates
  forward; defers whatever is not yet clear to a future run. Writes exclusively through the
  `clif-d req` CLI so every addition is shape-validated and reference-checked.
---

# Extend Low-Level Requirements

You are helping the user extend the low-level requirements in an existing CLIF-D PRD. The PRD's high-level requirements form a complete picture of system behavior; its low-level requirements form a *partial* picture -- only the clear first steps. Your job is to push that partial picture forward by exactly one slice: add the low-level requirements that are clear **right now** based on the state of the code and the existing PRD, and no more.

---

## Philosophy

### Bow wave, not fleet

The implementation ship pushes a bow wave of low-level planning detail. Your job is to keep that wave just ahead of the ship -- not a week ahead, not a month ahead, just the next clear step. A PRD with too many speculative low-level requirements is worse than one with too few: it bakes in decisions that the code has not yet justified, crowds the dependency graph with forks the implementer may never take, and pretends certainty the project does not have.

If a candidate low-level requirement is not unambiguously specifiable today, do not write it. Trust the next run of this skill to pick it up when the code or the preceding requirements have made it clear.

### Grounded in the current state

Every low-level requirement you add must be derivable from two sources taken **together**:

1. **An existing high-level requirement** in the PRD that it helps realize.
2. **The current state of the project** -- what has been implemented, what has been tested, what conventions have been established, and what the most recent executed plans and lessons reveal.

A candidate that is not traceable to a high-level requirement has no seat in the PRD. A candidate that ignores what the code already does risks duplicating or contradicting reality. Read before you write.

### Additive only; never revise in place

This skill only **adds** low-level requirements. It does not rewrite the concept, edit high-level requirements, revise existing low-level requirements, or change architecture. If exploration surfaces drift between the code and an upstream design doc, flag it to the user -- the correction is a separate concern (either a manual edit or a rerun of the upstream skill). Never silently amend.

If you find that a high-level requirement's acceptance criteria are now demonstrably wrong because of what implementation taught, stop and say so. The fix is a correction upstream, not an extension.

### Two abstraction levels, still

The PRD has exactly two levels: high and low. You are extending the low-level layer only. Every requirement you add must have `abstraction_level: "low"`, a structured `given` / `when` / `then` acceptance-criteria object, and -- wherever a CLI surface is meaningful -- a concrete `cli_spec`. The authoritative field contract is the PRD schema (the plugin's `prd-schema.json`); defer to it for field names, types, and allowed values rather than restating them.

### CLIF-D continues to apply

Push CLI-First Decomposition wherever a CLI surface is meaningful. A new low-level requirement typically adds a command, a subcommand, a flag, or a refinement to a tool introduced by an existing high-level requirement. Occasionally it introduces a new tool -- rare, and a signal that a high-level requirement's shape may need upstream attention.

New low-level requirements must **match the conventions already present in the PRD and the code**: existing flag style, exit-code mapping, stdout/stderr discipline, naming. If a candidate would fork a pattern, either fold it into the existing pattern or stop and flag the inconsistency for the user.

---

## Input

This skill expects:

1. **A CLIF-D PRD** at `clif-d/prd.json` in the product repo, containing at least one high-level requirement with incomplete low-level coverage.
2. **The product codebase** -- source, tests, configuration. Exploration is mandatory, not optional.
3. **Any existing `clif-d/plans/executed/`, `clif-d/plans/lessons_learned/`, and `clif-d/plans/archive/` content.** These record what has already been built and what implementation taught.
4. **Optional caller-supplied focus** -- one or more high-level requirement IDs the user wants to extend. If no focus is given, consider every high-level requirement with incomplete low-level coverage and surface the shortlist to the user before proposing specifics.

Read all inputs before proposing anything.

---

## Exploration

### 1. Inventory the PRD

- List high-level requirements: `clif-d req ls --abstraction=high --plain`.
- List existing low-level requirements: `clif-d req ls --abstraction=low --plain`.
- For each high-level requirement, note the low-level requirements that cite it in their `description` or that share its `context_refs` / `architecture_refs` scope. Use `clif-d req show REQ-NNN` to inspect individual items in full.
- Classify each high-level requirement's low-level coverage:
  - **Not started** -- no low-level requirements yet; this is the first slice.
  - **In progress** -- some low-level requirements exist; more are needed to fully realize it.
  - **Fully covered** -- every acceptance sub-behavior implied by the high-level requirement already has a specifying low-level requirement. Skip.
- Note the `status` of each existing low-level requirement. Recently-`done` work often unblocks the next slice.

### 2. Trace the code

- Map repo structure: modules, test layout, CLI entry points, configuration, build scripts.
- Identify what is implemented and tested. A candidate whose acceptance criterion is already satisfied by existing code must not be re-added.
- Record established conventions: error handling, exit-code mapping, naming, flag style, file locations. New low-level requirements must fit these rather than introduce parallel ones.
- If `clif-d/backpressure.md` or `clif-d/dev-environment.md` are present, consult them -- quality guardrails and toolchain choices sometimes determine whether a behavior is specifiable right now.

### 3. Read preceding plans and lessons

- `clif-d/plans/executed/*.md` is the most reliable per-requirement account of what shipped, with commit SHAs. Scan the plans that closed requirements adjacent to the high-level requirement you are extending.
- `clif-d/plans/lessons_learned/*.md` records what surprised the implementer. Lessons often point at behaviors that were near-miss acceptance sub-criteria -- candidates for the next slice.
- `clif-d/plans/archive/*.md` is the compact history. Use it when executed/lessons directories have been compactified.

### 4. Identify the next slice

For each high-level requirement with incomplete low-level coverage, ask four questions of every candidate behavior:

1. **What is the very next implementation step?** A single user-observable behavior, describable as a CLI interaction (or, rarely, another observable surface).
2. **Is it clear enough right now** to write given / when / then acceptance criteria, a concrete `cli_spec`, and an exit-code map without guessing at interfaces, data shapes, or flag names that the code has not yet fixed?
3. **Are its dependencies already satisfied, or already queued as earlier low-level requirements** (existing in the PRD or being added in this same slice)?
4. **Is the CLI surface it introduces consistent** with existing tools in the PRD and the code?

A candidate that survives all four questions is a clear first step. A candidate that fails any of them is deferred to a future run.

---

## Interrogation

This skill is research-led, HITL-lite. Do the exploration above before asking the user anything. Then present the slice as a single confirmation gate -- not a per-requirement loop.

For each proposed low-level requirement, show:

- Proposed `id` (determined by `clif-d id next REQ`, allocated sequentially for the slice).
- Title and a one-sentence behavior summary.
- The high-level requirement it realizes, and how it advances that realization.
- Any existing or in-slice low-level requirements it depends on.
- A one-line rationale for why it is clear **right now** -- which code, plan, or lesson made it so.

Also show **deferred candidates**: behaviors that will eventually need low-level requirements but are not clear yet, with a one-line note on what has to become clear first. Making deferrals explicit helps the user sanity-check the slice size. Over-large slices are the primary failure mode; surfacing what you chose *not* to write is the primary defense.

Ask the user to confirm, trim, or request additions. Do not write to the PRD until the user confirms.

When interrogation surfaces a question that upstream documents should have answered but did not, treat that as a signal of drift. Finish the interrogation, but flag the drift in your final report so the user can decide whether to amend an upstream document or rerun an upstream skill before extending again. Do not silently revise upstream docs.

### Escalate rather than guess

If exploration shows that no high-level requirement has a clearly-unblocked next step -- because the implementation ship has caught up with the bow wave, or because the upstream PRD is silent on load-bearing behaviors -- say so and stop. Writing a speculative slice is worse than writing nothing. The user can rerun this skill after more implementation lands, or rerun an upstream skill to resolve the silence.

---

## Output

The output is one or more new low-level requirement objects appended to the `requirements` array in `clif-d/prd.json`. Nothing else in the PRD is changed.

Each new requirement conforms to the PRD schema. Key conventions for newly-authored low-level requirements:

- `abstraction_level`: `"low"`. Always.
- `status`: `"not_started"`. Always, for a freshly-authored requirement.
- `acceptance_criteria`: a structured `{ given, when, then }` object. No prose-only criteria at this level.
- `description`: self-contained motivating context. Reference the realizing high-level requirement by ID inline; do **not** list the high-level requirement under `dependencies` (dependency is for blocking peers, not parent intent).
- `dependencies`: only hard, blocking requirements. Typically peer low-level requirements that must be implemented first.
- `context_refs` and `architecture_refs`: carry forward from the realizing high-level requirement where still applicable; drop any that no longer bind.
- `cli_spec`: include wherever a CLI surface is meaningful, with exact command, arguments, flags, stdin/stdout/stderr, and exit-code map consistent with existing tools in the PRD.

Do not create new `context` or `architecture` items from this skill. If a candidate seems to require one, that is a signal the upstream layer needs attention -- flag it to the user instead of inventing context here.

---

## Generation process

Once the user confirms the slice:

1. **Determine IDs.** Run `clif-d id next REQ` to find the next free `REQ-NNN`, then allocate sequentially across the approved slice. If `clif-d req add` is used without supplying an `id`, it auto-assigns; either approach is acceptable, but keep assignment deterministic when the slice has internal dependencies so you can reference the right IDs as you wire them up.
2. **Add each requirement via the CLI.** Use `clif-d req add < requirement.json` (or the equivalent stdin form) for every new low-level requirement. Never hand-edit `prd.json`. The CLI validates shape, uniqueness, dangling refs, and acyclicity on every write; hand-edits bypass all of that.
3. **Wire in-slice dependencies.** If a new requirement depends on another requirement added in the same slice, either add the depended-on one first so the `dependencies` field can include it directly, or add the edge afterward with `clif-d req dep add <REQ-ID> <DEP-ID>`.
4. **Validate the PRD.** Run `clif-d validate`. Stop on any error and fix it before proceeding.
5. **Report to the user.** Summarize:
   - Each new requirement ID, title, and the high-level requirement it realizes.
   - The deferred candidates and why they were deferred.
   - Any upstream-drift findings surfaced during exploration, with a recommended next action (manual edit, upstream-skill rerun, or a follow-up that only the user can authorize).
6. **Commit the PRD change.** Use a commit message with a `Requirement:` trailer for each new `REQ-NNN` so the slice is discoverable via `git log --grep`. Example subject: `prd: Extend low-level requirements for REQ-003`. The body should list the new requirement IDs, the realizing high-level requirements, and any deferrals or drift findings worth preserving in git history.

Do not run the downstream `plan-requirement` skill from this one. The user decides when to plan the newly-added requirements.
