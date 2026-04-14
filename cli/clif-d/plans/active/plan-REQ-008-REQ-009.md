# Implementation Plan: List Requirements with Filters + Show a Single Requirement

**Requirements:** REQ-008, REQ-009
**PRD:** `cli-prd.json`
**Backpressure:** `cli/clif-d/backpressure.md`
**Preceding plans:** None (first implementation plan)
**Date:** 2026-04-14
**Status:** Draft

## 1. Objective

Implement the `req ls` and `req show` commands in `bin/clif-d`, establishing the core infrastructure (argument parsing, PRD loading, JSON output formatting) that all subsequent commands build on. When complete, an agent can list requirements filtered by status and abstraction level, select output fields, and retrieve any single requirement by ID -- all via CLI commands that output valid JSON to stdout.

## 2. Context Summary

### Requirement: REQ-008 -- List requirements with filters

**Description:** First concrete command. Enables the plan-requirement skill to quickly assess PRD state without parsing JSON. Supports filtering by status and abstraction level, which are the two most common query axes. Also supports field selection to keep output concise -- an agent listing requirements to find the next one to plan does not need full cli_spec objects in the output. Related to REQ-001.

**Acceptance criteria (Given-When-Then):**
- **Given:** A valid prd.json exists at the default or specified path
- **When:** The agent runs `clif-d req ls --status=not_started --abstraction=low`
- **Then:** stdout contains a JSON array of requirement objects matching both filters, each containing only the default fields (id, title, status, abstraction_level, priority). Exit code is 0. If no requirements match, stdout contains an empty JSON array.

**CLI specification:**
- Command: `req ls`
- Flags:
  - `--status` / `-s` -- Filter by status value. Comma-separated for multiple: `--status=not_started,blocked`. Values: not_started, in_progress, done, blocked. Requirements with no status field are treated as not_started.
  - `--abstraction` / `-a` -- Filter by abstraction_level: high or low.
  - `--priority` -- Sort output by priority ascending (lowest number = highest priority). Unranked requirements appear last.
  - `--fields` / `-f` -- Comma-separated list of fields to include. Default: id,title,status,abstraction_level,priority.
  - `--deps` -- Include the dependencies field in output. Shorthand for adding dependencies to --fields.
  - `--json` -- JSON output (default).
  - `--plain` -- Plain tabular text output, one requirement per line.
- stdout: JSON array of filtered requirement objects with selected fields.
- stderr: Error messages if PRD file cannot be read or parsed.
- Exit codes: 0 = success (empty array if no matches), 2 = PRD file not found or not valid JSON.

### Requirement: REQ-009 -- Show a single requirement

**Description:** Retrieve the complete object for one requirement by ID. Used by plan-requirement to read the full detail (description, acceptance_criteria, cli_spec, all refs) of a target requirement, and by implement-plan to inspect a requirement before marking it done. Related to REQ-001.

**Acceptance criteria (Given-When-Then):**
- **Given:** A valid prd.json containing REQ-007
- **When:** The agent runs `clif-d req show REQ-007`
- **Then:** stdout contains the full JSON object for REQ-007 with all fields present in the PRD (no field filtering). Exit code is 0.

**CLI specification:**
- Command: `req show`
- Arguments: REQ-ID (required) -- The requirement ID to display (e.g. REQ-007).
- stdout: The complete requirement JSON object.
- stderr: Error message if the ID does not exist.
- Exit codes: 0 = requirement found and printed, 1 = requirement ID does not exist in the PRD, 2 = PRD file not found or not valid JSON.

### Relevant architecture decisions

**ARCH-002 -- Command routing architecture:** The CLI uses a two-level noun-verb command structure: `clif-d <domain> <command> [args] [flags] [prd-path]`. Domains are: req, ctx, arch, validate, id, schema. The router parses argv, identifies the domain and command, validates flags, and dispatches to the handler.

**ARCH-001 -- Plugin bin/ distribution:** The CLI lives at `bin/clif-d` in the CLIF-D plugin repository. The CLI must resolve the schema path relative to its own location (using `__dirname` or equivalent), not relative to cwd.

### Relevant context items

