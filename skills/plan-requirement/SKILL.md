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
---

# Plan Requirement Implementation

You are helping the user plan the implementation of one or more requirements from a CLIF-D PRD. The output is a **Markdown file** containing a detailed, step-by-step implementation plan that an implementer (human or agentic) can follow to deliver the requirement with high confidence.

---

## Philosophy

### Test-first, always

Every implementation step follows the TDD cycle: **write the test, then write the code that makes it pass**. The plan must make this ordering explicit and natural. A step that says "implement X" without first specifying the test for X is incomplete.

This isn't dogma -- it's a practical constraint for agentic implementation. An agent that writes tests first has a built-in verification loop: run the tests, see them fail, write code, see them pass. Without this structure, the agent has no reliable signal for "done."

### Plans are self-contained documents

The plan must be **understandable and actionable without reading any other document during implementation**. The implementer may be a relatively junior developer or a narrowly-scoped agent -- they should not need to search the codebase, read the PRD, or interpret the architecture document to understand what to build. Your job as the planner is to do that interpretive work upfront and deliver a plan that is ready to execute.

This means inlining or summarizing all necessary context: the requirement's acceptance criteria, relevant architectural decisions, module interfaces, CLI specifications, data structures, error handling conventions, and quality check commands. Reference the source documents by path for traceability, but don't force the implementer to consult them. If a piece of information from an upstream document would help the implementer make a better decision, include it in the plan -- don't assume they'll go find it.

### Vertical slices, not horizontal layers

Plan implementation as vertical slices -- each step delivers a thin, working piece of end-to-end functionality. Do not plan "first build all the data models, then build all the business logic, then build all the CLI handlers." Instead: "first build the simplest possible end-to-end path (test → implement → verify), then extend it step by step."

This aligns with CLIF-D: each slice should be runnable and testable as a CLI invocation.

### Granularity serves verification

Each step should be small enough that its test is obvious and its implementation is straightforward. If a step requires more than ~50 lines of implementation code, it's probably too big. Break it down.

The goal is a plan where each step can be completed and verified in isolation before moving to the next. This makes progress measurable and failures diagnosable.

---

## Input

This skill expects:

1. **A CLIF-D PRD** (JSON file). The user will specify which requirement(s) to plan by ID (e.g., REQ-003, REQ-007).
2. **An architecture document** (from the `create-architecture` skill or equivalent) -- optional but strongly recommended.
3. **A backpressure design document** (from the `design-backpressure` skill or equivalent) -- optional but strongly recommended.
4. **The current codebase** -- the skill should explore existing code, tests, and documentation to understand what's already built.

Read all inputs before beginning.

### Backpressure gate

Before planning implementation, **verify that quality guardrails are both designed and installed**. Check for:
- A `clif-d/backpressure.md` or equivalent quality documentation in the product repo (designed by `design-backpressure`)
- A `clif-d/dev-environment.md` with a Backpressure Implementation section confirming the guardrails are wired to the toolchain (implemented by `bootstrap-dev-environment`)
- Pre-commit hook configuration on disk (`.pre-commit-config.yaml`, `.husky/`, git hooks, etc.)
- Linter configuration appropriate to the project's language
- Type-checker configuration in its strictest viable mode
- A working test runner

If the **design** is missing or incomplete, warn the user: "Quality backpressure is not yet designed. Implementation plans assume that guardrails exist to catch regressions and enforce standards at every step. Consider running the `design-backpressure` skill first."

If the design is present but the **implementation** is missing (no hooks installed, no lint configs, no suppression scanner), warn the user: "Quality backpressure is designed in `clif-d/backpressure.md` but not yet installed. Run `bootstrap-dev-environment` to wire the guardrails into the toolchain before planning."

You may proceed after the warning if the user chooses to -- this is a gate, not a wall. But the warning must be given.

---

## Exploration

Before planning, you must understand the current state of the codebase. This is not optional -- plans that ignore existing code produce redundant or conflicting implementations.

### 1. Resolve the requirement graph

For each target requirement:
- Read its full entry from the PRD (description, acceptance criteria, CLI spec, dependencies, context refs, architecture refs).
- Read every item it references: dependency requirements, context items, architecture items.
- Recursively read dependencies of dependencies until you have the full subgraph.
- Identify which dependencies are already implemented (by examining the codebase) and which are not.

