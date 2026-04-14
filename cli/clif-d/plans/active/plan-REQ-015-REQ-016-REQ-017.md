# Implementation Plan: Requirement Add, Edit, and Dependency Mutations

**Requirements:** REQ-015, REQ-016, REQ-017
**PRD:** `cli-prd.json`
**Backpressure:** `cli/clif-d/backpressure.md`
**Preceding plans:**
- `cli/clif-d/plans/executed/plan-REQ-008-REQ-009.md` (core infrastructure: arg parsing, PRD loading, command routing, schema-ordered JSON output)
- `cli/clif-d/plans/active/plan-REQ-011-REQ-012-REQ-013.md` (atomic `writePrd`, status-transition validation, mutation-command pattern)
- `cli/clif-d/plans/active/plan-REQ-014.md` (reusable validation helpers: ID uniqueness, referential integrity, cycle detection, enum checks)

**Date:** 2026-04-14
**Status:** Draft

## 1. Objective

Implement the `req add`, `req edit`, and `req dep add` / `req dep rm` commands in `bin/clif-d`. When complete, skills that construct or refine requirements can mutate the PRD programmatically instead of hand-editing JSON: appending new requirements with auto-assigned IDs, updating individual fields, and adding or removing single dependency edges with acyclicity enforced on every add.

## 2. Context Summary

### Requirement: REQ-015 -- Add a requirement via stdin

**Description:** Enables the create-architecture skill (and future extend-low-level-requirements skill) to append requirements programmatically instead of hand-editing the JSON array. Auto-assigns the next REQ-NNN ID when id is omitted, which eliminates the manual ID calculation that skills currently perform. Related to REQ-004.

**Acceptance criteria (Given-When-Then):**
- **Given:** A valid prd.json with requirements up to REQ-012
- **When:** The agent pipes a JSON object with `title`, `description`, `acceptance_criteria`, and `abstraction_level` (no `id` field) to `clif-d req add`
- **Then:** The PRD is updated with a new requirement assigned REQ-013. stdout contains the complete requirement object with the assigned ID. All referenced dependency, context_ref, and architecture_ref IDs are validated to exist. Exit code is 0.

**CLI specification:**
- Command: `req add`
- stdin: JSON requirement object. All required fields per schema must be present except `id` (auto-assigned if omitted).
- stdout: The added requirement object with assigned ID.
- stderr: Validation errors -- schema violations, dangling references.
- Exit codes: 0 = requirement added, PRD written; 1 = validation error; 2 = PRD file not found or not valid JSON.

### Requirement: REQ-016 -- Edit requirement fields via stdin

**Description:** Enables skills to update individual fields on a requirement without rewriting the entire object. Used by create-architecture to backfill architecture_refs and by design-backpressure to backfill context_refs. Uses **replace semantics** for all fields (including arrays) -- the caller provides the complete new value for any field being changed. Related to REQ-004.

**Acceptance criteria (Given-When-Then):**
- **Given:** A valid prd.json where REQ-003 has `architecture_refs` `["ARCH-001"]`
- **When:** The agent pipes `{"architecture_refs": ["ARCH-001", "ARCH-002"]}` to `clif-d req edit REQ-003`
- **Then:** REQ-003's `architecture_refs` is now `["ARCH-001", "ARCH-002"]`. All other fields are unchanged. stdout contains the full updated requirement. Exit code is 0.

**CLI specification:**
- Command: `req edit`
- Arguments: `REQ-ID` (required) -- The requirement ID to edit.
- stdin: Partial JSON object. Only fields present are updated (replace semantics). Cannot change `id`.
- stdout: The full updated requirement object.
- stderr: Validation errors -- requirement not found, schema violation, dangling references, attempt to change `id`.
- Exit codes: 0 = requirement updated, PRD written; 1 = validation error; 2 = PRD file not found or not valid JSON.

### Requirement: REQ-017 -- Add and remove dependency edges

**Description:** Provides dedicated commands for the most common dependency mutation: adding or removing a single edge. More ergonomic than piping a full dependencies array through `req edit`. Enforces acyclicity on every add. Related to REQ-003.

**Acceptance criteria (Given-When-Then):**
- **Given:** A valid prd.json where REQ-005 has no dependencies and REQ-003 exists and is not a descendant of REQ-005
- **When:** The agent runs `clif-d req dep add REQ-005 REQ-003`
- **Then:** REQ-005's `dependencies` array now includes REQ-003. The full dependency graph remains acyclic. stdout contains the updated REQ-005 object. Exit code is 0.

