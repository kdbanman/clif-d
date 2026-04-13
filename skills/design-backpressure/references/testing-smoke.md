# Smoke Tests

## What They Are

A smoke test is a small, fast suite of tests that verifies the most basic, critical functionality of a system is working. The name comes from hardware testing — when you power on a new circuit board, the first test is whether it catches fire (produces smoke). If it does, you don't bother with further testing.

Smoke tests answer one question: "Is this build/deployment so broken that further testing is pointless?"

## Why They Exist

Smoke tests serve as a fast, cheap gate that catches catastrophic failures early:

- **A build that won't start.** Configuration errors, missing dependencies, corrupted artifacts.
- **A deployment where the application doesn't respond.** Server crashes on startup, database connection failures, missing environment variables.
- **A release where core functionality is completely broken.** Login fails, the main page doesn't render, the primary API endpoint returns errors.

By catching these failures in seconds rather than waiting for a full test suite to run (which could take minutes or hours), smoke tests save time and prevent wasted effort running a comprehensive test suite against a fundamentally broken build.

## When to Use Them

Use smoke tests:

- **After every build** as the first automated check. If smoke tests fail, skip the rest of the test suite.
- **After every deployment** to a new environment (staging, production) to verify the deployment succeeded.
- **As a health check** for a running system — a lightweight probe that monitoring systems can run continuously.
- **As a gating check** before running a more expensive test suite. If smoke tests fail, there's no point running integration or E2E tests.

## Scope and Boundaries

Smoke tests are deliberately shallow and narrow. They should:

- **Cover only the critical path.** Login, the main landing page, the primary API endpoint, the core happy-path workflow. Nothing more.
- **Run in seconds, not minutes.** If your smoke suite takes more than 1-2 minutes, it is too large.
- **Be small in number.** A typical smoke suite might have 5-15 tests. If you have 50+, you've drifted into integration or E2E territory.
- **Verify "alive and responding correctly," not "fully correct."** A smoke test for a search endpoint might verify that it returns 200 OK with a non-empty result set for a known query. It does not verify that the results are ranked correctly or that pagination works.

## Relationship to Other Test Types

Smoke tests are a *subset* of your broader test suite, selected for speed and criticality. They overlap with other types:

- A smoke test might be a unit test ("does the config parser load without errors?").
- A smoke test might be an integration test ("does the app connect to the database on startup?").
- A smoke test might be a thin E2E test ("does the login page render and accept credentials?").

The defining characteristic is not scope but *purpose and speed*: smoke tests exist to fail fast on catastrophic problems.

## Relevance to Backpressure Design

Smoke tests are the purest expression of the backpressure philosophy: a fast, hard gate that catches catastrophic failures before any further effort is wasted. When designing enforcement infrastructure, consider where smoke tests fit in the gate sequence:

- **Pre-push or early CI:** Run smoke tests before the full test suite. If smoke fails, abort — there is no point running hundreds of tests against a fundamentally broken build.
- **Post-deployment:** Run smoke tests immediately after deploying to any environment. A deployment that fails smoke is rolled back before anyone notices.
- **Separate from the main suite:** Smoke tests should be runnable independently via directory separation or markers (e.g., `tests/smoke/` or a `@smoke` marker). See [testing-enforcement.md](./testing-enforcement.md) for guidance on partitioning by type.

## Type-Specific Pitfalls

**Scope creep.** The most common failure mode. A smoke suite that grows to 100+ tests is no longer a smoke suite — it's a slow integration suite labeled "smoke." Resist the urge to add "just one more" test. If a test isn't checking for a catastrophic, ship-blocking failure, it doesn't belong in smoke.

**False confidence from passing smoke tests.** Smoke tests passing does not mean the system works correctly. It means the system isn't dead on arrival. Teams that treat a passing smoke suite as sufficient validation will ship bugs. Smoke tests are a necessary first check, not a sufficient final one.

**Smoke tests that are too clever.** A smoke test should be trivially simple. If a smoke test itself has bugs, or requires complex setup, it undermines its purpose. Keep them as plain and obvious as possible.

## Checklist

When writing or reviewing a smoke test, verify:

- [ ] **Catastrophic failure only:** The test checks for a failure that would make the system fundamentally unusable, not a subtle bug.
- [ ] **Fast:** The test completes in seconds. The whole suite should run in under 2 minutes.
- [ ] **Simple:** The test is trivially easy to understand — no complex setup, no nuanced assertions. No logic in tests.
- [ ] **Independent:** The test does not depend on other smoke tests having run first.
- [ ] **Critical path only:** The test covers functionality that, if broken, blocks all users or all further testing.
- [ ] **Suite size:** The total smoke suite remains small (5-15 tests). If it's larger, prune non-critical tests.
