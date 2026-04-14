# Implementation Plan: Context Item and Architecture Item CRUD

**Requirements:** REQ-019, REQ-020
**PRD:** `cli-prd.json`
**Backpressure:** `cli/clif-d/backpressure.md`
**Preceding plans:**
- `cli/clif-d/plans/executed/plan-REQ-008-REQ-009.md` (core infrastructure, schema-ordered output, field selection)
- `cli/clif-d/plans/active/plan-REQ-011-REQ-012-REQ-013.md` (atomic `writePrd` pattern)
- `cli/clif-d/plans/active/plan-REQ-014.md` (referential-integrity and enum helpers)
- `cli/clif-d/plans/active/plan-REQ-015-REQ-016-REQ-017.md` (stdin handling, auto-assigned IDs, `req add`/`req edit` shape as the template)

**Date:** 2026-04-14
**Status:** Draft

## 1. Objective

Implement the `ctx` and `arch` domain commands in `bin/clif-d`: `ctx add`, `ctx edit`, `ctx ls`, `ctx show`, and the symmetric `arch add`, `arch edit`, `arch ls`, `arch show`. When complete, skills such as create-architecture and design-backpressure can programmatically manage context items and architecture items in the PRD with the same CRUD pattern used for requirements -- no hand-editing of JSON arrays.

## 2. Context Summary

### Requirement: REQ-019 -- Context item CRUD

**Description:** The design-backpressure skill adds context items to the PRD (e.g. a backpressure constraint). The create-architecture skill may also add context items. These operations need the same add/edit/show/ls pattern as requirements. Related to REQ-004.

**Acceptance criteria (Given-When-Then):**
- **Given:** A valid prd.json with context items up to CTX-003
- **When:** The agent pipes a JSON context item (no `id`) to `clif-d ctx add`
- **Then:** A new context item is appended with ID CTX-004. stdout contains the added object. The agent can also run `clif-d ctx ls --type=constraint` to filter by type, and `clif-d ctx show CTX-004` to retrieve the full object.

**CLI specification:**
- Command `ctx add`:
  - stdin: JSON context item object. `id` optional (auto-assigned if omitted).
  - stdout: the added context item with assigned ID.
  - stderr: validation errors.
  - Exit: 0 / 1 / 2 as per other mutation commands.

### Requirement: REQ-020 -- Architecture item CRUD

**Description:** The create-architecture skill adds architecture items to the PRD. Needs the same add/edit/show/ls pattern as requirements and context items. Related to REQ-004.

**Acceptance criteria (Given-When-Then):**
- **Given:** A valid prd.json with architecture items up to ARCH-002
- **When:** The agent pipes a JSON architecture item (no `id`) to `clif-d arch add`
- **Then:** A new architecture item is appended with ID ARCH-003. stdout contains the added object. The agent can also run `clif-d arch ls --level=component` to filter by C4 level.

**CLI specification:**
- Command `arch add`:
  - stdin: JSON architecture item object. `id` optional.
  - stdout: the added architecture item with assigned ID.
  - stderr: validation errors.
  - Exit: 0 / 1 / 2.

Both requirements imply a fuller set of commands beyond `add`. The PRD description explicitly mentions `show` and `ls` (with filter) for `ctx`, and `ls` with a `--level` filter for `arch`. For parity with `req` and to serve the skills that consume these, we also implement `ctx edit` and `arch edit`.

### Inferred full command set

| Command | Args | stdin | stdout | Description |
|---|---|---|---|---|
| `ctx ls` | -- | -- | JSON array | List context items; supports `--type=<value>` filter. |
| `ctx show` | `CTX-ID` | -- | JSON object | Full item. Exit 1 if not found. |
| `ctx add` | -- | JSON object | Added item | Auto-assigns `id` if omitted. |
| `ctx edit` | `CTX-ID` | partial JSON | Full updated item | Replace semantics; cannot change `id`. |
| `arch ls` | -- | -- | JSON array | Supports `--level=<value>` filter. |
| `arch show` | `ARCH-ID` | -- | JSON object | Full item. Exit 1 if not found. |
| `arch add` | -- | JSON object | Added item | Auto-assigns `id` if omitted. |
| `arch edit` | `ARCH-ID` | partial JSON | Full updated item | Replace semantics; cannot change `id`. |

### Schema for each item type

