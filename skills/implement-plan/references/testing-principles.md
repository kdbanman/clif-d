# Principles & Practices of Test Design

This document contains the universal guidance that applies to every test you write, regardless of type.
It is the most frequently consulted document in this set -- the Test Type subdocs are thin by design and refer back here.

Each principle includes explicit **Do** and **Don't** examples.
The examples use Python-like pseudocode for readability, but the principles are language-agnostic.

**Primary sources:**
- *Software Engineering at Google*, Ch 12: Unit Testing
- *xUnit Test Patterns* (Meszaros), Goals, Philosophy, and Principles of Test Automation
- Martin Fowler's testing articles at martinfowler.com

---

## 1. Strive for Unchanging Tests

The ideal test, once written, never needs to change unless the *requirements* of the system under test change.
Google identifies four kinds of changes engineers make to production code and how tests should respond:

- **Refactoring** (changing internals without changing behavior): Tests should not break.
- **Adding new features**: Existing tests should not break.
  Write new tests for new behavior.
- **Fixing bugs**: Existing tests should not break.
  Add the missing test case.
- **Changing behavior**: This is the *only* case where existing tests should need updating.

If you routinely update tests during refactoring or feature addition, your tests are too tightly coupled to implementation.

### Do / Don't

**Don't** -- test that is coupled to implementation and breaks on refactoring:

```python
def test_calculate_discount():
    service = DiscountService()
    # Calling internal method directly -- if we rename or restructure, test breaks
    raw = service._compute_raw_discount(price=100, tier="gold")
    adjusted = service._apply_seasonal_adjustment(raw, season="summer")
    assert adjusted == 15.0
```

**Do** -- test the observable behavior through the public interface:

```python
def test_gold_customer_summer_discount():
    service = DiscountService()
    discount = service.get_discount(price=100, customer_tier="gold", season="summer")
    assert discount == 15.0
```

Now we can freely rename, merge, or split those internal methods without touching the test.

---

## 2. Test via Public APIs

Invoke the system under test the same way its real users would -- through its public interface, not its internal methods.

**Why:** Tests that use public APIs are, by definition, exercising the system the way real consumers do.
If such a test breaks, a real consumer might also be broken.

**What counts as a "public API":**
- If a module or class is designed for external consumption, test through that external interface.
- If a class exists only to support another class (a "helper"), test it through the class it supports.
- If a class is internal but provides general-purpose functionality (a "support library"), it's reasonable to test it directly.

### Do / Don't

**Don't** -- remove `private` visibility to test internals:

```python
def test_serialization_format():
    processor = TransactionProcessor(db)
    # Reaching into private method
    serialized = processor._serialize(Transaction(sender="me", recipient="you", amount=100))
    assert serialized == "me,you,100"
```

This test breaks if we change the serialization format, the method name, or extract serialization into a helper class -- even if external behavior is unchanged.

**Do** -- test through the same interface a real caller uses:

```python
def test_successful_transfer():
    processor = TransactionProcessor(db)
    processor.set_balance("me", 150)
    processor.set_balance("you", 20)

    processor.process_transaction(Transaction(sender="me", recipient="you", amount=100))

    assert processor.get_balance("me") == 50
    assert processor.get_balance("you") == 120
```

This test is indifferent to how transactions are serialized internally.

---

## 3. Test State, Not Interactions

Prefer verifying *what happened* (the resulting state) over *how it happened* (which methods were called in what order).

### Do / Don't

**Don't** -- interaction testing via mock call verification:

```python
def test_process_order():
    mock_inventory = Mock()
    mock_emailer = Mock()
    service = OrderService(inventory=mock_inventory, emailer=mock_emailer)

    service.process(order)

    # Verifying HOW the work was done, not WHAT happened
    mock_inventory.reserve.assert_called_once_with(item_id=42, quantity=2)
    mock_inventory.commit.assert_called_once()
    mock_emailer.send.assert_called_once_with(
        to="user@example.com",
        template="order_confirmation",
        order_id=order.id
    )
```

This breaks if we rename `reserve` to `hold`, combine `reserve`+`commit` into one call, or change the email template parameter name -- all internal refactors that don't affect the user.

**Do** -- state testing with lightweight fakes:

