# Implementation Plan: Find Next Implementable Requirement

**Requirements:** REQ-010
**PRD:** `cli-prd.json`
**Backpressure:** `cli/clif-d/backpressure.md`
**Preceding plans:** `cli/clif-d/plans/executed/plan-REQ-008-REQ-009.md` (core infrastructure: arg parsing, PRD loading, command routing, JSON output, selectFields/SCHEMA_FIELD_ORDER)
**Date:** 2026-04-14
**Status:** Executed
**Implementation commit:** bd465f0817f2d4c0add53337e69ab3d37849521b

## 1. Objective

Implement the `req next` command in `bin/clif-d`. When complete, an agent can run a single command to retrieve the highest-priority `not_started` requirement whose dependencies are all `done`. This is the single highest-value command for the plan-requirement skill, replacing its current multi-step process of scanning requirements and checking each one's dependency chain.

## 2. Context Summary

### Requirement: REQ-010 -- Find next implementable requirement

**Description:** The single highest-value command for the plan-requirement skill. Answers "what should I work on next?" by combining status filtering with dependency resolution. Replaces the multi-step process of: read all requirements, filter to not_started, check each one's dependencies recursively, determine if all dependencies are done. Related to REQ-001 and REQ-003.

**Acceptance criteria (Given-When-Then):**
- **Given:** A valid prd.json where REQ-001 is done, REQ-002 depends on REQ-001 and is not_started with priority 1, and REQ-003 is not_started with priority 2 and no dependencies
- **When:** The agent runs `clif-d req next`
- **Then:** stdout contains the full JSON object for REQ-002 (highest priority among eligible). Exit code is 0.

**CLI specification:**
- Command: `req next`
- stdout: The full JSON requirement object of the highest-priority eligible requirement.
- stderr: Diagnostic message if no requirements are eligible.
- Exit codes: 0 = an eligible requirement was found and printed; 1 = no eligible requirement exists (all done, all blocked, or all have unmet dependencies); 2 = PRD file not found or not valid JSON.

### Eligibility rules (derived from PRD + CTX-007 + CTX-008)

A requirement is **eligible** (implementable now) if and only if:
1. Its status is `not_started` (or absent, which defaults to `not_started`).
2. Every ID in its `dependencies` array refers to a requirement whose status is `done`.

All other requirements are **ineligible**:
- `in_progress`, `done`, `blocked` are not candidates.
- `not_started` with any unmet dependency (dependency status is not `done`) is not a candidate.
- A dependency pointing to a nonexistent ID is treated as unmet (also surfaced by `validate` separately -- `req next` does not error on dangling refs, it just treats them as unmet).

Among eligible requirements, selection is by **lowest `priority` value first** (priority 1 beats priority 2). Requirements with no `priority` field sort after all prioritized ones. Ties within the same priority are broken by the order the requirement appears in the PRD (stable).

### Relevant architecture decisions

**ARCH-002 -- Command routing architecture:** Two-level noun-verb: `clif-d <domain> <command> [args] [flags] [prd-path]`. `req next` is a standard two-level command under the existing `req` domain.

### Relevant context items

**CTX-007 -- Requirement lifecycle states:** Status values: not_started (default when absent), in_progress, done, blocked. Only `not_started` is eligible for `req next`.

**CTX-008 -- Dependency graph semantics:** The dependencies field defines hard blocking relationships. A requirement cannot be worked on until all its dependencies are done. Self-references and cycles are structurally invalid (surfaced by `validate`); `req next` tolerates them by treating unmet deps as unmet.

**CTX-009 -- Default PRD path convention:** Optional [prd-path] as the last positional argument, default `clif-d/prd.json`.

**CTX-010 -- Quality backpressure guardrails:** All code in `bin/clif-d` must pass formatting (Prettier), linting (ESLint), type checking (TypeScript checkJs strict), and tests before commit.

**CTX-011 -- Development environment bootstrap:** Dev tooling under `cli/`. Run checks with `cd cli && npm run check`.

