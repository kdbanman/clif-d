---
name: implement-plan
description: >
  Implement code according to a plan from the plan-requirement skill, with rigorous TDD discipline, modular
  code structure, and continuous quality verification. Use this skill when the user has an implementation plan
  (Markdown file from the plan-requirement skill or equivalent) and wants to execute it step by step. Follows
  the plan's test-first ordering strictly -- writes each test before its implementation, runs tests after each
  step, and runs all quality checks (lint, type-check, format) before considering a step complete. Produces
  clean, modular, well-documented code that passes all guardrails on every commit.
  Pipeline position: after plan-requirement; loops back to plan-requirement and feeds compactify-artifacts.
  Outputs product code and tests; moves the plan to clif-d/plans/executed/ and writes
  clif-d/plans/lessons_learned/lessons-REQ-NNN.md. CLI: clif-d req start, clif-d req done, clif-d validate.
---

# Implement According to Plan

You are implementing code by following a structured implementation plan. The plan specifies what to build, in what order, with what tests, and to what quality standards. Your job is to execute it faithfully, writing high-quality code that passes all guardrails at every step.

---

## Philosophy

### The plan is the contract

Follow the plan's step ordering and test-first structure. Do not skip steps, reorder steps, or combine steps unless you encounter a concrete problem that makes the plan's ordering impossible -- and if that happens, explain what you found and why you're deviating before proceeding.

The plan was written with care about decomposition and verification ordering. Respecting it means each step is independently verifiable, which is the whole point.

### Red-Green-Refactor, literally

For every step that includes a "Test first" section:

1. **Red**: Write the test. Run it. Confirm it fails. If it passes before you've written the implementation, something is wrong -- either the test is trivial, the behavior already exists, or the test isn't testing what it claims. Investigate before proceeding.

2. **Green**: Write the minimum implementation to make the test pass. Do not write more than what the test demands. Run the test. Confirm it passes.

3. **Refactor**: Look at what you just wrote. Is there duplication? Is the code clear? Are names precise? Is the module boundary right? Refactor if needed -- and run the tests again after refactoring to confirm nothing broke.

This is the implementation protocol. Skipping the Red step (writing tests that already pass) defeats the purpose of TDD.

### Quality checks run after every step

After completing each step's implementation:

1. **Run the step's specific tests** -- they must pass.
2. **Run the full test suite** -- nothing previously passing should break.
3. **Run the linter** -- no new violations.
4. **Run the type checker** -- no new errors.
5. **Run the formatter** -- code must be formatted.

If any check fails, fix the issue before moving to the next step. Do not accumulate debt across steps.

If the project has pre-commit hooks configured (see `clif-d/backpressure.md`), these checks will also run at commit time. But don't rely on hooks as your only verification -- run checks explicitly after each step so you catch issues immediately, not at commit time when the context has shifted.

### Code quality is not negotiable

Write code that is:

- **Modular**: Each function does one thing. Each module has a clear, single responsibility. Dependencies between modules flow in one direction. If you find yourself writing a function longer than ~20 lines, split it.

- **Explicit**: No magic. No implicit behavior. No reliance on global state. Every function's inputs and outputs are clear from its signature. Error cases are handled explicitly, not swallowed.

- **Named precisely**: Names are the primary documentation. A function called `process_data` is a failure. A function called `parse_csv_row_to_transaction` is a success. Variables, functions, modules, and types should all have names that make the code readable without comments.

- **Documented where non-obvious**: Don't comment *what* the code does (the code says that). Comment *why* -- the business reason, the edge case being handled, the constraint being respected. Module-level documentation should explain the module's responsibility and public interface.

- **Tested at the right level**: Unit tests for logic. Integration tests for CLI behavior. Don't write unit tests for trivial getters. Don't write integration tests for pure computation. Test at the boundary where the behavior is most meaningfully verified.

### Handle plan deviations explicitly

Sometimes the plan doesn't survive contact with reality. When this happens:

