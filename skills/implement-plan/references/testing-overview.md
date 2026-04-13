# Software Testing: Overview

## Purpose of These Documents

You are implementing a plan. You need to write tests right now -- good ones, quickly. These documents give you the practical guidance to do that.

They are language-agnostic and domain-agnostic, drawn from a small number of deeply respected sources:

- *Software Engineering at Google* (Winters, Manshreck, Wright, 2020) -- freely available at [abseil.io/resources/swe-book](https://abseil.io/resources/swe-book)
- Martin Fowler's testing articles at [martinfowler.com/testing](https://martinfowler.com/testing)
- *xUnit Test Patterns* (Gerard Meszaros, 2007) -- companion site at [xunitpatterns.com](http://xunitpatterns.com)
- Kent C. Dodds, "The Testing Trophy and Testing Classifications" (2021) -- at [kentcdodds.com](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)
- Google Testing Blog, especially "Just Say No to More End-to-End Tests" (2015)

---

## How to Use These Documents

Use the **Scenario Quick-Reference** below to find your situation, then jump directly to the linked document. For routine work, each test type doc has an inlined checklist of the most relevant principles. For tricky situations, go to the full Principles & Practices doc.

---

## Scenario Quick-Reference

| Your situation | Start here | Then consult |
|---|---|---|
| "I wrote a function/class and need to verify it works" | [Unit Tests](./testing-unit.md) | [Principles](./testing-principles.md) -- Arrange-Act-Assert, Test via Public APIs |
| "I need to verify two components work together correctly" | [Integration Tests](./testing-integration.md) | [Principles](./testing-principles.md) -- Test Doubles |
| "I fixed a bug and want to prevent regression" | [Unit Tests](./testing-unit.md) (replicate the bug at the lowest possible level) | [Principles](./testing-principles.md) -- Strive for Unchanging Tests |
| "I need to verify a full user workflow end to end" | [Principles](./testing-principles.md) -- Completeness and Conciseness | Consider whether the workflow can be decomposed into unit + integration tests first |
| "My tests are flaky, slow, or hard to understand" | [Principles](./testing-principles.md) -- Test Smells | [Cheat Sheet](./testing-cheat-sheet.md) |
| "I just need a quick reference while writing tests" | [Cheat Sheet](./testing-cheat-sheet.md) | [Principles](./testing-principles.md) |

---

## Why We Test

Automated testing serves three purposes, in order of importance:

1. **Preventing bugs from reaching users.** This is the obvious one, but it is not the most important at scale.
2. **Enabling change with confidence.** A comprehensive test suite is what makes refactoring, performance optimization, and feature addition safe. Without it, codebases become rigid -- engineers are afraid to touch working code. This is the most important long-term function of tests, and it is what makes them worth the investment.
3. **Documenting intended behavior.** A well-written test is an executable specification. When an engineer asks "what is this code supposed to do?", a good test answers that question more reliably than comments or design documents, because it is verified every time the code changes.

The xUnit Test Patterns perspective adds a useful framing: the goals of test automation include improving quality, understanding the system under test, reducing risk, being easy to run, being easy to write, and requiring minimal maintenance as the system evolves. The last three are about the tests themselves -- they acknowledge that test code is real code that must be maintained, and poorly-written tests can become a net drag on productivity rather than a benefit.

---

## Document Map

| Document | What it covers | When to use it |
|---|---|---|
| **[Principles & Practices](./testing-principles.md)** | Universal dos, don'ts, and test smells that apply to every type of test | During implementation; when diagnosing test quality problems |
| **[Unit Tests](./testing-unit.md)** | Purpose, scope, pitfalls, and checklist for unit tests | When writing or reviewing unit tests |
| **[Integration Tests](./testing-integration.md)** | Purpose, scope, pitfalls, and checklist for integration tests | When testing cross-component interactions |
| **[Cheat Sheet](./testing-cheat-sheet.md)** | One-page quick reference of all dos, don'ts, smells, and naming templates | Pin next to your editor; consult mid-implementation |

---

*These references support the implement-plan skill. They focus on writing sound tests during implementation. For guidance on choosing test types and proportions (testing strategy), see the plan-requirement or create-architecture skills. For guidance on enforcing test quality as automated gates, see the design-backpressure skill.*