### Relevant preceding implementation (from `bin/clif-d`)

The executed plan for REQ-008/REQ-009 established:
- `parseFlags(args)` returns `{ named, boolean, positional }`.
- `resolvePrdPath(flags, expectedPositional)` -- uses `.json`/separator heuristic on the last positional to pick a prd-path, else defaults to `clif-d/prd.json`.
- `loadPrd(prdPath)` -- reads and parses JSON, exits 2 with stderr on error.
- Router dispatches on `args[0]` (domain) + `args[1]` (command), currently supports `req ls` and `req show`.
- `SCHEMA_FIELD_ORDER` constant for canonical output ordering.
- `selectFields(req, fields)` / full-object output uses this ordering; `status` defaults to `not_started`, `dependencies` defaults to `[]`.
- Per-command help: `--help` / `-h` prints usage to stderr and exits 0.

`req next` should output the **full** requirement object using the same canonical ordering as `req show` (including default `status: "not_started"` and `dependencies: []`).

### Quality guardrails

```bash
cd cli
npx prettier --write ../bin/clif-d
npx eslint ../bin/clif-d
npx tsc --noEmit
node --test test/**/*.test.js
npm run check
```

### Error handling conventions

- Exit 0: an eligible requirement was found. Full JSON object on stdout.
- Exit 1: no eligible requirement. A short diagnostic on stderr (e.g. `No eligible requirement: all requirements are done, in_progress, blocked, or have unmet dependencies.`). stdout is empty.
- Exit 2: PRD file missing or unparseable. Handled by existing `loadPrd`.

### Lessons learned from prior plans (apply to tests in this plan)

- **Tests are ESM.** `cli/package.json` has `"type": "module"`. Use `import ... from "./helpers.js"`, not `require`. Helpers re-exports `run`, `withFixture`, and `MINIMAL_PRD`.
- **Use `spawnSync`-based `run` helper.** It captures stdout/stderr on both success and failure paths.
- **TypeScript strict access.** `checkJs` with `noUncheckedIndexedAccess` is on. Array indexing and `.at(-1)` return `T | undefined`; cast with JSDoc when you know the index is valid.

## 3. Prerequisites

- **Plan REQ-008-REQ-009 must be implemented and merged.** Status: DONE (commit `eae6775`). This plan extends the existing `req` domain handler and reuses `loadPrd`, `parseFlags`, `resolvePrdPath`, and the schema-ordered output pattern.
- Node.js 18+ available (guaranteed by Claude Code environment).
- Dev tooling installed: `cd cli && npm install`.

This plan does **not** depend on REQ-011/REQ-012/REQ-013 (status mutation) or REQ-014 (validate) -- `req next` is a read-only query.

## 4. Implementation Steps

### Step 1: Happy path test -- picks the single eligible requirement