```python
def test_process_order():
    inventory = FakeInventory(available={42: 10})
    emailer = FakeEmailer()
    service = OrderService(inventory=inventory, emailer=emailer)

    service.process(order)

    # Verifying WHAT happened
    assert inventory.available[42] == 8              # stock decreased
    assert len(emailer.sent_messages) == 1           # confirmation sent
    assert emailer.sent_messages[0].to == "user@example.com"
```

This test survives internal refactoring because it asserts on observable outcomes.

**When interaction testing is justified:** When the side effect *is* the important behavior and there's no observable state to check -- e.g., verifying an audit log entry was created, or that a third-party API was called.
Even then, prefer a fake that records calls over a mock with rigid expectations.

---

## 4. Arrange, Act, Assert

Structure every test in three distinct phases:

1. **Arrange:** Set up preconditions.
2. **Act:** Execute the single behavior being tested.
3. **Assert:** Verify the expected outcome.

### Do / Don't

**Don't** -- phases are jumbled together:

```python
def test_cart_behavior():
    cart = Cart()
    cart.add(Item("shoe", 50))
    assert cart.total == 50        # asserting mid-test
    cart.add(Item("hat", 25))
    cart.apply_coupon("10OFF")
    assert cart.total == 65
    assert len(cart.items) == 2    # multiple acts and asserts interleaved
```

This is testing multiple behaviors (adding items, applying coupons) and interleaving actions with assertions, making it hard to know which behavior failed.

**Do** -- one clear Act, with Arrange and Assert separated:

```python
def test_apply_coupon_reduces_total():
    # Arrange
    cart = Cart()
    cart.add(Item("shoe", 50))
    cart.add(Item("hat", 25))

    # Act
    cart.apply_coupon("10OFF")

    # Assert
    assert cart.total == 65
```

```python
def test_add_items_increases_total():
    # Arrange
    cart = Cart()

    # Act
    cart.add(Item("shoe", 50))
    cart.add(Item("hat", 25))

    # Assert
    assert cart.total == 75
    assert len(cart.items) == 2
```

Two tests, each with one Act step, each verifying one behavior.
Note that the second test has two assertions -- that's fine because they collectively verify the single behavior of "adding items."

---

## 5. Test Behaviors, Not Methods

Don't write one test per method.
Write one test per *behavior* -- a specific response to a specific condition.

A behavior-oriented test name answers three questions:
1. What is being tested?
2. Under what conditions?
3. What is the expected outcome?

### Do / Don't

**Don't** -- one test per method, testing the method signature rather than the behavior:

```python
def test_process_transaction():
    # Tests the happy path, the error path, and an edge case all in one
    processor = TransactionProcessor(db)
    
    result1 = processor.process(valid_transaction)
    assert result1.success == True
    
    result2 = processor.process(invalid_transaction)
    assert result2.success == False
    
    result3 = processor.process(zero_amount_transaction)
    assert result3.success == False
```

When this test fails, which behavior is broken?
You have to read the whole test to find out.

**Do** -- one test per behavior, named descriptively:

```python
def test_process_valid_transaction_succeeds():
    processor = TransactionProcessor(db)
    result = processor.process(valid_transaction)
    assert result.success == True

def test_process_insufficient_funds_declines():
    processor = TransactionProcessor(db)
    result = processor.process(overdrawn_transaction)
    assert result.success == False
    assert result.reason == "insufficient_funds"

def test_process_zero_amount_is_rejected():
    processor = TransactionProcessor(db)
    result = processor.process(zero_amount_transaction)
    assert result.success == False
    assert result.reason == "invalid_amount"
```

When `test_process_zero_amount_is_rejected` fails, you know exactly what's broken from the test name alone.

---

## 6. Verify One Condition per Test

Each test should verify exactly one logical condition -- one behavior, one scenario, one path through the code.

**This doesn't mean one assertion per test.** Multiple assertions are fine when they collectively verify a single condition.

**This does mean one Act step per test.** If your test has two Act steps, it is testing two behaviors and should be two tests.

### Do / Don't

**Don't** -- Meszaros's "Eager Test" smell:

```python
def test_user_registration():
    service = UserService(db)

    user = service.register("alice", "alice@example.com")     # Act 1
    assert user.id is not None
    assert user.email == "alice@example.com"

    service.verify_email(user.id, token="abc123")             # Act 2
    updated = service.get_user(user.id)
    assert updated.email_verified == True

    service.update_profile(user.id, display_name="Alice")     # Act 3
    updated = service.get_user(user.id)
    assert updated.display_name == "Alice"
```

