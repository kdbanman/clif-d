# Test Organization & Maintenance

This document covers the structural and operational aspects of a test suite: how to organize test files, name things consistently, think about coverage, maintain tests over time, and deal with flakiness. Consult this document at project setup time and revisit it periodically as the codebase grows.

**Primary sources:**
- *Software Engineering at Google*, Ch 11-12
- *xUnit Test Patterns* (Meszaros), Ch 12: Organizing Our Tests, and Ch 6: Test Automation Strategy
- Martin Fowler's testing articles

---

## 1. File and Directory Structure

There are two dominant conventions for where test files live relative to production code. Neither is universally better — choose one and be consistent within a project.

**Co-located tests (test files alongside source files):**

```
src/
  user/
    user_service.py
    user_service_test.py
    user_repository.py
    user_repository_test.py
```

Advantages: Easy to find the test for a given file. Encourages writing tests at the same time as production code. Makes it obvious when a file lacks tests.

**Separate test directory (mirror structure):**

```
src/
  user/
    user_service.py
    user_repository.py
tests/
  user/
    test_user_service.py
    test_user_repository.py
```

Advantages: Clean separation of production and test code. Easier to exclude tests from production builds. Some frameworks and languages expect this layout.

### Organizing by Test Type

When a project has multiple test types (unit, integration, E2E), organize them into clearly separated directories or markers:

```
tests/
  unit/
    ...
  integration/
    ...
  e2e/
    ...
  smoke/
    ...
```

This allows each category to be run independently — unit tests on every commit, integration tests in CI, E2E tests on deployment. It also makes it clear what kind of test you're looking at when reading the code.

If your framework supports tags or markers (pytest markers, JUnit tags, RSpec tags), use them in addition to or instead of directory separation. Either way, the ability to run "just the unit tests" or "just the smoke tests" is essential.

---

## 2. Naming Conventions

### Test Files

Name test files to make the mapping from source file to test file obvious. Common conventions:

- `thing_test.py` (Go, some Python projects)
- `test_thing.py` (pytest convention)
- `ThingTest.java` / `ThingSpec.scala`
- `thing.test.js` / `thing.spec.ts`

Whatever you choose, be consistent. A developer should be able to find the test for any file without searching.

### Test Classes and Methods

Name tests after the behavior they verify, not the method they call.

**Pattern:** `unitOfWork_stateUnderTest_expectedBehavior`

Examples:
- `transfer_insufficientBalance_declinesTransaction`
- `parseConfig_missingRequiredField_throwsValidationError`
- `searchIndex_emptyQuery_returnsAllResults`

This pattern makes test names self-documenting — when a test fails, the name tells you what broke without reading the test body.

Avoid:
- `testProcessTransaction` (which behavior? which scenario?)
- `test1`, `test2` (meaningless)
- `testBug1234` (tell the reader what the bug was, not its ticket number — add the ticket number in a comment if needed)

### Test Suite / Test Class Naming

Group tests into classes or suites that correspond to the unit or feature being tested:

- `UserServiceTest` — all unit tests for the UserService
- `CheckoutFlowIntegrationTest` — integration tests for the checkout workflow
- `LoginSmokeTest` — smoke tests for login functionality

---

## 3. Test Independence and Ordering

**Every test must be independent.** A test must produce the same result regardless of which other tests have run before it, what order tests run in, or whether tests run in parallel.

Violations of this principle — "Interacting Tests" in Meszaros's terminology — are one of the most insidious sources of flakiness. They create failures that only appear in specific CI runs, are impossible to reproduce locally, and waste enormous amounts of debugging time.

Achieving independence requires:

- **Fresh fixtures:** Each test creates its own state from scratch. Do not rely on state left by a previous test.
- **No shared mutable state:** If tests share a database, each test must either use a dedicated schema/table, wrap in a rolled-back transaction, or clean up after itself reliably.
- **No assumed ordering:** Never design tests that must run in a specific sequence. If your framework runs tests in alphabetical order today, it might parallelize them tomorrow.
- **Idempotent tests:** Running a test twice in a row must produce the same result. Tests that create resources should either clean up or use unique identifiers.