**Test first:**
- File: `cli/test/req-next.test.js`
- Description: Verify that with exactly one eligible requirement, `req next` outputs its full JSON object and exits 0.
- Test code sketch:
```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { run, withFixture } from "./helpers.js";

const NEXT_PRD = {
  $schema: "prd-schema.json",
  product_name: "test",
  concept_summary: { description: "test", reference_link: "test" },
  context: [],
  architecture: [],
  requirements: [
    {
      id: "REQ-001",
      title: "First",
      description: "D",
      acceptance_criteria: "Done",
      abstraction_level: "high",
      priority: 1,
      status: "done",
      implementation_commit: "abc1234",
    },
    {
      id: "REQ-002",
      title: "Second",
      description: "D",
      acceptance_criteria: { given: "G", when: "W", then: "T" },
      abstraction_level: "low",
      priority: 1,
      dependencies: ["REQ-001"],
    },
    {
      id: "REQ-003",
      title: "Third",
      description: "D",
      acceptance_criteria: "Done",
      abstraction_level: "high",
      priority: 2,
    },
  ],
};

describe("req next", () => {
  it("returns highest-priority eligible requirement with full object", () => {
    const dir = withFixture(NEXT_PRD);
    const result = run(["req", "next"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const req = JSON.parse(result.stdout);
    // REQ-002 (priority 1, deps met) beats REQ-003 (priority 2).
    assert.equal(req.id, "REQ-002");
    // Full object: description, acceptance_criteria, dependencies present.
    assert.equal(req.description, "D");
    assert.deepEqual(req.acceptance_criteria, { given: "G", when: "W", then: "T" });
    assert.deepEqual(req.dependencies, ["REQ-001"]);
    // Default status exposed.
    assert.equal(req.status, "not_started");
  });
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: Add `reqNext(prd, flags)` handler:
  1. Build a `doneIds` Set from requirements whose `status === "done"`.
  2. Filter requirements whose effective status (`status ?? "not_started"`) is `not_started` and every dep in `dependencies ?? []` is in `doneIds`.
  3. Stable sort by priority ascending (undefined priority last). Take the first.
  4. If none, write diagnostic to stderr and exit 1.
  5. Otherwise, output the full object using `SCHEMA_FIELD_ORDER` (same pattern as `reqShow` -- reuse `selectFields` with the full field list, or emit a small helper `fullRequirementObject(req)` and use it from both `reqShow` and `reqNext`).
- Route `req next` in the router alongside `req ls` and `req show`. Add `--help` text.
- Key decisions:
  - Use a **Set** for `doneIds` (O(1) lookup per dep check).
  - **Stable priority sort**: preserve PRD order for ties by using `Array.prototype.sort` with `(a, b) => priA - priB` and a consistent index tiebreaker; or use `Array.prototype.filter` + a linear pass that tracks best-so-far -- both are fine. Prefer the linear pass for clarity and to avoid the "undefined priority" sort-comparator pitfall.
  - **Dangling deps are unmet.** If a dep ID is not in the full requirement set, it is not in `doneIds`, so the requirement is ineligible. No special handling needed.

**Verify:**
- Run: `cd cli && node --test test/req-next.test.js`
- Expected: Test passes.
- Quality check: `cd cli && npm run check`

### Step 2: Test priority ordering and priority-tie stability

**Test first:**
- File: `cli/test/req-next.test.js`
- Description: Verify priority 1 beats priority 2 even when both are eligible; verify priority-less requirements sort last; verify ties preserve PRD order.
- Test code sketch:
```js
it("prefers lower priority number among eligible", () => {
  const prd = structuredClone(NEXT_PRD);
  // Remove REQ-002 dep so both REQ-002 and REQ-003 are eligible.
  delete prd.requirements[1].dependencies;
  // REQ-002 priority 1, REQ-003 priority 2 -- REQ-002 wins.
  const dir = withFixture(prd);
  const result = run(["req", "next"], { cwd: dir });
  assert.equal(result.exitCode, 0);
  const req = JSON.parse(result.stdout);
  assert.equal(req.id, "REQ-002");
});

it("prefers requirements with priority over those without", () => {
  const prd = structuredClone(NEXT_PRD);
  delete prd.requirements[1].dependencies;
  delete prd.requirements[2].priority;
  const dir = withFixture(prd);
  const result = run(["req", "next"], { cwd: dir });
  const req = JSON.parse(result.stdout);
  assert.equal(req.id, "REQ-002");
});