Three behaviors crammed into one test.

**Do** -- three tests, each verifying one behavior:

```python
def test_register_creates_user_with_email():
    service = UserService(db)
    user = service.register("alice", "alice@example.com")
    assert user.id is not None
    assert user.email == "alice@example.com"

def test_verify_email_marks_user_verified():
    service = UserService(db)
    user = service.register("alice", "alice@example.com")
    service.verify_email(user.id, token="abc123")
    updated = service.get_user(user.id)
    assert updated.email_verified == True

def test_update_profile_changes_display_name():
    service = UserService(db)
    user = service.register("alice", "alice@example.com")
    service.update_profile(user.id, display_name="Alice")
    updated = service.get_user(user.id)
    assert updated.display_name == "Alice"
```

Yes, the Arrange phase overlaps between tests.
That's fine -- clarity trumps deduplication in tests.

---

## 7. Make Tests Complete and Concise

**Complete:** A test should contain all the information a reader needs to understand it without looking elsewhere.

**Concise:** A test should contain *no more* information than necessary.

### Do / Don't

**Don't** -- the "Mystery Guest" smell (depends on external fixture):

```python
# In a fixtures file somewhere:
# TEST_USER = User(id=1, name="Test User", email="test@example.com", 
#                  tier="gold", balance=500, created_at=...)

def test_gold_discount():
    discount = calculate_discount(TEST_USER)
    assert discount == EXPECTED_DISCOUNT
```

Why does this user get this discount?
You have to go find `TEST_USER` in another file.
If someone modifies `TEST_USER` for a different test, this test might silently break.

**Do** -- complete, with all relevant values visible:

```python
def test_gold_tier_gets_fifteen_percent_discount():
    user = make_user(tier="gold")
    discount = calculate_discount(user)
    assert discount == 0.15
```

The `make_user` helper provides sensible defaults for irrelevant fields so the test only specifies what matters: the tier.

**Don't** -- verbose, with irrelevant details (not concise):

```python
def test_gold_tier_gets_fifteen_percent_discount():
    user = User(
        id=42,
        name="Alice Johnson",
        email="alice.johnson@example.com",
        tier="gold",
        balance=1547.82,
        created_at=datetime(2023, 3, 15, 10, 30, 0),
        last_login=datetime(2024, 1, 20, 14, 22, 0),
        preferences={"newsletter": True, "dark_mode": False},
    )
    discount = calculate_discount(user)
    assert discount == 0.15
```

The reader wastes time wondering: does the balance matter?
The creation date?
None of them do -- only the tier matters.
But you can't tell without reading the production code.

---

## 8. Don't Put Logic in Tests

Test code should be straight-line code.
No loops, no conditionals, no computation to derive expected values.

### Do / Don't

**Don't** -- logic in the test mirrors (and could replicate) bugs in production code:

```python
def test_format_price():
    prices = [10, 20.5, 100, 0.99]
    for price in prices:
        result = format_price(price)
        # Computing expected value the same way production code might
        expected = "$" + f"{price:.2f}"
        assert result == expected
```

If `format_price` has a bug and this test computes the expected value the same wrong way, the test passes despite the bug.

**Do** -- hardcoded expected values, one test per case:

```python
def test_format_price_whole_dollar():
    assert format_price(10) == "$10.00"

def test_format_price_with_cents():
    assert format_price(20.5) == "$20.50"

def test_format_price_under_one_dollar():
    assert format_price(0.99) == "$0.99"
```

The expected values are the specification.
The test verifies the code meets them.

**Don't** -- conditional logic in a test:

```python
def test_user_access():
    for role in ["admin", "editor", "viewer"]:
        user = make_user(role=role)
        result = check_access(user, resource)
        if role == "admin":
            assert result.can_delete == True
        elif role == "editor":
            assert result.can_edit == True
        else:
            assert result.can_view == True
            assert result.can_edit == False
```

**Do** -- separate tests with explicit expectations:

```python
def test_admin_can_delete():
    user = make_user(role="admin")
    result = check_access(user, resource)
    assert result.can_delete == True

def test_editor_can_edit_but_not_delete():
    user = make_user(role="editor")
    result = check_access(user, resource)
    assert result.can_edit == True
    assert result.can_delete == False

def test_viewer_can_view_but_not_edit():
    user = make_user(role="viewer")
    result = check_access(user, resource)
    assert result.can_view == True
    assert result.can_edit == False
```