### 2. Read preceding plans

Check `clif-d/plans/executed/` and `clif-d/plans/active/` for plans that implemented dependency requirements or related functionality. These are valuable because they show:
- What modules and interfaces were created (and where)
- What test patterns were established
- What implementation decisions were made that this plan should follow or build on
- What assumptions were documented that may affect this plan

If a dependency requirement was recently implemented, its executed plan is the fastest way to understand the current state of that area of the codebase. Reference the most relevant preceding plans in the plan header.

### 3. Explore the codebase

- **Project structure**: Understand the directory layout, module organization, and build system.
- **Existing modules**: What's already implemented? What interfaces exist? What can be reused?
- **Existing tests**: What test patterns are established? What test utilities exist? What's the test file naming convention?
- **Configuration**: Read linter, type-checker, formatter, and test configuration to understand the quality standards the plan must satisfy.
- **Documentation**: Read any `clif-d/backpressure.md`, `README.md`, `CONTRIBUTING.md`, or similar docs that define development practices.

### 4. Identify the implementation gap

Compare what the requirement needs (from the PRD + architecture) with what exists (from the codebase). The plan should only cover what's missing. If a dependency is already implemented and tested, the plan should note it as a given, not re-plan it.

### 5. Identify high-level requirements realized

Low-level requirements do not exist in isolation -- each one realizes part of some high-level requirement. When you plan the implementation of a low-level requirement (or group of low-level requirements), decide which high-level requirements the plan **fully realizes** and which it **partially realizes**.

For each high-level requirement the plan touches:

- **Fully realized**: every acceptance-criterion sub-behavior implied by the high-level requirement is delivered by the low-level requirements in this plan (plus any already-done upstream work). At plan completion the high-level requirement should be marked `done` with the same `implementation_commit` SHA as the final low-level requirement in the plan (or a dedicated closing commit).
- **Partially realized**: the plan makes progress toward the high-level requirement but does not finish it. If the high-level requirement is currently `not_started`, it should be transitioned to `in_progress` at the start of this plan's work so the PRD reflects reality. It stays `in_progress` until a future plan finishes it.
- **Untouched**: no action.

Record this mapping in the plan. The plan author does the upfront thinking so the implementer does not have to guess which high-level requirements to close.

Without this step, high-level requirements drift silently out of sync with reality: low-level work closes through the `plan-requirement` → `implement-plan` cycle, while the high-level requirements they realize stay `not_started` forever. The only way to prevent this is to name the mapping in the plan and add explicit status-update tasks the implementer runs alongside the low-level closures.

---

## Ambiguity Resolution

Before planning, you must resolve ambiguity -- not defer it to the implementer. The implementer should receive a plan where every step is clear enough to execute without interpretation.

### Trace upstream first

When a requirement is ambiguous, trace upstream through the documentation before asking the user:

1. **PRD context items and descriptions** -- the requirement's `context_refs` and `description` often contain the clarifying detail.
2. **Architecture document** -- module interfaces, data flow diagrams, and error handling conventions often resolve "how should this work?" questions.
3. **Concept document** -- the product's fundamental purpose and value proposition often resolve "why does this behave this way?" questions.
4. **Preceding plans and existing code** -- patterns established by earlier implementation often resolve "what convention should I follow?" questions.
5. **Backpressure document** -- quality constraints often resolve "how strict should this be?" questions.

Most ambiguity in requirements can be resolved by reading upstream documents carefully. The requirement author couldn't (and shouldn't) inline every detail -- that's what the reference graph is for. Your job is to follow the references, synthesize the answer, and bake it into the plan.

### Interrogation

After upstream tracing, interrogation is for genuine ambiguities that can't be answered by reading. Ask the user only when:
- The requirement's acceptance criteria are ambiguous at a level that affects implementation approach, and no upstream document resolves it
- There's a design choice not covered by the architecture document
- There's a conflict between the requirement and existing code

Keep interrogation minimal. Prefer making reasonable assumptions (stated explicitly in the plan) over blocking on questions.

---

## Output Structure

The output is a Markdown file saved as `clif-d/plans/active/plan-<requirement-ids>.md` in the product repository (e.g., `clif-d/plans/active/plan-REQ-003.md` or `clif-d/plans/active/plan-REQ-003-REQ-007.md` for multiple requirements). Create the `clif-d/plans/active/` directory if it does not yet exist. See the README section "The `clif-d/` directory" for the full artifact layout and lifecycle.

