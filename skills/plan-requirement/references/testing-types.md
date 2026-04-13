# Test Types

This document summarizes all five test types at a conceptual level to support planning decisions. For deep guidance on writing specific test types, consult the implement-plan skill's references.

For acceptance tests specifically — which are central to requirement planning — see [testing-acceptance.md](./testing-acceptance.md) for the full reference.

---

## Unit Tests

### What They Are

A unit test verifies the behavior of a small, isolated piece of code — typically a single function, method, or class. It exercises the code through its public interface, asserts on observable output or state, and runs fast enough that an engineer can execute thousands of them in seconds.

Google defines unit tests as tests of "relatively narrow scope, such as of a single class or method." They are usually (but not always) "small" in Google's size taxonomy: single-process, single-threaded, no I/O.

### Why They Exist

- **Speed:** Millisecond execution times mean engineers can run them on every save and every commit.
- **Determinism:** No external dependencies means no flakiness.
- **Defect localization:** When a unit test fails, you know exactly which piece of code is broken.
- **Documentation:** A well-written unit test suite is the most reliable documentation of what a module does.
- **Refactoring safety:** Tests through public APIs give confidence to restructure internal code.

### When to Use Them

- Pure logic: data transformations, calculations, parsing, formatting, validation.
- Business rules and domain logic.
- Edge cases and boundary conditions.
- Error handling paths.
- Any code where inputs and outputs are well-defined and the code can be exercised without expensive setup.

Do **not** use unit tests for verifying that two components work together (use integration tests) or that a full user workflow works (use E2E tests).

### Scope and Boundaries

**Solitary vs. sociable unit tests:**

- **Solitary** tests isolate the unit from all collaborators using test doubles.
- **Sociable** tests allow the unit to interact with real collaborators, as long as the test remains fast and deterministic.

Google's current guidance leans sociable — prefer real implementations when they are fast and deterministic. Use test doubles only for dependencies that are slow, nondeterministic, or have significant side effects.

---

## Integration Tests

### What They Are

An integration test verifies that two or more components work together correctly. It exercises the seams between units — the interfaces, contracts, and data flows that connect them.

The term "integration test" is notoriously fuzzy. Fowler observes that its definition varies more than almost any other testing term. For this document: an integration test exercises a collaboration between components that a unit test, by design, does not cover. The components might be classes within a single service, a service and its database, an API layer and its business logic, or two microservices.

### Why They Exist

Correct units do not guarantee a correct system. Common bugs that only integration tests catch:

- A function produces output in a format its consumer doesn't expect.
- A database query works logically but fails with real schema constraints.
- Two modules agree on an interface at compile time but disagree on behavioral contracts (ordering, nullability, error semantics).
- Serialization/deserialization between components loses data or changes types.

### When to Use Them

- Verifying your code correctly reads from and writes to a database, file system, or external API.
- Verifying two modules or services communicate correctly through their shared interface.
- Verifying your API layer correctly translates HTTP requests into business logic and responses.
- Verifying a UI component correctly interacts with its data layer.
- Any scenario where the risk lives at the boundary between components.

### Scope and Boundaries

**Prefer narrower integration tests.** Each test should focus on one specific boundary. A test that exercises controller + service + repository + database all at once is harder to debug than three tests verifying each boundary separately.

**Real vs. fake dependencies:** Use real dependencies when they are fast and reliable. An in-memory database (SQLite, H2) is often preferable to mocking the database layer because it catches real SQL bugs while remaining fast. But a real external API that is slow or rate-limited should be replaced with a fake.

**Contract tests** are a specialized form for microservice architectures. Rather than spinning up both services, you test each side of the contract independently: the consumer tests that it correctly calls the expected API, and the provider tests that it correctly serves it.

---

## End-to-End Tests

### What They Are

An end-to-end (E2E) test exercises the entire system from a user's perspective — entering through the same interface a real user would use (a browser, a CLI, a mobile app, an API client) and verifying the outcome through the same channels a user would observe. E2E tests are sometimes called "broad stack tests" (Fowler) or "system tests."

