# Implementation Plan: Status Mutation Commands (done, start, block)

**Requirements:** REQ-011, REQ-012, REQ-013
**PRD:** `cli-prd.json`
**Backpressure:** `cli/clif-d/backpressure.md`
**Preceding plans:** `cli/clif-d/plans/active/plan-REQ-008-REQ-009.md` (establishes core infrastructure: arg parsing, PRD loading, command routing, JSON output)
**Date:** 2026-04-14
**Status:** Executed
**Implementation commit:** 4475eee335f7232d1bf7097f45d40af76b7fbeb5

## 1. Objective

Implement the `req done`, `req start`, and `req block` commands in `bin/clif-d`, establishing the read-validate-write cycle (ARCH-003) that all mutation commands share. When complete, an agent can transition requirements through their lifecycle (not_started -> in_progress -> done, or -> blocked) with validated, atomic PRD updates.

## 2. Context Summary

### Requirement: REQ-011 -- Mark requirement done with commit SHA

**Description:** Used by the implement-plan skill at the end of every implementation cycle. Currently the skill hand-edits prd.json to set status and implementation_commit -- the most dangerous manual JSON edit in the pipeline. This command makes the operation atomic and validated. The --commit flag is required to enforce traceability (every done requirement has a commit SHA). Related to REQ-002.

**Acceptance criteria (Given-When-Then):**
- **Given:** A valid prd.json containing REQ-007 with status absent or in_progress
- **When:** The agent runs `clif-d req done REQ-007 --commit=abc1234def`
- **Then:** The PRD file is updated atomically: REQ-007 now has status 'done' and implementation_commit 'abc1234def'. stdout contains the updated requirement object. Exit code is 0.

**CLI specification:**
- Command: `req done`
- Arguments: REQ-ID (required) -- The requirement ID to mark done.
- Flags:
  - `--commit` / `-c` -- The git commit SHA that completed this requirement. Required. Must be a valid hex string (7-40 characters).
- stdout: The updated requirement object as JSON.
- stderr: Validation errors: requirement not found, already done, invalid SHA format, missing --commit flag.
- Exit codes: 0 = status set to done, PRD written; 1 = validation error; 2 = PRD file not found or not valid JSON.

### Requirement: REQ-012 -- Mark requirement in-progress

**Description:** Used by the plan-requirement skill when planning begins on a requirement. Signals to other agents or future skill invocations that work is underway. Related to REQ-002.

**Acceptance criteria (Given-When-Then):**
- **Given:** A valid prd.json containing REQ-007 with status absent or not_started
- **When:** The agent runs `clif-d req start REQ-007`
- **Then:** The PRD file is updated: REQ-007 now has status 'in_progress'. stdout contains the updated requirement object. Exit code is 0.

**CLI specification:**
- Command: `req start`
- Arguments: REQ-ID (required) -- The requirement ID to mark in-progress.
- stdout: The updated requirement object as JSON.
- stderr: Validation errors: requirement not found, already done (cannot re-start a completed requirement).
- Exit codes: 0 = status set to in_progress, PRD written; 1 = validation error; 2 = PRD file not found or not valid JSON.

### Requirement: REQ-013 -- Mark requirement blocked

**Description:** Provides a way to signal that a requirement cannot proceed due to an external factor. The blocker should be noted in the requirement's description (via a separate req edit call). Related to REQ-002.

**Acceptance criteria (Given-When-Then):**
- **Given:** A valid prd.json containing REQ-007 with status absent, not_started, or in_progress
- **When:** The agent runs `clif-d req block REQ-007`
- **Then:** The PRD file is updated: REQ-007 now has status 'blocked'. stdout contains the updated requirement object. Exit code is 0.

**CLI specification:**
- Command: `req block`
- Arguments: REQ-ID (required) -- The requirement ID to mark blocked.
- stdout: The updated requirement object as JSON.
- stderr: Validation errors: requirement not found, already done (cannot block a completed requirement).
- Exit codes: 0 = status set to blocked, PRD written; 1 = validation error; 2 = PRD file not found or not valid JSON.

### Relevant architecture decisions

**ARCH-003 -- Read-validate-write cycle:** Every mutation command follows the same cycle: (1) read the PRD file into memory, (2) parse JSON, (3) apply the mutation, (4) validate the result against the PRD schema and domain rules (referential integrity, acyclicity, status transitions), (5) write to a temp file, (6) atomic rename to the target path. If validation fails at step 4, the original file is untouched and the tool exits 1 with diagnostics on stderr.