Active plans live in `clif-d/plans/active/`. After implementation, the `implement-plan` skill moves completed plans to `clif-d/plans/executed/`. The `compactify-artifacts` skill periodically distills executed plans into compact entries in `clif-d/plans/archive/` and deletes the originals. This skill should not move or archive plans itself.

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

Link specific sections of the architecture document, not just the file. The implementer should be able to jump directly to the relevant module decomposition or data flow diagram if they need to verify something.

### 1. Objective

A concise summary (2-3 sentences) of what this plan delivers. State the user-visible behavior that will work when the plan is complete. Reference the requirement IDs.

### 2. Context Summary

This is where you do the heavy lifting that makes the plan self-contained. **Inline everything the implementer needs** so they can work from this document alone. Be generous with context -- it's far better to include a paragraph the implementer skims than to omit something they'll need to go hunt for.

Include:

- **Requirement description and acceptance criteria** -- copy verbatim from the PRD, not summarized. The implementer needs the exact wording to verify against.
- **CLI specification** -- the exact command, args, flags, stdin/stdout/stderr, exit codes. Copy from PRD.
- **Relevant architecture decisions** -- the specific modules involved, their public interfaces, key data structures, and how data flows between them. Don't just name the modules; describe the interfaces the implementer will call or implement. Pull from the architecture document's Module Architecture (§4) and Data Flow (§6) sections.
- **Relevant context items** -- constraints, personas, domain definitions that affect implementation. Copy from PRD context items.
- **Quality guardrails** -- the exact commands to run for linting, type-checking, formatting, and testing. Copy from `clif-d/backpressure.md` Practitioner Quick Reference. The implementer should not need to look these up.
- **Error handling conventions** -- how errors are represented, propagated, and mapped to exit codes. Pull from the architecture document's Error Handling Strategy (§7).
- **Relevant preceding implementation** -- if this plan extends code built by a preceding plan, summarize what already exists: which modules, which interfaces, which test patterns. The implementer needs to know what they're building on top of.

### 3. Prerequisites

What must be true before this plan can be executed:
- Dependency requirements that must already be implemented (with current status: done/not done)
- Tools and dependencies that must be installed
- Environment setup required

If a prerequisite is not met, state what needs to happen first.

### 4. High-level Requirements Realized

List every high-level requirement this plan touches, with its realization category and the status transition(s) the implementer must perform. Example:

```markdown
| High-level REQ | Realization | Status transition |
|----------------|-------------|-------------------|
| REQ-025        | Fully       | not_started -> done at plan completion (same commit as final low-level closure) |
| REQ-030        | Partially   | not_started -> in_progress at plan start; stays in_progress |
```

If the plan realizes no high-level requirements, write "None" and briefly justify why -- every low-level requirement should normally ladder up to at least one high-level requirement.

The transitions listed here drive the corresponding Implementation Steps below. Do not leave them to the implementer to infer.

### 5. Implementation Steps

The core of the plan. Each step follows this structure:

```markdown
### Step N: <Short description>

**Test first:**
- File: `path/to/test/file`
- Description: What the test verifies, in plain language
- Test code sketch: A pseudocode or real-code sketch of the test.
  For CLI tests: the command invocation, expected stdout, expected stderr, expected exit code.
  For unit tests: the function call, expected return value, expected side effects.

**Implement:**
- File(s): `path/to/implementation/file(s)`
- Description: What code to write, referencing specific modules and interfaces from the architecture
- Key decisions: Any implementation choices made and why

**Verify:**
- Run: `<the specific test command>`
- Expected: All new tests pass, all existing tests still pass
- Quality check: `<lint/typecheck command>` passes
```

#### Step ordering principles

1. **Start with the simplest end-to-end path.** The first step should produce a working (if minimal) CLI invocation that exercises the full stack from argument parsing to output.
2. **Each subsequent step extends functionality.** Add one behavior, one edge case, or one error path per step.
3. **Error handling is not deferred.** Each step that adds a success path should also add its corresponding error path in the same step or the immediately following step.
4. **Refactoring gets its own steps.** If a step's implementation reveals a need to restructure, make that a separate step with its own tests.

#### Status transition steps