The system under test should be deployed in a configuration as close to production as practical, with real (or near-real) dependencies: databases, queues, external services.

### Why They Exist

E2E tests catch bugs that no lower-level test can: emergent behaviors that arise only when the full system is assembled. These include infrastructure misconfigurations, behavioral disagreements between services that satisfy their individual contracts but produce incorrect results in combination, and UI-to-backend integration issues.

### When to Use Them

- Critical user journeys that, if broken, would cause significant business impact (checkout flows, login, data submission).
- Scenarios where the risk lives in the integration of many components and cannot be adequately covered by narrower tests.
- Final validation before release, as a confidence gate.

**Use them sparingly.** The pyramid model, the trophy model, and Google's guidance all agree: E2E tests should be a small fraction of your overall test suite. They are the most expensive tests to write, maintain, and run.

### Scope and Boundaries

E2E tests are, by definition, broad in scope. But "end to end" does not mean "test everything." Each E2E test should focus on a single user journey or workflow — not attempt to verify every feature of the application in one test.

**Choose E2E scenarios based on risk, not coverage.** You cannot E2E-test every path through a complex system — the combinatorial explosion makes it impractical. Instead, identify the 5-20 most critical user journeys and test those.

---

## Acceptance Tests

### What They Are

An acceptance test verifies that a system satisfies a business requirement or user story. It answers the question: "Does this feature do what the stakeholder asked for?" The defining characteristic of an acceptance test is not its technical scope — it's its *audience and purpose*. An acceptance test should be readable (or at least recognizable) by a non-engineer stakeholder. The behavior it specifies comes from requirements, not from implementation design.

See [testing-acceptance.md](./testing-acceptance.md) for the full reference on acceptance tests, including their relationship to other test types, scope guidance, and pitfalls.

### Why They Exist

- **Executable specifications:** A precise, unambiguous definition of what "done" means for a feature.
- **Shared understanding:** Surface misunderstandings about requirements early — before code is written.
- **Regression protection at the requirements level:** If a future change breaks a business requirement, the acceptance test catches it in terms the stakeholder can understand.

### When to Use Them

- Features with clear, stakeholder-defined requirements.
- Behaviors where correctness is defined by the business rather than by engineering design.
- Regulated or compliance-sensitive functionality where you need to demonstrate that requirements are met.

### Scope and Boundaries

Acceptance tests are orthogonal to the test pyramid. They are defined by *what they verify* (business requirements), not by *how much of the system they exercise*. A given acceptance test might be narrow (unit-level), medium (integration-level), or broad (E2E-level). **Prefer the narrowest scope that fully verifies the requirement.**

---

## Smoke Tests

### What They Are

A smoke test is a small, fast suite of tests that verifies the most basic, critical functionality of a system is working. The name comes from hardware testing — when you power on a new circuit board, the first test is whether it catches fire (produces smoke). If it does, you don't bother with further testing.

Smoke tests answer one question: "Is this build/deployment so broken that further testing is pointless?"

### Why They Exist

Smoke tests serve as a fast, cheap gate that catches catastrophic failures early: builds that won't start, deployments where the application doesn't respond, releases where core functionality is completely broken. By catching these failures in seconds rather than waiting for a full test suite, smoke tests save time and prevent wasted effort.

### When to Use Them

- **After every build** as the first automated check. If smoke tests fail, skip the rest of the test suite.
- **After every deployment** to a new environment to verify the deployment succeeded.
- **As a health check** for a running system.
- **As a gating check** before running a more expensive test suite.

### Scope and Boundaries

Smoke tests are deliberately shallow and narrow:

- **Cover only the critical path.** Login, the main landing page, the primary API endpoint, the core happy-path workflow. Nothing more.
- **Run in seconds, not minutes.** If your smoke suite takes more than 1-2 minutes, it is too large.
- **Be small in number.** A typical smoke suite might have 5-15 tests. If you have 50+, you've drifted into integration or E2E territory.
- **Verify "alive and responding correctly," not "fully correct."**