**ARCH-002 -- Command routing architecture:** Two-level noun-verb: `clif-d <domain> <command> [args] [flags] [prd-path]`.

### Relevant context items

**CTX-007 -- Requirement lifecycle states:** Status values: not_started (default when absent), in_progress, done, blocked. Transitions: not_started -> in_progress -> done, or not_started -> blocked -> not_started. A done requirement cannot be un-done or blocked.

**CTX-005 -- CLI design conventions:** stdout for data, stderr for errors; exit 0 success, 1 logic error, 2 usage error.

**CTX-006 -- PRD as living document:** The CLI must handle concurrent-style access gracefully (atomic writes, no corruption on interruption).

**CTX-010 -- Quality backpressure guardrails:** All code must pass formatting, linting, type checking, and tests.

### Valid status transitions (from CTX-007)

| From | To | Allowed? |
|------|----|----------|
| absent/not_started | in_progress | Yes (req start) |
| absent/not_started | done | Yes (req done) |
| absent/not_started | blocked | Yes (req block) |
| in_progress | done | Yes (req done) |
| in_progress | blocked | Yes (req block) |
| blocked | not_started | Yes (req start sets in_progress, but blocked -> in_progress is valid) |
| blocked | in_progress | Yes (req start) |
| done | anything | No -- done is terminal |

Note: `req start` from blocked is allowed (unblock by starting work). `req done` from not_started is allowed (small requirements may skip in_progress). The only hard rule is: **done is terminal**.

### Quality guardrails

```bash
cd cli

# Format
npx prettier --write ../bin/clif-d

# Lint
npx eslint ../bin/clif-d

# Type check
npx tsc --noEmit

# Test
node --test test/**/*.test.js

# All checks
npm run check
```

### Atomic write pattern

Write to a temporary file in the same directory as the target (ensures same filesystem for rename), then rename. In Node.js:

```js
const tmpPath = prdPath + ".tmp." + process.pid;
fs.writeFileSync(tmpPath, json, "utf8");
fs.renameSync(tmpPath, prdPath);
```

This ensures the PRD is never in a half-written state. If the process is killed between writeFile and rename, only the tmp file is left (orphaned but harmless).

### Deterministic JSON output

Per cli-design-notes.md: preserve key ordering from the schema. When writing back the full PRD, preserve the original key ordering of the top-level object and of each requirement. When outputting a single requirement to stdout, use the schema field order.

## 3. Prerequisites

- **Plan REQ-008-REQ-009 must be implemented first.** This plan extends the core infrastructure (arg parsing, PRD loading, command routing) established there.
- Node.js 18+ available.
- Dev tooling installed: `cd cli && npm install`.
- The test helpers (`cli/test/helpers.js`) from Plan REQ-008-REQ-009 are available.

## 4. Implementation Steps

### Step 1: Implement atomic write utility and test req start (happy path)

**Test first:**
- File: `cli/test/req-start.test.js`
- Description: Test that `req start REQ-001` sets status to in_progress and writes the PRD atomically. Verify the file on disk reflects the change.
- Test code sketch:
```js
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { run, withFixture, MINIMAL_PRD } = require("./helpers.js");
const fs = require("node:fs");
const path = require("node:path");

describe("req start", () => {
  it("sets status to in_progress and outputs updated requirement", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "start", "REQ-001"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const req = JSON.parse(result.stdout);
    assert.equal(req.id, "REQ-001");
    assert.equal(req.status, "in_progress");

    // Verify file was actually updated
    const prd = JSON.parse(
      fs.readFileSync(path.join(dir, "clif-d", "prd.json"), "utf8"),
    );
    const updated = prd.requirements.find((r) => r.id === "REQ-001");
    assert.equal(updated.status, "in_progress");
  });

  it("does not leave temp files on success", () => {
    const dir = withFixture(MINIMAL_PRD);
    run(["req", "start", "REQ-001"], { cwd: dir });
    const files = fs.readdirSync(path.join(dir, "clif-d"));
    const tmpFiles = files.filter((f) => f.includes(".tmp."));
    assert.equal(tmpFiles.length, 0);
  });
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: Add two pieces of infrastructure:
  1. A `writePrd(prdPath, prd)` function implementing the atomic write pattern: serialize to JSON with 2-space indent, write to temp file, rename.
  2. A `reqStart(prdPath, prd, reqId)` handler that finds the requirement, validates the transition is allowed, sets status to "in_progress", calls writePrd, and outputs the updated requirement.
- Key decisions: JSON serialization preserves original key order by reconstructing the PRD object with explicit field ordering. The 2-space indent matches typical PRD formatting.

**Verify:**
- Run: `cd cli && node --test test/req-start.test.js`
- Expected: Tests pass.
- Quality check: `cd cli && npm run check`

### Step 2: Test req start error cases

**Test first:**
- File: `cli/test/req-start.test.js`
- Description: Test invalid transitions and missing ID.
- Test code sketch:
```js
it("exits 1 when requirement is already done", () => {
  const prd = structuredClone(MINIMAL_PRD);
  prd.requirements[1].status = "done";
  prd.requirements[1].implementation_commit = "abc1234";
  const dir = withFixture(prd);
  const result = run(["req", "start", "REQ-002"], { cwd: dir });
  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /done|terminal|cannot/i);
});