**CTX-001 -- Zero-dependency Node.js constraint:** The CLI must use only Node.js built-in modules (fs, path, process). No package.json, no node_modules, no npm install step.

**CTX-002 -- Single-file distribution:** The entire CLI is one executable file at `bin/clif-d` with a `#!/usr/bin/env node` shebang. No multi-file architecture, no transpilation, no build step.

**CTX-004 -- Claude Code agent persona:** The primary user is a Claude Code agent. The agent does not need colors, progress bars, or interactive prompts. It needs predictable exit codes, valid JSON on stdout, and actionable error messages on stderr.

**CTX-005 -- CLI design conventions:** stdout for data, stderr for errors and diagnostics; exit 0 for success, 1 for logic/validation errors, 2 for usage errors; --json for structured output (default), --plain for tabular text; long flags always available, short flags only for frequently used options.

**CTX-007 -- Requirement lifecycle states:** Status values: not_started (default when absent), in_progress, done, blocked.

**CTX-009 -- Default PRD path convention:** All commands accept an optional [prd-path] as the last positional argument. When omitted, the CLI defaults to `clif-d/prd.json` relative to the current working directory.

**CTX-010 -- Quality backpressure guardrails:** All code in `bin/clif-d` must pass formatting (Prettier), linting (ESLint), type checking (TypeScript checkJs strict), and tests (node --test) before commit.

### Quality guardrails (from backpressure.md Practitioner Quick Reference)

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

# All checks (what the pre-commit hook runs)
npm run check
```

### Error handling conventions

- Exit 0: success, data on stdout.
- Exit 1: logic/validation error (e.g. ID not found). Error message on stderr.
- Exit 2: usage error (e.g. PRD file not found, not valid JSON, bad usage). Error message on stderr.
- stdout is always valid JSON (or empty) on exit 0. Never mix error text into stdout.
- stderr messages should be actionable: state what went wrong and what to do about it.

### Deterministic JSON output

Per cli-design-notes.md: the CLI should write JSON with keys in a stable, predictable order matching the schema's field ordering (id, description, title, acceptance_criteria, priority, dependencies, abstraction_level, status, implementation_commit, context_refs, architecture_refs, cli_spec). Node.js preserves insertion order for string keys.

## 3. Prerequisites

- Node.js 18+ available (guaranteed by Claude Code environment).
- Dev tooling installed: `cd cli && npm install` (installs ESLint, Prettier, TypeScript, husky).
- The existing stub at `bin/clif-d` will be extended.

## 4. Implementation Steps

### Step 1: Create test infrastructure and first failing test

**Test first:**
- File: `cli/test/req-ls.test.js`
- Description: Create test infrastructure: a helper function that spawns `bin/clif-d` as a child process, captures stdout/stderr/exit code, and returns them. Write the first test: `req ls` with a minimal valid PRD fixture returns a JSON array of requirements with default fields.
- Test code sketch:
```js
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