- **If a test needs to be different than sketched**: Write the correct test and note why it differs from the plan.
- **If an implementation approach doesn't work**: Try the plan's approach first. If it genuinely doesn't work, explain what you found, what you're doing instead, and why.
- **If you discover a missing step**: Implement it in the spirit of the plan's structure -- test first, verify after.
- **If you discover the plan has a bug**: Stop and explain the issue. Don't silently work around it.

The plan is the contract, but a contract interpreted in good faith, not followed off a cliff.

---

## Input

This skill expects:

1. **An implementation plan** (Markdown file from the `plan-requirement` skill or equivalent). The user will provide the file path.
2. **The project codebase** -- the implementation is written directly into the project.

Read the full plan before starting. Understand the overall arc -- what's being built, why, and how the steps connect -- before writing any code.

---

## Execution Protocol

### Before starting

1. **Read the plan fully.** Understand the objective, context, prerequisites, and the full sequence of steps.
2. **Verify prerequisites.** Check that required dependencies are installed, required modules exist, required configuration is in place. If a prerequisite is not met, stop and report it.
3. **Identify the quality check commands.** From the plan's Context Summary or the project's `clif-d/backpressure.md`, determine the exact commands for: running tests, running the linter, running the type checker, running the formatter.
4. **Run the existing test suite.** Confirm it passes before you change anything. If it doesn't, stop and report -- you need a green baseline to detect regressions.

### For each step

Follow this sequence exactly:

#### 1. Announce the step

State which step you're executing and what it will accomplish. This provides a clear progress trail.

#### 2. Write the test (Red)

- Create or modify the test file specified in the plan's "Test first" section.
- Follow the plan's test sketch, but write real, complete test code -- not pseudocode.
- **Run the test.** It should fail (Red). If it passes, investigate:
  - Is the behavior already implemented? → Skip the implementation part of this step, note why.
  - Is the test not actually testing the right thing? → Fix the test.
  - Is the test trivially passing (e.g., testing a no-op)? → Make the test more specific.

#### 3. Write the implementation (Green)

- Create or modify the implementation files specified in the plan's "Implement" section.
- Write the **minimum code** to make the failing test pass. Resist the urge to implement the next step's functionality.
- **Run the step's test.** It should pass (Green).
- **Run the full test suite.** Everything should pass -- no regressions.

#### 4. Refactor (if needed)

- Review the code you just wrote. Look for:
  - Duplication (within this step or with existing code)
  - Unclear names
  - Functions that are too long
  - Module boundaries that feel wrong
  - Missing error handling
- If you refactor, **run the full test suite again** to confirm nothing broke.

#### 5. Quality checks

Run all quality checks:
- **Formatter**: Format the code. Stage any formatting changes.
- **Linter**: Run the linter. Fix any violations. Do not suppress lint rules: inline suppressions are forbidden by the backpressure policy. If a rule is genuinely wrong for this codebase, stop and surface it to the user rather than working around it - the rule must be changed globally (with a rationale recorded in `clif-d/backpressure.md` §4), not bypassed locally.
- **Type checker**: Run the type checker. Fix any errors.
- **Full test suite**: One final run to confirm everything is green.

If any check fails, fix the issue before proceeding. This is a hard gate.

#### 6. Confirm step completion

State that the step is complete. Summarize what was implemented and what tests verify it.

### After all steps

1. **Run the complete acceptance criteria checklist** from the plan's "Acceptance Criteria Verification" section. Confirm each criterion is verified by passing tests.
2. **Run the full quality check suite** one final time.
3. **Commit the implementation** with a commit message that treats the git history as a durable implementation log. The audience is future humans and AI agents running `git log`, `git blame`, and `git bisect` months or years later -- someone tracing a regression, recovering the rationale behind non-obvious code, or understanding why a design decision was made. Write accordingly:
   - **Subject:** `<area>: <imperative summary>`, 72 chars max, capitalized, no trailing period.
   - **Body (mandatory):** context and motivation (which requirement, which plan step, why now), non-obvious design choices, terse notes on alternatives tried or rejected (when the TDD loop revealed a failed approach -- encouraged but not mandatory), constraints preserved, and verification performed (which quality checks passed).
   - **Trailers:** `Requirement: REQ-NNN`, `Plan: <path>`, `Step: N/M`, and `Fixes:` / `Refs:` / `Link:` as applicable.
   - Never use `git commit -m`. Wrap body at 72 characters.
   - See [Git hygiene reference](references/git-hygiene.md) for full format, trailer vocabulary, and rationale.
