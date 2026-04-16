# Implementation Plan: Dependency Graph Query, Next ID, Schema Copy

**Requirements:** REQ-018, REQ-021, REQ-022
**PRD:** `cli-prd.json`
**Backpressure:** `cli/clif-d/backpressure.md`
**Preceding plans:** `cli/clif-d/plans/active/plan-REQ-008-REQ-009.md` (core infrastructure), `cli/clif-d/plans/active/plan-REQ-014.md` (cycle detection logic, reusable for graph traversal)
**Date:** 2026-04-14
**Status:** Executed
**Implementation commit:** 718ad14

## 1. Objective

Implement three independent utility commands: `req dep graph` (dependency visualization), `id next` (next available ID), and `schema copy` (copy PRD schema to product repo). These are Phase 2/3 commands that extend the CLI's utility without blocking any critical skill integration.

## 2. Context Summary

### Requirement: REQ-018 -- Dependency graph query

**Description:** Print the dependency graph for visualization and analysis. Supports full graph or a subgraph rooted at a specific requirement (ancestors only -- what must be done before this requirement). The plan-requirement skill uses the rooted subgraph to understand the full chain of prerequisites. Related to REQ-003.

**Acceptance criteria (Given-When-Then):**
- **Given:** A valid prd.json where REQ-005 depends on REQ-003, REQ-003 depends on REQ-001
- **When:** The agent runs `clif-d req dep graph --root=REQ-005`
- **Then:** stdout contains a JSON adjacency list showing REQ-005 -> [REQ-003] and REQ-003 -> [REQ-001]. Requirements outside this subgraph are excluded. Exit code is 0.

**CLI specification:**
- Command: `req dep graph`
- Flags:
  - `--root` -- Print only the subgraph of ancestors reachable from this requirement ID.
  - `--json` -- JSON adjacency list output (default).
  - `--dot` -- Graphviz DOT format for visualization.
  - `--plain` -- Plain text, one edge per line: `REQ-005 -> REQ-003`.
- stdout: Dependency graph in requested format.
- stderr: Error if --root ID does not exist.
- Exit codes: 0 = graph printed, 1 = referenced requirement ID does not exist, 2 = PRD file not found or not valid JSON.

### Requirement: REQ-021 -- Next available ID query

**Description:** Skills that construct objects before piping them to the add commands sometimes need to know the ID in advance. Related to REQ-007.

**Acceptance criteria (Given-When-Then):**
- **Given:** A valid prd.json with requirements up to REQ-012
- **When:** The agent runs `clif-d id next REQ`
- **Then:** stdout contains `REQ-013`. Exit code is 0.

**CLI specification:**
- Command: `id next`
- Arguments: prefix (required) -- The ID prefix: REQ, CTX, or ARCH.
- stdout: The next available ID (e.g. REQ-013).
- stderr: Error if prefix is not recognized.
- Exit codes: 0 = ID printed, 1 = invalid prefix, 2 = PRD file not found or not valid JSON.

### Requirement: REQ-022 -- Copy PRD schema to product repo

**Description:** Addresses the README TODO about the $schema field pointing into .claude/. After running this command, the skill can set $schema to a repo-relative path. Related to REQ-006.

**Acceptance criteria (Given-When-Then):**
- **Given:** A product repository with a clif-d/ directory
- **When:** The agent runs `clif-d schema copy clif-d/`
- **Then:** The file clif-d/prd-schema.json is created, identical to the plugin's canonical schema. stdout contains the absolute path of the copied file. Exit code is 0.

**CLI specification:**
- Command: `schema copy`
- Arguments: dest-dir (required) -- The directory to copy prd-schema.json into.
- stdout: Absolute path of the copied schema file.
- stderr: Error if destination directory does not exist.
- Exit codes: 0 = schema copied, 1 = destination directory does not exist, 2 = plugin schema file not found (broken installation).

### Relevant architecture decisions

**ARCH-001 -- Plugin bin/ distribution:** The CLI resolves the schema path relative to its own location using `__dirname` or `path.dirname(process.argv[1])`: `path.resolve(binDir, "../skills/create-initial-prd/assets/prd-schema.json")`.

