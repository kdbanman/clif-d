---
name: plan-requirement
description: >
  Generate a detailed implementation plan for one or more requirements from a CLIF-D PRD. Use this skill when the
  user wants to plan the implementation of specific requirements -- typically after an architecture document exists.
  Reads the PRD to understand the requirement and all its linked context, architecture, and dependency items.
  Explores the current codebase and documentation to understand what already exists. Produces a step-by-step
  implementation plan as a Markdown file, with strong emphasis on TDD (test-first), modular code structure, and
  clear acceptance criteria traceability. Each plan step specifies what to test, what to implement, and how to
  verify -- in that order.
  Pipeline position: after bootstrap-dev-environment and each prior implement-plan; before implement-plan.
  Outputs clif-d/plans/active/plan-REQ-NNN.md. Most relevant CLI: clif-d req show, clif-d req dep, clif-d req next.
---

# Plan Requirement Implementation

You are helping the user plan the implementation of one or more requirements from a CLIF-D PRD.
The output is a **Markdown file** containing a detailed, step-by-step implementation plan that an implementer (human or agentic) can follow to deliver the requirement with high confidence.

---

## Philosophy

### Test-first, always

Every implementation step follows the TDD cycle: **write the test, then write the code that makes it pass**.
The plan must make this ordering explicit and natural.
A step that says "implement X" without first specifying the test for X is incomplete.

This isn't dogma -- it's a practical constraint for agentic implementation.
An agent that writes tests first has a built-in verification loop: run the tests, see them fail, write code, see them pass.
Without this structure, the agent has no reliable signal for "done."

### Plans are reference-rich, not self-contained

The plan must be **executable without re-doing the planner's interpretive work**, but it should not duplicate content that already lives in upstream docs.
The implementer has `CLAUDE.md` pointing at the PRD, architecture, and backpressure documents; assume they can follow a link.

Link to specific sections, not whole files: `backpressure.md §3.1`, `architecture.md §4.1 module:rng`, `prd.json REQ-007 acceptance_criteria`.
Inline only what requires interpretive synthesis the implementer cannot do by following one link -- a chosen interface signature, a non-obvious data flow, an acceptance criterion mapped to a specific test predicate.

### Vertical slices, not horizontal layers

Plan implementation as vertical slices -- each step delivers a thin, working piece of end-to-end functionality.
Do not plan "first build all the data models, then build all the business logic, then build all the CLI handlers." Instead: "first build the simplest possible end-to-end path (test → implement → verify), then extend it step by step."

This aligns with CLIF-D: each slice should be runnable and testable as a CLI invocation.

### Granularity serves verification

Each step should be small enough that its test is obvious and its implementation is straightforward.
If a step requires more than ~50 lines of implementation code, it's probably too big.
Break it down.

The goal is a plan where each step can be completed and verified in isolation before moving to the next.
This makes progress measurable and failures diagnosable.

### Detail ceiling: describe, do not write

The plan describes *what* to build, not *how* to write it.
Cap code detail at signatures and pseudocode.
Never include full file contents, full function bodies, or unified diffs -- those are the implementer's output, not the planner's.

Over-prescription is a failure mode, not thoroughness.
When the plan hands the implementer a finished diff, it bypasses the Red-Green-Refactor loop, pins implementation choices that TDD should surface, and makes the plan expensive to review.
The implementer has their own references and judgment; trust them to turn a signature plus a behaviour description into working code.

Specific anti-patterns the ceiling rules out:

- Do not re-enumerate items the architecture or PRD already lists.
  Write "add the deps in `architecture.md` §2 for `goose-core`", not the list.
  The architecture is the source of truth; the plan is the trigger.
- Test predicates are described in plain language. "`config/sim.toml` parses and contains every `SimParams` field" -- not a Python one-liner that asserts it.
  The implementer writes the runnable form.
- Never inline file contents -- JSON, TOML, YAML, fixture data -- even if the file is small.
  Describe the shape by pointing at the struct it must satisfy.

### Length is a planning signal

When a plan runs long, the planner is doing someone else's job: the implementer's (writing code), the architecture's (re-explaining context), or the user's (defending assumptions instead of asking).
The fix is always to cut, not to compress.

---

## Input

This skill expects:

1. **A CLIF-D PRD** (JSON file).
   The user will specify which requirement(s) to plan by ID (e.g., REQ-003, REQ-007).
2. **An architecture document** (from the `create-architecture` skill or equivalent) -- optional but strongly recommended.
3. **A backpressure design document** (from the `design-backpressure` skill or equivalent) -- optional but strongly recommended.
4. **The current codebase** -- the skill should explore existing code, tests, and documentation to understand what's already built.