**Context item (`prd.context[]`):**
- Required: `id` (`CTX-NNN`), `title`, `description`, `type`.
- `type` enum: `"non_functional"`, `"constraint"`, `"persona"`, `"domain"`, `"product_goal"`.
- Optional: `reference_link` (string).

**Architecture item (`prd.architecture[]`):**
- Required: `id` (`ARCH-NNN`), `title`, `description`, `level`.
- `level` enum: `"context"`, `"container"`, `"component"`.
- Optional: `diagram_file` (string), `reference_link` (string).

Field orderings for output (mirrors schema order):
- Context: `id, title, description, type, reference_link`.
- Architecture: `id, title, description, level, diagram_file, reference_link`.

### Relevant architecture decisions

**ARCH-002 -- Command routing:** Two new top-level domains enter the router: `ctx` and `arch`. Each has `ls`, `show`, `add`, `edit` subcommands.

**ARCH-003 -- Read-validate-write cycle:** Same pattern as the requirement mutations -- atomic write via `writePrd`, validate before committing. On failure, original file untouched; exit 1 with diagnostics.

### Relevant context items

**CTX-003 -- PRD schema as contract:** Item shapes and enum values come from `skills/create-initial-prd/assets/prd-schema.json`.

**CTX-005 -- CLI design conventions:** Same as prior plans: stdout data, stderr errors, exit 0/1/2, `--json` default, `--plain` for tabular text.

**CTX-009 -- Default PRD path convention:** Optional `[prd-path]` as the last positional argument.

**CTX-010 / CTX-011 -- Quality + dev env.** Same guardrails as prior plans.

### Relevant preceding implementation (reuse, don't duplicate)

From executed REQ-008/009 plan:
- `parseFlags`, `resolvePrdPath`, `loadPrd`, router pattern.
- `selectFields` pattern and `--plain` tabular output.

From active REQ-011-013 plan (must land first):
- `writePrd(prdPath, prd)` atomic write.

From active REQ-015-016-017 plan (must land first):
- `readStdinJson()` helper.
- `validateRequirementShape` pattern -- this plan introduces analogous `validateContextShape(item, { requireAllFields })` and `validateArchitectureShape` helpers.
- `nextReqId(prd)` pattern -- this plan adds `nextCtxId(prd)` and `nextArchId(prd)` mirrors, or (better) extracts a shared `nextId(prefix, existingIds)` helper used by all three.

From active REQ-014 plan (recommended first):
- Enum validation helpers: `VALID_CONTEXT_TYPES`, `VALID_ARCHITECTURE_LEVELS`.

### Quality guardrails

```bash
cd cli
npx prettier --write ../bin/clif-d
npx eslint ../bin/clif-d
npx tsc --noEmit
node --test test/**/*.test.js
npm run check
```

### Lessons learned (apply here)

- **Tests are ESM.** `import ... from "./helpers.js"`.
- **`run` helper forwards stdin via `input` option** (added in the REQ-015-016-017 plan, Step 1).
- **TypeScript strict index access.** Cast as needed.
- **Deterministic on-disk JSON.** Reconstruct items in schema field order when appending.

## 3. Prerequisites

- Plan REQ-008/009 implemented. (Done.)
- Plan REQ-011/012/013 implemented (for `writePrd`).
- Plan REQ-015/016/017 implemented (for `readStdinJson`, validation helper pattern, `run({input})`).
- Plan REQ-014 recommended (enum helpers). If not yet landed, inline `VALID_CONTEXT_TYPES` and `VALID_ARCHITECTURE_LEVELS` constants in this plan's code.
- Node.js 18+; dev tooling installed.

## 4. Implementation Steps

### Step 1: Extract a shared `nextId(prefix, items)` helper, and add item-shape validators