**ARCH-002 -- Command routing:** Two new domain prefixes enter the router: `id` and `schema`. `req dep graph` is a three-level command under the existing `req` domain.

### Relevant context items

**CTX-008 -- Dependency graph semantics:** The dependency graph is a DAG. Dependencies define blocking relationships.

**CTX-003 -- PRD schema as contract:** The schema at `skills/create-initial-prd/assets/prd-schema.json` is the canonical source.

**CTX-009 -- Default PRD path convention:** Optional [prd-path] as last positional argument, default `clif-d/prd.json`.

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

- **Plan REQ-008-REQ-009 must be implemented first.** Uses core infrastructure.
- **Plan REQ-014 is recommended first** (cycle detection logic from validate can be reused for graph traversal, though not strictly required).
- Node.js 18+ available.
- Dev tooling installed.

## 4. Implementation Steps

### Step 1: Test and implement req dep graph (full graph, JSON format)

**Test first:**
- File: `cli/test/req-dep-graph.test.js`
- Description: Test that `req dep graph` outputs a JSON adjacency list for the full dependency graph.
- Test code sketch:
```js
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { run, withFixture } = require("./helpers.js");

const GRAPH_PRD = {
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
    },
    {
      id: "REQ-002",
      title: "Second",
      description: "D",
      acceptance_criteria: "Done",
      abstraction_level: "high",
      dependencies: ["REQ-001"],
    },
    {
      id: "REQ-003",
      title: "Third",
      description: "D",
      acceptance_criteria: "Done",
      abstraction_level: "high",
      dependencies: ["REQ-001", "REQ-002"],
    },
    {
      id: "REQ-004",
      title: "Fourth",
      description: "D",
      acceptance_criteria: "Done",
      abstraction_level: "high",
    },
  ],
};

describe("req dep graph", () => {
  it("outputs full adjacency list as JSON", () => {
    const dir = withFixture(GRAPH_PRD);
    const result = run(["req", "dep", "graph"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const graph = JSON.parse(result.stdout);
    // Adjacency list: { "REQ-001": [], "REQ-002": ["REQ-001"], ... }
    assert.deepEqual(graph["REQ-001"], []);
    assert.deepEqual(graph["REQ-002"], ["REQ-001"]);
    assert.deepEqual(graph["REQ-003"], ["REQ-001", "REQ-002"]);
    assert.deepEqual(graph["REQ-004"], []);
  });

  it("includes all requirements even those with no dependencies", () => {
    const dir = withFixture(GRAPH_PRD);
    const result = run(["req", "dep", "graph"], { cwd: dir });
    const graph = JSON.parse(result.stdout);
    assert.ok("REQ-004" in graph);
  });
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: Add `reqDepGraph(prd, flags)` handler. Build an adjacency list from all requirements' dependencies arrays. Output as JSON object where keys are requirement IDs and values are arrays of dependency IDs. Route `req dep graph` as a three-level command.

**Verify:**
- Run: `cd cli && node --test test/req-dep-graph.test.js`
- Expected: Tests pass.
- Quality check: `cd cli && npm run check`

### Step 2: Test and implement --root subgraph filtering

**Test first:**
- File: `cli/test/req-dep-graph.test.js`
- Description: Test that `--root=REQ-003` outputs only the ancestor subgraph.
- Test code sketch:
```js
it("outputs ancestor subgraph with --root", () => {
  const dir = withFixture(GRAPH_PRD);
  const result = run(
    ["req", "dep", "graph", "--root=REQ-003"],
    { cwd: dir },
  );
  assert.equal(result.exitCode, 0);
  const graph = JSON.parse(result.stdout);
  // Should include REQ-003, REQ-002, REQ-001 (ancestors)
  // Should NOT include REQ-004 (not an ancestor of REQ-003)
  assert.ok("REQ-003" in graph);
  assert.ok("REQ-002" in graph);
  assert.ok("REQ-001" in graph);
  assert.ok(!("REQ-004" in graph));
});