it("exits 1 when requirement ID not found", () => {
  const dir = withFixture(MINIMAL_PRD);
  const result = run(["req", "start", "REQ-999"], { cwd: dir });
  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /REQ-999/);
});

it("exits 2 when no REQ-ID argument given", () => {
  const dir = withFixture(MINIMAL_PRD);
  const result = run(["req", "start"], { cwd: dir });
  assert.equal(result.exitCode, 2);
});

it("is idempotent -- starting an in_progress requirement succeeds", () => {
  const prd = structuredClone(MINIMAL_PRD);
  prd.requirements[0].status = "in_progress";
  const dir = withFixture(prd);
  const result = run(["req", "start", "REQ-001"], { cwd: dir });
  assert.equal(result.exitCode, 0);
});

it("can start a blocked requirement (unblock)", () => {
  const prd = structuredClone(MINIMAL_PRD);
  prd.requirements[0].status = "blocked";
  const dir = withFixture(prd);
  const result = run(["req", "start", "REQ-001"], { cwd: dir });
  assert.equal(result.exitCode, 0);
  const req = JSON.parse(result.stdout);
  assert.equal(req.status, "in_progress");
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: Add transition validation to `reqStart`. The only invalid transition is from "done" -- all other states can transition to in_progress. Write a shared `validateTransition(currentStatus, targetStatus)` function since done/start/block all need it.

**Verify:**
- Run: `cd cli && node --test test/req-start.test.js`
- Expected: All tests pass.
- Quality check: `cd cli && npm run check`

### Step 3: Test and implement req done (happy path)

**Test first:**
- File: `cli/test/req-done.test.js`
- Description: Test that `req done REQ-001 --commit=abc1234def` sets status to done, sets implementation_commit, and writes atomically.
- Test code sketch:
```js
describe("req done", () => {
  it("sets status to done with commit SHA", () => {
    const prd = structuredClone(MINIMAL_PRD);
    prd.requirements[0].status = "in_progress";
    const dir = withFixture(prd);
    const result = run(
      ["req", "done", "REQ-001", "--commit=abc1234def"],
      { cwd: dir },
    );
    assert.equal(result.exitCode, 0);
    const req = JSON.parse(result.stdout);
    assert.equal(req.status, "done");
    assert.equal(req.implementation_commit, "abc1234def");

    // Verify file on disk
    const updated = JSON.parse(
      fs.readFileSync(path.join(dir, "clif-d", "prd.json"), "utf8"),
    );
    const r = updated.requirements.find((r) => r.id === "REQ-001");
    assert.equal(r.status, "done");
    assert.equal(r.implementation_commit, "abc1234def");
  });

  it("accepts -c shorthand for --commit", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(
      ["req", "done", "REQ-001", "-c", "abc1234def"],
      { cwd: dir },
    );
    assert.equal(result.exitCode, 0);
    const req = JSON.parse(result.stdout);
    assert.equal(req.implementation_commit, "abc1234def");
  });

  it("can mark a not_started requirement done (skip in_progress)", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(
      ["req", "done", "REQ-001", "--commit=abc1234"],
      { cwd: dir },
    );
    assert.equal(result.exitCode, 0);
  });
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: Add `reqDone(prdPath, prd, reqId, commitSha)` handler. Parse `--commit` / `-c` flag. Validate: requirement exists, not already done, commit SHA is 7-40 hex characters. Set status to "done" and implementation_commit to the SHA. Write atomically.

**Verify:**
- Run: `cd cli && node --test test/req-done.test.js`
- Expected: Tests pass.
- Quality check: `cd cli && npm run check`

### Step 4: Test req done error cases

**Test first:**
- File: `cli/test/req-done.test.js`
- Description: Test missing --commit, invalid SHA, already done, nonexistent ID.
- Test code sketch:
```js
it("exits 1 when --commit is missing", () => {
  const dir = withFixture(MINIMAL_PRD);
  const result = run(["req", "done", "REQ-001"], { cwd: dir });
  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /--commit|commit/i);
});

it("exits 1 when SHA is invalid (too short)", () => {
  const dir = withFixture(MINIMAL_PRD);
  const result = run(
    ["req", "done", "REQ-001", "--commit=abc"],
    { cwd: dir },
  );
  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /sha|hex|commit/i);
});

