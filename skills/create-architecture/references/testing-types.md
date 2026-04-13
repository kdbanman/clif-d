# Testing Types

This document summarizes all five test types to support architectural decisions about testing infrastructure. For detailed guidance on writing tests of each type, consult the implement-plan skill's references.

---

## Unit Tests

### What They Are

A unit test verifies the behavior of a small, isolated piece of code — typically a single function, method, or class. It exercises the code through its public interface, asserts on observable output or state, and runs fast enough that an engineer can execute thousands of them in seconds.

Google defines unit tests as tests of "relatively narrow scope, such as of a single class or method." They are usually (but not always) "small" in Google's size taxonomy: single-process, single-threaded, no I/O.

### Why They Exist

- **Speed:** Millisecond execution times mean they run on every save and every commit.
- **Determinism:** No external dependencies means no flakiness.
- **Defect localization:** When a unit test fails, you know exactly which piece of code is broken.
- **Documentation:** A well-written unit test suite is the most reliable documentation of what a module does.
- **Refactoring safety:** Tests through public APIs give confidence to restructure internal code.

Google recommends roughly 80% unit tests and 20% broader-scoped tests as a starting point.

### When to Use Them

- Pure logic: data transformations, calculations, parsing, formatting, validation.
- Business rules and domain logic.
- Edge cases and boundary conditions.
- Error handling paths.
- Any code where inputs and outputs are well-defined and the code can be exercised without expensive setup.

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

Correct units do not guarantee a correct system. Integration tests catch:

- A function producing output in a format its consumer doesn't expect.
- A database query that works logically but fails with real schema constraints.
- Two modules agreeing on an interface at compile time but disagreeing on behavioral contracts (ordering, nullability, error semantics).
- Serialization/deserialization between components losing data or changing types.

Dodds's Testing Trophy perspective: integration tests often provide the best return on investment because they're close enough to real usage to catch meaningful bugs, but not so broad that they become slow and flaky.

### When to Use Them

- Verifying code correctly reads from and writes to a database, file system, or external API.
- Verifying two modules or services communicate correctly through their shared interface.
- Verifying an API layer correctly translates HTTP requests into business logic and responses.
- Verifying a UI component correctly interacts with its data layer.
- Any scenario where the risk lives at the boundary between components.

### Scope and Boundaries

**Prefer narrower integration tests.** Each test should focus on one specific boundary. A test that exercises controller + service + repository + database all at once is harder to debug than three tests verifying each boundary separately.

**Real vs. fake dependencies:** Use real dependencies when they are fast and reliable. An in-memory database (SQLite, H2) is often preferable to mocking the database layer because it catches real SQL bugs while remaining fast. But a real external API that is slow or rate-limited should be replaced with a fake.

**Contract tests** are a specialized form for microservice architectures. Rather than spinning up both services, you test each side of the contract independently: the consumer tests that it correctly calls the expected API, and the provider tests that it correctly serves it.

### Relationship to Other Types

Integration tests occupy the middle ground. They overlap upward with E2E tests (an integration test that spans too many boundaries is really an E2E test) and downward with unit tests (an integration test for pure logic should be pushed down to unit level). The key architectural decision is identifying which boundaries in your system carry enough risk to warrant dedicated integration tests.

---

## End-to-End Tests

### What They Are

An end-to-end (E2E) test exercises the entire system from a user's perspective — entering through the same interface a real user would use (a browser, a CLI, a mobile app, an API client) and verifying the outcome through the same channels a user would observe. The system under test should be deployed in a configuration as close to production as practical, with real (or near-real) dependencies.

### Why They Exist

E2E tests catch bugs that no lower-level test can: emergent behaviors that arise only when the full system is assembled. These include infrastructure misconfigurations, behavioral disagreements between services that satisfy their individual contracts but produce incorrect results in combination, UI-to-backend integration issues, and performance or reliability issues that appear only under realistic conditions.

They also serve as the ultimate validation of user-facing requirements — they answer the question "does the system actually work for the user?"

### When to Use Them

- Critical user journeys that, if broken, would cause significant business impact (checkout flows, login, data submission).
- Scenarios where the risk lives in the integration of many components and cannot be adequately covered by narrower tests.
- Final validation before release, as a confidence gate.

