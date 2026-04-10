---
name: implement-plan
description: >
  Implement code according to a plan from the plan-requirement skill, with rigorous TDD discipline, modular
  code structure, and continuous quality verification. Use this skill when the user has an implementation plan
  (Markdown file from the plan-requirement skill or equivalent) and wants to execute it step by step. Follows
  the plan's test-first ordering strictly — writes each test before its implementation, runs tests after each
  step, and runs all quality checks (lint, type-check, format) before considering a step complete. Produces
  clean, modular, well-documented code that passes all guardrails on every commit.
---

# Implement According to Plan

You are implementing code by following a structured implementation plan. The plan specifies what to build, in what order, with what tests, and to what quality standards. Your job is to execute it faithfully, writing high-quality code that passes all guardrails at every step.

---

## Philosophy

### The plan is the contract

Follow the plan's step ordering and test-first structure. Do not skip steps, reorder steps, or combine steps unless you encounter a concrete problem that makes the plan's ordering impossible — and if that happens, explain what you found and why you're deviating before proceeding.

The plan was written with care about decomposition and verification ordering. Respecting it means each step is independently verifiable, which is the whole point.

### Red-Green-Refactor, literally

For every step that includes a "Test first" section:

1. **Red**: Write the test. Run it. Confirm it fails. If it passes before you've written the implementation, something is wrong — either the test is trivial, the behavior already exists, or the test isn't testing what it claims. Investigate before proceeding.

2. **Green**: Write the minimum implementation to make the test pass. Do not write more than what the test demands. Run the test. Confirm it passes.

3. **Refactor**: Look at what you just wrote. Is there duplication? Is the code clear? Are names precise? Is the module boundary right? Refactor if needed — and run the tests again after refactoring to confirm nothing broke.

This is not a suggestion — it's the implementation protocol. Skipping the Red step (writing tests that already pass) defeats the purpose of TDD.

### Quality checks are not optional

After completing each step's implementation:

1. **Run the step's specific tests** — they must pass.
2. **Run the full test suite** — nothing previously passing should break.
3. **Run the linter** — no new violations.
4. **Run the type checker** — no new errors.
5. **Run the formatter** — code must be formatted.

If any check fails, fix the issue before moving to the next step. Do not accumulate debt across steps.

If the project has pre-commit hooks configured (see `QUALITY.md`), these checks will also run at commit time. But don't rely on hooks as your only verification — run checks explicitly after each step so you catch issues immediately, not at commit time when the context has shifted.

### Code quality is not negotiable

Write code that is:

- **Modular**: Each function does one thing. Each module has a clear, single responsibility. Dependencies between modules flow in one direction. If you find yourself writing a function longer than ~20 lines, split it.

- **Explicit**: No magic. No implicit behavior. No reliance on global state. Every function's inputs and outputs are clear from its signature. Error cases are handled explicitly, not swallowed.

- **Named precisely**: Names are the primary documentation. A function called `process_data` is a failure. A function called `parse_csv_row_to_transaction` is a success. Variables, functions, modules, and types should all have names that make the code readable without comments.

- **Documented where non-obvious**: Don't comment *what* the code does (the code says that). Comment *why* — the business reason, the edge case being handled, the constraint being respected. Module-level documentation should explain the module's responsibility and public interface.

- **Tested at the right level**: Unit tests for logic. Integration tests for CLI behavior. Don't write unit tests for trivial getters. Don't write integration tests for pure computation. Test at the boundary where the behavior is most meaningfully verified.

### Handle plan deviations explicitly

Sometimes the plan doesn't survive contact with reality. When this happens:

- **If a test needs to be different than sketched**: Write the correct test and note why it differs from the plan.
- **If an implementation approach doesn't work**: Try the plan's approach first. If it genuinely doesn't work, explain what you found, what you're doing instead, and why.
- **If you discover a missing step**: Implement it in the spirit of the plan's structure — test first, verify after.
- **If you discover the plan has a bug**: Stop and explain the issue. Don't silently work around it.

The plan is the contract, but a contract interpreted in good faith, not followed off a cliff.

---

## Input

This skill expects:

1. **An implementation plan** (Markdown file from the `plan-requirement` skill or equivalent). The user will provide the file path.
2. **The project codebase** — the implementation is written directly into the project.

Read the full plan before starting. Understand the overall arc — what's being built, why, and how the steps connect — before writing any code.

---

## Execution Protocol

### Before starting

1. **Read the plan fully.** Understand the objective, context, prerequisites, and the full sequence of steps.
2. **Verify prerequisites.** Check that required dependencies are installed, required modules exist, required configuration is in place. If a prerequisite is not met, stop and report it.
3. **Identify the quality check commands.** From the plan's Context Summary or the project's `QUALITY.md`, determine the exact commands for: running tests, running the linter, running the type checker, running the formatter.
4. **Run the existing test suite.** Confirm it passes before you change anything. If it doesn't, stop and report — you need a green baseline to detect regressions.

### For each step

Follow this sequence exactly:

#### 1. Announce the step

State which step you're executing and what it will accomplish. This provides a clear progress trail.

#### 2. Write the test (Red)

- Create or modify the test file specified in the plan's "Test first" section.
- Follow the plan's test sketch, but write real, complete test code — not pseudocode.
- **Run the test.** It should fail (Red). If it passes, investigate:
  - Is the behavior already implemented? → Skip the implementation part of this step, note why.
  - Is the test not actually testing the right thing? → Fix the test.
  - Is the test trivially passing (e.g., testing a no-op)? → Make the test more specific.

#### 3. Write the implementation (Green)

- Create or modify the implementation files specified in the plan's "Implement" section.
- Write the **minimum code** to make the failing test pass. Resist the urge to implement the next step's functionality.
- **Run the step's test.** It should pass (Green).
- **Run the full test suite.** Everything should pass — no regressions.

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
- **Linter**: Run the linter. Fix any violations. Do not suppress lint rules without a clear, documented justification.
- **Type checker**: Run the type checker. Fix any errors.
- **Full test suite**: One final run to confirm everything is green.

If any check fails, fix the issue before proceeding. This is a hard gate.

#### 6. Confirm step completion

State that the step is complete. Summarize what was implemented and what tests verify it.

### After all steps

1. **Run the complete acceptance criteria checklist** from the plan's "Acceptance Criteria Verification" section. Confirm each criterion is verified by passing tests.
2. **Run the full quality check suite** one final time.
3. **Summarize** what was implemented: files created/modified, tests written, any deviations from the plan and why.

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
- **Inline comments**: Only for *why*, never for *what*. If you need to explain *what* the code does, the code isn't clear enough — rewrite it.
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