Read all inputs before beginning.

### Backpressure gate

Before planning implementation, **verify that quality guardrails are both designed and installed**.
Check for:
- A `clif-d/backpressure.md` or equivalent quality documentation in the product repo (designed by `design-backpressure`)
- A `clif-d/dev-environment.md` with a Backpressure Implementation section confirming the guardrails are wired to the toolchain (implemented by `bootstrap-dev-environment`)
- Pre-commit hook configuration on disk (`.pre-commit-config.yaml`, `.husky/`, git hooks, etc.)
- Linter configuration appropriate to the project's language
- Type-checker configuration in its strictest viable mode
- A working test runner

If the **design** is missing or incomplete, warn the user: "Quality backpressure is not yet designed.
Implementation plans assume that guardrails exist to catch regressions and enforce standards at every step.
Consider running the `design-backpressure` skill first."

If the design is present but the **implementation** is missing (no hooks installed, no lint configs, no suppression scanner), warn the user: "Quality backpressure is designed in `clif-d/backpressure.md` but not yet installed.
Run `bootstrap-dev-environment` to wire the guardrails into the toolchain before planning."

You may proceed after the warning if the user chooses to -- this is a gate, not a wall.
But the warning must be given.

---

## Exploration

Before planning, you must understand the current state of the codebase.
This is not optional -- plans that ignore existing code produce redundant or conflicting implementations.

### 1. Resolve the requirement graph

Read the PRD through the `clif-d` CLI -- do not parse `clif-d/prd.json` by hand.
If the user did not specify a target requirement, run `clif-d req next clif-d/prd.json` to pick the highest-priority `not_started` requirement whose dependencies are all `done`.

For each target requirement:
- Read its full entry: `clif-d req show <REQ-ID> clif-d/prd.json` prints the complete JSON object (description, acceptance criteria, CLI spec, dependencies, context refs, architecture refs).
- Walk the blocking-dependency subgraph: `clif-d req dep graph --root=<REQ-ID> clif-d/prd.json` prints the JSON adjacency list of ancestors (requirements that must be done before this one can be implemented).
  Fetch every ID in that graph with `clif-d req show` for full detail.
- Fetch referenced context and architecture items via `clif-d ctx show <CTX-ID> clif-d/prd.json` and `clif-d arch show <ARCH-ID> clif-d/prd.json`.
- Identify which dependencies are already implemented by comparing the subgraph against `clif-d req ls --status=done --plain clif-d/prd.json`.
  Cross-check against `git log` for commits touching the relevant code paths -- a requirement is only truly "done" if the PRD status and the code both agree.

### 2. Read preceding plans

Check `clif-d/plans/executed/` and `clif-d/plans/active/` for plans that implemented dependency requirements or related functionality.
These Markdown files have no CLI surface -- read them directly.
They are valuable because they show:
- What modules and interfaces were created (and where)
- What test patterns were established
- What implementation decisions were made that this plan should follow or build on
- What assumptions were documented that may affect this plan

Cross-check the requirement status of preceding work with `clif-d req ls --status=done --plain clif-d/prd.json` so the PRD state and the plan artifacts agree.
If a dependency requirement was recently implemented, its executed plan is the fastest way to understand the current state of that area of the codebase.
Reference the most relevant preceding plans in the plan header.

### 3. Explore the codebase

- **Project structure**: Understand the directory layout, module organization, and build system.
- **Existing modules**: What's already implemented?
  What interfaces exist?
  What can be reused?
- **Existing tests**: What test patterns are established?
  What test utilities exist?
  What's the test file naming convention?
- **Configuration**: Read linter, type-checker, formatter, and test configuration to understand the quality standards the plan must satisfy.
- **Documentation**: Read any `clif-d/backpressure.md`, `README.md`, `CONTRIBUTING.md`, or similar docs that define development practices.

### 4. Identify the implementation gap

Compare what the requirement needs (from the PRD + architecture) with what exists (from the codebase).
The plan should only cover what's missing.
If a dependency is already implemented and tested, the plan should note it as a given, not re-plan it.

### 5. Identify high-level requirements realized

Low-level requirements do not exist in isolation -- each one realizes part of some high-level requirement.
When you plan the implementation of a low-level requirement (or group of low-level requirements), decide which high-level requirements the plan **fully realizes** and which it **partially realizes**.

For each high-level requirement the plan touches:

- **Fully realized**: every acceptance-criterion sub-behavior implied by the high-level requirement is delivered by the low-level requirements in this plan (plus any already-done upstream work).
  At plan completion the high-level requirement should be marked `done` with the same `implementation_commit` SHA as the final low-level requirement in the plan (or a dedicated closing commit).