it("exits 1 when --root ID does not exist", () => {
  const dir = withFixture(GRAPH_PRD);
  const result = run(
    ["req", "dep", "graph", "--root=REQ-999"],
    { cwd: dir },
  );
  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /REQ-999/);
});

it("outputs single-node graph when root has no dependencies", () => {
  const dir = withFixture(GRAPH_PRD);
  const result = run(
    ["req", "dep", "graph", "--root=REQ-004"],
    { cwd: dir },
  );
  assert.equal(result.exitCode, 0);
  const graph = JSON.parse(result.stdout);
  assert.deepEqual(Object.keys(graph), ["REQ-004"]);
  assert.deepEqual(graph["REQ-004"], []);
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: When `--root` is specified, perform BFS/DFS from the root requirement, following dependency edges (dependencies are "points to ancestors" -- follow them to collect the full ancestor set). Include only nodes reachable from root via dependency traversal.

**Verify:**
- Run: `cd cli && node --test test/req-dep-graph.test.js`
- Expected: All tests pass.
- Quality check: `cd cli && npm run check`

### Step 3: Test and implement --plain and --dot output formats

**Test first:**
- File: `cli/test/req-dep-graph.test.js`
- Description: Test --plain (one edge per line) and --dot (Graphviz DOT) formats.
- Test code sketch:
```js
it("outputs plain text with --plain", () => {
  const dir = withFixture(GRAPH_PRD);
  const result = run(["req", "dep", "graph", "--plain"], { cwd: dir });
  assert.equal(result.exitCode, 0);
  const lines = result.stdout.trimEnd().split("\n");
  // Should contain edges like "REQ-002 -> REQ-001"
  assert.ok(lines.some((l) => l === "REQ-002 -> REQ-001"));
  assert.ok(lines.some((l) => l === "REQ-003 -> REQ-001"));
  assert.ok(lines.some((l) => l === "REQ-003 -> REQ-002"));
});

it("outputs DOT format with --dot", () => {
  const dir = withFixture(GRAPH_PRD);
  const result = run(["req", "dep", "graph", "--dot"], { cwd: dir });
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /digraph/);
  assert.match(result.stdout, /"REQ-002" -> "REQ-001"/);
});

it("plain output is empty (no lines) when no edges exist", () => {
  const prd = structuredClone(GRAPH_PRD);
  prd.requirements = [prd.requirements[0], prd.requirements[3]]; // no deps
  const dir = withFixture(prd);
  const result = run(["req", "dep", "graph", "--plain"], { cwd: dir });
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout.trimEnd(), "");
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: Add output format selection. `--plain`: one line per edge, format `"REQ-X -> REQ-Y"`. Nodes with no edges are omitted. `--dot`: Graphviz digraph with quoted node IDs and edges. `--json` (default): adjacency list object.

**Verify:**
- Run: `cd cli && node --test test/req-dep-graph.test.js`
- Expected: All tests pass.
- Quality check: `cd cli && npm run check`

### Step 4: Test and implement id next

**Test first:**
- File: `cli/test/id-next.test.js`
- Description: Test `id next REQ`, `id next CTX`, `id next ARCH`, and error cases.
- Test code sketch:
```js
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { run, withFixture, MINIMAL_PRD } = require("./helpers.js");

describe("id next", () => {
  it("returns next REQ ID", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["id", "next", "REQ"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    // MINIMAL_PRD has REQ-001 and REQ-002
    assert.equal(result.stdout.trim(), "REQ-003");
  });

  it("returns CTX-001 when no context items exist", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["id", "next", "CTX"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout.trim(), "CTX-001");
  });

  it("returns next ARCH ID", () => {
    const prd = structuredClone(MINIMAL_PRD);
    prd.architecture = [
      { id: "ARCH-001", title: "T", description: "D", level: "context" },
      { id: "ARCH-003", title: "T", description: "D", level: "context" },
    ];
    const dir = withFixture(prd);
    const result = run(["id", "next", "ARCH"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    // Highest existing is ARCH-003, so next is ARCH-004
    assert.equal(result.stdout.trim(), "ARCH-004");
  });

  it("exits 1 for invalid prefix", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["id", "next", "INVALID"], { cwd: dir });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /prefix|REQ|CTX|ARCH/i);
  });

  it("exits 2 when no prefix argument given", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["id", "next"], { cwd: dir });
    assert.equal(result.exitCode, 2);
  });

  it("handles gaps in ID numbering", () => {
    const prd = structuredClone(MINIMAL_PRD);
    // REQ-001, REQ-002 exist. Add REQ-010.
    prd.requirements.push({
      id: "REQ-010",
      title: "Tenth",
      description: "D",
      acceptance_criteria: "Done",
      abstraction_level: "high",
    });
    const dir = withFixture(prd);
    const result = run(["id", "next", "REQ"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    // Next after highest (REQ-010) is REQ-011
    assert.equal(result.stdout.trim(), "REQ-011");
  });
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: Add `id` domain and `next` command to the router. Parse the prefix argument. Look up the appropriate array in the PRD (requirements for REQ, context for CTX, architecture for ARCH). Find the highest numeric suffix among existing IDs, increment by 1, zero-pad to 3 digits. Output the ID string to stdout (no JSON wrapping -- plain string).

**Verify:**
- Run: `cd cli && node --test test/id-next.test.js`
- Expected: All tests pass.
- Quality check: `cd cli && npm run check`

### Step 5: Test and implement schema copy

**Test first:**
- File: `cli/test/schema-copy.test.js`
- Description: Test that `schema copy <dir>` copies the schema and outputs the absolute path.
- Test code sketch:
```js
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { run } = require("./helpers.js");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

describe("schema copy", () => {
  it("copies schema to destination directory", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
    const result = run(["schema", "copy", dir]);
    assert.equal(result.exitCode, 0);

    // Verify file exists
    const destFile = path.join(dir, "prd-schema.json");
    assert.ok(fs.existsSync(destFile));

    // Verify content matches canonical schema
    const canonical = fs.readFileSync(
      path.resolve(__dirname, "../../skills/create-initial-prd/assets/prd-schema.json"),
      "utf8",
    );
    const copied = fs.readFileSync(destFile, "utf8");
    assert.equal(copied, canonical);

    // Verify stdout contains absolute path
    assert.equal(result.stdout.trim(), destFile);
  });

  it("exits 1 when destination directory does not exist", () => {
    const result = run(["schema", "copy", "/nonexistent/path"]);
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /directory|exist/i);
  });

  it("exits 2 when no dest-dir argument given", () => {
    const result = run(["schema", "copy"]);
    assert.equal(result.exitCode, 2);
  });

  it("overwrites existing schema file", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
    fs.writeFileSync(path.join(dir, "prd-schema.json"), "old content");
    const result = run(["schema", "copy", dir]);
    assert.equal(result.exitCode, 0);
    const content = fs.readFileSync(
      path.join(dir, "prd-schema.json"),
      "utf8",
    );
    assert.notEqual(content, "old content");
  });
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: Add `schema` domain and `copy` command to the router. Resolve the canonical schema path relative to the CLI's own location: `path.resolve(path.dirname(process.argv[1]), "../skills/create-initial-prd/assets/prd-schema.json")`. Verify the source exists (exit 2 if not -- broken installation). Verify the destination directory exists (exit 1 if not). Copy the file. Output the absolute path of the destination file to stdout.

**Verify:**
- Run: `cd cli && node --test test/schema-copy.test.js`
- Expected: All tests pass.
- Quality check: `cd cli && npm run check`

### Step 6: Test all three commands with explicit prd-path and --help

**Test first:**
- File: `cli/test/req-dep-graph.test.js`, `cli/test/id-next.test.js` (add to existing)
- Description: Verify prd-path works for graph and id commands. Verify --help for all three.
- Test code sketch:
```js
// In req-dep-graph.test.js
it("accepts explicit prd-path", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
  const prdPath = path.join(dir, "custom.json");
  fs.writeFileSync(prdPath, JSON.stringify(GRAPH_PRD, null, 2));
  const result = run(["req", "dep", "graph", prdPath]);
  assert.equal(result.exitCode, 0);
});

it("prints help on --help", () => {
  const result = run(["req", "dep", "graph", "--help"]);
  assert.equal(result.exitCode, 0);
  assert.match(result.stderr, /--root/);
});

// In id-next.test.js
it("accepts explicit prd-path", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
  const prdPath = path.join(dir, "my.json");
  fs.writeFileSync(prdPath, JSON.stringify(MINIMAL_PRD, null, 2));
  const result = run(["id", "next", "REQ", prdPath]);
  assert.equal(result.exitCode, 0);
});