**CLI specification:**
- Command: `req dep add` -- args: `REQ-ID` (required, gains the dep), `DEP-ID` (required, the dep).
- Command: `req dep rm` -- symmetric: args: `REQ-ID` (required), `DEP-ID` (required, removed from REQ-ID's dependencies).
- stdout: The updated REQ-ID requirement object.
- stderr: Errors -- ID not found, duplicate edge, cycle detected (add); edge not present (rm).
- Exit codes: 0 = PRD written; 1 = validation error (missing ID, cycle, duplicate, edge-not-present); 2 = PRD file not found or not valid JSON.

### Relevant architecture decisions

**ARCH-002 -- Command routing architecture:** Two-level noun-verb: `clif-d <domain> <command> [args] [flags] [prd-path]`. `req dep add` / `req dep rm` are three-level (domain `req`, subdomain `dep`, verb `add`/`rm`). Router dispatches `args[0]` = "req", `args[1]` = "dep", `args[2]` = "add" | "rm".

**ARCH-003 -- Read-validate-write cycle:** Every mutation: (1) read, (2) parse, (3) apply, (4) validate (schema, referential integrity, acyclicity), (5) atomic write via temp file + rename. On validation failure, the original file is untouched; exit 1 with diagnostics on stderr. `writePrd(prdPath, prd)` is provided by the REQ-011-013 plan.

### Relevant context items

**CTX-003 -- PRD schema as contract:** Required requirement fields per schema: `id`, `description`, `title`, `acceptance_criteria`, `abstraction_level`. `acceptance_criteria` is either a string (high-level) or `{given, when, then}` (low-level).

**CTX-005 -- CLI design conventions:** stdout for data, stderr for errors; exit 0 success, 1 logic/validation error, 2 usage error; stdin accepts JSON where documented.

**CTX-006 -- PRD as living document:** Atomic writes (no corruption on interruption). `writePrd` from the REQ-011-013 plan handles this.

**CTX-008 -- Dependency graph semantics:** Dependencies must form a DAG. Every add must preserve acyclicity. Self-loops are cycles.

**CTX-010 -- Quality backpressure guardrails:** All code must pass formatting, linting, type checking, and tests.

**CTX-011 -- Development environment bootstrap:** `cd cli && npm run check`.

### Auto-assigned ID scheme (shared with REQ-021)

When `id` is omitted from `req add` stdin, the CLI assigns `REQ-NNN` using max+1 over existing REQ IDs (zero-padded to 3 digits):

```js
const existingNumbers = prd.requirements
  .map((r) => Number((r.id.match(/^REQ-(\d+)$/) || [])[1]))
  .filter((n) => Number.isFinite(n));
const next = (Math.max(0, ...existingNumbers) + 1).toString().padStart(3, "0");
const newId = `REQ-${next}`;
```

This matches the scheme proposed for REQ-021 (`id next`). If REQ-021 has already been implemented when this plan runs, extract and share the helper `nextId("REQ", prd)`.

### Validation required by each command

**`req add`:**
1. stdin is valid JSON and an object.
2. If `id` is provided: it matches `/^REQ-\d{3}$/` and is not already in use. If omitted: auto-assign.
3. Required fields present: `title`, `description`, `acceptance_criteria`, `abstraction_level`.
4. Enum values valid: `abstraction_level` is `"high"` or `"low"`; `status` (if present) is one of `not_started|in_progress|done|blocked`.
5. `acceptance_criteria` type matches schema: string for high-level, `{given, when, then}` object for low-level (enforced as a shape check, not strictly by abstraction_level -- the schema accepts either form on either level, but all three GWT fields must be strings when the object form is used).
6. Every `dependencies[]` ID exists in the PRD as a requirement ID, every `context_refs[]` exists as a context item ID, every `architecture_refs[]` exists as an architecture item ID.
7. The resulting dependency graph is acyclic (use the cycle-detection helper from REQ-014).
8. `implementation_commit` + `status` are consistent (done requires commit; commit-without-done is a warning only on `validate`, but `req add` rejects the inconsistency on the strict path -- safer to fail fast when the caller is explicitly constructing the object).

**`req edit REQ-ID`:**
1. `REQ-ID` exists in `requirements[]`.
2. stdin is valid JSON and an object.
3. stdin does not contain an `id` field (cannot rename).
4. Merge stdin into the existing requirement (replace-semantics per field). Validate the merged object against the same schema rules as `req add` points 3-8 (enum, refs, acyclicity, done/commit consistency).
5. Any ref array provided in stdin fully replaces the existing array (replace, not append).

**`req dep add REQ-ID DEP-ID`:**
1. Both IDs exist in `requirements[]`.
2. `REQ-ID !== DEP-ID` (self-loop).
3. `DEP-ID` is not already in `REQ-ID.dependencies` (no duplicate edge).
4. Adding the edge does not create a cycle: traverse dependencies of `DEP-ID`; if `REQ-ID` is reachable, reject.

**`req dep rm REQ-ID DEP-ID`:**
1. `REQ-ID` exists.
2. `DEP-ID` is in `REQ-ID.dependencies` (else exit 1, "edge not present").
3. Remove the entry; no further validation needed (removing edges cannot introduce issues).

### Relevant preceding implementation (what already exists)

From the executed REQ-008/009 plan and the active REQ-011-013 plan (which must land first):
- `parseFlags`, `resolvePrdPath`, `loadPrd`, `SCHEMA_FIELD_ORDER`, `selectFields` (core infra).
- `writePrd(prdPath, prd)` -- atomic write via temp file + rename; 2-space JSON + trailing newline.
- Full-object output pattern used by `reqShow` -- construct a new object following `SCHEMA_FIELD_ORDER`, defaulting `status` to `"not_started"` and `dependencies` to `[]`.
- Router dispatches `req <command>`; extend it for `add`, `edit`, `dep`.

From the active REQ-014 plan (recommended to land first, but not strictly required -- duplicate the helpers if needed):
- Cycle detection via DFS coloring (white/gray/black). Extract to a `hasCycle(prd)` or `wouldCreateCycle(prd, from, to)` helper.
- Referential-integrity helpers: `isValidReqId(prd, id)`, `isValidCtxId`, `isValidArchId`.
- Enum-value helpers: `VALID_STATUSES`, `VALID_ABSTRACTION_LEVELS`.

If REQ-014 has not merged when this plan runs, implement the minimal cycle and referential helpers directly in this plan's Step 1 and note the duplication for a later refactor.

### stdin handling

Node built-in pattern (zero dependencies):

```js
function readStdin() {
  try {
    return fs.readFileSync(0, "utf8"); // fd 0 = stdin
  } catch (err) {
    stderr.write(`Error: failed to read stdin: ${err.message}\n`);
    return exit(2);
  }
}
function parseStdinJson() {
  const raw = readStdin();
  try {
    return JSON.parse(raw);
  } catch {
    stderr.write("Error: stdin is not valid JSON.\n");
    return exit(1);
  }
}
```

Use `fs.readFileSync(0, "utf8")` -- synchronous, no streaming needed (payloads are small). Empty stdin (spawn test with no input) reads as `""`, which `JSON.parse` rejects -- caught and reported as a validation error (exit 1).

### Deterministic JSON output on write

The full PRD is re-serialized on every mutation. Preserve insertion order of top-level keys and of each requirement's keys. When adding a new requirement via `req add`, construct the object following `SCHEMA_FIELD_ORDER` for the requirement keys. Append it to `prd.requirements`.

When editing via `req edit`, mutate the existing requirement object in place: for each key in the stdin payload, assign onto the existing object. Do **not** reorder existing keys (preserves git-diff cleanliness). If the edit introduces a new key not already on the requirement, insert it at the schema-canonical position -- or simpler: rebuild the requirement in `SCHEMA_FIELD_ORDER` after the merge, pulling values from the merged object. The existing `reqShow` pattern already does this for output; reuse that logic for the writeback.

### Quality guardrails

```bash
cd cli
npx prettier --write ../bin/clif-d
npx eslint ../bin/clif-d
npx tsc --noEmit
node --test test/**/*.test.js
npm run check
```

### Lessons learned from prior plans

- **Tests are ESM.** `import ... from "./helpers.js"`. `helpers.js` exports `run`, `withFixture`, `MINIMAL_PRD`.
- **Use `spawnSync` with an `input` option to feed stdin.** The existing `run` helper uses `spawnSync` but does not forward `input`. Extend it -- see Step 1.
- **TypeScript `noUncheckedIndexedAccess`.** Cast `args[i]` at each access.
- **`process.exit()` is not `never` in TS control flow.** Use `return exit(n)` in functions that must return a value.

## 3. Prerequisites

- **Plan REQ-008/REQ-009 implemented.** (Done, commit `eae6775`.)
- **Plan REQ-011/REQ-012/REQ-013 implemented.** This plan depends on `writePrd(prdPath, prd)` and the atomic-write pattern. Status: not yet implemented. Block on that plan landing first.
- **Plan REQ-014 recommended.** Referential-integrity and cycle helpers are ideally shared. If REQ-014 has not landed, implement minimal local versions in this plan (Step 1). Status: not yet implemented.
- Node.js 18+ available. Dev tooling installed (`cd cli && npm install`).

## 4. Implementation Steps

### Step 1: Extend the `run` test helper to forward stdin, and add a shared validation helpers module

**Test first:**
- File: `cli/test/helpers.test.js`
- Description: Add a smoke test that confirms `run(args, { input })` pipes stdin to the child process. Use an existing command (e.g., `req ls`) that ignores stdin -- the assertion is only that passing `input` does not break anything. This also exercises the helper change in isolation before the feature tests rely on it.
- Test code sketch:
```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { run, withFixture, MINIMAL_PRD } from "./helpers.js";

describe("run helper stdin support", () => {
  it("forwards input option to child stdin without error", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "ls"], { cwd: dir, input: '{"ignored": true}' });
    assert.equal(result.exitCode, 0);
  });
});
```

**Implement:**
- File(s): `cli/test/helpers.js`
- Description: Extend the `run` helper: accept an `input` option and pass it to `spawnSync` as the `input` field. Default remains no stdin.
- Sketch:
```js
export function run(args, options) {
  const result = spawnSync(BIN, args, {
    cwd: options?.cwd ?? process.cwd(),
    encoding: "utf8",
    timeout: 5000,
    input: options?.input,
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status ?? 1,
  };
}
```

**Verify:**
- Run: `cd cli && node --test test/helpers.test.js`
- Expected: Test passes; no other tests regress.
- Quality check: `cd cli && npm run check`

### Step 2: Test and implement `req add` happy path (auto-assigned ID, minimal required fields)

**Test first:**
- File: `cli/test/req-add.test.js`
- Description: Piping a minimal valid requirement without `id` appends it with the next REQ-NNN ID, writes the PRD atomically, and outputs the new requirement as JSON.
- Test code sketch:
```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { run, withFixture, MINIMAL_PRD } from "./helpers.js";

describe("req add", () => {
  it("auto-assigns the next REQ-NNN id and appends the requirement", () => {
    const dir = withFixture(MINIMAL_PRD);
    const body = {
      title: "New requirement",
      description: "Something new",
      acceptance_criteria: "Done when done",
      abstraction_level: "high",
    };
    const result = run(["req", "add"], {
      cwd: dir,
      input: JSON.stringify(body),
    });
    assert.equal(result.exitCode, 0);
    const added = JSON.parse(result.stdout);
    // MINIMAL_PRD has REQ-001 and REQ-002 -> next is REQ-003.
    assert.equal(added.id, "REQ-003");
    assert.equal(added.title, "New requirement");

    // File on disk contains the appended requirement.
    const prd = JSON.parse(
      fs.readFileSync(path.join(dir, "clif-d", "prd.json"), "utf8"),
    );
    assert.equal(prd.requirements.length, 3);
    assert.equal(prd.requirements[2].id, "REQ-003");
  });

  it("accepts an explicit id if it does not collide", () => {
    const dir = withFixture(MINIMAL_PRD);
    const body = {
      id: "REQ-042",
      title: "Forty-two",
      description: "D",
      acceptance_criteria: "Done",
      abstraction_level: "low",
    };
    const result = run(["req", "add"], {
      cwd: dir,
      input: JSON.stringify(body),
    });
    assert.equal(result.exitCode, 0);
    const added = JSON.parse(result.stdout);
    assert.equal(added.id, "REQ-042");
  });
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description:
  1. Add a `readStdinJson()` helper (see Context Summary).
  2. Add a `nextReqId(prd)` helper (max+1 over REQ IDs).
  3. Add a `reqAdd(prdPath, prd)` handler: read stdin, validate, assign ID if missing, validate no collision, append to `prd.requirements`, write atomically, output the new requirement in schema order.
  4. Route `req add`.
- Key decisions:
  - Construct the appended object via `SCHEMA_FIELD_ORDER` so the on-disk ordering is canonical and predictable.
  - Defer referential and acyclicity validation to Step 4 -- this step asserts the happy path with no optional fields.

**Verify:**
- Run: `cd cli && node --test test/req-add.test.js`
- Expected: Tests pass.
- Quality check: `cd cli && npm run check`

### Step 3: Test and implement `req add` schema/required-field validation

**Test first:**
- File: `cli/test/req-add.test.js`
- Description: Missing required fields, invalid enum values, invalid `acceptance_criteria` shape, invalid explicit ID, duplicate ID all exit 1 with a helpful stderr; PRD on disk is unchanged.
- Test code sketch:
```js
it("exits 1 when a required field is missing", () => {
  const dir = withFixture(MINIMAL_PRD);
  const body = { description: "D", acceptance_criteria: "Done", abstraction_level: "high" };
  // No title.
  const result = run(["req", "add"], { cwd: dir, input: JSON.stringify(body) });
  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /title/i);

  // PRD unchanged.
  const prd = JSON.parse(fs.readFileSync(path.join(dir, "clif-d", "prd.json"), "utf8"));
  assert.equal(prd.requirements.length, 2);
});