- **Partially realized**: the plan makes progress toward the high-level requirement but does not finish it.
  If the high-level requirement is currently `not_started`, it should be transitioned to `in_progress` at the start of this plan's work so the PRD reflects reality.
  It stays `in_progress` until a future plan finishes it.
- **Untouched**: no action.

Record this mapping in the plan.
The plan author does the upfront thinking so the implementer does not have to guess which high-level requirements to close.

Without this step, high-level requirements drift silently out of sync with reality: low-level work closes through the `plan-requirement` → `implement-plan` cycle, while the high-level requirements they realize stay `not_started` forever.
The only way to prevent this is to name the mapping in the plan and add explicit status-update tasks the implementer runs alongside the low-level closures.

---

## Ambiguity Resolution

Before planning, you must resolve ambiguity -- not defer it to the implementer.
The implementer should receive a plan where every step is clear enough to execute without interpretation.

### Trace upstream first

When a requirement is ambiguous, trace upstream through the documentation before asking the user:

1. **PRD context items and descriptions** -- the requirement's `context_refs` and `description` often contain the clarifying detail.
2. **Architecture document** -- module interfaces, data flow diagrams, and error handling conventions often resolve "how should this work?" questions.
3. **Concept document** -- the product's fundamental purpose and value proposition often resolve "why does this behave this way?" questions.
4. **Preceding plans and existing code** -- patterns established by earlier implementation often resolve "what convention should I follow?" questions.
5. **Backpressure document** -- quality constraints often resolve "how strict should this be?" questions.

Most ambiguity in requirements can be resolved by reading upstream documents carefully.
The requirement author couldn't (and shouldn't) inline every detail -- that's what the reference graph is for.
Your job is to follow the references, synthesize the answer, and bake it into the plan.

### Resolve, do not punt

If a question is answerable by reading official documentation -- a manifest reference, a library README, an RFC -- resolve it before writing the plan.
"The implementer can trial it" is not an assumption; it is an unresolved question masquerading as one.
Punting an answerable question downstream poisons the plan: the implementer pays the resolution cost mid-Red-Green-Refactor, when context is most expensive.

### Interrogation

After upstream tracing and documentation lookup, interrogation is for genuine ambiguities that can't be answered by reading.
Ask the user only when:
- The requirement's acceptance criteria are ambiguous at a level that affects implementation approach, and no upstream document resolves it
- There's a design choice not covered by the architecture document
- There's a conflict between the requirement and existing code

Keep interrogation minimal.
Prefer making reasonable assumptions (stated explicitly in the plan) over blocking on questions.

---

## Output Structure

The output is a Markdown file saved as `clif-d/plans/active/plan-<requirement-ids>.md` in the product repository (e.g., `clif-d/plans/active/plan-REQ-003.md` or `clif-d/plans/active/plan-REQ-003-REQ-007.md` for multiple requirements).
Create the `clif-d/plans/active/` directory if it does not yet exist.
See the README section "The `clif-d/` directory" for the full artifact layout and lifecycle.

Active plans live in `clif-d/plans/active/`.
After implementation, the `implement-plan` skill moves completed plans to `clif-d/plans/executed/`.
The `compactify-artifacts` skill periodically distills executed plans into compact entries in `clif-d/plans/archive/` and deletes the originals.
This skill should not move or archive plans itself.

### Header

```markdown
# Implementation Plan: <Requirement Title(s)>

**Requirements:** REQ-003, REQ-007
**PRD:** `clif-d/prd.json`
**Architecture:** `clif-d/architecture.md` (§4 Module Architecture, §5 CLI-to-Module Mapping -- or whichever sections are relevant)
**Backpressure:** `clif-d/backpressure.md`
**Preceding plans:** `clif-d/plans/executed/plan-REQ-001.md` (if relevant -- list plans that built the code this plan extends)
**Date:** YYYY-MM-DD
**Status:** Draft
```

Link specific sections of the architecture document, not just the file.
The implementer should be able to jump directly to the relevant module decomposition or data flow diagram if they need to verify something.

### 1. Objective

A concise summary of what this plan delivers, in **at most 2 sentences**.
State the user-visible behavior that will work when the plan is complete.
Reference the requirement IDs.

### 2. Context Summary

A short list of section-scoped links to the upstream items the implementer will need, each with a one-sentence rationale stating its bearing on this plan (e.g. `architecture.md §4 -- defines the module boundary this requirement must not cross`).
A citation without a rationale forces the implementer to reconstruct the planner's reasoning; the rationale is the planner's job.

