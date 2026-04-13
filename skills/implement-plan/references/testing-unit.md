# Unit Tests

## What They Are

A unit test verifies the behavior of a small, isolated piece of code -- typically a single function, method, or class. It exercises the code through its public interface, asserts on observable output or state, and runs fast enough that an engineer can execute thousands of them in seconds.

Google defines unit tests as tests of "relatively narrow scope, such as of a single class or method." They are usually (but not always) "small" in Google's size taxonomy: single-process, single-threaded, no I/O.

## Why They Exist

- **Speed:** Millisecond execution times mean engineers can run them on every save and every commit.
- **Determinism:** No external dependencies means no flakiness.
- **Defect localization:** When a unit test fails, you know exactly which piece of code is broken.
- **Documentation:** A well-written unit test suite is the most reliable documentation of what a module does.
- **Refactoring safety:** Tests through public APIs give confidence to restructure internal code.

Google recommends roughly 80% unit tests and 20% broader-scoped tests as a starting point.

## When to Use Them

Use unit tests for:
- Pure logic: data transformations, calculations, parsing, formatting, validation.
- Business rules and domain logic.
- Edge cases and boundary conditions.
- Error handling paths.
- Any code where inputs and outputs are well-defined and the code can be exercised without expensive setup.

**Don't** use unit tests for verifying that two components work together (use [integration tests](./testing-integration.md)) or that a full user workflow works (broader-scope tests).

## Scope and Boundaries

**Solitary vs. sociable unit tests:**

- **Solitary** tests isolate the unit from all collaborators using test doubles.
- **Sociable** tests allow the unit to interact with real collaborators, as long as the test remains fast and deterministic.

Google's current guidance leans sociable -- prefer real implementations when they are fast and deterministic. Use test doubles only for dependencies that are slow, nondeterministic, or have significant side effects.

## Worked Example: A Good Unit Test

Suppose you have a `PriceCalculator` that computes order totals with discounts and tax:

```python
class PriceCalculator:
    def __init__(self, tax_rate):
        self.tax_rate = tax_rate

    def calculate_total(self, items, coupon=None):
        subtotal = sum(item.price * item.quantity for item in items)
        if coupon and subtotal >= coupon.minimum_spend:
            subtotal -= coupon.discount_amount
        tax = subtotal * self.tax_rate
        return round(subtotal + tax, 2)
```

Here's a well-structured test suite for it:

```python
def test_single_item_total():
    calc = PriceCalculator(tax_rate=0.10)
    items = [Item(price=20.00, quantity=1)]

    total = calc.calculate_total(items)

    assert total == 22.00  # 20 + 10% tax

def test_multiple_items_sums_correctly():
    calc = PriceCalculator(tax_rate=0.10)
    items = [Item(price=20.00, quantity=2), Item(price=10.00, quantity=1)]

    total = calc.calculate_total(items)

    assert total == 55.00  # (40 + 10) + 10% tax

def test_coupon_applied_when_minimum_met():
    calc = PriceCalculator(tax_rate=0.10)
    items = [Item(price=50.00, quantity=1)]
    coupon = Coupon(discount_amount=10.00, minimum_spend=40.00)

    total = calc.calculate_total(items, coupon=coupon)

    assert total == 44.00  # (50 - 10) + 10% tax

def test_coupon_ignored_when_minimum_not_met():
    calc = PriceCalculator(tax_rate=0.10)
    items = [Item(price=20.00, quantity=1)]
    coupon = Coupon(discount_amount=10.00, minimum_spend=40.00)

    total = calc.calculate_total(items, coupon=coupon)

    assert total == 22.00  # coupon not applied, 20 + 10% tax

def test_no_coupon_provided():
    calc = PriceCalculator(tax_rate=0.10)
    items = [Item(price=30.00, quantity=1)]

    total = calc.calculate_total(items, coupon=None)

    assert total == 33.00

def test_empty_cart_returns_zero():
    calc = PriceCalculator(tax_rate=0.10)

    total = calc.calculate_total(items=[])

    assert total == 0.00
```

