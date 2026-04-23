# Integration Tests

## What They Are

An integration test verifies that two or more components work together correctly.
It exercises the seams between units -- the interfaces, contracts, and data flows that connect them.

The term "integration test" is notoriously fuzzy.
Fowler observes that its definition varies more than almost any other testing term.
For this document: an integration test exercises a collaboration between components that a unit test, by design, does not cover.
The components might be classes within a single service, a service and its database, an API layer and its business logic, or two microservices.

## Why They Exist

Correct units do not guarantee a correct system.
Common bugs that only integration tests catch:

- A function produces output in a format its consumer doesn't expect.
- A database query works logically but fails with real schema constraints.
- Two modules agree on an interface at compile time but disagree on behavioral contracts (ordering, nullability, error semantics).
- Serialization/deserialization between components loses data or changes types.

Dodds's Testing Trophy perspective: integration tests often provide the best return on investment because they're close enough to real usage to catch meaningful bugs, but not so broad that they become slow and flaky.

## When to Use Them

Use integration tests for:
- Verifying your code correctly reads from and writes to a database, file system, or external API.
- Verifying two modules or services communicate correctly through their shared interface.
- Verifying your API layer correctly translates HTTP requests into business logic and responses.
- Verifying a UI component correctly interacts with its data layer.
- Any scenario where the risk lives at the boundary between components.

## Scope and Boundaries

**Prefer narrower integration tests.** Each test should focus on one specific boundary.
A test that exercises controller + service + repository + database all at once is harder to debug than three tests verifying each boundary separately.

**Real vs. fake dependencies:** Use real dependencies when they are fast and reliable.
An in-memory database (SQLite, H2) is often preferable to mocking the database layer because it catches real SQL bugs while remaining fast.
But a real external API that is slow or rate-limited should be replaced with a fake.

**Contract tests** are a specialized form for microservice architectures.
Rather than spinning up both services, you test each side of the contract independently: the consumer tests that it correctly calls the expected API, and the provider tests that it correctly serves it.

## Worked Example: Testing a Repository Against a Real Database

Suppose you have a `UserRepository` that wraps database access:

```python
class UserRepository:
    def __init__(self, db):
        self.db = db

    def save(self, user):
        self.db.execute(
            "INSERT INTO users (id, name, email) VALUES (?, ?, ?)",
            (user.id, user.name, user.email)
        )

    def find_by_email(self, email):
        row = self.db.execute(
            "SELECT id, name, email FROM users WHERE email = ?", (email,)
        ).fetchone()
        if row is None:
            return None
        return User(id=row[0], name=row[1], email=row[2])
```

**Good integration tests** -- each focused on one boundary behavior:

```python
@pytest.fixture
def db():
    """Fresh in-memory database for each test."""
    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE users (id TEXT, name TEXT, email TEXT UNIQUE)")
    yield conn
    conn.close()

def test_save_and_retrieve_user(db):
    repo = UserRepository(db)
    user = User(id="1", name="Alice", email="alice@example.com")

    repo.save(user)
    found = repo.find_by_email("alice@example.com")

    assert found is not None
    assert found.id == "1"
    assert found.name == "Alice"
    assert found.email == "alice@example.com"

def test_find_by_email_returns_none_when_not_found(db):
    repo = UserRepository(db)

    found = repo.find_by_email("nobody@example.com")

    assert found is None

def test_save_duplicate_email_raises_error(db):
    repo = UserRepository(db)
    repo.save(User(id="1", name="Alice", email="alice@example.com"))

    with pytest.raises(sqlite3.IntegrityError):
        repo.save(User(id="2", name="Bob", email="alice@example.com"))
```

**Why this is good:**
- Uses a real (in-memory) database -- catches real SQL bugs like the UNIQUE constraint.
- Each test gets a fresh database via the fixture -- no shared state.
- Each test verifies one boundary behavior.
- Tests are fast (in-memory SQLite) and deterministic (no external dependencies).
- The third test verifies behavior that a mock-based test would completely miss.

## Worked Example: Testing an API Controller

Suppose you have a web controller that calls a service layer:

```python
# BAD -- mocking the service and only verifying calls
def test_create_user_endpoint():
    mock_service = Mock()
    mock_service.create_user.return_value = User(id="1", name="Alice")
    app = create_app(user_service=mock_service)
    client = app.test_client()

    response = client.post("/users", json={"name": "Alice", "email": "alice@example.com"})

    assert response.status_code == 201
    mock_service.create_user.assert_called_once_with(
        name="Alice", email="alice@example.com"
    )
```

This test verifies *call wiring*, not behavior.
If `create_user` changes its parameter order, the test breaks without any real bug.

