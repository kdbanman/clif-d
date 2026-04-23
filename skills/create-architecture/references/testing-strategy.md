# Testing Strategy

> These references support the create-architecture skill. They focus on *designing* a testing strategy and architecture -- choosing types, proportions, frameworks, and structure. For guidance on *planning* test-first implementation steps, see the plan-requirement skill. For guidance on *writing* tests, see the implement-plan skill.

**Primary sources:**
- *Software Engineering at Google* (Winters, Manshreck, Wright, 2020)
- Martin Fowler's testing articles at [martinfowler.com/testing](https://martinfowler.com/testing)
- *xUnit Test Patterns* (Gerard Meszaros, 2007)
- Kent C. Dodds, "The Testing Trophy and Testing Classifications" (2021)
- Google Testing Blog, especially "Just Say No to More End-to-End Tests" (2015)

---

## Why We Test

Automated testing serves three purposes, in order of importance:

1. **Preventing bugs from reaching users.** This is the obvious one, but it is not the most important at scale.
2. **Enabling change with confidence.** A comprehensive test suite is what makes refactoring, performance optimization, and feature addition safe.
   Without it, codebases become rigid -- engineers are afraid to touch working code.
   This is the most important long-term function of tests, and it is what makes them worth the investment.
3. **Documenting intended behavior.** A well-written test is an executable specification.
   When an engineer asks "what is this code supposed to do?", a good test answers that question more reliably than comments or design documents, because it is verified every time the code changes.

Google's experience illustrates this concretely: their web search server (GWS) saw an 80%+ rate of user-affecting bugs in production pushes before adopting engineer-driven automated testing.
Within a year of requiring tests for all new code, emergency pushes dropped by half.

The xUnit Test Patterns perspective adds a useful framing: the goals of test automation include improving quality, understanding the system under test, reducing risk, being easy to run, being easy to write, and requiring minimal maintenance as the system evolves.
The last three are about the tests themselves -- they acknowledge that test code is real code that must be maintained, and poorly-written tests can become a net drag on productivity rather than a benefit.

---

## The Shape of a Testing Strategy

### The Pyramid, the Trophy, and the Honeycomb

Three mental models dominate the conversation about how to distribute testing effort.
All three agree on more than they disagree.

**The Test Pyramid** (Mike Cohn, popularized by Martin Fowler) argues for many fast, cheap unit tests at the base; fewer integration tests in the middle; and very few slow, expensive end-to-end tests at the top.
The essential insight: as you move up the pyramid, tests become slower, more brittle, and harder to debug, so you should have fewer of them.
Fowler's rule of thumb: high-level tests are a second line of defense -- if a high-level test catches a bug, you should first replicate it with a unit test, so the unit test ensures the bug stays dead.

**The Testing Trophy** (Kent C. Dodds) adds static analysis as a foundation layer and argues that integration tests provide the best return on investment -- they're close enough to real usage to catch meaningful bugs but not so broad that they become flaky.
The motto: "Write tests.
Not too many.
Mostly integration." This perspective emerged from frontend/UI engineering, where unit-testing individual components in isolation can miss the integration bugs that actually hurt users.

**The Testing Honeycomb** (Spotify engineering) similarly de-emphasizes unit tests for microservice architectures, arguing that integration tests between services are where the real risk lies.

**What actually matters:** Fowler's 2021 article cuts through the debate.
His biggest objection to the whole discussion is that people love debating proportions when they should focus on writing tests that establish clear boundaries, run quickly and reliably, and only fail for useful reasons.
His second-biggest objection is that the terms "unit test" and "integration test" mean different things to different people, making the debate partly definitional.

The practical takeaway: **don't adopt a shape dogmatically.** Instead:

1. Identify where your risk lives.
2. Choose the lowest-scope test type that can effectively cover each risk.
3. Move to broader-scope tests only for risks that lower-scope tests cannot catch (cross-boundary interactions, emergent behavior, real user workflows).

Google recommends roughly 80% unit tests and 20% broader-scoped tests as a starting point, but emphasizes that this varies by project.

---

## Risk-Based Prioritization

Not all code deserves equal testing investment.
Before choosing test types and proportions, assess your codebase by asking:

**What is the cost of failure for each component?**

- **High cost of failure:** Code that, if broken, causes data loss, incorrect results used for decisions, security vulnerabilities, or significant user impact.
  Test this heavily, at multiple levels.
- **Medium cost of failure:** Code that causes degraded experience, slower performance, or incorrect-but-recoverable behavior.
  Test this solidly, primarily at the unit and integration level.
- **Low cost of failure:** One-off scripts, exploratory code, internal tooling with a single user.
  Test this lightly or not at all -- your time is better spent elsewhere.

**How stable is each component?**

- Code that changes frequently needs tests that are robust to change (test via public APIs, not implementation details).
- Code that rarely changes can tolerate somewhat more tightly-coupled tests.

**How hard is each component to test?**

- Some components are inherently difficult to test (UI rendering, ML training loops, hardware interactions).
  For these, move as much logic as possible into testable, isolated modules, and test those.
  Fowler calls this the "Humble Object" pattern -- keep the hard-to-test shell thin and push logic into easily-testable code.

---

## Applying This to a Concrete Example: An LLM Training Project

An LLM training codebase typically has components with very different risk and testability profiles:

| Component | Cost of failure | Testability | Recommended approach |
|---|---|---|---|
| Data pipeline / preprocessing | Very high -- corrupted training data produces a worthless model | High -- pure data transformations | Heavy unit testing of transformations; integration tests for pipeline stages |
| Config / hyperparameter management | High -- wrong config wastes expensive compute | Very high -- pure functions, serialization | Thorough unit tests; validation tests for config schemas |
| Training loop | Medium-high -- bugs waste compute | Low -- expensive to run, nondeterministic | Extract testable logic (learning rate schedules, gradient clipping, checkpointing logic) into unit-testable modules; use short "smoke" training runs as integration tests |
| Evaluation / metrics code | Very high -- incorrect evaluation leads to wrong decisions | High | Heavy unit testing; integration tests comparing against known-good baselines |
| Experiment tracking / logging | Medium | High | Unit tests for formatting/serialization; integration tests for storage |
| One-off analysis scripts | Low | Varies | Light or no testing |

The strategist's job is to make this kind of table for their specific project, then design the testing strategy to match.

---

## Test Size vs. Test Scope

Google draws a useful distinction that most organizations conflate:

**Size** is about resource constraints and execution characteristics:
- **Small tests** run in a single process, on a single thread, and must not perform I/O (no disk, no network, no databases).
  They are fast and deterministic.
- **Medium tests** can span multiple processes on a single machine, and may use localhost networking and local databases.
- **Large tests** can span multiple machines and may use real external services.

**Scope** is about how much code a test is intended to validate:
- **Narrow scope** (unit): a single class, function, or module.
- **Medium scope** (integration): the interaction between a small number of components.
- **Broad scope** (end-to-end): the system as a whole, from a user's perspective.

These axes are independent.
A unit test is usually small, but a unit test that reads from a local file is medium-sized.
An integration test might be small if all components run in-process with in-memory fakes.

This distinction matters because the advice "write more unit tests" is really two pieces of advice: "test at narrow scope" (for defect localization) and "keep tests small" (for speed and determinism).
You want both, but recognizing they are separate concerns helps when you must make tradeoffs.
