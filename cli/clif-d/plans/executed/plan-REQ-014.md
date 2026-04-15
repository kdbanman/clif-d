# Implementation Plan: Validate PRD Structural Integrity

**Requirements:** REQ-014
**PRD:** `cli-prd.json`
**Backpressure:** `cli/clif-d/backpressure.md`
**Preceding plans:** `cli/clif-d/plans/active/plan-REQ-008-REQ-009.md` (core infrastructure), `cli/clif-d/plans/active/plan-REQ-011-REQ-012-REQ-013.md` (atomic write, status transitions)
**Date:** 2026-04-14
**Status:** Executed
**Implementation commit:** 7af96fe

## 1. Objective

Implement the `validate` command in `bin/clif-d`. When complete, an agent or developer can run a single command that checks JSON validity, schema conformance, referential integrity of all ID references, dependency graph acyclicity, ID uniqueness, and status/implementation_commit consistency. The output is a structured JSON list of issues with severity levels.

## 2. Context Summary

### Requirement: REQ-014 -- Validate PRD structural integrity

**Description:** A comprehensive validation command that checks everything beyond what JSON Schema alone can express. Intended as a final step in any skill that modifies the PRD, and as the foundation of the planned check-clif-d-consistency skill. Related to REQ-005.

**Acceptance criteria (Given-When-Then):**
- **Given:** A prd.json where REQ-003 has a dependency on nonexistent REQ-999 and REQ-005 has status 'done' but no implementation_commit
- **When:** The agent runs `clif-d validate`
- **Then:** stdout contains a JSON array with at least two issue objects: one error for the dangling dependency reference and one error for the done-without-commit inconsistency. Exit code is 1.

**CLI specification:**
- Command: `validate`
- stdout: JSON array of issue objects: `{ "level": "error" | "warning", "id": "<entity-id or null>", "message": "..." }`. Empty array if valid.
- stderr: Fatal errors only (file not found, unparseable JSON).
- Exit codes: 0 = PRD is valid (no errors; warnings are allowed), 1 = PRD has validation errors, 2 = PRD file not found or not parseable as JSON.

### Relevant architecture decisions

**ARCH-002 -- Command routing:** `validate` is a top-level command (no domain prefix). Dispatched directly from the router.

### Relevant context items

**CTX-003 -- PRD schema as contract:** The CLI operates on JSON files conforming to the PRD schema at `skills/create-initial-prd/assets/prd-schema.json`. The CLI must validate reads and writes against this schema.

**CTX-008 -- Dependency graph semantics:** The dependencies field defines hard blocking relationships. The graph must be a DAG -- circular dependencies are invalid.

**CTX-007 -- Requirement lifecycle states:** done requires implementation_commit. Status transitions are validated.

### Validation checks to implement

The validate command performs these checks in order. Each check produces zero or more issue objects.

1. **JSON parse** -- handled by loadPrd (exit 2 on failure, not an issue object).
2. **Required top-level fields** -- $schema, product_name, concept_summary, context, architecture, requirements must exist and be the correct types.
3. **ID uniqueness** -- no duplicate IDs within each namespace (REQ, CTX, ARCH).
4. **ID format** -- all IDs match their expected pattern (REQ-NNN, CTX-NNN, ARCH-NNN).
5. **Referential integrity -- dependencies** -- every ID in a requirement's dependencies array must exist as a requirement ID.
6. **Referential integrity -- context_refs** -- every ID in context_refs must exist as a context item ID.
7. **Referential integrity -- architecture_refs** -- every ID in architecture_refs must exist as an architecture item ID.
8. **Dependency graph acyclicity** -- the dependency graph must be a DAG. Report the cycle if found.
9. **Status/commit consistency** -- if status is "done", implementation_commit must be present. If implementation_commit is present, status should be "done" (warning if not).
10. **Required fields per item** -- requirements need id, title, description, acceptance_criteria, abstraction_level. Context items need id, title, description, type. Architecture items need id, title, description, level.
11. **Enum values** -- status must be one of not_started/in_progress/done/blocked. abstraction_level must be high/low. Context type must be one of the valid types. Architecture level must be context/container/component.

