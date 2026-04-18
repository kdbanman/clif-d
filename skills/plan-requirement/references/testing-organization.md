# Test Organization

This document covers the structural aspects of a test suite that matter at planning time: where test files go, how they are named, how tests stay independent, and how fixtures are managed. These decisions are made in the plan so that implementation steps are concrete and consistent.

**Primary sources:**
- *Software Engineering at Google*, Ch 11-12
- *xUnit Test Patterns* (Meszaros), Ch 12: Organizing Our Tests, and Ch 6: Test Automation Strategy
- Martin Fowler's testing articles

---

## 1. File and Directory Structure

There are two dominant conventions for where test files live relative to production code. Neither is universally better -- choose one and be consistent within a project.

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

This allows each category to be run independently -- unit tests on every commit, integration tests in CI, E2E tests on deployment. It also makes it clear what kind of test you're looking at when reading the code.

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

This pattern makes test names self-documenting -- when a test fails, the name tells you what broke without reading the test body.

Avoid:
- `testProcessTransaction` (which behavior? which scenario?)
- `test1`, `test2` (meaningless)
- `testBug1234` (tell the reader what the bug was, not its ticket number -- add the ticket number in a comment if needed)

### Test Suite / Test Class Naming

Group tests into classes or suites that correspond to the unit or feature being tested:

- `UserServiceTest` -- all unit tests for the UserService
- `CheckoutFlowIntegrationTest` -- integration tests for the checkout workflow
- `LoginSmokeTest` -- smoke tests for login functionality

---

## 3. Test Independence and Ordering

**Every test must be independent.** A test must produce the same result regardless of which other tests have run before it, what order tests run in, or whether tests run in parallel.

Violations of this principle -- "Interacting Tests" in Meszaros's terminology -- are one of the most insidious sources of flakiness. They create failures that only appear in specific CI runs, are impossible to reproduce locally, and waste enormous amounts of debugging time.

Achieving independence requires:

- **Fresh fixtures:** Each test creates its own state from scratch. Do not rely on state left by a previous test.
- **No shared mutable state:** If tests share a database, each test must either use a dedicated schema/table, wrap in a rolled-back transaction, or clean up after itself reliably.
- **No assumed ordering:** Never design tests that must run in a specific sequence. If your framework runs tests in alphabetical order today, it might parallelize them tomorrow.
- **Idempotent tests:** Running a test twice in a row must produce the same result. Tests that create resources should either clean up or use unique identifiers.

---

## 4. Test Fixture Management

A **fixture** is the state needed for a test to run -- objects, data, configuration, external services. Fixture management is a strategic choice that significantly impacts test speed, reliability, and maintainability.

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