**Test first:**
- File: `cli/test/ctx-add.test.js` (first test exercises the helper via `ctx add` end-to-end; no unit tests for internal helpers)
- Description: Adding a context item with no `id` to a PRD with `CTX-001`, `CTX-003` (gap) yields `CTX-004` (max+1, not gap-fill) -- same semantics as `nextReqId`.
- Test code sketch:
```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { run, withFixture, MINIMAL_PRD } from "./helpers.js";

function prdWithContext() {
  const prd = structuredClone(MINIMAL_PRD);
  prd.context = [
    { id: "CTX-001", title: "A", description: "D", type: "constraint" },
    { id: "CTX-003", title: "B", description: "D", type: "persona" },
  ];
  return prd;
}

describe("ctx add id assignment", () => {
  it("assigns max+1 (CTX-004) even when gaps exist", () => {
    const dir = withFixture(prdWithContext());
    const body = { title: "C", description: "D", type: "domain" };
    const result = run(["ctx", "add"], { cwd: dir, input: JSON.stringify(body) });
    assert.equal(result.exitCode, 0);
    const added = JSON.parse(result.stdout);
    assert.equal(added.id, "CTX-004");
  });
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description:
  1. Extract a `nextId(prefix, existingIds)` helper from the (by this point implemented) `nextReqId`. Signature: `nextId("CTX", prd.context.map((c) => c.id))`. Returns `"CTX-004"` etc.
  2. Add `VALID_CONTEXT_TYPES = ["non_functional", "constraint", "persona", "domain", "product_goal"]`.
  3. Add `VALID_ARCHITECTURE_LEVELS = ["context", "container", "component"]`.
  4. Add `validateContextShape(item, { requireAllFields })`:
     - If `requireAllFields`: require `title`, `description`, `type` (plus `id` if provided it must match `/^CTX-\d{3}$/`).
     - `type` must be in `VALID_CONTEXT_TYPES` when present.
     - `reference_link`, if present, must be a string.
  5. Add `validateArchitectureShape(item, { requireAllFields })` symmetric: require `title`, `description`, `level`; `level` in `VALID_ARCHITECTURE_LEVELS`; `diagram_file` / `reference_link` optional strings.
  6. Keep the pattern used by `req add`: validators return an array of error messages.

**Verify:**
- Run: `cd cli && node --test test/ctx-add.test.js`
- Expected: Test passes.
- Quality check: `cd cli && npm run check`

### Step 2: Test and implement `ctx add` (happy path + validation)

**Test first:**
- File: `cli/test/ctx-add.test.js`
- Description: Happy path appends in `CTX` order; missing required field exits 1; invalid `type` exits 1; duplicate explicit id exits 1; non-JSON stdin exits 1.
- Test code sketch:
```js
it("appends a context item and outputs the added object", () => {
  const dir = withFixture(prdWithContext());
  const body = { title: "New", description: "D", type: "constraint" };
  const result = run(["ctx", "add"], { cwd: dir, input: JSON.stringify(body) });
  assert.equal(result.exitCode, 0);
  const added = JSON.parse(result.stdout);
  assert.equal(added.title, "New");
  const prd = JSON.parse(fs.readFileSync(path.join(dir, "clif-d", "prd.json"), "utf8"));
  assert.equal(prd.context.length, 3);
  assert.equal(prd.context[2].title, "New");
});

it("exits 1 on invalid type", () => {
  const dir = withFixture(prdWithContext());
  const body = { title: "T", description: "D", type: "invalid_type" };
  const result = run(["ctx", "add"], { cwd: dir, input: JSON.stringify(body) });
  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /type/i);
});

it("exits 1 when required field missing", () => {
  const dir = withFixture(prdWithContext());
  const body = { title: "T", type: "constraint" }; // no description
  const result = run(["ctx", "add"], { cwd: dir, input: JSON.stringify(body) });
  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /description/i);
});