4. **Record the commit SHA** -- you will need it for the next steps.
5. **Apply the PRD status transitions.** The plan enumerates every transition in §4 **High-level Requirements Realized** and in the per-step sections. Execute them with the `clif-d req` CLI, never by hand-editing `prd.json`:
   - **Every low-level requirement targeted by the plan:** `clif-d req done REQ-NNN --commit=<sha>` (the SHA from step 4). This sets `status` to `"done"` and records `implementation_commit` in one atomic, validated write.
   - **Every high-level requirement marked "Fully realized" in §4:** `clif-d req done REQ-MMM --commit=<sha>` using the same implementation SHA. A high-level requirement is realized by the collection of low-level requirements this plan closes, so it shares their commit.
   - **Every high-level requirement marked "Partially realized" in §4 that is still `not_started`:** `clif-d req start REQ-MMM`. No `implementation_commit` -- it is not done yet; a future plan will close it.
   - **Any partially-realized high-level requirement already `in_progress`:** no transition; it stays `in_progress`.

   If some transitions were already performed inline as individual plan steps (per the plan's Status Transition Steps guidance), the remaining ones are whatever is left. Verify the final PRD state matches §4 before committing.

   If the plan has no §4 section (older plans predating this guidance), close only the low-level requirements the plan explicitly targets, and flag in your completion summary which high-level requirements appear to have been realized but were not closed. The reviewer can then update them or schedule a follow-up plan.
6. **Move the plan to executed.** Move the plan file from `clif-d/plans/active/` to `clif-d/plans/executed/`. Create the `executed/` directory if it does not yet exist. Append the commit SHA to the plan's header metadata (e.g. `**Implementation commit:** <sha>`).
7. **Write a lessons-learned file.** Create `clif-d/plans/lessons_learned/` if it does not yet exist. Write a Markdown file named to match the plan (e.g. `lessons-REQ-NNN.md`) that records any significant problems encountered during implementation and how they were resolved. Include:
   - **User corrections** -- places where the user redirected your approach or pointed out a misunderstanding.
   - **Surprise failures** -- commands that failed unexpectedly, especially repeated failures of the same kind.
   - **Regressions** -- tests or behaviors that broke during implementation and what caused them.
   - **Plan deviations** -- steps where the plan was wrong or insufficient, what the actual solution was, and why.
   - **Environment or tooling issues** -- dependency problems, version mismatches, configuration surprises.
   If nothing significant happened -- the implementation went smoothly with no surprises -- write a short file noting that and skip the categories above. Do not fabricate lessons for the sake of filling the file.
8. **Commit the lifecycle updates** (PRD status changes, plan move, and lessons-learned file) as a separate commit. This keeps the implementation commit clean and the lifecycle bookkeeping distinct. The bookkeeping commit follows the same format as the implementation commit (see [Git hygiene reference](references/git-hygiene.md)), but its body should: name the implementation commit's SHA in a `Refs:` trailer, list the PRD status transitions (e.g., "REQ-042: not_started -> done"), list plan-file moves, and name any lessons-learned file created.
9. **Summarize** what was implemented: files created/modified, tests written, any deviations from the plan and why. Include both commit SHAs (implementation and lifecycle).

---

## Code Style Guidelines

These apply universally, regardless of language:

### Functions

- **Single responsibility**: One function, one job. If you need to describe a function with "and" ("parses the input and validates it and writes it to disk"), split it.
- **Small**: Most functions should be 5-15 lines. A 30-line function is suspicious. A 50-line function is almost certainly doing too much.
- **Pure where possible**: Functions that take inputs and return outputs without side effects are easier to test and reason about. Isolate side effects (I/O, mutation) at the edges.
- **Explicit error handling**: Return errors, don't throw/panic. Handle every error case. The "happy path only" implementation is not done.

### Modules

- **Clear boundaries**: Each module has a public interface (what it exports) and private internals. The public interface should be small and stable. The internals can change freely.
- **One direction of dependency**: Module A depends on Module B, or B depends on A, never both. If you find circular dependencies, restructure.
- **Cohesion**: Everything in a module should relate to the module's single responsibility. If a module has "utils" in its name, it probably lacks cohesion.

### Tests

- **Descriptive names**: `test_login_with_expired_token_returns_exit_code_1`, not `test_login_error`. The test name should describe the scenario and expected outcome.
- **Arrange-Act-Assert**: Set up the preconditions, perform the action, check the result. Keep these sections visually distinct.
- **One behavior per test**: A test that checks three different behaviors will give a confusing failure message. Write three tests.
- **No test interdependence**: Tests must pass in any order. No shared mutable state between tests.
- **Test the interface, not the implementation**: Test what the module does (its public interface), not how it does it (its internal structure). This makes tests resilient to refactoring.

### Naming

- **Be specific**: `user` → `authenticated_user`. `data` → `csv_row`. `result` → `parsed_transaction`.
- **Be consistent**: If you call it `parse` in one module, don't call it `decode` in another for the same concept.
- **Follow the language's conventions**: `camelCase` or `snake_case` as the language dictates. Don't fight the ecosystem.

### Comments and documentation

- **Module-level docs**: Every module has a brief description of its responsibility and public interface.
- **Function-level docs**: Public functions have a brief description of what they do, their parameters, and their return value.
- **Inline comments**: Only for *why*, never for *what*. If you need to explain *what* the code does, the code isn't clear enough -- rewrite it.
- **No commented-out code**: Delete it. Version control exists.

---

## Handling Common Situations

### The test is hard to write

If a test is difficult to write, that's often a signal that the interface being tested is poorly designed. Consider:
- Is the function doing too much? Split it.
- Are there too many dependencies? Inject them.
- Is the behavior too coupled to I/O? Separate the logic from the I/O.

### The implementation is more complex than expected

If a step's implementation is growing beyond what the plan anticipated:
- Stop and check: are you implementing more than the step requires?
- If the complexity is genuinely necessary, implement the minimum for this step and note that the plan may need additional steps.
- Do not gold-plate. The plan's step boundary is your scope boundary.

### A previous step's code needs to change

This happens. When it does:
- Make the change.
- Run the previous step's tests to confirm they still pass.
- Run the full suite to confirm no regressions.
- Note the change and why it was necessary.

### You disagree with the plan

Implement the plan as written. Note your disagreement and reasoning in your completion summary. The plan author can decide whether to adjust future plans based on your feedback.

Exception: if the plan asks you to do something that would break existing tests, violate quality guardrails, or introduce a security vulnerability, do not do it. Explain why and wait for guidance.

---

## References

This skill's references directory contains detailed, language-agnostic guidance. Consult them as needed during implementation -- don't try to memorize them upfront.

### Testing

- **Quick lookup**: [Cheat sheet](references/testing-cheat-sheet.md) -- dos, don'ts, smells, naming templates
- **Principles**: [Testing principles](references/testing-principles.md) -- universal test design guidance with Do/Don't examples
- **Unit tests**: [Unit test guide](references/testing-unit.md) -- scope, worked examples, pitfalls, checklist
- **Integration tests**: [Integration test guide](references/testing-integration.md) -- scope, worked examples, pitfalls, checklist
- **Scenarios**: [Overview](references/testing-overview.md) -- "what kind of test do I need?" quick-reference table

These references focus on *writing* tests during Red-Green-Refactor execution. They assume the plan already specifies which types of tests to write and where -- that's the plan-requirement skill's job. They also assume quality guardrails (linting, type checking, test enforcement) are already designed and installed -- that's the combined responsibility of `design-backpressure` (what the guardrails are) and `bootstrap-dev-environment` (making them real and invokable).

### Git

- **Commit messages**: [Git hygiene](references/git-hygiene.md) -- subject format, body structure, trailer vocabulary, self-containment principle, bookkeeping commits
