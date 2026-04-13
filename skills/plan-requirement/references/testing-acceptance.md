# Acceptance Tests

## What They Are

An acceptance test verifies that a system satisfies a business requirement or user story. It answers the question: "Does this feature do what the stakeholder asked for?" Acceptance tests are sometimes called "functional tests," "customer tests," or "story tests."

The defining characteristic of an acceptance test is not its technical scope — it's its *audience and purpose*. An acceptance test should be readable (or at least recognizable) by a non-engineer stakeholder. The behavior it specifies comes from requirements, not from implementation design.

## Why They Exist

Acceptance tests bridge the gap between what stakeholders asked for and what engineers built. They serve as:

- **Executable specifications:** A precise, unambiguous definition of what "done" means for a feature. When all acceptance tests pass, the feature meets its requirements.
- **Shared understanding:** Written collaboratively between stakeholders and engineers, acceptance tests surface misunderstandings about requirements early — before code is written, not after.
- **Regression protection at the requirements level:** If a future change breaks a business requirement, the acceptance test catches it in terms the stakeholder can understand.

Fowler's concept of "Specification by Example" captures this: acceptance tests are examples of desired behavior, expressed concretely enough to be automated and verified.

## When to Use Them

Use acceptance tests for:

- Features with clear, stakeholder-defined requirements ("a user can search for products by name and filter by price range").
- Behaviors where correctness is defined by the business rather than by engineering design.
- Regulated or compliance-sensitive functionality where you need to demonstrate that requirements are met.

## Scope and Boundaries

Acceptance tests are orthogonal to the test pyramid. They are defined by *what they verify* (business requirements), not by *how much of the system they exercise*. A given acceptance test might be:

- **Narrow** (unit-level): If the business rule is implemented in a single function, an acceptance test can exercise just that function. For example, "discounts above 50% require manager approval" might be testable at the domain logic level.
- **Medium** (integration-level): If the business rule involves interactions between components (API + database + business logic), the acceptance test exercises that integration.
- **Broad** (E2E-level): If the business rule is only verifiable through the full user workflow ("user can complete checkout"), the acceptance test is effectively an E2E test.

**Prefer the narrowest scope that fully verifies the requirement.** An acceptance test written at unit scope runs faster, fails with better localization, and is easier to maintain than one written at E2E scope. Only use a broader scope when the requirement genuinely cannot be verified at a lower level.

## Relationship to Other Test Types

Acceptance tests overlap with other types by design. A unit test and an acceptance test might exercise the same code — the difference is their purpose. The unit test exists to verify internal correctness during development. The acceptance test exists to verify that a business requirement is met.

It is fine (even encouraged) for a behavior to be covered by both a unit test and an acceptance test. They serve different audiences and protect against different kinds of regression.

## Type-Specific Pitfalls

**Writing acceptance tests only at the E2E level.** This is the most common mistake. When teams equate "acceptance test" with "drive the UI through a full workflow," they end up with a large, slow, flaky acceptance suite that is expensive to maintain. Many acceptance criteria can be verified at a lower level.

**Overly technical language.** Acceptance tests should describe *what* the system does in business terms, not *how* it does it in technical terms. "When a user submits a transfer exceeding their balance, the system declines the transfer" is good. "When `processTransaction()` is called with `amount > sender.balance`, it returns `false`" is a unit test wearing an acceptance test's name.

**Not involving stakeholders.** Acceptance tests written solely by engineers, without stakeholder input, risk encoding the engineer's interpretation of the requirement rather than the stakeholder's actual intent. The value of acceptance tests comes from the conversation between stakeholders and engineers about what "done" means.

**Treating acceptance tests as the only tests.** Acceptance tests verify requirements; they do not provide thorough coverage of edge cases, error handling, or internal design. A passing acceptance suite with no unit tests is a project with many untested code paths.

## Checklist

When writing or reviewing an acceptance test, verify:

- [ ] **Requirement-driven:** The test traces directly to a specific business requirement, user story, or acceptance criterion. It is not a technical test disguised as an acceptance test.
- [ ] **Business-readable:** A non-engineer stakeholder could read the test (or its description) and confirm that it describes the desired behavior.
- [ ] **Narrowest viable scope:** The test exercises the minimum number of components needed to verify the requirement. If the requirement can be verified at the unit or integration level, it should be. (See [testing-strategy.md](./testing-strategy.md) for the rationale: prefer the lowest-scope test that covers the risk.)
- [ ] **Behavior-focused name:** The test name describes the requirement in business terms. (See the testing principles in the implement-plan skill's references for naming guidance.)
- [ ] **Independent of implementation:** The test does not depend on specific internal method names, database schemas, or UI element IDs that might change without affecting the business behavior.
- [ ] **Stakeholder-validated:** The acceptance criteria were reviewed by or written with a stakeholder before implementation began.