**Exception -- parameterized tests:** Frameworks like pytest's `@pytest.mark.parametrize` let you run the same test logic with multiple inputs.
This is acceptable when the logic is identical across cases and only inputs/outputs differ:

```python
@pytest.mark.parametrize("price, expected", [
    (10, "$10.00"),
    (20.5, "$20.50"),
    (0.99, "$0.99"),
])
def test_format_price(price, expected):
    assert format_price(price) == expected
```

No logic in the test -- the framework handles iteration, and each case is reported separately on failure.

---

## 9. Write Clear Failure Messages

When a test fails, the failure message should tell the engineer what went wrong without requiring them to read the test code.

### Do / Don't

**Don't** -- bare assertion with no context:

```python
def test_process_order():
    result = service.process(order)
    assert result  # Failure: "AssertionError: assert False"
```

What failed?
What was `result`?
What was expected?

**Do** -- assertion with context:

```python
def test_process_order_with_valid_items_succeeds():
    result = service.process(order)
    assert result.success, f"Expected order to succeed but got: {result.error}"
```

**Do** -- for complex objects, make expected vs. actual clear:

```python
def test_build_report_includes_all_sections():
    report = build_report(data)
    expected_sections = {"summary", "details", "appendix"}
    actual_sections = set(report.sections.keys())
    assert actual_sections == expected_sections, (
        f"Missing sections: {expected_sections - actual_sections}, "
        f"Unexpected sections: {actual_sections - expected_sections}"
    )
```

---

## 10. DAMP over DRY