**At most 8 bullets, each at most 1 sentence.**
If you find yourself paraphrasing the cited section, delete the paraphrase -- the link suffices.

Link, do not copy.
The implementer follows the link if they need the full text.
Inline a snippet only when it embodies an interpretive choice the planner made (a chosen signature, a selected error mode, an acceptance criterion mapped to a specific test predicate) -- and even then, keep it to the minimum that conveys the choice.

Typical links to include (omit any that are not load-bearing for this plan):

- Requirement description, acceptance criteria, and CLI spec -- by ID, e.g. `prd.json REQ-007`.
- Relevant architecture sections -- by §, e.g. `architecture.md §4.1 module:rng`, `architecture.md §6 (data flow)`, `architecture.md §7 (error handling)`.
- Relevant context items -- by ID, e.g. `prd.json CTX-003`.
- Quality guardrails -- one link to `backpressure.md` Practitioner Quick Reference; do not re-list the commands.
- Preceding plans whose code this plan extends -- by path, with one sentence on what they established.

### 3. Prerequisites

What must be true before this plan can be executed:
- Dependency requirements that must already be implemented (with current status: done/not done)
- Tools and dependencies that must be installed
- Environment setup required

If a prerequisite is not met, state what needs to happen first.

### 4. High-level Requirements Realized

List every high-level requirement this plan touches, with its realization category and the status transition(s) the implementer must perform.
Example:

```markdown
| High-level REQ | Realization | Status transition |
|----------------|-------------|-------------------|
| REQ-025        | Fully       | not_started -> done at plan completion (same commit as final low-level closure) |
| REQ-030        | Partially   | not_started -> in_progress at plan start; stays in_progress |
```

If the plan realizes no high-level requirements, write "None" and briefly justify why -- every low-level requirement should normally ladder up to at least one high-level requirement.

The transitions listed here drive the corresponding Implementation Steps below.
Do not leave them to the implementer to infer.

### 5. Implementation Steps

The core of the plan.
Each step is a tight bullet block, two to four lines:

```markdown
### Step N: <short title>
- Files: `path/to/impl`, `path/to/test`
- Test: <one-line description, with signature or assert predicate; reference the AC being verified, e.g. (REQ-007 AC: exits 0 on valid input)>
- Implement: <one-line description, with the signature(s) to add or change>
- Done when: <the specific command that returns 0, or the assertion that holds>
```

Drop a line if it is empty.
A trivial step may be just `Files` + `Done when`; a step that closes a requirement may be just `Files` + `Done when: clif-d req done REQ-XXX --commit=<sha>`.
Respect the detail ceiling: signatures and pseudocode only -- no full function bodies, no full file contents, no unified diffs.

**Per-line budgets:**

- Each step's `Implement:` line is **at most 2 sentences**.
- Each step's `Test:` line is **one sentence describing what's verified** -- never a runnable shell or Python script.
  The implementer translates the predicate into the test harness.

The "Step ordering principles" and "Status transition steps" guidance below is **for you, the planner**.
Do not echo it into the plan output.

**Step ordering principles** (planner-only):

1. Start with the simplest end-to-end path -- the first step should produce a working CLI invocation across the full stack.
2. Each subsequent step adds one behavior, edge case, or error path.
3. Pair each success path with its error path in the same or immediately following step.
4. Refactoring gets its own steps with their own tests.

**Status transition steps** (planner-only -- emit as explicit steps in the output, but do not include this rationale):

- First step for each low-level requirement and each partially-realized high-level requirement not already `in_progress`: `clif-d req start REQ-XXX`.
- Closing step for each low-level requirement and each fully-realized high-level requirement: `clif-d req done REQ-XXX --commit=<sha>`.
- A single closing step may close multiple requirements when one commit delivers them all.
- `clif-d req start` / `clif-d req done` are **one-line bullets, not full step blocks**.
  When several requirements close in the same commit, group them into a single closing step.

### 6. Acceptance Criteria Verification (optional)

**Default: omit.**
Include only when an AC is verified by a combination of tests across multiple steps and that combination isn't visible from any single `Test:` line.
If your per-step `Test:` lines already name the AC (e.g. `(REQ-007 AC: exits 0 on valid input)`), this section is duplication -- delete it.

When included, the format is a checklist:

```markdown
- [ ] **Criterion**: "Given X, when Y, then Z"
  - **Verified by**: `test_file.py::test_name` (Step N)
```

### 7. Files Created or Modified (optional)

**Default: omit.**
Include only when one file is touched across many steps and a consolidated view materially helps.
If the per-step `Files:` lines already make the inventory obvious, this section is duplication -- delete it.

### 8. Open Questions and Assumptions