---

## 4. Test Fixture Management

A **fixture** is the state needed for a test to run — objects, data, configuration, external services. Fixture management is a strategic choice that significantly impacts test speed, reliability, and maintainability.

### Fresh Fixture (preferred default)

Each test creates its own fixture from scratch. This maximizes test independence and is the most reliable approach.

Use factory methods or builder patterns to make fixture creation concise:

```python
def make_user(name="default", balance=100):
    return User(name=name, balance=balance)
```

The factory provides sensible defaults so that each test specifies only the values relevant to its scenario.

### Shared Fixture (use with caution)

Multiple tests share a common fixture (e.g., a database seeded once for the entire test class). This is faster than recreating the fixture per test, but creates coupling between tests.

If you use shared fixtures:
- Make the shared fixture **immutable** during tests. Tests should read from it, not modify it.
- If tests must modify shared state, use a transaction-rollback strategy so each test sees the original state.
- Document explicitly which fixture is shared and what it contains, so tests don't become Mystery Guests.

---

## 5. Coverage: How to Think About It

### What Coverage Tells You

Code coverage measures the percentage of your code that is *executed* during testing. The most common metrics:

- **Line coverage:** What percentage of lines were executed.
- **Branch coverage:** What percentage of conditional branches (if/else, switch) were taken.
- **Function/method coverage:** What percentage of functions were called.

Coverage is a **useful negative indicator**: if a module has 20% line coverage, you know large parts of it are untested. But coverage is a **poor positive indicator**: 100% line coverage does not mean your tests are good. A test that calls a function without asserting on its result achieves coverage without verifying behavior.

### Guidelines for Using Coverage

**Use coverage to find gaps, not to declare victory.** Run coverage reports periodically and examine uncovered areas. Ask: "Is this uncovered code high-risk? Should it have tests?" Sometimes the answer is no — trivial getters, generated code, or dead code may not warrant tests.

**Set per-component floors, not project-wide ceilings.** A data processing pipeline with complex transformation logic might warrant 90%+ coverage. A thin API adapter might be well-served at 60%. Setting a single project-wide target (e.g., "80% coverage") incentivizes gaming — engineers write meaningless tests for easy-to-cover code while ignoring hard-to-test, high-risk code.

**Watch for falling coverage, not just low coverage.** If a module's coverage drops significantly between commits, it means new code was added without tests. This is a more actionable signal than absolute coverage numbers.

**Never game coverage.** Tests that execute code without meaningful assertions are worse than no tests — they create false confidence. If a coverage tool counts a test as "covering" a function, but the test never checks the function's output, the coverage number is a lie.

### Mutation Testing (a more rigorous alternative)

Mutation testing introduces small changes (mutations) to your production code and checks whether your tests catch them. If a test suite achieves high coverage but doesn't detect most mutations, the tests are executing code without truly verifying its behavior. Mutation testing is more expensive to run but produces more meaningful quality signals than line coverage alone. Consider it for high-risk components.

---

## 6. Maintaining Tests Over Time

Test code is real code. It needs maintenance, refactoring, and care — not just the production code it tests.

### When to Refactor Tests

- **When you find an Obscure Test:** If a test is hard to understand, refactor it for clarity before it causes more confusion. Extract helper methods, inline Mystery Guests, remove irrelevant setup.
- **When you find duplication across many tests:** Extract common patterns into well-named utility functions or builders. But don't over-extract — each test should remain readable in isolation (DAMP over DRY).
- **When tests are fragile:** If tests break on unrelated changes, they are coupled to implementation details. Refactor to test via public APIs and assert on state, not interactions.
- **When a test class grows too large:** If a test file has hundreds of tests, it's probably testing too many behaviors in one place. Split by behavior or sub-feature.

### Deleting Tests

Tests can and should be deleted when they no longer provide value:

- **Redundant tests:** If a behavior is covered by multiple tests at different levels and the lower-level test provides the same confidence as the higher-level one, the higher-level test may be deletable.
- **Tests for deleted features:** When a feature is removed, its tests should be removed too. Dead tests add noise and maintenance burden.
- **Permanently broken tests:** A test that has been skipped or disabled for months is providing zero value while cluttering the suite. Either fix it or delete it.
- **Change-detector tests:** Tests that fail on every cosmetic or structural change without catching real bugs are net negative. Delete them and replace with behavior-focused tests.

### Preventing Test Rot

- **Review test code with the same rigor as production code.** If code review skips the test files, test quality will degrade over time.
- **Run the full test suite regularly.** Tests that are never run are tests that silently break. If certain tests are too slow to run in CI, consider moving them to a nightly or weekly run — but ensure they run.
- **Track test health metrics.** Flake rate, test run duration, and test count growth over time can all indicate emerging problems before they become crises.

---

## 7. Dealing with Flaky Tests

A flaky test is one that passes and fails nondeterministically without any change to the code under test. Flaky tests are one of the most damaging problems a test suite can have — they erode trust in the entire suite, waste debugging time, and train engineers to ignore test failures.

### Common Causes

- **Shared mutable state:** Tests modify a shared resource (database, file, global variable) and interfere with each other.
- **Timing dependencies:** Tests rely on specific timing (network latency, thread scheduling, animation completion) that varies between runs.
- **Order dependence:** Tests pass only when run in a specific order because they rely on state left by previous tests.
- **External service dependencies:** Tests call real external services that are sometimes slow, unavailable, or returning different data.
- **Resource leaks:** Tests don't clean up properly, causing later tests to fail as resources are exhausted.

### Strategies

**Quarantine, don't disable.** When a test is identified as flaky, move it to a separate quarantine suite that runs separately from the main suite. This prevents it from blocking other engineers while keeping it visible for fixing. A disabled test is invisible — it will stay disabled forever.

**Fix the root cause, not the symptom.** Adding retries or increasing timeouts papers over flakiness without fixing it. Diagnose whether the issue is shared state, timing, or external dependencies, and fix the actual problem.

**Eliminate shared mutable state aggressively.** The most effective anti-flakiness measure. Use fresh fixtures, unique identifiers, or transaction rollbacks to ensure test isolation.

**Replace real external calls with fakes or stubs.** If a test is flaky because of an external service, replace that dependency with a test double. The risk of reduced fidelity is worth the gain in reliability.

**Track flake rates.** Monitor which tests fail most often and prioritize fixing them. A test that flakes once a week is an annoyance; a test that flakes once per CI run is an emergency.

---

## 8. Test Suite Performance

As a codebase grows, test suite execution time naturally increases. If the suite becomes too slow, engineers stop running it, and the tests lose their value.

### Speed Guidelines

- **Unit tests:** Milliseconds per test. The full unit suite should run in under a minute for most projects.
- **Integration tests:** Low seconds per test. The full integration suite should run in under 10 minutes.
- **E2E tests:** Seconds to low minutes per test. The full E2E suite should run in under 30 minutes.
- **Smoke tests:** The complete smoke suite should run in under 2 minutes.

These are rough guidelines — adjust for your project's size and constraints. See [./testing-types.md](./testing-types.md) for detailed guidance on each type's characteristics and appropriate use.

### When the Suite Gets Slow

- **Profile the suite.** Find the slowest tests and ask why they're slow. Common culprits: unnecessary I/O, redundant fixture setup, tests at too broad a scope.
- **Push tests down the pyramid.** If an integration test is slow because it sets up a full database for what is essentially a logic test, rewrite it as a unit test with a fake. See [./testing-strategy.md](./testing-strategy.md) for guidance on choosing the right test scope.
- **Parallelize.** Most modern test frameworks support parallel execution. This requires test independence (no shared mutable state) but can dramatically reduce wall-clock time.
- **Partition by type.** Run unit tests on every commit, integration tests in CI, and E2E tests on deployment. Each category has a different acceptable run time.