it("exits 1 on duplicate explicit id", () => {
  const dir = withFixture(prdWithContext());
  const body = { id: "CTX-001", title: "Dup", description: "D", type: "domain" };
  const result = run(["ctx", "add"], { cwd: dir, input: JSON.stringify(body) });
  assert.equal(result.exitCode, 1);
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: Add `ctxAdd(prdPath, prd)` handler mirroring `reqAdd`. Route `ctx add`. Construct the new item in context-schema order when writing and when returning on stdout.

**Verify:**
- Run: `cd cli && node --test test/ctx-add.test.js`
- Expected: Tests pass.
- Quality check: `cd cli && npm run check`

### Step 3: Test and implement `ctx ls` (including --type filter and --plain)

**Test first:**
- File: `cli/test/ctx-ls.test.js`
- Description: Default lists all items; `--type=constraint` filters; `--plain` outputs TSV with header; empty PRD context lists as `[]`.
- Test code sketch:
```js
describe("ctx ls", () => {
  it("lists all context items as JSON", () => {
    const dir = withFixture(prdWithContext());
    const result = run(["ctx", "ls"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const items = JSON.parse(result.stdout);
    assert.equal(items.length, 2);
    // Default fields (canonical order)
    assert.deepEqual(Object.keys(items[0]), ["id", "title", "type"]);
  });

  it("filters by --type", () => {
    const dir = withFixture(prdWithContext());
    const result = run(["ctx", "ls", "--type=persona"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const items = JSON.parse(result.stdout);
    assert.equal(items.length, 1);
    assert.equal(items[0].id, "CTX-003");
  });

  it("outputs tabular with --plain", () => {
    const dir = withFixture(prdWithContext());
    const result = run(["ctx", "ls", "--plain"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const lines = result.stdout.trimEnd().split("\n");
    assert.match(lines[0], /^id\t/);
    assert.equal(lines.length, 3);
  });

  it("returns [] when no context items exist", () => {
    const dir = withFixture(MINIMAL_PRD); // context: []
    const result = run(["ctx", "ls"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    assert.deepEqual(JSON.parse(result.stdout), []);
  });
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: Add `ctxLs(prd, flags)`. Default output fields: `["id", "title", "type"]`. Support `--type=<value>` (comma-separated multi-value like `req ls --status`), `--fields`, `--plain`, `--json`. Reuse the `selectFields` pattern but with context-specific field order and defaults -- easiest by generalizing `selectFields` to take a field-order array:
  ```js
  function projectItem(item, fields, schemaOrder) {
    // existing selectFields logic, parameterized by schemaOrder
  }
  ```
  Refactor `selectFields` callers in `reqLs`/`reqShow` to use the generalized version.
- Register `ctx ls` in the router.

**Verify:**
- Run: `cd cli && node --test test/**/*.test.js`
- Expected: All tests pass (including prior `req ls` tests).
- Quality check: `cd cli && npm run check`

### Step 4: Test and implement `ctx show` and `ctx edit`

**Test first:**
- Files: `cli/test/ctx-show.test.js`, `cli/test/ctx-edit.test.js`
- Description:
```js
// ctx-show.test.js
describe("ctx show", () => {
  it("returns the full context object", () => {
    const dir = withFixture(prdWithContext());
    const result = run(["ctx", "show", "CTX-001"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const item = JSON.parse(result.stdout);
    assert.equal(item.id, "CTX-001");
    assert.equal(item.title, "A");
    assert.equal(item.type, "constraint");
  });

  it("exits 1 when CTX-ID not found", () => {
    const dir = withFixture(prdWithContext());
    const result = run(["ctx", "show", "CTX-999"], { cwd: dir });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /CTX-999/);
  });

  it("exits 2 when no CTX-ID given", () => {
    const dir = withFixture(prdWithContext());
    const result = run(["ctx", "show"], { cwd: dir });
    assert.equal(result.exitCode, 2);
  });
});

// ctx-edit.test.js
describe("ctx edit", () => {
  it("updates title and preserves other fields", () => {
    const dir = withFixture(prdWithContext());
    const result = run(
      ["ctx", "edit", "CTX-001"],
      { cwd: dir, input: JSON.stringify({ title: "Renamed" }) },
    );
    assert.equal(result.exitCode, 0);
    const item = JSON.parse(result.stdout);
    assert.equal(item.title, "Renamed");
    assert.equal(item.type, "constraint");
  });

  it("exits 1 when stdin contains an id field", () => {
    const dir = withFixture(prdWithContext());
    const result = run(
      ["ctx", "edit", "CTX-001"],
      { cwd: dir, input: JSON.stringify({ id: "CTX-999" }) },
    );
    assert.equal(result.exitCode, 1);
  });

  it("exits 1 when the edit invalidates the enum", () => {
    const dir = withFixture(prdWithContext());
    const result = run(
      ["ctx", "edit", "CTX-001"],
      { cwd: dir, input: JSON.stringify({ type: "invalid" }) },
    );
    assert.equal(result.exitCode, 1);
  });

  it("exits 1 when CTX-ID not found", () => {
    const dir = withFixture(prdWithContext());
    const result = run(
      ["ctx", "edit", "CTX-999"],
      { cwd: dir, input: JSON.stringify({ title: "x" }) },
    );
    assert.equal(result.exitCode, 1);
  });
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: `ctxShow(prd, flags)`: find by id in `prd.context`, return full object in schema order. `ctxEdit(prdPath, prd, ctxId)`: mirror `reqEdit` -- read stdin, reject `id` changes, merge replace-semantics, validate merged shape, write atomically, output full item.

**Verify:**
- Run: `cd cli && node --test test/ctx-*.test.js`
- Expected: All tests pass.
- Quality check: `cd cli && npm run check`

### Step 5: Test and implement the `arch` command family (mirror of ctx)

**Test first:**
- Files: `cli/test/arch-add.test.js`, `cli/test/arch-ls.test.js`, `cli/test/arch-show.test.js`, `cli/test/arch-edit.test.js`
- Description: Same shape as the `ctx` tests, using a fixture with architecture items. Key differences:
  - `--level=<value>` filter for `arch ls` instead of `--type`.
  - `level` enum is `context|container|component`.
  - Default `arch ls` fields: `["id", "title", "level"]`.
- Test code sketch (representative):
```js
const ARCH_PRD = (() => {
  const prd = structuredClone(MINIMAL_PRD);
  prd.architecture = [
    { id: "ARCH-001", title: "Bin distribution", description: "D", level: "context" },
    { id: "ARCH-002", title: "Command router", description: "D", level: "container" },
  ];
  return prd;
})();

describe("arch add", () => {
  it("appends and auto-assigns ARCH-003", () => {
    const dir = withFixture(ARCH_PRD);
    const body = { title: "Read-validate-write", description: "D", level: "component" };
    const result = run(["arch", "add"], { cwd: dir, input: JSON.stringify(body) });
    assert.equal(result.exitCode, 0);
    const added = JSON.parse(result.stdout);
    assert.equal(added.id, "ARCH-003");
  });

  it("exits 1 on invalid level", () => {
    const dir = withFixture(ARCH_PRD);
    const body = { title: "T", description: "D", level: "subsystem" };
    const result = run(["arch", "add"], { cwd: dir, input: JSON.stringify(body) });
    assert.equal(result.exitCode, 1);
  });
});

describe("arch ls", () => {
  it("filters by --level", () => {
    const dir = withFixture(ARCH_PRD);
    const result = run(["arch", "ls", "--level=container"], { cwd: dir });
    const items = JSON.parse(result.stdout);
    assert.equal(items.length, 1);
    assert.equal(items[0].id, "ARCH-002");
  });
});

describe("arch show", () => {
  it("returns full object", () => {
    const dir = withFixture(ARCH_PRD);
    const result = run(["arch", "show", "ARCH-001"], { cwd: dir });
    const item = JSON.parse(result.stdout);
    assert.equal(item.level, "context");
  });
});

describe("arch edit", () => {
  it("updates level", () => {
    const dir = withFixture(ARCH_PRD);
    const result = run(
      ["arch", "edit", "ARCH-001"],
      { cwd: dir, input: JSON.stringify({ level: "container" }) },
    );
    const item = JSON.parse(result.stdout);
    assert.equal(item.level, "container");
  });
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: Implement `archAdd`, `archLs`, `archShow`, `archEdit` by copying the `ctx` handlers and adjusting field ordering, enum constant, filter flag name, default fields, and schema-path (`prd.architecture`). Route `arch add|ls|show|edit`.
- **Consider** extracting a single generic CRUD factory parameterized by `(prefix, arrayKey, schemaFieldOrder, defaultListFields, validateShape, filterFlag)`. This removes the near-duplication between `ctx` and `arch`. Trade-off: the factory is ~60 lines of generic code that replaces ~120 lines of specific code; it's worth doing if the abstraction stays under `bin/clif-d`'s single-file constraint without hurting clarity. Implementer discretion -- the tests do not care.

**Verify:**
- Run: `cd cli && node --test test/**/*.test.js`
- Expected: All tests pass (including all prior command tests).
- Quality check: `cd cli && npm run check`

### Step 6: Test explicit prd-path and --help for all new commands

**Test first:**
- Files: each of the 8 new test files (append a small block)
- Description: Each command accepts a trailing prd-path positional and prints help on `--help`.
- Test code sketch (representative, per command):
```js
it("accepts explicit prd-path", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
  const prdPath = path.join(dir, "custom.json");
  fs.writeFileSync(prdPath, JSON.stringify(prdWithContext(), null, 2));
  const result = run(["ctx", "ls", prdPath]);
  assert.equal(result.exitCode, 0);
});

it("prints help on --help", () => {
  const result = run(["ctx", "ls", "--help"]);
  assert.equal(result.exitCode, 0);
  assert.match(result.stderr, /ctx ls/i);
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: Register `resolvePrdPath(flags, N)` with correct expected-positional counts (0 for `add`/`ls`, 1 for `show`/`edit`). Add help strings for each command. Update `printMainHelp` to mention the new domains.

**Verify:**
- Run: `cd cli && node --test test/**/*.test.js`
- Expected: All tests pass.
- Quality check: `cd cli && npm run check`

## 5. Acceptance Criteria Verification

- [ ] **REQ-019 criterion, add:** "Pipe JSON ctx item (no id) to `clif-d ctx add`, new item CTX-NNN appended, stdout has added object."
  - **Verified by:** `ctx-add.test.js` -- append + auto-id (Step 1, Step 2)
- [ ] **REQ-019 criterion, ls filter:** "`clif-d ctx ls --type=constraint` filters by type."
  - **Verified by:** `ctx-ls.test.js` -- `--type` filter (Step 3)
- [ ] **REQ-019 criterion, show:** "`clif-d ctx show CTX-NNN` retrieves the full object."
  - **Verified by:** `ctx-show.test.js` (Step 4)
- [ ] **REQ-019 implied edit parity:** `ctx edit` updates fields with replace semantics.
  - **Verified by:** `ctx-edit.test.js` (Step 4)
- [ ] **REQ-020 criterion, add:** "Pipe JSON arch item to `arch add`, new item ARCH-NNN appended."
  - **Verified by:** `arch-add.test.js` (Step 5)
- [ ] **REQ-020 criterion, ls filter:** "`clif-d arch ls --level=component` filters by C4 level."
  - **Verified by:** `arch-ls.test.js` (Step 5)
- [ ] **REQ-020 implied show + edit parity.**
  - **Verified by:** `arch-show.test.js`, `arch-edit.test.js` (Step 5)
- [ ] **File-not-found / unparseable PRD:** exit 2. Covered by `loadPrd`.
- [ ] **Explicit prd-path + --help for all 8 commands.**
  - **Verified by:** Step 6 test blocks.

## 6. Files Created or Modified

| File | Action | Step |
|------|--------|------|
| `cli/test/ctx-add.test.js` | Create | 1, 2, 6 |
| `cli/test/ctx-ls.test.js` | Create | 3, 6 |
| `cli/test/ctx-show.test.js` | Create | 4, 6 |
| `cli/test/ctx-edit.test.js` | Create | 4, 6 |
| `cli/test/arch-add.test.js` | Create | 5, 6 |
| `cli/test/arch-ls.test.js` | Create | 5, 6 |
| `cli/test/arch-show.test.js` | Create | 5, 6 |
| `cli/test/arch-edit.test.js` | Create | 5, 6 |
| `bin/clif-d` | Modify | 1, 2, 3, 4, 5, 6 |

## 7. Open Questions and Assumptions

- **Assumption: list filter flags match the dominant field.** `ctx ls` filters by `--type` (the main discriminator among context items). `arch ls` filters by `--level` (C4 level). Matches the acceptance criteria wording.
- **Assumption: default `ls` fields.** `ctx ls` default fields: `id, title, type`. `arch ls` default fields: `id, title, level`. Parallel to `req ls` defaults (`id, title, status, abstraction_level, priority`). Users who want more can use `--fields`.
- **Assumption: `edit` uses replace semantics, matching `req edit`.** This keeps the mental model consistent across all three domains.
- **Assumption: no referential impact from deleting context/architecture items.** This plan does not implement delete. If a `ctx rm` is added later, it will need to check whether any requirement's `context_refs` points at the ID (`validate` will surface dangling refs but not prevent removal). Out of scope here.
- **Open question: factor out a generic CRUD module?** `ctx` and `arch` are near-duplicates of each other and share 80% of shape with `req`. A single generic CRUD factory function would reduce lines and surface a cleaner mental model, but adds indirection in a zero-dependency, single-file tool. Implementer may keep them separate (straightforward) or factor once the parallelism is obvious from code -- both acceptable.