// In schema-copy.test.js
it("prints help on --help", () => {
  const result = run(["schema", "copy", "--help"]);
  assert.equal(result.exitCode, 0);
});
```

**Implement:**
- File(s): `bin/clif-d`
- Description: Ensure prd-path resolution works for `req dep graph` (note: three-level command, prd-path is still the last .json argument) and `id next` (prd-path after the prefix argument). Add --help text for all three commands. Note: `schema copy` does not use prd-path (it operates on the schema file, not the PRD).

**Verify:**
- Run: `cd cli && node --test test/**/*.test.js`
- Expected: All tests pass (including all prior command tests).
- Quality check: `cd cli && npm run check`

## 5. Acceptance Criteria Verification

- [ ] **REQ-018 criterion:** "Given REQ-005 depends on REQ-003, REQ-003 depends on REQ-001, when `clif-d req dep graph --root=REQ-005`, then stdout contains JSON adjacency list showing REQ-005 -> [REQ-003] and REQ-003 -> [REQ-001]. Exit 0."
  - **Verified by:** `req-dep-graph.test.js` -- full graph (Step 1), rooted subgraph (Step 2), output formats (Step 3)

- [ ] **REQ-021 criterion:** "Given prd.json with requirements up to REQ-012, when `clif-d id next REQ`, then stdout contains REQ-013. Exit 0."
  - **Verified by:** `id-next.test.js` -- next REQ ID (Step 4), gap handling (Step 4), empty namespace (Step 4)

- [ ] **REQ-022 criterion:** "Given a product repo with clif-d/ directory, when `clif-d schema copy clif-d/`, then clif-d/prd-schema.json is created identical to canonical schema. stdout contains absolute path. Exit 0."
  - **Verified by:** `schema-copy.test.js` -- copy and verify (Step 5), overwrite (Step 5)

## 6. Files Created or Modified

| File | Action | Step |
|------|--------|------|
| `cli/test/req-dep-graph.test.js` | Create | 1, 2, 3, 6 |
| `cli/test/id-next.test.js` | Create | 4, 6 |
| `cli/test/schema-copy.test.js` | Create | 5, 6 |
| `bin/clif-d` | Modify | 1, 2, 3, 4, 5, 6 |

## 7. Open Questions and Assumptions

- **Assumption: adjacency list format.** The JSON graph format is `{ "REQ-ID": ["DEP-ID", ...], ... }` where values are the requirement's dependencies (what it depends ON, not what depends on it). This matches the PRD's data model and is intuitive for "what must be done before X?" queries.
- **Assumption: id next uses max+1, not gap-filling.** If IDs are REQ-001, REQ-003 (with a gap), `id next REQ` returns REQ-004 (one past the highest), not REQ-002 (filling the gap). This is simpler and avoids surprising behavior where adding a new requirement gets a lower ID than existing ones.
- **Assumption: schema copy uses fs.copyFileSync.** The simplest approach. No transformation of the schema content. The destination gets an exact byte-for-byte copy.
- **Assumption: --plain graph with no edges outputs empty string.** If the graph has nodes but no edges, `--plain` outputs nothing (empty stdout). This is consistent with "one edge per line" -- zero edges means zero lines. The JSON format still includes all nodes.