it("exits 1 when abstraction_level is invalid", () => {
  const dir = withFixture(MINIMAL_PRD);
  const body = {
    title: "T", description: "D", acceptance_criteria: "Done", abstraction_level: "medium",
  };
  const result = run(["req", "add"], { cwd: dir, input: JSON.stringify(body) });
  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /abstraction/i);
});

it("exits 1 when id is malformed", () => {
  const dir = withFixture(MINIMAL_PRD);
  const body = {
    id: "BAD-001", title: "T", description: "D",
    acceptance_criteria: "Done", abstraction_level: "high",
  };
  const result = run(["req", "add"], { cwd: dir, input: JSON.stringify(body) });
  assert.equal(result.exitCode, 1);
});

it("exits 1 when id already exists", () => {
  const dir = withFixture(MINIMAL_PRD);
  const body = {
    id: "REQ-001", title: "Duplicate", description: "D",
    acceptance_criteria: "Done", abstraction_level: "high",
  };
  const result = run(["req", "add"], { cwd: dir, input: JSON.stringify(body) });
  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /already|exist/i);
});

it("exits 1 on malformed acceptance_criteria object", () => {
  const dir = withFixture(MINIMAL_PRD);
  const body = {
    title: "T", description: "D",
    acceptance_criteria: { given: "G", when: "W" }, // missing "then"
    abstraction_level: "low",
  };
  const result = run(["req", "add"], { cwd: dir, input: JSON.stringify(body) });
  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /acceptance_criteria|then/i);
});