```python
# GOOD -- real service with fake database
def test_create_user_endpoint():
    db = create_test_db()
    service = UserService(UserRepository(db))
    app = create_app(user_service=service)
    client = app.test_client()

    response = client.post("/users", json={"name": "Alice", "email": "alice@example.com"})

    assert response.status_code == 201
    body = response.get_json()
    assert body["name"] == "Alice"
    assert body["email"] == "alice@example.com"
    assert body["id"] is not None
    # Also verify the user was actually persisted
    assert service.get_user_by_email("alice@example.com") is not None
```

This test exercises the real controller-to-service-to-repository chain with an in-memory database.
It verifies the full behavior: correct HTTP response *and* actual persistence.

## Type-Specific Pitfalls (with Examples)

### Pitfall: Scope Creep

```python
# BAD -- this is really a broad-scope test wearing an integration test's name
def test_full_checkout_flow():
    db = create_test_db()
    app = create_app(db)
    client = app.test_client()

    # Create user, add items, apply coupon, checkout, verify email sent,
    # verify inventory decreased, verify order in database...
    # (50 lines of test code spanning 6 components)
```

This test spans too many boundaries.
If it fails, you don't know which boundary is broken.
Break it into focused tests: controller-to-service, service-to-repository, service-to-emailer.

### Pitfall: Testing Logic at the Wrong Level

```python
# BAD -- using an integration test for pure logic
def test_discount_calculation():
    db = create_test_db()
    seed_data(db, users=[make_user(tier="gold")])
    service = DiscountService(UserRepository(db))

    discount = service.calculate_discount(user_id="1", subtotal=100.00)

    assert discount == 15.00
```

The discount calculation is pure logic -- it doesn't need a database.
Test it as a unit test:

```python
# GOOD -- unit test for the logic, integration test only for the DB interaction
def test_gold_tier_discount():
    discount = calculate_discount(customer_tier="gold", subtotal=100.00)
    assert discount == 15.00
```

Save the integration test for verifying that the repository correctly retrieves the user's tier from the database.

### Pitfall: Shared Test Database

```python
# BAD -- tests share a database and interfere with each other
db = create_test_db()  # shared across all tests

def test_create_user():
    repo = UserRepository(db)
    repo.save(User(id="1", name="Alice", email="alice@example.com"))
    assert repo.find_by_email("alice@example.com") is not None

def test_count_users():
    repo = UserRepository(db)
    # FRAGILE -- depends on how many users previous tests created
    assert repo.count() == 0  # fails because test_create_user already ran
```

```python
# GOOD -- each test gets a fresh database
@pytest.fixture
def repo():
    db = sqlite3.connect(":memory:")
    db.execute("CREATE TABLE users (...)")
    yield UserRepository(db)
    db.close()

def test_create_user(repo):
    repo.save(User(id="1", name="Alice", email="alice@example.com"))
    assert repo.find_by_email("alice@example.com") is not None

def test_empty_repo_has_no_users(repo):
    assert repo.count() == 0  # always passes -- fresh database
```

## Checklist

When writing or reviewing an integration test, verify:

- [ ] **Focused boundary:** The test verifies a specific interaction between a specific pair of components, not the entire system. *(avoid scope creep)*
- [ ] **Real over fake when possible:** Dependencies are real implementations unless they are slow, flaky, or impractical. *([Principles](./testing-principles.md) -- Test Doubles)*
- [ ] **Minimal fixture:** Only the data/state needed for this specific interaction. *([Principles](./testing-principles.md) -- Make Tests Complete and Concise)*
- [ ] **Isolated state:** Does not share mutable state with other tests.
  Each test gets a fresh database, clean file system, etc. *([Principles](./testing-principles.md) -- Test Smells, Erratic Test)*
- [ ] **Behavior-focused name:** Describes the cross-boundary behavior, not internal methods. *([Principles](./testing-principles.md) -- Test Behaviors Not Methods)*
- [ ] **Arrange-Act-Assert:** Clear three-phase structure. *([Principles](./testing-principles.md) -- Arrange Act Assert)*
- [ ] **Reasonable speed:** Completes in seconds, not minutes. *([Principles](./testing-principles.md) -- Test Smells, Slow Tests)*
- [ ] **Correct layer:** The behavior genuinely requires an integration test.
  If it's pure logic, push it to a [unit test](./testing-unit.md). *([Overview](./testing-overview.md): prefer lowest-scope test)*
- [ ] **State verification:** Asserts on observable outcomes (data in the database, response body), not on which internal methods were called. *([Principles](./testing-principles.md) -- Test State Not Interactions)*