it("exits 1 when SHA contains non-hex characters", () => {
  const dir = withFixture(MINIMAL_PRD);
  const result = run(
    ["req", "done", "REQ-001", "--commit=xyz1234"],
    { cwd: dir },
  );
  assert.equal(result.exitCode, 1);
});

it("exits 1 when requirement is already done", () => {
  const prd = structuredClone(MINIMAL_PRD);
  prd.requirements[0].status = "done";
  prd.requirements[0].implementation_commit = "abc1234";
  const dir = withFixture(prd);
  const result = run(
    ["req", "done", "REQ-001", "--commit=def5678"],
    { cwd: dir },
  );
  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /done|already/i);
});

it("exits 1 when requirement not found", () => {
  const dir = withFixture(MINIMAL_PRD);
  const result = run(
    ["req", "done", "REQ-999", "--commit=abc1234"],
    { cwd: dir },
  );
  assert.equal(result.exitCode, 1);
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: Add validation for --commit flag: required, must match `/^[0-9a-f]{7,40}$/i`. Add "already done" check. Error messages should be specific and actionable.

**Verify:**
- Run: `cd cli && node --test test/req-done.test.js`
- Expected: All tests pass.
- Quality check: `cd cli && npm run check`

### Step 5: Test and implement req block (happy path + error cases)

**Test first:**
- File: `cli/test/req-block.test.js`
- Description: Test happy path and error cases for req block.
- Test code sketch:
```js
describe("req block", () => {
  it("sets status to blocked", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "block", "REQ-001"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const req = JSON.parse(result.stdout);
    assert.equal(req.status, "blocked");

    // Verify file on disk
    const prd = JSON.parse(
      fs.readFileSync(path.join(dir, "clif-d", "prd.json"), "utf8"),
    );
    const r = prd.requirements.find((r) => r.id === "REQ-001");
    assert.equal(r.status, "blocked");
  });

  it("can block an in_progress requirement", () => {
    const prd = structuredClone(MINIMAL_PRD);
    prd.requirements[0].status = "in_progress";
    const dir = withFixture(prd);
    const result = run(["req", "block", "REQ-001"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const req = JSON.parse(result.stdout);
    assert.equal(req.status, "blocked");
  });

  it("exits 1 when requirement is already done", () => {
    const prd = structuredClone(MINIMAL_PRD);
    prd.requirements[0].status = "done";
    prd.requirements[0].implementation_commit = "abc1234";
    const dir = withFixture(prd);
    const result = run(["req", "block", "REQ-001"], { cwd: dir });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /done|cannot/i);
  });

  it("exits 1 when requirement not found", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "block", "REQ-999"], { cwd: dir });
    assert.equal(result.exitCode, 1);
  });

  it("exits 2 when no REQ-ID given", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "block"], { cwd: dir });
    assert.equal(result.exitCode, 2);
  });

  it("is idempotent -- blocking a blocked requirement succeeds", () => {
    const prd = structuredClone(MINIMAL_PRD);
    prd.requirements[0].status = "blocked";
    const dir = withFixture(prd);
    const result = run(["req", "block", "REQ-001"], { cwd: dir });
    assert.equal(result.exitCode, 0);
  });
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: Add `reqBlock(prdPath, prd, reqId)` handler. Same pattern as reqStart: find requirement, validate not done, set status to "blocked", write atomically, output updated requirement.

**Verify:**
- Run: `cd cli && node --test test/**/*.test.js`
- Expected: All tests pass (including req-ls and req-show from Plan 1).
- Quality check: `cd cli && npm run check`

### Step 6: Test that mutations preserve PRD structure

**Test first:**
- File: `cli/test/req-start.test.js` (add to existing)
- Description: Verify that mutation commands preserve all other PRD fields (context, architecture, other requirements).
- Test code sketch:
```js
it("preserves all other PRD fields after mutation", () => {
  const prd = structuredClone(MINIMAL_PRD);
  prd.context.push({
    id: "CTX-001",
    title: "Test context",
    description: "Test",
    type: "constraint",
  });
  const dir = withFixture(prd);
  run(["req", "start", "REQ-001"], { cwd: dir });
  const updated = JSON.parse(
    fs.readFileSync(path.join(dir, "clif-d", "prd.json"), "utf8"),
  );
  // Context preserved
  assert.equal(updated.context.length, 1);
  assert.equal(updated.context[0].id, "CTX-001");
  // Other requirement unchanged
  const req2 = updated.requirements.find((r) => r.id === "REQ-002");
  assert.equal(req2.title, "Second requirement");
  // Top-level fields preserved
  assert.equal(updated.product_name, "test");
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: Ensure `writePrd` serializes the full PRD object, not just the requirements array. The mutation functions modify the requirement in-place within the PRD object, then write the whole object back.

**Verify:**
- Run: `cd cli && node --test test/**/*.test.js`
- Expected: All tests pass.
- Quality check: `cd cli && npm run check`

### Step 7: Test mutations with explicit prd-path

**Test first:**
- File: `cli/test/req-done.test.js` (add to existing)
- Description: Verify that mutation commands work with an explicit prd-path argument.
- Test code sketch:
```js
it("accepts explicit prd-path", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
  const prdPath = path.join(dir, "custom.json");
  fs.writeFileSync(prdPath, JSON.stringify(MINIMAL_PRD, null, 2));
  const result = run(
    ["req", "done", "REQ-001", "--commit=abc1234", prdPath],
  );
  assert.equal(result.exitCode, 0);
  // Verify written to the explicit path
  const updated = JSON.parse(fs.readFileSync(prdPath, "utf8"));
  const r = updated.requirements.find((r) => r.id === "REQ-001");
  assert.equal(r.status, "done");
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: Ensure the prd-path resolution logic (from Plan REQ-008-REQ-009) works with mutation commands. The resolved path is used for both reading and writing.

**Verify:**
- Run: `cd cli && node --test test/**/*.test.js`
- Expected: All tests pass.
- Quality check: `cd cli && npm run check`

## 5. Acceptance Criteria Verification

- [ ] **REQ-011 criterion:** "Given REQ-007 with status absent or in_progress, when `clif-d req done REQ-007 --commit=abc1234def`, then PRD updated atomically with status 'done' and implementation_commit 'abc1234def'. stdout has updated object. Exit 0."
  - **Verified by:** `req-done.test.js` -- happy path (Step 3), SHA validation (Step 4), file verification (Step 3)

- [ ] **REQ-011 error cases:** Missing --commit, invalid SHA, already done, nonexistent ID.
  - **Verified by:** `req-done.test.js` -- error cases (Step 4)

- [ ] **REQ-012 criterion:** "Given REQ-007 with status absent or not_started, when `clif-d req start REQ-007`, then PRD updated with status 'in_progress'. stdout has updated object. Exit 0."
  - **Verified by:** `req-start.test.js` -- happy path (Step 1), idempotent (Step 2), unblock (Step 2)

- [ ] **REQ-012 error cases:** Already done, nonexistent ID.
  - **Verified by:** `req-start.test.js` -- error cases (Step 2)

- [ ] **REQ-013 criterion:** "Given REQ-007 with status absent, not_started, or in_progress, when `clif-d req block REQ-007`, then PRD updated with status 'blocked'. stdout has updated object. Exit 0."
  - **Verified by:** `req-block.test.js` -- happy path, from in_progress, idempotent (Step 5)

- [ ] **REQ-013 error cases:** Already done, nonexistent ID.
  - **Verified by:** `req-block.test.js` -- error cases (Step 5)

## 6. Files Created or Modified

| File | Action | Step |
|------|--------|------|
| `cli/test/req-start.test.js` | Create | 1, 2, 6 |
| `cli/test/req-done.test.js` | Create | 3, 4, 7 |
| `cli/test/req-block.test.js` | Create | 5 |
| `bin/clif-d` | Modify | 1, 2, 3, 4, 5, 6, 7 |

## 7. Open Questions and Assumptions

- **Assumption: idempotent status transitions.** Setting a requirement to its current status succeeds silently (exit 0) rather than erroring. Example: `req start` on an already in_progress requirement is a no-op success. This is friendlier for scripting and avoids forcing callers to check current status before transitioning.
- **Assumption: JSON formatting on write.** The PRD is written with 2-space indentation and a trailing newline, matching the output of `JSON.stringify(obj, null, 2) + "\n"`. This is consistent with how most tools format JSON and produces clean git diffs.
- **Assumption: done is the only terminal state.** Per CTX-007, done cannot transition to anything else. All other transitions are allowed. This is simpler than a full state machine and matches the documented lifecycle.