it("breaks priority ties by PRD order (stable)", () => {
  const prd = structuredClone(NEXT_PRD);
  delete prd.requirements[1].dependencies;
  prd.requirements[2].priority = 1; // same priority as REQ-002
  // REQ-002 appears before REQ-003 in the array -- REQ-002 wins.
  const dir = withFixture(prd);
  const result = run(["req", "next"], { cwd: dir });
  const req = JSON.parse(result.stdout);
  assert.equal(req.id, "REQ-002");
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: Ensure `reqNext` selection logic handles these ordering cases. A linear "best so far" scan handles all three naturally: iterate eligible requirements in PRD order and replace best-so-far only when strictly better (lower priority; ranked beats unranked).

**Verify:**
- Run: `cd cli && node --test test/req-next.test.js`
- Expected: All tests pass.
- Quality check: `cd cli && npm run check`

### Step 3: Test dependency gating

**Test first:**
- File: `cli/test/req-next.test.js`
- Description: Verify that a requirement with an unmet dep is skipped, that the skip happens even if the skipped requirement has the lowest priority, and that transitively-done chains work.
- Test code sketch:
```js
it("skips requirement whose dependency is not done", () => {
  const prd = structuredClone(NEXT_PRD);
  // REQ-002 depends on REQ-001, but mark REQ-001 as in_progress (not done).
  prd.requirements[0].status = "in_progress";
  delete prd.requirements[0].implementation_commit;
  const dir = withFixture(prd);
  const result = run(["req", "next"], { cwd: dir });
  // REQ-002 is ineligible (unmet dep). REQ-003 is the only eligible.
  assert.equal(result.exitCode, 0);
  const req = JSON.parse(result.stdout);
  assert.equal(req.id, "REQ-003");
});

it("treats dangling dependency ID as unmet", () => {
  const prd = structuredClone(NEXT_PRD);
  // Point REQ-002 at a nonexistent dep. REQ-001 is still done.
  prd.requirements[1].dependencies = ["REQ-999"];
  const dir = withFixture(prd);
  const result = run(["req", "next"], { cwd: dir });
  // REQ-002 ineligible; REQ-003 (priority 2, no deps) is picked.
  assert.equal(result.exitCode, 0);
  const req = JSON.parse(result.stdout);
  assert.equal(req.id, "REQ-003");
});

it("handles multi-dep requirements (all must be done)", () => {
  const prd = structuredClone(NEXT_PRD);
  // REQ-002 depends on REQ-001 (done) and REQ-003 (not_started).
  prd.requirements[1].dependencies = ["REQ-001", "REQ-003"];
  const dir = withFixture(prd);
  const result = run(["req", "next"], { cwd: dir });
  // REQ-002 ineligible (one dep not done). REQ-003 has no deps -> picked.
  const req = JSON.parse(result.stdout);
  assert.equal(req.id, "REQ-003");
});

it("treats status absent as not_started (eligible)", () => {
  const prd = structuredClone(NEXT_PRD);
  delete prd.requirements[2].status; // REQ-003 already has no status, but be explicit
  delete prd.requirements[2].priority; // unranked, no deps -- still eligible
  delete prd.requirements[1].dependencies; // REQ-002 also eligible, priority 1
  const dir = withFixture(prd);
  const result = run(["req", "next"], { cwd: dir });
  assert.equal(result.exitCode, 0);
  const req = JSON.parse(result.stdout);
  assert.equal(req.id, "REQ-002");
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: No new code needed beyond Step 1 if the `doneIds` Set approach was used. These tests verify that the initial logic handles dangling deps, multi-dep "all must be done" semantics, and absent status. If any of these fail, adjust the eligibility predicate.

**Verify:**
- Run: `cd cli && node --test test/req-next.test.js`
- Expected: All tests pass.
- Quality check: `cd cli && npm run check`

### Step 4: Test the "no eligible requirement" exit code (exit 1)

**Test first:**
- File: `cli/test/req-next.test.js`
- Description: Verify exit 1 and stderr diagnostic when no requirement is eligible.
- Test code sketch:
```js
it("exits 1 with a diagnostic when no requirement is eligible", () => {
  const prd = structuredClone(NEXT_PRD);
  // Mark all as done.
  for (const r of prd.requirements) {
    r.status = "done";
    r.implementation_commit = "abc1234";
  }
  const dir = withFixture(prd);
  const result = run(["req", "next"], { cwd: dir });
  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /no eligible|no requirement/i);
});

it("exits 1 when all not_started requirements are blocked by unmet deps", () => {
  const prd = structuredClone(NEXT_PRD);
  // REQ-001 not done -> REQ-002 unmet. REQ-003 is blocked.
  prd.requirements[0].status = "in_progress";
  delete prd.requirements[0].implementation_commit;
  prd.requirements[2].status = "blocked";
  const dir = withFixture(prd);
  const result = run(["req", "next"], { cwd: dir });
  assert.equal(result.exitCode, 1);
});

it("exits 1 on an empty requirements array", () => {
  const prd = structuredClone(NEXT_PRD);
  prd.requirements = [];
  const dir = withFixture(prd);
  const result = run(["req", "next"], { cwd: dir });
  assert.equal(result.exitCode, 1);
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: When no eligible requirement is found, write a short actionable diagnostic to stderr and exit 1. Ensure stdout is empty (do not write `null` or `[]`).

**Verify:**
- Run: `cd cli && node --test test/req-next.test.js`
- Expected: All tests pass.
- Quality check: `cd cli && npm run check`

### Step 5: Test explicit prd-path and --help

**Test first:**
- File: `cli/test/req-next.test.js`
- Description: Verify `req next /path/to/custom.json` resolves correctly, and `req next --help` prints usage.
- Test code sketch:
```js
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

it("accepts explicit prd-path", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
  const prdPath = path.join(dir, "custom.json");
  fs.writeFileSync(prdPath, JSON.stringify(NEXT_PRD, null, 2));
  const result = run(["req", "next", prdPath]);
  assert.equal(result.exitCode, 0);
  const req = JSON.parse(result.stdout);
  assert.equal(req.id, "REQ-002");
});

it("prints help on --help", () => {
  const result = run(["req", "next", "--help"]);
  assert.equal(result.exitCode, 0);
  assert.match(result.stderr, /req next/i);
});

it("exits 2 when PRD file is missing", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
  const result = run(["req", "next"], { cwd: dir });
  assert.equal(result.exitCode, 2);
  assert.match(result.stderr, /not found/i);
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: In the router's `req next` branch, call `resolvePrdPath(flags, 0)` (no required positionals) and `loadPrd(prdPath)` before dispatching. Add `printReqNextHelp()` mirroring the style of `printReqLsHelp` / `printReqShowHelp`. Register it in `printMainHelp` if not already present.

**Verify:**
- Run: `cd cli && node --test test/**/*.test.js`
- Expected: All tests pass (including req-ls and req-show).
- Quality check: `cd cli && npm run check`

## 5. Acceptance Criteria Verification

- [ ] **REQ-010 criterion:** "Given REQ-001 done, REQ-002 depends on REQ-001 not_started priority 1, REQ-003 not_started priority 2 no deps, when `clif-d req next`, then stdout has full JSON of REQ-002. Exit 0."
  - **Verified by:** `req-next.test.js` -- happy path (Step 1), priority ordering (Step 2), dep gating (Step 3)

- [ ] **Exit 1 when no eligible requirement exists.**
  - **Verified by:** `req-next.test.js` -- all done / all blocked / empty (Step 4)

- [ ] **Exit 2 when PRD missing or unparseable.**
  - **Verified by:** `req-next.test.js` -- missing PRD (Step 5); existing `loadPrd` covers parse failure via other commands' tests

## 6. Files Created or Modified

| File | Action | Step |
|------|--------|------|
| `cli/test/req-next.test.js` | Create | 1, 2, 3, 4, 5 |
| `bin/clif-d` | Modify | 1, 4, 5 |

## 7. Open Questions and Assumptions

- **Assumption: priority semantics.** Lower number = higher priority. Priority 1 is picked before priority 2. Requirements with no `priority` field sort after all prioritized ones. This matches the existing `req ls --priority` sort from the executed REQ-008 plan.
- **Assumption: tie-breaking is PRD insertion order.** Among equally-prioritized eligible requirements, the one appearing earlier in `requirements[]` wins. This is deterministic and stable across invocations, which matters for agents that script on `req next` output.
- **Assumption: dangling dependency IDs are treated as unmet, not errors.** `req next` is a query, not a validator. `validate` (REQ-014) surfaces dangling refs; `req next` just silently de-eligibilizes the requirement. This keeps `req next` usable even when the PRD has minor issues.
