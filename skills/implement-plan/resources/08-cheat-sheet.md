# Testing Cheat Sheet

Pin this next to your editor. For full explanations and examples, see [Principles & Practices](./01-principles-and-practices.md).

---

## Before You Write a Test, Ask:

1. **What behavior am I testing?** (Not: what method am I calling.)
2. **What's the lowest test level that can verify this?** (Unit > Integration > E2E.)
3. **Would a user of this code care if this behavior changed?** If yes, test it. If no, you may be testing implementation details.

---

## The Structure of Every Test

```
Arrange  →  set up preconditions
Act      →  do the ONE thing being tested
Assert   →  verify the expected outcome
```

One Act step. One behavior. One test. Separate with blank lines.

---

## Do

- **Test through public APIs.** Call the code the same way its real users would.
- **Assert on state / output.** "The balance is 50" not "save() was called once."
- **Hardcode expected values.** `assert total == 42.00` not `assert total == price * rate`.
- **Name tests after behavior.** `transfer_insufficient_funds_declines` not `testTransfer`.
- **Make the test self-contained.** A reader should understand it without opening another file.
- **Use helpers for boilerplate.** `make_user(role="admin")` with sensible defaults.
- **Create fresh state per test.** No shared mutable fixtures between tests.
- **Write a regression test before fixing a bug.** Verify it fails, then fix, then verify it passes.
- **Use real dependencies** when they are fast and deterministic. Prefer real > fake > stub > mock.
- **Write clear failure messages.** "Expected status 'completed' but got 'failed'" not "assert False."

---

## Don't

- **Don't test private/internal methods.** If you must change visibility to test it, test through the public caller instead.
- **Don't put logic in tests.** No `if`, no `for`, no string concatenation to build expected values.
- **Don't over-mock.** If you're verifying `mock.save.assert_called_once_with(...)`, you're testing wiring, not behavior.
- **Don't share mutable state between tests.** Each test must pass in isolation and in any order.
- **Don't compute expected values.** `assert user.full_name() == user.first + " " + user.last` is a change-detector, not a test.
- **Don't write one test per method.** Write one test per *behavior*. A method may have many behaviors.
- **Don't cram multiple behaviors into one test.** If you have two Act steps, you have two tests.
- **Don't use fixed sleep timers** in tests that wait for async operations. Wait for a specific condition.
- **Don't test at a higher level than necessary.** If it's pure logic, unit-test it. Don't spin up a server.
- **Don't skip reviewing test code.** Test code rots just like production code.

---

## Test Doubles: Preference Order

```
1. Real implementation  ← best fidelity, use when fast and deterministic
2. Fake                 ← lightweight working implementation (in-memory DB, fake emailer)
3. Stub                 ← returns pre-programmed responses
4. Mock                 ← records calls for assertion (use sparingly)
```

---

## Test Smells: Quick Diagnosis

| Symptom | Likely smell | Fix |
|---|---|---|
| Tests break on unrelated changes | Fragile Test | Test via public APIs; assert on state, not interactions |
| Can't understand what a test does | Obscure Test / Mystery Guest | Inline relevant setup; remove irrelevant details |
| Tests are slow | Slow Tests | Replace real I/O with fakes; push to lower test level |
| Tests pass/fail randomly | Erratic / Flaky Test | Eliminate shared state; control time/randomness inputs |
| Tests mirror the code exactly | Change-Detector | Hardcode expected values; test *what*, not *how* |
| Test has if/else or loops | Conditional Test Logic | Split into separate tests or use parameterized tests |
| Fixing one test breaks another | Interacting Tests | Use fresh fixtures; no shared mutable state |
| Tests exist but bugs still ship | Buggy Tests / No assertions | Add meaningful assertions; check for coverage-gaming |

---

## Naming Template

```
[unit]_[condition]_[expected result]
```

Examples:
- `parseDate_invalidFormat_throwsParseError`
- `applyDiscount_goldTier_returns15Percent`
- `login_expiredPassword_promptsReset`
- `searchIndex_emptyQuery_returnsAllResults`
- `transfer_negativeAmount_isRejected`

---

## Coverage: What It Does and Doesn't Tell You

- **Low coverage = untested code.** Investigate high-risk uncovered areas.
- **High coverage ≠ good tests.** A test with no assertions achieves coverage but catches nothing.
- **Watch for drops**, not just absolute numbers. Coverage decreasing means new code has no tests.
- **Set per-component floors**, not one project-wide ceiling.

---

## When to Write Each Type of Test

| Situation | Test type | Speed expectation |
|---|---|---|
| Testing a function, class, or module in isolation | Unit | Milliseconds |
| Testing that two components work together (code + DB, API + service) | Integration | Seconds |
| Testing a full user workflow end to end | E2E | Seconds to minutes |
| Verifying a feature meets business requirements | Acceptance | Depends on scope |
| Checking that a build/deploy isn't dead on arrival | Smoke | Seconds (whole suite < 2 min) |
| Preventing a fixed bug from returning | Regression (at lowest viable level) | Depends on level |