### Schema location

Per ARCH-001, the CLI resolves the schema relative to its own location. In `bin/clif-d`:

```js
const schemaPath = path.resolve(__dirname, "../skills/create-initial-prd/assets/prd-schema.json");
```

Note: for the validate command, we implement validation checks directly in code rather than using a JSON Schema validation library (which would be a dependency). The schema is the source of truth for what fields and types are valid, but the code performs the checks.

### Quality guardrails

```bash
cd cli
npx prettier --write ../bin/clif-d
npx eslint ../bin/clif-d
npx tsc --noEmit
node --test test/**/*.test.js
npm run check
```

## 3. Prerequisites

- **Plan REQ-008-REQ-009 must be implemented first.** Uses core infrastructure (loadPrd, command routing, parseFlags).
- Node.js 18+ available.
- Dev tooling installed.

## 4. Implementation Steps

### Step 1: Test and implement basic validate with ID uniqueness check

**Test first:**
- File: `cli/test/validate.test.js`
- Description: Test that validate returns an empty array for a valid PRD, and detects duplicate IDs.
- Test code sketch:
```js
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { run, withFixture, MINIMAL_PRD } = require("./helpers.js");

describe("validate", () => {
  it("returns empty array for a valid PRD", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["validate"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const issues = JSON.parse(result.stdout);
    assert.deepEqual(issues, []);
  });

  it("detects duplicate requirement IDs", () => {
    const prd = structuredClone(MINIMAL_PRD);
    prd.requirements.push({
      id: "REQ-001",
      title: "Duplicate",
      description: "Dup",
      acceptance_criteria: "Done",
      abstraction_level: "high",
    });
    const dir = withFixture(prd);
    const result = run(["validate"], { cwd: dir });
    assert.equal(result.exitCode, 1);
    const issues = JSON.parse(result.stdout);
    const dupIssue = issues.find((i) => i.message.includes("REQ-001"));
    assert.ok(dupIssue);
    assert.equal(dupIssue.level, "error");
  });

  it("exits 2 when PRD file not found", () => {
    const dir = require("node:fs").mkdtempSync(
      require("node:path").join(require("node:os").tmpdir(), "clif-d-test-"),
    );
    const result = run(["validate"], { cwd: dir });
    assert.equal(result.exitCode, 2);
  });
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: Add `validate(prd)` function that returns an array of `{ level, id, message }` objects. Start with ID uniqueness: collect all IDs per namespace, flag duplicates. Add the `validate` command to the router. Exit 0 if no errors (warnings OK), exit 1 if any errors.

**Verify:**
- Run: `cd cli && node --test test/validate.test.js`
- Expected: Tests pass.
- Quality check: `cd cli && npm run check`

### Step 2: Test and implement referential integrity checks

**Test first:**
- File: `cli/test/validate.test.js`
- Description: Test dangling dependency refs, dangling context_refs, dangling architecture_refs.
- Test code sketch:
```js
it("detects dangling dependency reference", () => {
  const prd = structuredClone(MINIMAL_PRD);
  prd.requirements[1].dependencies = ["REQ-999"];
  const dir = withFixture(prd);
  const result = run(["validate"], { cwd: dir });
  assert.equal(result.exitCode, 1);
  const issues = JSON.parse(result.stdout);
  const refIssue = issues.find(
    (i) => i.message.includes("REQ-999") && i.id === "REQ-002",
  );
  assert.ok(refIssue);
  assert.equal(refIssue.level, "error");
});

it("detects dangling context_refs", () => {
  const prd = structuredClone(MINIMAL_PRD);
  prd.requirements[0].context_refs = ["CTX-999"];
  const dir = withFixture(prd);
  const result = run(["validate"], { cwd: dir });
  assert.equal(result.exitCode, 1);
  const issues = JSON.parse(result.stdout);
  const refIssue = issues.find((i) => i.message.includes("CTX-999"));
  assert.ok(refIssue);
});