Any assumptions made during planning that the implementer should be aware of.
Flag anything where the plan made a judgment call that might need revisiting.

**At most 2 items, each at most 1 sentence.**
Defending the assumption against alternatives turns a note into an essay; cut it or escalate to the user before writing the plan.

If this section has more than one or two items, that's a signal of one of the following:

1. That the planning phase didn't resolve enough ambiguity.
   Go back to the upstream documents and the user before leaving questions for the implementer.
   The implementer should be able to execute the plan without needing to make interpretive decisions -- those are the planner's job.
2. That the requirement itself needs work: further decomposition, clearer acceptance criteria, etc. Discuss with the user to plan requirements revision.

---

## Generation process

Once you've explored the codebase and resolved any ambiguities:

1. **Name the output file** using the convention `clif-d/plans/active/plan-<requirement-ids>.md` (e.g., `clif-d/plans/active/plan-REQ-003.md`) in the product repository.
   Create the directory if it does not yet exist.
2. **Write the plan** following the output structure above.
3. **Verify traceability**: each step names the upstream item(s) it satisfies in a short reference like `(REQ-031 AC: cargo metadata exits 0)`.
   Each Context Summary citation carries a one-sentence rationale.
   Each high-level requirement in §4 has at least one status-transition step in §5.
   Do not enumerate every AC and architecture element in prose -- the per-step references are the trace.
4. **Verify completeness**: every test mentioned in a step has a corresponding implementation step.
   If §6 or §7 is included, it adds information the per-step bullets do not already encode; if not, omit it.
5. **Review step granularity**: each step should be completable and verifiable in isolation.
   If a step depends on uncommitted work from a previous step, that's fine -- but if a step can't be tested without completing the *next* step, the plan needs restructuring.
6. **Enforce the detail ceiling**: scan each step for over-prescription.
   No step should contain more than ~10 consecutive lines of code in any block, and no step should contain a unified diff or a full function/file body.
   If a snippet exceeds the ceiling, trim it to a signature plus pseudocode.
7. **Self-audit before saving.** Run this checklist against the draft and fix any failure before committing:
   - [ ] §1 Objective: at most 2 sentences?
   - [ ] §2 Context Summary: at most 8 bullets, each at most 1 sentence, no paraphrase of cited material?
   - [ ] No step inlines a list of items already enumerated upstream (deps, config fields, AC text)?
   - [ ] No `Test:` line is a runnable script (`python3 -c ...`, multi-pipe shell, inline assertion code)?
   - [ ] No step inlines file contents (JSON, TOML, YAML, fixture data)?
   - [ ] §6 and §7 omitted unless they add information the per-step bullets do not?
   - [ ] §8 at most 2 items, each at most 1 sentence, no defense-against-alternatives prose?
   - [ ] `clif-d req start` / `req done` rendered as one-line bullets, not full step blocks?
   - [ ] Length: scaffolding/config-only plan at most ~150 lines; feature plan at most ~300 lines?
8. **Commit the plan.** The plan file is a project artifact and should be committed when complete.
   Use a clear commit message with a `Requirement:` trailer for each targeted requirement so the plan is discoverable via `git log --grep`.
   Example subject: `plans: Add implementation plan for REQ-003`.
   The body should briefly state what the plan covers and name the requirement IDs.
9. **Transition the target requirement to `in_progress`.** As the final action of this skill, run `clif-d req start <REQ-ID>` for each target low-level requirement (and any partially-realized high-level requirement listed in §4 that is currently `not_started`).
   This makes the claim visible to cross-worktree or cross-session agents before implementation begins.

---

## Testing References

This skill's references directory contains guidance on *choosing* test types, proportions, and structure when planning implementation steps.
Consult them when deciding what kind of test to specify for a step, where test files should live, or how to map acceptance criteria to tests.

- **Strategy**: [Testing strategy](references/testing-strategy.md) -- pyramid vs. trophy vs. honeycomb, risk-based prioritization, test size vs. scope
- **Test types**: [Testing types overview](references/testing-types.md) -- what each type is, when to use it, scope boundaries (unit, integration, E2E, acceptance, smoke)
- **Acceptance tests**: [Acceptance test guide](references/testing-acceptance.md) -- full guidance on mapping business requirements to executable specifications
- **Organization**: [Test organization](references/testing-organization.md) -- file structure, naming conventions, test independence, fixture management

These references focus on *planning* which tests to write and how to structure them.
The plan specifies the tests; the implement-plan skill writes them.
This skill does not need to explain how to write test code -- the implementer has their own detailed references for that.
Similarly, enforcement of test quality (pre-commit hooks, coverage gates) is the design-backpressure skill's domain.