it("exits 1 on non-JSON stdin", () => {
  const dir = withFixture(MINIMAL_PRD);
  const result = run(["req", "add"], { cwd: dir, input: "not json{" });
  assert.equal(result.exitCode, 1);
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: Add a `validateRequirementShape(req, { requireAllFields })` helper:
  - If `requireAllFields`, check presence of id/title/description/acceptance_criteria/abstraction_level.
  - `id` (when present) matches `/^REQ-\d{3}$/`.
  - `abstraction_level` is `"high"` or `"low"`.
  - `status`, if present, is in `VALID_STATUSES`.
  - `acceptance_criteria` is either a string or an object with string `given`, `when`, `then`.
  - Return an array of error messages. `reqAdd` rejects on any error.
- Use the helper in both `req add` and `req edit`.

**Verify:**
- Run: `cd cli && node --test test/req-add.test.js`
- Expected: All tests pass.
- Quality check: `cd cli && npm run check`

### Step 4: Test and implement `req add` referential integrity and cycle checks

**Test first:**
- File: `cli/test/req-add.test.js`
- Description: Dangling `dependencies`, dangling `context_refs`, dangling `architecture_refs`, and a dependency that would create a cycle all exit 1.
- Test code sketch:
```js
it("exits 1 on dangling dependency", () => {
  const dir = withFixture(MINIMAL_PRD);
  const body = {
    title: "T", description: "D", acceptance_criteria: "Done",
    abstraction_level: "high", dependencies: ["REQ-999"],
  };
  const result = run(["req", "add"], { cwd: dir, input: JSON.stringify(body) });
  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /REQ-999/);
});

it("exits 1 on dangling context_ref", () => {
  const dir = withFixture(MINIMAL_PRD);
  const body = {
    title: "T", description: "D", acceptance_criteria: "Done",
    abstraction_level: "high", context_refs: ["CTX-999"],
  };
  const result = run(["req", "add"], { cwd: dir, input: JSON.stringify(body) });
  assert.equal(result.exitCode, 1);
});

// Cycle via add: REQ-001 (no deps), REQ-002 depends on REQ-001.
// Adding a new REQ-003 that REQ-001 depends on is fine (no cycle),
// but if we add a new requirement with id=REQ-003 and then *edit* REQ-001 to
// depend on REQ-003 that depends on REQ-001, cycle. Covered in edit tests.
// For add, the cycle case is only achievable via a self-referential new id.
it("exits 1 when adding a new requirement that depends on itself (explicit id)", () => {
  const dir = withFixture(MINIMAL_PRD);
  const body = {
    id: "REQ-003", title: "T", description: "D", acceptance_criteria: "Done",
    abstraction_level: "high", dependencies: ["REQ-003"],
  };
  const result = run(["req", "add"], { cwd: dir, input: JSON.stringify(body) });
  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /cycle|self/i);
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description:
  1. Build valid-ID sets: `reqIds = new Set(prd.requirements.map((r) => r.id))`, similarly `ctxIds`, `archIds`. After assignment, add the new requirement's ID to `reqIds` so self-referential deps are still caught by the cycle check.
  2. Validate every `dependencies[]`, `context_refs[]`, `architecture_refs[]` entry is in its ID set.
  3. Run `hasCycle(prd)` on the speculative post-add PRD. If true, reject with a message identifying one node in the cycle.
- If REQ-014 has landed, import the cycle-detection helper. Otherwise, implement DFS coloring here (white/gray/black) -- see the REQ-014 plan for the sketch.

**Verify:**
- Run: `cd cli && node --test test/req-add.test.js`
- Expected: All tests pass.
- Quality check: `cd cli && npm run check`

### Step 5: Test and implement `req edit` happy path (partial update, replace semantics)

**Test first:**
- File: `cli/test/req-edit.test.js`
- Description: Editing `architecture_refs` replaces the array; other fields unchanged; stdout has the full updated object; on-disk PRD reflects the change.
- Test code sketch:
```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { run, withFixture, MINIMAL_PRD } from "./helpers.js";

function prdWithArchRefs() {
  const prd = structuredClone(MINIMAL_PRD);
  prd.architecture = [
    { id: "ARCH-001", title: "A", description: "D", level: "context" },
    { id: "ARCH-002", title: "B", description: "D", level: "container" },
  ];
  prd.requirements[0].architecture_refs = ["ARCH-001"];
  return prd;
}

describe("req edit", () => {
  it("replaces architecture_refs and preserves other fields", () => {
    const dir = withFixture(prdWithArchRefs());
    const result = run(
      ["req", "edit", "REQ-001"],
      { cwd: dir, input: JSON.stringify({ architecture_refs: ["ARCH-001", "ARCH-002"] }) },
    );
    assert.equal(result.exitCode, 0);
    const req = JSON.parse(result.stdout);
    assert.deepEqual(req.architecture_refs, ["ARCH-001", "ARCH-002"]);
    assert.equal(req.title, "First requirement"); // unchanged

    const prd = JSON.parse(fs.readFileSync(path.join(dir, "clif-d", "prd.json"), "utf8"));
    const r = prd.requirements.find((x) => x.id === "REQ-001");
    assert.deepEqual(r.architecture_refs, ["ARCH-001", "ARCH-002"]);
  });

  it("can update a scalar field (title)", () => {
    const dir = withFixture(prdWithArchRefs());
    const result = run(
      ["req", "edit", "REQ-001"],
      { cwd: dir, input: JSON.stringify({ title: "Renamed" }) },
    );
    assert.equal(result.exitCode, 0);
    const req = JSON.parse(result.stdout);
    assert.equal(req.title, "Renamed");
  });
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: Add `reqEdit(prdPath, prd, reqId)`:
  1. Find the requirement; exit 1 if not found.
  2. Read stdin JSON.
  3. Reject if `id` key is present (`exit 1`, "cannot change id").
  4. Merge: for each key in stdin, assign onto the existing requirement (replace, not append).
  5. Validate the merged requirement with `validateRequirementShape(req, { requireAllFields: true })`.
  6. Re-run referential-integrity and cycle checks on the full PRD (the dependency edit may have introduced a cycle or dangling ref).
  7. Write atomically; output the full requirement in schema order.
- Route `req edit`.

**Verify:**
- Run: `cd cli && node --test test/req-edit.test.js`
- Expected: Tests pass.
- Quality check: `cd cli && npm run check`

### Step 6: Test `req edit` error cases (not found, id rename attempt, cycle via edit, dangling refs)

**Test first:**
- File: `cli/test/req-edit.test.js`
- Description:
```js
it("exits 1 when REQ-ID does not exist", () => {
  const dir = withFixture(MINIMAL_PRD);
  const result = run(
    ["req", "edit", "REQ-999"],
    { cwd: dir, input: JSON.stringify({ title: "x" }) },
  );
  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /REQ-999/);
});

it("exits 1 when stdin contains an id field", () => {
  const dir = withFixture(MINIMAL_PRD);
  const result = run(
    ["req", "edit", "REQ-001"],
    { cwd: dir, input: JSON.stringify({ id: "REQ-999" }) },
  );
  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /id/i);
});

it("exits 1 when edit introduces a cycle", () => {
  // REQ-002 already depends on REQ-001. Edit REQ-001 to depend on REQ-002 -> cycle.
  const dir = withFixture(MINIMAL_PRD);
  const result = run(
    ["req", "edit", "REQ-001"],
    { cwd: dir, input: JSON.stringify({ dependencies: ["REQ-002"] }) },
  );
  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /cycle|circular/i);
});

it("exits 1 when edit introduces a dangling dependency", () => {
  const dir = withFixture(MINIMAL_PRD);
  const result = run(
    ["req", "edit", "REQ-001"],
    { cwd: dir, input: JSON.stringify({ dependencies: ["REQ-999"] }) },
  );
  assert.equal(result.exitCode, 1);
});

it("exits 2 when no REQ-ID argument is given", () => {
  const dir = withFixture(MINIMAL_PRD);
  const result = run(["req", "edit"], { cwd: dir, input: "{}" });
  assert.equal(result.exitCode, 2);
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: Harden `reqEdit` per the cases above. Reuse the referential and cycle helpers from Step 4. Ensure that on validation failure, the on-disk PRD is untouched (the write happens last).

**Verify:**
- Run: `cd cli && node --test test/req-edit.test.js`
- Expected: All tests pass.
- Quality check: `cd cli && npm run check`

### Step 7: Test and implement `req dep add`

**Test first:**
- File: `cli/test/req-dep-add.test.js`
- Description: Happy path; duplicate edge; self-loop; cycle; missing ID; exit 2 on missing args.
- Test code sketch:
```js
describe("req dep add", () => {
  it("adds a dependency edge and persists it", () => {
    const dir = withFixture(MINIMAL_PRD);
    // Add REQ-003 to depend on -- needs to exist first. Use a larger fixture.
    const prd = structuredClone(MINIMAL_PRD);
    prd.requirements.push({
      id: "REQ-003", title: "Third", description: "D",
      acceptance_criteria: "Done", abstraction_level: "high",
    });
    const dir2 = withFixture(prd);
    // Make REQ-001 depend on REQ-003.
    const result = run(["req", "dep", "add", "REQ-001", "REQ-003"], { cwd: dir2 });
    assert.equal(result.exitCode, 0);
    const updated = JSON.parse(result.stdout);
    assert.deepEqual(updated.dependencies, ["REQ-003"]);
    const diskPrd = JSON.parse(fs.readFileSync(path.join(dir2, "clif-d", "prd.json"), "utf8"));
    const r = diskPrd.requirements.find((x) => x.id === "REQ-001");
    assert.deepEqual(r.dependencies, ["REQ-003"]);
  });

  it("exits 1 on self-loop", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "dep", "add", "REQ-001", "REQ-001"], { cwd: dir });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /self|cycle/i);
  });

  it("exits 1 on duplicate edge", () => {
    // REQ-002 already depends on REQ-001 in MINIMAL_PRD.
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "dep", "add", "REQ-002", "REQ-001"], { cwd: dir });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /duplicate|already/i);
  });

  it("exits 1 on cycle through existing graph", () => {
    // REQ-002 depends on REQ-001. Add REQ-001 -> REQ-002 creates a cycle.
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "dep", "add", "REQ-001", "REQ-002"], { cwd: dir });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /cycle|circular/i);
  });

  it("exits 1 when REQ-ID not found", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "dep", "add", "REQ-999", "REQ-001"], { cwd: dir });
    assert.equal(result.exitCode, 1);
  });

  it("exits 1 when DEP-ID not found", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "dep", "add", "REQ-001", "REQ-999"], { cwd: dir });
    assert.equal(result.exitCode, 1);
  });

  it("exits 2 when an arg is missing", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "dep", "add", "REQ-001"], { cwd: dir });
    assert.equal(result.exitCode, 2);
  });
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description:
  1. Add router dispatch for `req dep add` (three-level).
  2. Add `reqDepAdd(prdPath, prd, reqId, depId)`:
     - Both IDs exist (exit 1 otherwise).
     - `reqId !== depId` (self-loop -> exit 1).
     - `depId` not already in `reqId.dependencies` (duplicate -> exit 1).
     - Speculatively add the edge and run `hasCycle(prd)`. If true, reject.
     - Commit: set `requirement.dependencies = [...(requirement.dependencies ?? []), depId]`. Write atomically.
     - Output the full updated requirement in schema order.