it("detects dangling architecture_refs", () => {
  const prd = structuredClone(MINIMAL_PRD);
  prd.requirements[0].architecture_refs = ["ARCH-999"];
  const dir = withFixture(prd);
  const result = run(["validate"], { cwd: dir });
  assert.equal(result.exitCode, 1);
  const issues = JSON.parse(result.stdout);
  const refIssue = issues.find((i) => i.message.includes("ARCH-999"));
  assert.ok(refIssue);
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: Build sets of valid IDs per namespace (reqIds, ctxIds, archIds). For each requirement, check that every entry in dependencies references a valid REQ ID, every entry in context_refs references a valid CTX ID, and every entry in architecture_refs references a valid ARCH ID.

**Verify:**
- Run: `cd cli && node --test test/validate.test.js`
- Expected: All tests pass.
- Quality check: `cd cli && npm run check`

### Step 3: Test and implement dependency cycle detection

**Test first:**
- File: `cli/test/validate.test.js`
- Description: Test that circular dependencies are detected and reported.
- Test code sketch:
```js
it("detects dependency cycles", () => {
  const prd = structuredClone(MINIMAL_PRD);
  // Create cycle: REQ-001 -> REQ-002 -> REQ-001
  prd.requirements[0].dependencies = ["REQ-002"];
  prd.requirements[1].dependencies = ["REQ-001"];
  const dir = withFixture(prd);
  const result = run(["validate"], { cwd: dir });
  assert.equal(result.exitCode, 1);
  const issues = JSON.parse(result.stdout);
  const cycleIssue = issues.find((i) => /cycle|circular/i.test(i.message));
  assert.ok(cycleIssue);
  assert.equal(cycleIssue.level, "error");
});

it("handles self-referencing dependency", () => {
  const prd = structuredClone(MINIMAL_PRD);
  prd.requirements[0].dependencies = ["REQ-001"];
  const dir = withFixture(prd);
  const result = run(["validate"], { cwd: dir });
  assert.equal(result.exitCode, 1);
  const issues = JSON.parse(result.stdout);
  const cycleIssue = issues.find((i) => /cycle|circular/i.test(i.message));
  assert.ok(cycleIssue);
});

it("detects longer cycles (A -> B -> C -> A)", () => {
  const prd = structuredClone(MINIMAL_PRD);
  prd.requirements.push({
    id: "REQ-003",
    title: "Third",
    description: "Desc",
    acceptance_criteria: "Done",
    abstraction_level: "high",
    dependencies: ["REQ-001"],
  });
  prd.requirements[0].dependencies = ["REQ-003"];
  // Now: REQ-001 -> REQ-003 -> REQ-001 (cycle through REQ-002 is not involved)
  const dir = withFixture(prd);
  const result = run(["validate"], { cwd: dir });
  assert.equal(result.exitCode, 1);
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: Implement cycle detection using DFS with coloring (white/gray/black). White = unvisited, gray = in current path, black = fully explored. When a gray node is encountered, a cycle exists. Report the cycle path in the error message.

**Verify:**
- Run: `cd cli && node --test test/validate.test.js`
- Expected: All tests pass.
- Quality check: `cd cli && npm run check`

### Step 4: Test and implement status/commit consistency check

**Test first:**
- File: `cli/test/validate.test.js`
- Description: Test done-without-commit (error) and commit-without-done (warning).
- Test code sketch:
```js
it("detects done status without implementation_commit", () => {
  const prd = structuredClone(MINIMAL_PRD);
  prd.requirements[0].status = "done";
  // No implementation_commit
  const dir = withFixture(prd);
  const result = run(["validate"], { cwd: dir });
  assert.equal(result.exitCode, 1);
  const issues = JSON.parse(result.stdout);
  const issue = issues.find(
    (i) => i.id === "REQ-001" && /commit/i.test(i.message),
  );
  assert.ok(issue);
  assert.equal(issue.level, "error");
});

it("warns when implementation_commit present but status is not done", () => {
  const prd = structuredClone(MINIMAL_PRD);
  prd.requirements[0].implementation_commit = "abc1234";
  prd.requirements[0].status = "in_progress";
  const dir = withFixture(prd);
  const result = run(["validate"], { cwd: dir });
  // Warnings don't cause exit 1
  assert.equal(result.exitCode, 0);
  const issues = JSON.parse(result.stdout);
  const issue = issues.find(
    (i) => i.id === "REQ-001" && i.level === "warning",
  );
  assert.ok(issue);
});

it("passes when done status has implementation_commit", () => {
  const prd = structuredClone(MINIMAL_PRD);
  prd.requirements[0].status = "done";
  prd.requirements[0].implementation_commit = "abc1234";
  const dir = withFixture(prd);
  const result = run(["validate"], { cwd: dir });
  assert.equal(result.exitCode, 0);
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: For each requirement: if status is "done" and implementation_commit is missing, emit error. If implementation_commit is present and status is not "done", emit warning.

**Verify:**
- Run: `cd cli && node --test test/validate.test.js`
- Expected: All tests pass.
- Quality check: `cd cli && npm run check`

### Step 5: Test and implement enum value validation

**Test first:**
- File: `cli/test/validate.test.js`
- Description: Test invalid status values, abstraction levels, context types, architecture levels.
- Test code sketch:
```js
it("detects invalid status value", () => {
  const prd = structuredClone(MINIMAL_PRD);
  prd.requirements[0].status = "invalid_status";
  const dir = withFixture(prd);
  const result = run(["validate"], { cwd: dir });
  assert.equal(result.exitCode, 1);
  const issues = JSON.parse(result.stdout);
  const issue = issues.find(
    (i) => i.id === "REQ-001" && /status/i.test(i.message),
  );
  assert.ok(issue);
});

it("detects invalid abstraction_level", () => {
  const prd = structuredClone(MINIMAL_PRD);
  prd.requirements[0].abstraction_level = "medium";
  const dir = withFixture(prd);
  const result = run(["validate"], { cwd: dir });
  assert.equal(result.exitCode, 1);
});

it("detects invalid context type", () => {
  const prd = structuredClone(MINIMAL_PRD);
  prd.context = [
    { id: "CTX-001", title: "T", description: "D", type: "invalid" },
  ];
  const dir = withFixture(prd);
  const result = run(["validate"], { cwd: dir });
  assert.equal(result.exitCode, 1);
});

it("detects invalid architecture level", () => {
  const prd = structuredClone(MINIMAL_PRD);
  prd.architecture = [
    { id: "ARCH-001", title: "T", description: "D", level: "invalid" },
  ];
  const dir = withFixture(prd);
  const result = run(["validate"], { cwd: dir });
  assert.equal(result.exitCode, 1);
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: Check each requirement's status (if present) against valid values. Check abstraction_level against "high"/"low". Check context type and architecture level against their respective enums from the schema.

**Verify:**
- Run: `cd cli && node --test test/validate.test.js`
- Expected: All tests pass.
- Quality check: `cd cli && npm run check`

### Step 6: Test and implement required fields check

**Test first:**
- File: `cli/test/validate.test.js`
- Description: Test that missing required fields on requirements, context items, and architecture items are detected.
- Test code sketch:
```js
it("detects missing required fields on requirement", () => {
  const prd = structuredClone(MINIMAL_PRD);
  delete prd.requirements[0].title;
  const dir = withFixture(prd);
  const result = run(["validate"], { cwd: dir });
  assert.equal(result.exitCode, 1);
  const issues = JSON.parse(result.stdout);
  const issue = issues.find(
    (i) => i.id === "REQ-001" && /title/i.test(i.message),
  );
  assert.ok(issue);
});

it("detects missing required fields on context item", () => {
  const prd = structuredClone(MINIMAL_PRD);
  prd.context = [{ id: "CTX-001", description: "D", type: "constraint" }];
  // Missing title
  const dir = withFixture(prd);
  const result = run(["validate"], { cwd: dir });
  assert.equal(result.exitCode, 1);
});

it("reports multiple issues at once", () => {
  const prd = structuredClone(MINIMAL_PRD);
  prd.requirements[0].status = "done"; // missing commit
  prd.requirements[1].dependencies = ["REQ-999"]; // dangling ref
  const dir = withFixture(prd);
  const result = run(["validate"], { cwd: dir });
  assert.equal(result.exitCode, 1);
  const issues = JSON.parse(result.stdout);
  assert.ok(issues.length >= 2);
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: Check that each requirement has id, title, description, acceptance_criteria, abstraction_level. Check context items have id, title, description, type. Check architecture items have id, title, description, level.

**Verify:**
- Run: `cd cli && node --test test/**/*.test.js`
- Expected: All tests pass (including all prior command tests).
- Quality check: `cd cli && npm run check`

### Step 7: Test validate with explicit prd-path and --help

**Test first:**
- File: `cli/test/validate.test.js`
- Description: Test explicit prd-path and help output.
- Test code sketch:
```js
it("accepts explicit prd-path", () => {
  const dir = require("node:fs").mkdtempSync(
    require("node:path").join(require("node:os").tmpdir(), "clif-d-test-"),
  );
  const prdPath = require("node:path").join(dir, "custom.json");
  require("node:fs").writeFileSync(
    prdPath,
    JSON.stringify(MINIMAL_PRD, null, 2),
  );
  const result = run(["validate", prdPath]);
  assert.equal(result.exitCode, 0);
});

it("prints help on --help", () => {
  const result = run(["validate", "--help"]);
  assert.equal(result.exitCode, 0);
  assert.match(result.stderr, /validate/i);
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: Ensure validate accepts explicit prd-path (same pattern as other commands) and --help.

**Verify:**
- Run: `cd cli && node --test test/**/*.test.js`
- Expected: All tests pass.
- Quality check: `cd cli && npm run check`

## 5. Acceptance Criteria Verification

- [ ] **REQ-014 criterion:** "Given a prd.json where REQ-003 has a dependency on nonexistent REQ-999 and REQ-005 has status 'done' but no implementation_commit, when `clif-d validate`, then stdout contains a JSON array with at least two issue objects: one error for the dangling dependency reference and one error for the done-without-commit inconsistency. Exit code is 1."
  - **Verified by:** `validate.test.js` -- dangling dependency (Step 2), done-without-commit (Step 4), multiple issues (Step 6)

- [ ] **Valid PRD exits 0 with empty array.**
  - **Verified by:** `validate.test.js` -- valid PRD (Step 1)

- [ ] **File not found exits 2.**
  - **Verified by:** `validate.test.js` -- exit 2 (Step 1)

- [ ] **Cycle detection works.**
  - **Verified by:** `validate.test.js` -- cycle detection (Step 3)

- [ ] **Warnings don't cause exit 1.**
  - **Verified by:** `validate.test.js` -- warning case (Step 4)

## 6. Files Created or Modified

| File | Action | Step |
|------|--------|------|
| `cli/test/validate.test.js` | Create | 1 |
| `bin/clif-d` | Modify | 1, 2, 3, 4, 5, 6, 7 |

## 7. Open Questions and Assumptions

- **Assumption: validation is code-based, not schema-library-based.** The zero-dependency constraint means we cannot use a JSON Schema validation library like ajv. The validate command implements checks directly in JavaScript, using the schema as the specification (not as a runtime dependency). This means schema changes require corresponding code changes in the validator. Acceptable given the single-file constraint.
- **Assumption: all issues are collected before reporting.** The validate command does not short-circuit on the first error. It runs all checks and reports all issues at once. This is more useful for the agent, which can fix multiple issues in one pass.
- **Assumption: ID format is checked but not strictly enforced for all possible schema violations.** The validator checks the most important structural properties (required fields, valid enums, referential integrity, acyclicity, status/commit consistency). It does not replicate every JSON Schema constraint (e.g., string min/max length, additionalProperties). These edge cases are less likely to occur in practice and would require significant code to cover.