In production code, DRY (Don't Repeat Yourself) is essential.
In test code, readability matters more. **DAMP** stands for **Descriptive And Meaningful Phrases**.

### Do / Don't

**Don't** -- aggressively DRY test code that requires tracing through abstractions:

```python
class BaseTransactionTest(TestCase):
    def setUp(self):
        self.db = setup_test_database()
        self.processor = TransactionProcessor(self.db)
        self.sender = self.create_account("sender", 1000)
        self.recipient = self.create_account("recipient", 0)
    
    def create_account(self, name, balance):
        # ... 15 lines of setup ...

    def assert_transfer_result(self, result, expected_success, 
                                expected_sender_balance, expected_recipient_balance):
        # ... 10 lines of assertion helpers ...

class TestTransfer(BaseTransactionTest):
    def test_valid_transfer(self):
        result = self.processor.transfer(self.sender, self.recipient, 100)
        self.assert_transfer_result(result, True, 900, 100)
```

To understand `test_valid_transfer`, you must read `setUp`, `create_account`, and `assert_transfer_result` across two classes.

**Do** -- self-contained test with helper for boilerplate only:

```python
def test_valid_transfer_moves_funds():
    db = create_test_db()
    processor = TransactionProcessor(db)
    processor.set_balance("sender", 1000)
    processor.set_balance("recipient", 0)

    result = processor.transfer("sender", "recipient", 100)

    assert result.success == True
    assert processor.get_balance("sender") == 900
    assert processor.get_balance("recipient") == 100
```

Slightly more lines, but a reader understands the entire test without looking anywhere else.

### What to Share vs. What to Inline

| Share (extract to helpers) | Inline (keep in each test) |
|---|---|
| Database/service startup and teardown | The specific values relevant to this scenario |
| Object construction boilerplate (builders/factories) | The Act step (the call being tested) |
| Complex environment setup | The Assert step (the expected outcomes) |
| Utility functions (e.g., `make_user(role="admin")`) | Any setup value that explains *why* this test exists |

---

## 11. Test Doubles: Mocks, Stubs, Fakes

A **test double** is any object that stands in for a real dependency during testing.

### Types at a Glance

| Type | What it does | Example | Fidelity |
|---|---|---|---|
| **Fake** | Lightweight working implementation | In-memory database, fake email service that records sent messages | High |
| **Stub** | Returns pre-programmed responses | `stub_api.get_user = lambda id: User(name="Alice")` | Medium |
| **Mock** | Records calls for later assertion | `mock_emailer.send.assert_called_once()` | Low |
| **Dummy** | Placeholder, never actually used | `null_logger` passed to satisfy a required parameter | N/A |

### The Preference Order

1. **Real implementation** -- always first choice if fast and deterministic.
2. **Fake** -- when the real thing is slow, costly, or has side effects.
3. **Stub** -- when you need controlled responses but don't care about behavioral fidelity.
4. **Mock** -- only when you must verify an interaction and there's no observable state to check.

### Do / Don't

**Don't** -- over-mocking everything, testing the wiring:

```python
def test_create_order():
    mock_repo = Mock()
    mock_validator = Mock()
    mock_validator.validate.return_value = True
    mock_notifier = Mock()
    
    service = OrderService(mock_repo, mock_validator, mock_notifier)
    service.create_order(order_data)

    mock_validator.validate.assert_called_once_with(order_data)
    mock_repo.save.assert_called_once()
    mock_notifier.notify.assert_called_once()
```

This verifies that three methods were called -- not that an order was actually created correctly.
If we refactor internal method names, the test breaks.

**Do** -- fakes with state verification:

```python
def test_create_order_saves_and_notifies():
    repo = FakeOrderRepo()
    notifier = FakeNotifier()
    service = OrderService(repo, InternalValidator(), notifier)

    service.create_order(order_data)

    assert len(repo.saved_orders) == 1
    assert repo.saved_orders[0].item_id == order_data.item_id
    assert len(notifier.sent_notifications) == 1
```

Uses a real validator (it's fast, why fake it?), fake repo and notifier.
Asserts on state: was an order saved?
Was a notification sent?

### Writing a Good Fake

A fake should be simple enough that it obviously has no bugs:

```python
class FakeEmailer:
    """Records emails instead of sending them. Owned by the email-service team."""
    
    def __init__(self):
        self.sent_messages = []
    
    def send(self, to, subject, body):
        self.sent_messages.append(Email(to=to, subject=subject, body=body))
    
    def reset(self):
        self.sent_messages = []
```

**The team that owns the real implementation should provide the fake.** They understand the contract and can keep the fake in sync.

---

## 12. Test Smells: Recognizing and Fixing Common Problems

A smell is a symptom, not a diagnosis.
Here are the most common smells with concrete before/after examples.

### Fragile Test

**Symptom:** Tests break when you make unrelated changes.

```python
# FRAGILE -- coupled to string representation
def test_user_display():
    user = User(first="Alice", last="Smith")
    assert str(user) == "User(first='Alice', last='Smith', id=None, active=True)"
```

If you add a field to `User`, this test breaks even though display logic is unchanged.

```python
# ROBUST -- tests the behavior you actually care about
def test_user_display_name():
    user = User(first="Alice", last="Smith")
    assert user.display_name() == "Alice Smith"
```

### Obscure Test / Mystery Guest

**Symptom:** You can't understand what a test does without reading other files.

```python
# OBSCURE
def test_apply_discount():
    result = apply_discount(STANDARD_FIXTURE)  # what is this?
    assert result == EXPECTED_DISCOUNT          # what is this?
```

```python
# CLEAR
def test_gold_customer_gets_15_percent_discount():
    order = make_order(customer_tier="gold", subtotal=100.00)
    result = apply_discount(order)
    assert result == 15.00
```

### Slow Tests

**Symptom:** Tests take seconds when they should take milliseconds.

Common causes and fixes:
- **Real database when a fake would work:** Replace with in-memory database.
- **Network calls in unit tests:** Replace with stubs or fakes.
- **Unnecessarily large fixtures:** Create only the data needed.
- **Wrong test level:** If you spin up a server to test business logic, rewrite as a unit test.

### Erratic / Flaky Test

**Symptom:** Test passes and fails without code changes.

```python
# FLAKY -- depends on current time
def test_is_business_hours():
    assert is_business_hours() == True  # fails at night and on weekends
```

```python
# DETERMINISTIC -- controls the input
def test_weekday_afternoon_is_business_hours():
    wednesday_2pm = datetime(2024, 3, 13, 14, 0, 0)
    assert is_business_hours(wednesday_2pm) == True

def test_sunday_is_not_business_hours():
    sunday_2pm = datetime(2024, 3, 17, 14, 0, 0)
    assert is_business_hours(sunday_2pm) == False
```

### Change-Detector Test

**Symptom:** The test restates the implementation rather than specifying behavior.

```python
# CHANGE-DETECTOR -- mirrors the code
def test_full_name():
    user = User(first="Alice", last="Smith")
    assert user.full_name() == user.first + " " + user.last
```

```python
# MEANINGFUL -- specifies expected behavior
def test_full_name():
    user = User(first="Alice", last="Smith")
    assert user.full_name() == "Alice Smith"
```

---

## 13. Design for Testability

### Do / Don't

**Don't** -- hardcoded dependency that can't be substituted:

```python
class OrderService:
    def __init__(self):
        self.db = PostgresDatabase("prod-connection-string")  # hardcoded
        self.emailer = SmtpEmailer("smtp.company.com")        # hardcoded
```

You cannot test this without a real Postgres database and a real SMTP server.

**Do** -- dependencies injected, substitutable:

```python
class OrderService:
    def __init__(self, db, emailer):
        self.db = db
        self.emailer = emailer

# In production:
service = OrderService(PostgresDatabase(config.db_url), SmtpEmailer(config.smtp_host))

# In tests:
service = OrderService(FakeDatabase(), FakeEmailer())
```

### Separate Logic from Side Effects (Humble Object Pattern)

**Don't** -- logic tangled with I/O:

```python
def process_file(path):
    with open(path) as f:
        data = json.load(f)
    # 50 lines of complex transformation logic interleaved with file I/O
    result = []
    for record in data:
        if record["type"] == "A":
            result.append(transform_a(record))
        else:
            result.append(transform_b(record))
    with open(path + ".out", "w") as f:
        json.dump(result, f)
```

To test the transformation logic, you need real files on disk.

**Do** -- pure logic extracted, thin I/O shell:

```python
def transform_records(data):
    """Pure function -- trivially testable with hardcoded inputs."""
    result = []
    for record in data:
        if record["type"] == "A":
            result.append(transform_a(record))
        else:
            result.append(transform_b(record))
    return result

def process_file(path):
    """Thin shell -- does I/O only. Covered by one integration test."""
    with open(path) as f:
        data = json.load(f)
    result = transform_records(data)
    with open(path + ".out", "w") as f:
        json.dump(result, f)
```

Now `transform_records` can be unit-tested with hardcoded inputs.
The thin `process_file` wrapper gets a single integration test.

---

## 14. The Role of Coverage Metrics

Code coverage measures what percentage of your code is *executed* during testing.
It does not measure what percentage is *correctly tested*.

### Do / Don't

**Don't** -- write tests that game coverage without verifying behavior:

```python
def test_covers_calculate():
    calculate(1, 2)   # no assertion -- executes the code but verifies nothing
```

This achieves line coverage for `calculate` while providing zero protection against bugs.

**Don't** -- set a single project-wide coverage target and enforce it rigidly.
This incentivizes engineers to write easy, low-value tests for trivial code while ignoring hard-to-test, high-risk code.

**Do** -- use coverage to find gaps:

```
$ coverage report
Name                     Stmts   Miss  Cover
---------------------------------------------
payment_processor.py       120     45    62%   <-- high-risk, low coverage
config_loader.py            30      2    93%
utils.py                    50     10    80%
```

"Payment processor has 62% coverage" is a signal to investigate -- are the untested lines high-risk?

**Do** -- watch for coverage *decreasing* between commits.
A drop means new code was added without tests.

**Do** -- set per-component minimum floors rather than a single project-wide number.
High-risk code gets a higher floor.

---

## 15. Regression Testing

A regression test is any test that prevents a previously-fixed bug from recurring.
It is a *purpose*, not a *type*.

### Do / Don't

**Don't** -- fix the bug without adding a test:

```python
# Bug report: negative transfer amounts bypass validation
# Engineer fixes the validation code, commits, done.
```

The bug will recur when someone refactors the validation logic.

**Don't** -- write the regression test at too high a level when the bug is in isolated logic:

```python
def test_bug_1234():
    # Slow, fragile test through the full stack when the bug is in validation logic
    response = client.post("/transfer", json={"amount": -100})
    assert response.status_code == 400
```

**Do** -- replicate the bug at the lowest possible level, then fix it:

```python
def test_transfer_negative_amount_is_rejected():
    """Regression test for BUG-1234: negative amounts bypassed validation."""
    processor = TransactionProcessor(db)
    processor.set_balance("sender", 1000)

    result = processor.transfer("sender", "recipient", amount=-100)

    assert result.success == False
    assert result.reason == "invalid_amount"
    assert processor.get_balance("sender") == 1000  # no money moved
```

Fast, focused, and the test name + docstring explain both the behavior and the history.