**Use them sparingly.** The pyramid model, the trophy model, and Google's guidance all agree: E2E tests should be a small fraction of your overall test suite. They are the most expensive tests to write, maintain, and run.

### Scope and Boundaries

E2E tests are broad by definition. But "end to end" does not mean "test everything." Each E2E test should focus on a single user journey or workflow.

**Choose E2E scenarios based on risk, not coverage.** You cannot E2E-test every path through a complex system — the combinatorial explosion makes it impractical. Instead, identify the 5-20 most critical user journeys and test those. Use analytics and production data to determine which workflows matter most.

### Relationship to Other Types

E2E tests are the most expensive and most flaky test type. When an E2E test catches a bug, replicate it at a lower level (unit or integration) before fixing it — the lower-level test provides faster feedback for the future. Projects that accumulate many E2E tests and few unit tests (the "ice cream cone" antipattern) face expensive maintenance, slow runs, and fragility.

---

## Acceptance Tests

### What They Are

An acceptance test verifies that a system satisfies a business requirement or user story. It answers the question: "Does this feature do what the stakeholder asked for?" The defining characteristic is not its technical scope — it's its *audience and purpose*. An acceptance test should be readable (or at least recognizable) by a non-engineer stakeholder.

### Why They Exist

Acceptance tests bridge the gap between what stakeholders asked for and what engineers built:

- **Executable specifications:** A precise, unambiguous definition of what "done" means for a feature.
- **Shared understanding:** Written collaboratively between stakeholders and engineers, they surface misunderstandings about requirements early.
- **Regression protection at the requirements level:** If a future change breaks a business requirement, the acceptance test catches it in terms the stakeholder can understand.

### When to Use Them

- Features with clear, stakeholder-defined requirements.
- Behaviors where correctness is defined by the business rather than by engineering design.
- Regulated or compliance-sensitive functionality where you need to demonstrate that requirements are met.

### Scope and Boundaries

Acceptance tests are orthogonal to the test pyramid. They are defined by *what they verify* (business requirements), not by *how much of the system they exercise*. A given acceptance test might be narrow (unit-level), medium (integration-level), or broad (E2E-level), depending on what scope is needed to verify the requirement.

**Prefer the narrowest scope that fully verifies the requirement.** An acceptance test at unit scope runs faster, fails with better localization, and is easier to maintain than one at E2E scope.

### Relationship to Other Types

Acceptance tests overlap with other types by design. A unit test and an acceptance test might exercise the same code — the difference is their purpose. The unit test exists to verify internal correctness during development. The acceptance test exists to verify that a business requirement is met. It is fine (even encouraged) for a behavior to be covered by both.

---

## Smoke Tests

### What They Are

A smoke test is a small, fast suite of tests that verifies the most basic, critical functionality of a system is working. The name comes from hardware testing — when you power on a new circuit board, the first test is whether it catches fire. Smoke tests answer one question: "Is this build/deployment so broken that further testing is pointless?"

### Why They Exist

Smoke tests serve as a fast, cheap gate that catches catastrophic failures early:

- A build that won't start (configuration errors, missing dependencies, corrupted artifacts).
- A deployment where the application doesn't respond (server crashes on startup, database connection failures).
- A release where core functionality is completely broken (login fails, the main page doesn't render).

By catching these failures in seconds rather than waiting for a full test suite, smoke tests save time and prevent wasted effort.

### When to Use Them

- **After every build** as the first automated check. If smoke tests fail, skip the rest of the suite.
- **After every deployment** to verify the deployment succeeded.
- **As a health check** for monitoring systems to run continuously.
- **As a gating check** before running more expensive test suites.

### Scope and Boundaries

Smoke tests are deliberately shallow and narrow:

- Cover only the critical path. Nothing more.
- Run in seconds, not minutes. The full smoke suite should complete in under 2 minutes.
- Small in number: 5-15 tests. If you have 50+, you've drifted into integration or E2E territory.
- Verify "alive and responding correctly," not "fully correct."

### Relationship to Other Types

Smoke tests are a *subset* of your broader test suite, selected for speed and criticality. They overlap with other types — a smoke test might be a unit test ("does the config parser load without errors?"), an integration test ("does the app connect to the database on startup?"), or a thin E2E test ("does the login page render and accept credentials?"). The defining characteristic is not scope but *purpose and speed*.
