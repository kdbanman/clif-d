# Testing Enforcement Infrastructure

> **Context:** This reference supports the `design-backpressure` skill, which designs the enforcement infrastructure for testing -- the gates that ensure tests are run and pass before code enters the repository. It does NOT write the tests themselves or install the gates. Tests are planned by the `plan-requirement` skill and written by the `implement-plan` skill; the gates are installed and wired to the toolchain by `bootstrap-dev-environment`. The backpressure system trusts that the other skills produce well-structured tests and a working environment; its job is to specify how and where those tests are *executed reliably* as hard gates.

---

## Speed Guidelines by Test Type

Tests that are too slow to run at a given gate will be skipped at that gate. Speed determines where enforcement is viable.

| Test type | Per-test budget | Full suite budget | Notes |
|---|---|---|---|
| Unit | Milliseconds | Under 1 minute | No I/O, no network, no database. If a "unit" test takes seconds, it is misclassified. |
| Integration | Low seconds | Under 10 minutes | May use localhost services, in-memory databases, local filesystem. |
| E2E | Seconds to low minutes | Under 30 minutes | Full system, real (or near-real) dependencies. |
| Smoke | Seconds each | Under 2 minutes total | 5-15 tests covering only catastrophic failures. See [testing-smoke.md](./testing-smoke.md). |

These are rough guidelines. Adjust for project size — but treat violations as a signal that tests are at the wrong level, not that the budget needs expanding.

---

## What to Enforce Where

The backpressure system operates at three enforcement points. Each has a time budget that determines what can run there.

### Pre-commit (must complete in seconds)

1. **Format** changed files (auto-fix, re-stage).
2. **Lint** changed files (fail on violation, no auto-fix).
3. **Type-check** (often requires full-project analysis, not just changed files).
4. **Unit tests** — the full unit suite if it completes in seconds, or tests affected by changes if scoping tooling exists.

If the unit suite exceeds the seconds budget, it belongs in pre-push. Do not compromise the pre-commit gate's speed — a slow pre-commit hook trains developers (and agents) to bypass it.

### Pre-push (must complete in under a minute)

1. **Full test suite** — unit + integration.
2. **Smoke tests** if they are not already part of CI deployment verification.

Pre-push is the last local gate. Everything that can run locally in under a minute belongs here.

### CI (everything else)

1. **E2E tests.**
2. **Coverage enforcement** (thresholds, ratchets).
3. **Security scanning.**
4. **Performance/benchmark tests.**
5. **Mutation testing** (expensive but high-signal for critical components).

CI is not designed by this skill, but the backpressure document should note what belongs there so the boundary is explicit.

---

## Test Suite Performance Management

A test suite that grows slow enough to miss its gate budget is a suite that stops being enforced. Performance management is an ongoing concern, not a one-time decision.

### Diagnosing slowness

- **Profile the suite.** Find the slowest tests. Common culprits: unnecessary I/O, redundant fixture setup, tests running at too broad a scope.
- **Check classification.** A test that hits a real database but only validates business logic is an integration test wearing a unit test's name. Reclassify it — or better, rewrite it as a true unit test with a fake.

### Remediation

- **Push tests down the pyramid.** If an integration test is slow because it sets up a full database for what is essentially a logic test, rewrite it as a unit test with a fake. This is the single most effective speedup.
- **Parallelize.** Most modern test frameworks support parallel execution. This requires test independence (see below) but can dramatically reduce wall-clock time.
- **Partition by type.** Enforce directory or marker separation so that each gate runs only the tests appropriate to its budget. The ability to run "just the unit tests" or "just the smoke tests" is essential infrastructure.

---

## Test Independence as an Enforcement Concern

Test independence is not just a quality-of-tests concern — it is a prerequisite for reliable enforcement. Gates that produce nondeterministic results (pass on one run, fail on the next) destroy trust in the enforcement system. Engineers and agents learn to retry-and-ignore rather than fix.

Independent tests require:

- **Fresh fixtures.** Each test creates its own state from scratch. No reliance on state left by a previous test.
- **No shared mutable state.** If tests share a database, each test must use a dedicated schema, wrap in a rolled-back transaction, or clean up reliably.
- **No assumed ordering.** Tests must produce the same result regardless of execution order. This is also a prerequisite for parallelization.
- **Idempotent execution.** Running a test twice in a row must produce the same result.

When evaluating a project's test infrastructure for backpressure readiness, check that tests can run in any order and in parallel. If they cannot, that is a structural problem to flag — the enforcement gates will be unreliable until it is fixed.

---

## Dealing with Flaky Tests

Flaky tests — tests that pass and fail nondeterministically without code changes — are the single greatest threat to gate reliability. A flaky test in a pre-commit gate trains everyone to distrust the gate. A gate that is distrusted is a gate that gets bypassed.

### Common causes

- **Shared mutable state** between tests (database rows, files, global variables).
- **Timing dependencies** (network latency, thread scheduling, sleep-based waits).
- **Order dependence** — tests that only pass when run after specific other tests.
- **External service dependencies** — tests calling real services that are sometimes slow or unavailable.
- **Resource leaks** — tests that do not clean up, causing later tests to fail as resources exhaust.

### Strategy

**Quarantine, do not disable.** Move flaky tests to a separate quarantine suite that runs outside the critical gate path. A disabled test is invisible and will stay disabled forever. A quarantined test is visible and trackable.

**Fix the root cause, not the symptom.** Adding retries or increasing timeouts papers over flakiness. Diagnose whether the issue is shared state, timing, or external dependencies, and fix the structural problem.

**Eliminate shared mutable state aggressively.** This is the most effective anti-flakiness measure. Fresh fixtures, unique identifiers, and transaction rollbacks ensure test isolation.

**Replace real external calls with fakes or stubs.** If a test is flaky because of an external service, the reduced fidelity of a test double is worth the gain in gate reliability.

**Track flake rates.** Monitor which tests fail most often and prioritize fixing them. A test that flakes once a week is an annoyance. A test that flakes once per CI run is an emergency — it means the gate is effectively non-functional for that check.

### The backpressure designer's responsibility

When designing enforcement gates, establish policy for flaky test handling:

1. Define a flake rate threshold that triggers quarantine (e.g., any test that fails nondeterministically more than once in a week).
2. Establish a quarantine location (separate directory or marker) that runs outside the gate path.
3. Require root cause analysis for quarantined tests, not just "skip and move on."
4. Track quarantine size — a growing quarantine is a signal that the test infrastructure has systemic problems.