Every status transition named in §4 **High-level Requirements Realized** must appear as an explicit step (or be folded into an existing step's Verify block). Low-level requirement transitions are similarly explicit -- do not rely on the implementer inferring which `clif-d req start`/`clif-d req done` commands to run.

- **First step** for each low-level requirement and each partially-realized high-level requirement not already `in_progress`: transition to `in_progress` via `clif-d req start REQ-XXX`.
- **Closing step** for each low-level requirement and each fully-realized high-level requirement: transition to `done` via `clif-d req done REQ-XXX --commit=<sha>` using the SHA of the commit that delivers the final acceptance criterion.
- A single closing step may close multiple requirements when one commit delivers them all.

### 6. Acceptance Criteria Verification

A checklist mapping the requirement's acceptance criteria to specific tests:

```markdown
- [ ] **Criterion**: "Given X, when Y, then Z"
  - **Verified by**: `test_file.py::test_name` (Step N)
- [ ] **Criterion**: "The tool outputs valid JSON to stdout"
  - **Verified by**: `test_file.py::test_json_output` (Step M)
```

For high-level (prose) acceptance criteria, map them to the collection of tests that together verify the criterion.

### 7. Files Created or Modified

A summary list of every file the plan touches:

```markdown
| File | Action | Step |
|------|--------|------|
| `src/lib/auth.rs` | Create | 2 |
| `tests/integration/test_auth_login.rs` | Create | 1 |
| `src/cli/auth.rs` | Modify | 3 |
```

### 8. Open Questions and Assumptions

Any assumptions made during planning that the implementer should be aware of. Flag anything where the plan made a judgment call that might need revisiting.

**Open questions should be rare.** If this section has more than one or two items, that's a signal of one of the following:

1. That the planning phase didn't resolve enough ambiguity. Go back to the upstream documents and the user before leaving questions for the implementer. The implementer should be able to execute the plan without needing to make interpretive decisions -- those are the planner's job.
2. That the requirement itself needs work: further decomposition, clearer acceptance criteria, etc. Discuss with the user to plan requirements revision.

---

## Generation process

Once you've explored the codebase and resolved any ambiguities:

1. **Name the output file** using the convention `clif-d/plans/active/plan-<requirement-ids>.md` (e.g., `clif-d/plans/active/plan-REQ-003.md`) in the product repository. Create the directory if it does not yet exist.
2. **Write the plan** following the output structure above.
3. **Verify traceability**: every acceptance criterion from the target requirements should appear in the Acceptance Criteria Verification section. Every architecture element referenced by the requirements should appear in the Context Summary. Every high-level requirement in §4 should have at least one status-transition step in §5.
4. **Verify completeness**: every file mentioned in Implementation Steps should appear in the Files Created or Modified summary. Every test mentioned should have a corresponding implementation step.
5. **Review step granularity**: each step should be completable and verifiable in isolation. If a step depends on uncommitted work from a previous step, that's fine -- but if a step can't be tested without completing the *next* step, the plan needs restructuring.
6. **Commit the plan.** The plan file is a project artifact and should be committed when complete. Use a clear commit message with a `Requirement:` trailer for each targeted requirement so the plan is discoverable via `git log --grep`. Example subject: `plans: Add implementation plan for REQ-003`. The body should briefly state what the plan covers and name the requirement IDs.

---

## Testing References

This skill's references directory contains guidance on *choosing* test types, proportions, and structure when planning implementation steps. Consult them when deciding what kind of test to specify for a step, where test files should live, or how to map acceptance criteria to tests.

- **Strategy**: [Testing strategy](references/testing-strategy.md) -- pyramid vs. trophy vs. honeycomb, risk-based prioritization, test size vs. scope
- **Test types**: [Testing types overview](references/testing-types.md) -- what each type is, when to use it, scope boundaries (unit, integration, E2E, acceptance, smoke)
- **Acceptance tests**: [Acceptance test guide](references/testing-acceptance.md) -- full guidance on mapping business requirements to executable specifications
- **Organization**: [Test organization](references/testing-organization.md) -- file structure, naming conventions, test independence, fixture management

These references focus on *planning* which tests to write and how to structure them. The plan specifies the tests; the implement-plan skill writes them. This skill does not need to explain how to write test code -- the implementer has their own detailed references for that. Similarly, enforcement of test quality (pre-commit hooks, coverage gates) is the design-backpressure skill's domain.