**Why this is good:**
- Each test has one Act step and verifies one behavior.
- Names describe the scenario and expectation.
- Expected values are hardcoded -- no computation.
- All relevant setup is visible in each test.
- The tests don't reach into internals -- they call `calculate_total` like a real caller would.
- Adding a new field to `Item` (e.g., `sku`) wouldn't break any test.

## Type-Specific Pitfalls (with Examples)

### Pitfall: Testing Implementation Details

```python
# BAD -- tests a private method directly
def test_compute_subtotal():
    calc = PriceCalculator(tax_rate=0.10)
    items = [Item(price=20.00, quantity=2)]
    subtotal = calc._compute_subtotal(items)  # reaching into private method
    assert subtotal == 40.00
```

If you rename `_compute_subtotal` or merge it into `calculate_total`, this test breaks. But no user-facing behavior changed. Test through `calculate_total` instead.

### Pitfall: Over-Mocking

```python
# BAD -- mocks a trivial collaborator for no reason
def test_calculate_total_with_mock():
    mock_item = Mock()
    mock_item.price = 20.00
    mock_item.quantity = 2
    calc = PriceCalculator(tax_rate=0.10)
    total = calc.calculate_total([mock_item])
    assert total == 44.00
```

`Item` is a simple data object -- using a real `Item` is faster to write, easier to read, and higher fidelity. Save mocking for dependencies that are slow or have side effects.

### Pitfall: Shared Mutable State

```python
# BAD -- tests share a calculator instance and modify it
calculator = PriceCalculator(tax_rate=0.10)

def test_set_tax_rate():
    calculator.tax_rate = 0.20
    items = [Item(price=100, quantity=1)]
    assert calculator.calculate_total(items) == 120.00

def test_default_tax_rate():
    items = [Item(price=100, quantity=1)]
    # FAILS -- tax_rate is still 0.20 from previous test
    assert calculator.calculate_total(items) == 110.00
```

```python
# GOOD -- each test creates its own instance
def test_twenty_percent_tax():
    calc = PriceCalculator(tax_rate=0.20)
    assert calc.calculate_total([Item(price=100, quantity=1)]) == 120.00

def test_ten_percent_tax():
    calc = PriceCalculator(tax_rate=0.10)
    assert calc.calculate_total([Item(price=100, quantity=1)]) == 110.00
```

## Checklist

When writing or reviewing a unit test, verify:

- [ ] **Public API:** The test calls the system through its public interface, not internal/private methods. *([Principles](./testing-principles.md) -- Test via Public APIs)*
- [ ] **State, not interactions:** Assertions verify observable output, not which methods were called on mocks. *([Principles](./testing-principles.md) -- Test State Not Interactions)*
- [ ] **Arrange-Act-Assert:** Three clear phases, visually separated. *([Principles](./testing-principles.md) -- Arrange Act Assert)*
- [ ] **One behavior:** The test verifies a single scenario. *([Principles](./testing-principles.md) -- Test Behaviors Not Methods, Verify One Condition)*
- [ ] **Descriptive name:** The name describes the behavior, not the method. *([Principles](./testing-principles.md) -- Test Behaviors Not Methods)*
- [ ] **No logic:** No conditionals, loops, or computed expected values. *([Principles](./testing-principles.md) -- Don't Put Logic in Tests)*
- [ ] **Complete and concise:** All relevant setup is visible; no irrelevant details. *([Principles](./testing-principles.md) -- Make Tests Complete and Concise)*
- [ ] **Hardcoded expectations:** Expected values are literals, not computed from the same logic as production code. *([Principles](./testing-principles.md) -- Don't Put Logic in Tests)*
- [ ] **Fast:** Completes in milliseconds. If it takes seconds, substitute a test double for the slow dependency. *([Principles](./testing-principles.md) -- Test Smells, Slow Tests)*
- [ ] **Fresh fixture:** Creates its own state; doesn't depend on other tests. *([Principles](./testing-principles.md) -- Test Smells, Erratic Test)*
- [ ] **Clear failure message:** If the test fails, you can diagnose the problem from the test name and assertion output alone. *([Principles](./testing-principles.md) -- Write Clear Failure Messages)*