**Verify:**
- Run: `cd cli && node --test test/req-dep-add.test.js`
- Expected: All tests pass.
- Quality check: `cd cli && npm run check`

### Step 8: Test and implement `req dep rm`

**Test first:**
- File: `cli/test/req-dep-rm.test.js`
- Description: Happy path; edge not present; missing IDs; exit 2 on missing args.
- Test code sketch:
```js
describe("req dep rm", () => {
  it("removes an existing edge and persists the change", () => {
    // MINIMAL_PRD: REQ-002 depends on REQ-001.
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "dep", "rm", "REQ-002", "REQ-001"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const updated = JSON.parse(result.stdout);
    assert.deepEqual(updated.dependencies, []);
    const diskPrd = JSON.parse(fs.readFileSync(path.join(dir, "clif-d", "prd.json"), "utf8"));
    const r = diskPrd.requirements.find((x) => x.id === "REQ-002");
    assert.deepEqual(r.dependencies, []);
  });

  it("exits 1 when edge is not present", () => {
    const dir = withFixture(MINIMAL_PRD);
    // REQ-001 has no dependencies.
    const result = run(["req", "dep", "rm", "REQ-001", "REQ-002"], { cwd: dir });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /not present|no edge|not a dependency/i);
  });

  it("exits 1 when REQ-ID not found", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "dep", "rm", "REQ-999", "REQ-001"], { cwd: dir });
    assert.equal(result.exitCode, 1);
  });

  it("exits 2 when a required arg is missing", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "dep", "rm", "REQ-002"], { cwd: dir });
    assert.equal(result.exitCode, 2);
  });
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: Router dispatch for `req dep rm`. `reqDepRm(prdPath, prd, reqId, depId)`: verify `reqId` exists, verify `depId` is in `reqId.dependencies` (exit 1 if not), filter it out, write atomically, output the updated requirement.
- Note: we don't require `depId` itself to exist as a requirement -- if it was an orphan reference, `req dep rm` should still be able to clean it up. Skip the "depId exists" check here; it's a data-hygiene command.

**Verify:**
- Run: `cd cli && node --test test/req-dep-rm.test.js`
- Expected: All tests pass.
- Quality check: `cd cli && npm run check`

### Step 9: Test explicit prd-path and --help for all new commands

**Test first:**
- File: `cli/test/req-add.test.js`, `cli/test/req-edit.test.js`, `cli/test/req-dep-add.test.js`, `cli/test/req-dep-rm.test.js` (append to each)
- Description: Each command accepts an explicit prd-path as the last positional and prints help on `--help`.
- Test code sketch (in `req-add.test.js`):
```js
it("accepts explicit prd-path", () => {
  const dir = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "clif-d-test-"));
  const prdPath = path.join(dir, "custom.json");
  fs.writeFileSync(prdPath, JSON.stringify(MINIMAL_PRD, null, 2));
  const body = {
    title: "T", description: "D", acceptance_criteria: "Done", abstraction_level: "high",
  };
  const result = run(["req", "add", prdPath], { input: JSON.stringify(body) });
  assert.equal(result.exitCode, 0);
});