// Helper: run clif-d with args, return { stdout, stderr, exitCode }
function run(args, { cwd } = {}) {
  const bin = path.resolve(__dirname, "../../bin/clif-d");
  try {
    const stdout = execFileSync(bin, args, {
      cwd: cwd || process.cwd(),
      encoding: "utf8",
      timeout: 5000,
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (error) {
    return {
      stdout: error.stdout || "",
      stderr: error.stderr || "",
      exitCode: error.status,
    };
  }
}

// Helper: create a temp dir with a clif-d/prd.json fixture
function withFixture(prd) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
  const cliDir = path.join(dir, "clif-d");
  fs.mkdirSync(cliDir);
  fs.writeFileSync(
    path.join(cliDir, "prd.json"),
    JSON.stringify(prd, null, 2),
  );
  return dir;
}

const MINIMAL_PRD = {
  $schema: "prd-schema.json",
  product_name: "test",
  concept_summary: { description: "test", reference_link: "test" },
  context: [],
  architecture: [],
  requirements: [
    {
      id: "REQ-001",
      title: "First requirement",
      description: "Desc",
      acceptance_criteria: "Done when done",
      abstraction_level: "high",
      priority: 1,
    },
    {
      id: "REQ-002",
      title: "Second requirement",
      description: "Desc",
      acceptance_criteria: { given: "G", when: "W", then: "T" },
      abstraction_level: "low",
      priority: 2,
      status: "done",
      dependencies: ["REQ-001"],
    },
  ],
};

describe("req ls", () => {
  it("lists all requirements with default fields", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "ls"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const reqs = JSON.parse(result.stdout);
    assert.equal(reqs.length, 2);
    // Default fields only
    const fields = Object.keys(reqs[0]);
    assert.deepEqual(fields, [
      "id", "title", "status", "abstraction_level", "priority",
    ]);
    // Missing status treated as not_started
    assert.equal(reqs[0].status, "not_started");
  });
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: Replace the stub with core infrastructure:
  1. A `loadPrd(prdPath)` function that reads and parses JSON, returning the PRD object or calling `exit(2)` with an error on stderr.
  2. A `resolvePrdPath(args)` function that checks for a trailing positional argument matching a file path, otherwise defaults to `clif-d/prd.json` relative to cwd.
  3. A command router that dispatches `argv[2]` (domain) + `argv[3]` (command) to handler functions.
  4. A `reqLs(prd, flags)` handler that filters requirements and outputs a JSON array with default fields.
  5. A `parseFlags(args)` utility that extracts `--flag=value` and `-f value` patterns from argv.
- Key decisions: Use `execFileSync` in tests (not `spawn`) for simplicity -- the CLI is fast. Default field list is `["id", "title", "status", "abstraction_level", "priority"]`. Requirements with no `status` field get `"not_started"` in output.

**Verify:**
- Run: `cd cli && node --test test/req-ls.test.js`
- Expected: Test passes.
- Quality check: `cd cli && npm run check`

### Step 2: Test and implement --status filter

**Test first:**
- File: `cli/test/req-ls.test.js`
- Description: Add tests for `--status` filtering: single value, comma-separated values, and treating absent status as not_started.
- Test code sketch:
```js
it("filters by --status=done", () => {
  const dir = withFixture(MINIMAL_PRD);
  const result = run(["req", "ls", "--status=done"], { cwd: dir });
  assert.equal(result.exitCode, 0);
  const reqs = JSON.parse(result.stdout);
  assert.equal(reqs.length, 1);
  assert.equal(reqs[0].id, "REQ-002");
});

it("filters by --status with comma-separated values", () => {
  const dir = withFixture(MINIMAL_PRD);
  const result = run(["req", "ls", "--status=not_started,done"], { cwd: dir });
  assert.equal(result.exitCode, 0);
  const reqs = JSON.parse(result.stdout);
  assert.equal(reqs.length, 2);
});

it("filters by -s shorthand", () => {
  const dir = withFixture(MINIMAL_PRD);
  const result = run(["req", "ls", "-s", "done"], { cwd: dir });
  assert.equal(result.exitCode, 0);
  const reqs = JSON.parse(result.stdout);
  assert.equal(reqs.length, 1);
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: Extend `parseFlags` to handle `--status=value` and `-s value`. In `reqLs`, filter the requirements array by comparing the requirement's status (defaulting absent to `"not_started"`) against the comma-split list of requested statuses.

**Verify:**
- Run: `cd cli && node --test test/req-ls.test.js`
- Expected: All tests pass.
- Quality check: `cd cli && npm run check`

### Step 3: Test and implement --abstraction filter

**Test first:**
- File: `cli/test/req-ls.test.js`
- Description: Test filtering by `--abstraction=low` and `--abstraction=high`.
- Test code sketch:
```js
it("filters by --abstraction=low", () => {
  const dir = withFixture(MINIMAL_PRD);
  const result = run(["req", "ls", "--abstraction=low"], { cwd: dir });
  assert.equal(result.exitCode, 0);
  const reqs = JSON.parse(result.stdout);
  assert.equal(reqs.length, 1);
  assert.equal(reqs[0].id, "REQ-002");
});

it("combines --status and --abstraction filters", () => {
  const dir = withFixture(MINIMAL_PRD);
  const result = run(
    ["req", "ls", "--status=not_started", "--abstraction=high"],
    { cwd: dir },
  );
  assert.equal(result.exitCode, 0);
  const reqs = JSON.parse(result.stdout);
  assert.equal(reqs.length, 1);
  assert.equal(reqs[0].id, "REQ-001");
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: Add `--abstraction` / `-a` flag parsing. Filter requirements where `abstraction_level` matches the requested value.

**Verify:**
- Run: `cd cli && node --test test/req-ls.test.js`
- Expected: All tests pass.
- Quality check: `cd cli && npm run check`

### Step 4: Test and implement --priority sort

**Test first:**
- File: `cli/test/req-ls.test.js`
- Description: Test that `--priority` sorts by priority ascending, with unranked requirements last.
- Test code sketch:
```js
it("sorts by --priority ascending, unranked last", () => {
  const prd = structuredClone(MINIMAL_PRD);
  prd.requirements.push({
    id: "REQ-003",
    title: "Third",
    description: "Desc",
    acceptance_criteria: "Done",
    abstraction_level: "high",
    // no priority -- should sort last
  });
  const dir = withFixture(prd);
  const result = run(["req", "ls", "--priority"], { cwd: dir });
  assert.equal(result.exitCode, 0);
  const reqs = JSON.parse(result.stdout);
  assert.equal(reqs[0].id, "REQ-001"); // priority 1
  assert.equal(reqs[1].id, "REQ-002"); // priority 2
  assert.equal(reqs[2].id, "REQ-003"); // no priority
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: When `--priority` flag is present (boolean flag, no value), sort the filtered results by priority ascending. Requirements without a priority field sort after all prioritized requirements. Stable sort preserves original order for ties.

**Verify:**
- Run: `cd cli && node --test test/req-ls.test.js`
- Expected: All tests pass.
- Quality check: `cd cli && npm run check`

### Step 5: Test and implement --fields selection and --deps shorthand

**Test first:**
- File: `cli/test/req-ls.test.js`
- Description: Test custom field selection and the --deps shorthand.
- Test code sketch:
```js
it("selects custom fields with --fields", () => {
  const dir = withFixture(MINIMAL_PRD);
  const result = run(["req", "ls", "--fields=id,description"], { cwd: dir });
  assert.equal(result.exitCode, 0);
  const reqs = JSON.parse(result.stdout);
  assert.deepEqual(Object.keys(reqs[0]), ["id", "description"]);
});

it("includes dependencies with --deps", () => {
  const dir = withFixture(MINIMAL_PRD);
  const result = run(["req", "ls", "--deps"], { cwd: dir });
  assert.equal(result.exitCode, 0);
  const reqs = JSON.parse(result.stdout);
  const req2 = reqs.find((r) => r.id === "REQ-002");
  assert.deepEqual(req2.dependencies, ["REQ-001"]);
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: Parse `--fields=field1,field2` and `-f field1,field2`. When selecting fields, construct output objects with only the requested keys in the order they appear in the field list. `--deps` adds `"dependencies"` to the field set. Fields not present on the requirement produce `undefined` (omitted from JSON output) except `status` which defaults to `"not_started"` and `dependencies` which defaults to `[]`.

**Verify:**
- Run: `cd cli && node --test test/req-ls.test.js`
- Expected: All tests pass.
- Quality check: `cd cli && npm run check`

### Step 6: Test and implement --plain output

**Test first:**
- File: `cli/test/req-ls.test.js`
- Description: Test that `--plain` outputs tab-separated text with a header row.
- Test code sketch:
```js
it("outputs plain tabular text with --plain", () => {
  const dir = withFixture(MINIMAL_PRD);
  const result = run(["req", "ls", "--plain"], { cwd: dir });
  assert.equal(result.exitCode, 0);
  const lines = result.stdout.trimEnd().split("\n");
  // First line is header
  assert.match(lines[0], /^id\t/);
  // Data lines follow
  assert.equal(lines.length, 3); // header + 2 requirements
  assert.match(lines[1], /^REQ-001\t/);
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: When `--plain` is present, output tab-separated text instead of JSON. First line is field names (tab-separated). Subsequent lines are values. Complex nested values (objects, arrays) are JSON-stringified inline.

**Verify:**
- Run: `cd cli && node --test test/req-ls.test.js`
- Expected: All tests pass.
- Quality check: `cd cli && npm run check`

### Step 7: Test and implement PRD file error handling

**Test first:**
- File: `cli/test/req-ls.test.js`
- Description: Test error cases: missing PRD file (exit 2), invalid JSON (exit 2).
- Test code sketch:
```js
it("exits 2 when PRD file not found", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
  const result = run(["req", "ls"], { cwd: dir });
  assert.equal(result.exitCode, 2);
  assert.match(result.stderr, /not found/i);
});

it("exits 2 when PRD is invalid JSON", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
  const cliDir = path.join(dir, "clif-d");
  fs.mkdirSync(cliDir);
  fs.writeFileSync(path.join(cliDir, "prd.json"), "not json{{{");
  const result = run(["req", "ls"], { cwd: dir });
  assert.equal(result.exitCode, 2);
  assert.match(result.stderr, /parse|json/i);
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: Ensure `loadPrd` handles missing file (ENOENT) and JSON parse errors gracefully. Write an actionable message to stderr and exit 2.

**Verify:**
- Run: `cd cli && node --test test/req-ls.test.js`
- Expected: All tests pass.
- Quality check: `cd cli && npm run check`

### Step 8: Test and implement explicit prd-path argument

**Test first:**
- File: `cli/test/req-ls.test.js`
- Description: Test that a trailing positional argument specifies the PRD path.
- Test code sketch:
```js
it("accepts explicit prd-path as last argument", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
  const prdPath = path.join(dir, "custom.json");
  fs.writeFileSync(prdPath, JSON.stringify(MINIMAL_PRD, null, 2));
  const result = run(["req", "ls", prdPath]);
  assert.equal(result.exitCode, 0);
  const reqs = JSON.parse(result.stdout);
  assert.equal(reqs.length, 2);
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: In `resolvePrdPath`, check if the last non-flag argument ends with `.json` or is an existing file path. If so, use it as the PRD path. Otherwise, default to `clif-d/prd.json` relative to cwd.

**Verify:**
- Run: `cd cli && node --test test/req-ls.test.js`
- Expected: All tests pass.
- Quality check: `cd cli && npm run check`

### Step 9: Test and implement req show

**Test first:**
- File: `cli/test/req-show.test.js`
- Description: Test `req show REQ-001` returns the full requirement object. Test nonexistent ID exits 1.
- Test code sketch:
```js
// Reuse run() and withFixture() helpers -- extract to cli/test/helpers.js

describe("req show", () => {
  it("shows the full requirement object by ID", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "show", "REQ-002"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const req = JSON.parse(result.stdout);
    assert.equal(req.id, "REQ-002");
    // Full object -- includes all fields present in PRD
    assert.equal(req.description, "Desc");
    assert.deepEqual(req.acceptance_criteria, {
      given: "G", when: "W", then: "T",
    });
    assert.deepEqual(req.dependencies, ["REQ-001"]);
  });

  it("exits 1 when requirement ID does not exist", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "show", "REQ-999"], { cwd: dir });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /REQ-999/);
  });

  it("exits 2 when no REQ-ID argument given", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "show"], { cwd: dir });
    assert.equal(result.exitCode, 2);
    assert.match(result.stderr, /usage|required|REQ-ID/i);
  });
});
```

**Implement:**
- File(s): `bin/clif-d`, `cli/test/helpers.js` (extract shared test utilities)
- Description: Add `reqShow(prd, reqId)` handler. Find the requirement by ID in `prd.requirements`. If found, output the full object as JSON to stdout. If not found, write error to stderr and exit 1. If no REQ-ID argument provided, write usage error to stderr and exit 2.

**Verify:**
- Run: `cd cli && node --test test/**/*.test.js`
- Expected: All tests pass.
- Quality check: `cd cli && npm run check`

### Step 10: Test req show with explicit prd-path

**Test first:**
- File: `cli/test/req-show.test.js`
- Description: Test that `req show REQ-001 /path/to/custom.json` works.
- Test code sketch:
```js
it("accepts explicit prd-path after REQ-ID", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
  const prdPath = path.join(dir, "custom.json");
  fs.writeFileSync(prdPath, JSON.stringify(MINIMAL_PRD, null, 2));
  const result = run(["req", "show", "REQ-001", prdPath]);
  assert.equal(result.exitCode, 0);
  const req = JSON.parse(result.stdout);
  assert.equal(req.id, "REQ-001");
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: Ensure `resolvePrdPath` correctly identifies the prd-path argument even when positional args (like REQ-ID) are present. The prd-path is always the last argument if it looks like a file path. REQ-ID pattern (`REQ-NNN`) is distinguishable from file paths.

**Verify:**
- Run: `cd cli && node --test test/**/*.test.js`
- Expected: All tests pass.
- Quality check: `cd cli && npm run check`

### Step 11: Test empty results and --help for commands

**Test first:**
- File: `cli/test/req-ls.test.js`
- Description: Verify empty filter returns empty array (not an error). Verify `req ls --help` prints usage.
- Test code sketch:
```js
it("returns empty array when no requirements match filter", () => {
  const dir = withFixture(MINIMAL_PRD);
  const result = run(["req", "ls", "--status=blocked"], { cwd: dir });
  assert.equal(result.exitCode, 0);
  const reqs = JSON.parse(result.stdout);
  assert.deepEqual(reqs, []);
});

it("prints help on req ls --help", () => {
  const result = run(["req", "ls", "--help"]);
  assert.equal(result.exitCode, 0);
  assert.match(result.stderr, /--status/);
  assert.match(result.stderr, /--abstraction/);
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: Add per-command `--help` handling that prints usage to stderr and exits 0. Ensure empty filter results output `[]` (not an error).

**Verify:**
- Run: `cd cli && node --test test/**/*.test.js`
- Expected: All tests pass.
- Quality check: `cd cli && npm run check`

## 5. Acceptance Criteria Verification

- [ ] **REQ-008 criterion:** "Given a valid prd.json, when the agent runs `clif-d req ls --status=not_started --abstraction=low`, then stdout contains a JSON array of matching requirements with default fields. Exit 0. Empty array if no matches."
  - **Verified by:** `req-ls.test.js` -- filters by status (Step 2), filters by abstraction (Step 3), combined filters (Step 3), empty results (Step 11), default fields (Step 1)

- [ ] **REQ-009 criterion:** "Given a valid prd.json containing REQ-007, when the agent runs `clif-d req show REQ-007`, then stdout contains the full JSON object for REQ-007 with all fields. Exit 0."
  - **Verified by:** `req-show.test.js` -- shows full object (Step 9), with explicit path (Step 10)

- [ ] **REQ-009 error case:** "Requirement ID does not exist exits 1."
  - **Verified by:** `req-show.test.js` -- exits 1 on unknown ID (Step 9)

## 6. Files Created or Modified

| File | Action | Step |
|------|--------|------|
| `cli/test/helpers.js` | Create | 1 (used), 9 (extracted) |
| `cli/test/req-ls.test.js` | Create | 1 |
| `cli/test/req-show.test.js` | Create | 9 |
| `bin/clif-d` | Modify | 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 |

## 7. Open Questions and Assumptions

- **Assumption: prd-path detection heuristic.** The last argument is treated as a prd-path if it ends with `.json` or contains a path separator. This distinguishes it from REQ-ID arguments (which match `^REQ-\d{3}$`). If a user names their file `REQ-001` (no extension), this would mis-detect. Acceptable edge case.
- **Assumption: --plain field separator.** Using tab characters as the field separator for `--plain` output. Tabs are standard for TSV and avoid issues with spaces in field values. Fields containing tabs or newlines (unlikely in practice) would break formatting -- acceptable given the agent-first persona.
- **Assumption: field ordering in output.** Output objects follow the schema field ordering: id, description, title, acceptance_criteria, priority, dependencies, abstraction_level, status, implementation_commit, context_refs, architecture_refs, cli_spec. The `--fields` flag selects which fields appear but preserves this canonical ordering regardless of the order fields are listed in the flag value.
