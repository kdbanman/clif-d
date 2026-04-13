# Testing Coverage as a Gate

Coverage metrics measure what percentage of code is *executed* during testing. They do not measure what percentage is *correctly tested*. This distinction matters when deciding whether and how to enforce coverage as a backpressure gate.

---

## What Coverage Tells You (and Does Not)

The most common metrics:

- **Line coverage:** What percentage of lines were executed.
- **Branch coverage:** What percentage of conditional branches (if/else, switch) were taken.
- **Function/method coverage:** What percentage of functions were called.

Coverage is a **useful negative indicator**: if a module has 20% line coverage, you know large parts of it are untested.

Coverage is a **poor positive indicator**: 100% line coverage does not mean your tests are good. A test that calls a function without asserting on its result achieves coverage while providing zero protection against bugs.

---

## Guidelines for Using Coverage

### Find gaps, not declare victory

Run coverage reports periodically and examine uncovered areas. Ask: "Is this uncovered code high-risk? Should it have tests?" Sometimes the answer is no — trivial getters, generated code, or dead code may not warrant tests.

Coverage is a diagnostic tool, not a scorecard.

### Per-component floors, not project-wide ceilings

A data processing pipeline with complex transformation logic might warrant 90%+ coverage. A thin API adapter might be well-served at 60%.

Setting a single project-wide target (e.g., "80% coverage") incentivizes gaming — engineers write meaningless tests for easy-to-cover code while ignoring hard-to-test, high-risk code. Per-component floors let you invest testing effort where risk is highest.

### Watch for falling coverage between commits

If a module's coverage drops significantly between commits, it means new code was added without tests. This is a more actionable signal than absolute coverage numbers, and it is enforceable as a gate: reject commits that decrease coverage below the floor for a given component.

A coverage ratchet — a gate that blocks coverage from decreasing — is often more useful than a coverage floor. It prevents erosion without requiring an arbitrary target.

### Never game coverage

Tests that execute code without meaningful assertions are worse than no tests — they create false confidence.

The canonical example of gaming:

```python
def test_covers_calculate():
    calculate(1, 2)   # no assertion — executes the code but verifies nothing
```

This achieves line coverage for `calculate` while providing zero protection against bugs. If a coverage tool counts this as "covering" a function, the coverage number is a lie.

When designing coverage enforcement as a gate, consider pairing it with assertion density checks or mutation testing to catch this failure mode.

---

## Mutation Testing: A More Rigorous Alternative

Mutation testing introduces small changes (mutations) to production code — flipping comparisons, removing lines, changing return values — and checks whether the test suite catches them. A mutation that survives (tests still pass) reveals a gap in test effectiveness that line coverage cannot detect.

Mutation testing is more expensive to run than coverage measurement, but produces a more meaningful quality signal. Consider it for:

- **High-risk components** where coverage numbers alone are insufficient.
- **Periodic audits** (not every commit) to validate that coverage numbers reflect real testing quality.
- **CI enforcement** — mutation testing is too slow for pre-commit or pre-push gates, but can run in CI on critical paths.

---

## Implications for Backpressure Design

When deciding how to enforce coverage as a gate:

1. **Prefer coverage ratchets over absolute floors.** Block coverage from decreasing rather than requiring an arbitrary target.
2. **Set per-component floors if you set floors at all.** High-risk code gets a higher floor.
3. **Enforce in CI, not pre-commit.** Coverage analysis is typically too slow for pre-commit and requires running the full test suite.
4. **Pair coverage with other signals.** Coverage alone is gameable. Combine with code review expectations, mutation testing on critical paths, or assertion density checks.
5. **Document the policy in the backpressure design document.** Whether you enforce coverage and at what level is a deliberate decision that should be recorded with rationale, not an afterthought.