it("prints help on --help", () => {
  const result = run(["req", "add", "--help"]);
  assert.equal(result.exitCode, 0);
  assert.match(result.stderr, /req add/i);
});
```
Repeat analogous tests for `req edit REQ-ID`, `req dep add REQ-ID DEP-ID`, `req dep rm REQ-ID DEP-ID`.

**Implement:**
- File(s): `bin/clif-d`
- Description: In the router, call `resolvePrdPath(flags, N)` with the correct expected-positional count for each command (0 for `req add`, 1 for `req edit`, 2 for `req dep add` and `req dep rm`). Add `printReqAddHelp`, `printReqEditHelp`, `printReqDepHelp`. Register them in `printMainHelp`.

**Verify:**
- Run: `cd cli && node --test test/**/*.test.js`
- Expected: All tests pass (including all prior command tests).
- Quality check: `cd cli && npm run check`

## 5. Acceptance Criteria Verification

- [ ] **REQ-015 criterion:** "Pipe a JSON object with title, description, acceptance_criteria, abstraction_level (no id) to `clif-d req add`, then new requirement REQ-NNN appended, stdout has full object, deps/refs validated. Exit 0."
  - **Verified by:** `req-add.test.js` -- happy path (Step 2), schema validation (Step 3), referential/cycle validation (Step 4)

- [ ] **REQ-016 criterion:** "Pipe `{\"architecture_refs\": [\"ARCH-001\", \"ARCH-002\"]}` to `clif-d req edit REQ-003`, then `architecture_refs` is replaced, other fields unchanged, stdout has full updated requirement. Exit 0."
  - **Verified by:** `req-edit.test.js` -- happy path (Step 5), not-found / id-rename / cycle / dangling ref (Step 6)

- [ ] **REQ-017 criterion:** "`clif-d req dep add REQ-005 REQ-003` adds the edge, graph stays acyclic, stdout has updated REQ-005. Exit 0."
  - **Verified by:** `req-dep-add.test.js` -- happy path, cycle, duplicate, self-loop (Step 7); `req-dep-rm.test.js` -- removal (Step 8)

- [ ] **File-not-found and unparseable-PRD cases:** exit 2. Covered by existing `loadPrd` behavior; no new test unless a prior command lacked coverage.

## 6. Files Created or Modified

| File | Action | Step |
|------|--------|------|
| `cli/test/helpers.js` | Modify | 1 (forward `input`) |
| `cli/test/helpers.test.js` | Create | 1 |
| `cli/test/req-add.test.js` | Create | 2, 3, 4, 9 |
| `cli/test/req-edit.test.js` | Create | 5, 6, 9 |
| `cli/test/req-dep-add.test.js` | Create | 7, 9 |
| `cli/test/req-dep-rm.test.js` | Create | 8, 9 |
| `bin/clif-d` | Modify | 2, 3, 4, 5, 6, 7, 8, 9 |

## 7. Open Questions and Assumptions

- **Assumption: replace semantics for array fields.** `req edit` with `{"dependencies": ["REQ-003"]}` **replaces** the dependencies array wholesale. This matches REQ-016's acceptance criteria ("Uses replace semantics for all fields (including arrays)"). Callers who want incremental edits use `req dep add` / `req dep rm`.
- **Assumption: stdin is read whole, synchronously, via `fs.readFileSync(0)`.** Payloads are small (a single requirement JSON). No streaming needed. An empty stdin (e.g. `run(["req", "add"])` with no `input`) produces empty string -> JSON parse fails -> exit 1.
- **Assumption: `req dep rm` tolerates orphaned DEP-IDs.** We do not require `DEP-ID` to exist as a requirement before removing the edge -- the command is a data-hygiene tool and should be able to clean up references to requirements that have since been deleted. We do still require `REQ-ID` to exist.
- **Assumption: `req add` fails closed on done-without-commit.** When stdin supplies `status: "done"` without `implementation_commit`, we reject (exit 1) on add, even though `validate` reports the same condition as an error post-hoc. Safer to fail fast at the mutation point. (This may be revisited if a use case emerges for constructing done requirements without a commit.)
- **Open question: should `nextReqId` be shared with REQ-021?** If REQ-021's `id next` is implemented before this plan runs, the helper already exists -- use it. If not, this plan implements the helper inline and REQ-021 can later refactor to call it. Either ordering is fine; the code shape is 5 lines and duplication is cheap.
