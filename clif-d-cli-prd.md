# clif-d CLI -- Product Requirements Document

## Overview

The `clif-d` CLI is a Node.js command-line tool shipped inside the CLIF-D Claude Code plugin via the `bin/` directory. It provides deterministic, token-efficient operations on PRD JSON files (`clif-d/prd.json` in user product repos) so that skills and humans can read, query, and mutate PRD state without hand-editing JSON or asking Claude to parse it.

### Why this tool exists

1. **Every skill that touches prd.json currently asks Claude to parse and rewrite JSON.** This is expensive (tokens), fragile (malformed edits), and nondeterministic (Claude may reformat, reorder, or subtly alter unrelated fields).

2. **Dependency resolution is a documented pain point.** The `plan-requirement` and `implement-plan` skills struggle to determine what has already been implemented (README "Potential Issues"). A CLI that can answer "what is done?" and "what is next?" eliminates the most error-prone step in the pipeline.

3. **Status transitions are safety-critical.** Marking a requirement `done` with the wrong commit SHA, or accidentally setting the wrong requirement's status, corrupts the living document that the entire pipeline depends on. A CLI with validation is safer than freehand JSON editing.

4. **The plugin `bin/` pattern is officially supported.** Files in a Claude Code plugin's `bin/` directory are added to the Bash tool's PATH. Node.js 18+ is guaranteed because Claude Code requires it. No additional runtime dependencies needed.

### Design constraints

- **Node.js only, stdlib only.** No `package.json`, no `node_modules`, no npm install step. The tool uses only Node.js built-in modules (`fs`, `path`, `process`, `child_process`). This is non-negotiable -- the tool must work the moment the plugin is installed.
- **Single file.** The entire CLI is one executable file at `bin/clif-d` with a `#!/usr/bin/env node` shebang. No multi-file architecture, no transpilation.
- **JSON in, JSON out (by default).** Machine-readable output for skill consumption. Human-readable table output available via `--format=table`.
- **No writes without validation.** Every mutation validates the result against the PRD schema before writing. If validation fails, the file is not modified and the tool exits nonzero.
- **Atomic writes.** Write to a temp file, then rename. No partial writes on crash or interrupt.
- **Deterministic formatting.** JSON output uses 2-space indentation and consistent key ordering matching the schema's field order. A `clif-d` write followed by a read produces identical bytes.
- **Operates on any PRD file.** Commands accept an optional `[prd-path]` positional argument. Default: `clif-d/prd.json` relative to cwd.

---

## Command reference

### Global behavior

```
clif-d <domain> <command> [args...] [prd-path]
```

- `prd-path` is always the last positional argument. If omitted, defaults to `clif-d/prd.json`.
- `--format=json` (default) or `--format=table` controls output format for read commands.
- `--quiet` suppresses stdout on success for write commands (exit code still signals result).
- All write commands print the modified object to stdout on success (unless `--quiet`).
- All commands exit 0 on success, 1 on validation/logic error, 2 on file I/O error.

---

### `req` domain -- requirement operations

#### `clif-d req ls [prd-path]`

List requirements with optional filters.

| Flag | Description | Default |
|---|---|---|
| `--status=<value>` | Filter by status: `not_started`, `in_progress`, `done`, `blocked`. Comma-separated for multiple. | all |
| `--abstraction=<value>` | Filter by `high` or `low`. | all |
| `--priority` | Sort by priority (ascending, unranked last). | insertion order |
| `--fields=<list>` | Comma-separated fields to include in output. | `id,title,status,abstraction_level,priority` |
| `--deps` | Include `dependencies` in output. | omitted |

**stdout (JSON, default):** Array of requirement objects with requested fields.
**stdout (table):** Columnar table with one row per requirement.

#### `clif-d req show <REQ-ID> [prd-path]`

Print a single requirement's full object.

**stdout:** The complete requirement object (all fields present in the PRD).
**exit 1:** If REQ-ID does not exist.

#### `clif-d req next [prd-path]`

Print the highest-priority `not_started` requirement whose hard dependencies are all `done`.

Logic:
1. Filter requirements to `status` absent or `not_started`.
2. Exclude any whose `dependencies` array contains a requirement that is not `done`.
3. Among remaining, pick the one with the lowest `priority` value (highest priority). If tied or unranked, pick the first by insertion order.

**stdout:** The full requirement object.
**exit 1:** If no requirement is eligible (all done, all blocked, or unresolved dependencies).

#### `clif-d req start <REQ-ID> [prd-path]`

Set `status` to `in_progress`.

Validation:
- Requirement must exist.
- Current status must be absent, `not_started`, or `blocked` (cannot start an already-done requirement).

#### `clif-d req done <REQ-ID> --commit=<SHA> [prd-path]`

Set `status` to `done` and `implementation_commit` to the given SHA.

Validation:
- Requirement must exist.
- `--commit` is required.
- SHA must be a valid hex string (7-40 chars).

#### `clif-d req block <REQ-ID> [prd-path]`

Set `status` to `blocked`.

Validation:
- Requirement must exist.
- Current status must not be `done` (cannot block a completed requirement).

#### `clif-d req add [prd-path]`

Add a new requirement. Reads a JSON requirement object from stdin.

Behavior:
- Validates the input object against the requirement sub-schema.
- Auto-assigns the next available `REQ-NNN` ID if `id` is omitted.
- Appends to the `requirements` array.
- Validates all `dependencies`, `context_refs`, and `architecture_refs` point to existing IDs.

**stdout:** The added requirement object (with assigned ID).
**stdin:** JSON requirement object (id optional, all other required fields must be present).

#### `clif-d req edit <REQ-ID> [prd-path]`

Update fields on an existing requirement. Reads a partial JSON object from stdin -- only the fields present are updated (merge semantics, not replace).

Validation:
- Requirement must exist.
- Cannot change `id`.
- If `dependencies`, `context_refs`, or `architecture_refs` are provided, validates all referenced IDs exist.
- Result must still pass schema validation.

**stdin:** Partial JSON requirement object (fields to update).
**stdout:** The full updated requirement object.

#### `clif-d req dep add <REQ-ID> <DEP-ID> [prd-path]`

Add a dependency edge: REQ-ID depends on DEP-ID.

Validation:
- Both IDs must exist.
- Must not create a circular dependency (the tool traverses the full graph to check).
- DEP-ID must not already be in REQ-ID's dependencies.

#### `clif-d req dep rm <REQ-ID> <DEP-ID> [prd-path]`

Remove a dependency edge.

Validation:
- Both IDs must exist.
- DEP-ID must be in REQ-ID's dependencies.

#### `clif-d req dep graph [prd-path]`

Print the full dependency graph.

| Flag | Description | Default |
|---|---|---|
| `--root=<REQ-ID>` | Print only the subgraph reachable from this requirement (ancestors). | full graph |
| `--format=json` | Adjacency list: `{ "REQ-001": ["REQ-002", "REQ-003"], ... }` | json |
| `--format=dot` | Graphviz DOT format for visualization. | -- |
| `--format=table` | One row per edge: `REQ-001 -> REQ-002`. | -- |

---

### `ctx` domain -- context item operations

#### `clif-d ctx ls [prd-path]`

List context items.

| Flag | Description | Default |
|---|---|---|
| `--type=<value>` | Filter by type: `non_functional`, `constraint`, `persona`, `domain`, `product_goal`. | all |

**stdout:** Array of context item objects.

#### `clif-d ctx show <CTX-ID> [prd-path]`

Print a single context item's full object.

#### `clif-d ctx add [prd-path]`

Add a context item. Reads JSON from stdin. Auto-assigns next `CTX-NNN` if `id` omitted.

#### `clif-d ctx edit <CTX-ID> [prd-path]`

Update fields on an existing context item. Merge semantics from stdin.

---

### `arch` domain -- architecture item operations

#### `clif-d arch ls [prd-path]`

List architecture items.

| Flag | Description | Default |
|---|---|---|
| `--level=<value>` | Filter by C4 level: `context`, `container`, `component`. | all |

#### `clif-d arch show <ARCH-ID> [prd-path]`

Print a single architecture item's full object.

#### `clif-d arch add [prd-path]`

Add an architecture item. Reads JSON from stdin. Auto-assigns next `ARCH-NNN` if `id` omitted.

#### `clif-d arch edit <ARCH-ID> [prd-path]`

Update fields on an existing architecture item. Merge semantics from stdin.

---

### `validate` domain -- structural integrity checks

#### `clif-d validate [prd-path]`

Run all validation checks on the PRD file. Exits 0 if valid, 1 if issues found.

Checks:
- JSON parses successfully.
- Conforms to prd-schema.json (field types, required fields, patterns).
- All `dependencies` reference existing REQ-IDs.
- All `context_refs` reference existing CTX-IDs.
- All `architecture_refs` reference existing ARCH-IDs.
- No circular dependencies in the requirement graph.
- No duplicate IDs within any ID namespace (REQ, CTX, ARCH).
- Requirements with `status: "done"` have `implementation_commit` set.
- Requirements with `implementation_commit` have `status: "done"`.

**stdout:** Array of issue objects: `{ "level": "error"|"warning", "id": "<entity-id>", "message": "..." }`. Empty array if clean.

---

### `id` domain -- ID utilities

#### `clif-d id next <prefix> [prd-path]`

Print the next available ID for a given prefix (`REQ`, `CTX`, `ARCH`).

**stdout:** e.g. `REQ-014`

Useful for skills that need to know what ID to assign before constructing an object to pipe into `req add`.

---

### `schema` domain -- schema operations

#### `clif-d schema copy <dest-dir>`

Copy the canonical `prd-schema.json` from the plugin's assets to the given directory. This addresses the README TODO about the $schema field pointing into `.claude/` -- skills can use this command to place the schema alongside the PRD as a product artifact.

**stdout:** The path of the copied file.

#### `clif-d schema path`

Print the absolute path to the plugin's canonical `prd-schema.json`. Useful for validation tooling.

---

## Skill integration guide

This section documents how each existing skill should use the CLI, and what existing skill instructions should change or be removed as a result.

### create-initial-prd

**Current behavior:** Claude generates the entire `prd.json` by writing raw JSON directly.

**CLI integration:**

The initial PRD creation is a bulk operation -- the skill generates the whole file at once. The CLI is not the right tool for initial generation. However, two things change:

1. **Schema copying.** After generating `prd.json`, the skill should call:
   ```
   clif-d schema copy clif-d/
   ```
   Then set `$schema` to `"prd-schema.json"` (relative, same directory) instead of a path into `.claude/`.

2. **Post-creation validation.** After writing the file, the skill should call:
   ```
   clif-d validate clif-d/prd.json
   ```
   This replaces any ad-hoc "verify JSON structure" instructions in the skill.

**Skill text changes:**
- **Remove** instructions about manually validating JSON structure against the schema.
- **Add** a final step: "Run `clif-d schema copy clif-d/` and `clif-d validate` to place the schema and verify the PRD."
- **Change** the `$schema` field guidance from a relative path into `.claude/` to `"prd-schema.json"`.

---

### create-architecture

**Current behavior:** Claude reads the full PRD by parsing `prd.json`, then directly edits the JSON to append scaffolding requirements and backfill `architecture_refs` on existing requirements.

**CLI integration:**

1. **Reading the PRD for analysis.** The skill reads the full PRD to understand requirements, context, and architecture. This is a bulk read -- Claude should still read the file directly (the CLI doesn't help with "give me everything").

2. **Adding scaffolding requirements.** Instead of manually inserting JSON into the requirements array:
   ```
   echo '{"title":"Initialize package manifest","description":"...","acceptance_criteria":{...},"abstraction_level":"low","priority":1,"dependencies":["REQ-005"]}' | clif-d req add
   ```
   Repeat for each scaffolding requirement. The CLI auto-assigns IDs and validates.

3. **Adding dependency edges.** Instead of manually editing dependency arrays:
   ```
   clif-d req dep add REQ-012 REQ-011
   ```

4. **Backfilling architecture_refs.** For each requirement that maps to an architecture component:
   ```
   echo '{"architecture_refs":["ARCH-003","ARCH-004"]}' | clif-d req edit REQ-002
   ```

5. **Adding architecture items.** If the skill adds ARCH items to the PRD:
   ```
   echo '{"title":"CLI-to-Core Boundary","description":"...","level":"component"}' | clif-d arch add
   ```

6. **Final validation:**
   ```
   clif-d validate
   ```

**Skill text changes:**
- **Remove** all instructions about "carefully edit the JSON" or "append to the requirements array ensuring valid JSON."
- **Replace** with specific CLI commands for adding requirements, architecture items, and dependency edges.
- **Remove** manual ID assignment instructions; replace with `clif-d id next REQ` or let `req add` auto-assign.
- **Add** final validation step.

---

### design-backpressure

**Current behavior:** Claude reads `architecture.md` and `prd.json`, may add a backpressure constraint context item, and may backfill `context_refs` on requirements.

**CLI integration:**

1. **Check if backpressure context item exists:**
   ```
   clif-d ctx ls --type=constraint
   ```
   Inspect output to see if a backpressure constraint already exists.

2. **Add backpressure context item if missing:**
   ```
   echo '{"title":"Quality backpressure guardrails","description":"...","type":"constraint","reference_link":"clif-d/backpressure.md"}' | clif-d ctx add
   ```

3. **Backfill context_refs on affected requirements:**
   ```
   echo '{"context_refs":["CTX-005"]}' | clif-d req edit REQ-001
   ```
   (Merge semantics means existing context_refs are preserved and the new one is added.)

   Note: merge semantics for array fields needs clarification -- see Open Questions below. If the CLI uses replace semantics for arrays, the skill must read existing refs first and include them in the edit payload.

4. **Final validation:**
   ```
   clif-d validate
   ```

**Skill text changes:**
- **Remove** manual JSON editing instructions for adding context items.
- **Replace** with CLI commands.
- **Add** validation step.

---

### plan-requirement

**Current behavior:** Claude reads the full PRD, recursively resolves the dependency graph, reads executed plans and the codebase to determine what is already implemented. This is the skill with the most documented pain around PRD interaction.

**CLI integration -- this is the highest-value integration:**

1. **Find the next implementable requirement (when user doesn't specify):**
   ```
   clif-d req next
   ```
   This single command replaces the multi-step process of: read all requirements, filter to not_started, check each one's dependencies, determine if dependencies are done.

2. **Show the target requirement with full detail:**
   ```
   clif-d req show REQ-007
   ```

3. **Resolve the dependency subgraph:**
   ```
   clif-d req dep graph --root=REQ-007
   ```
   This gives the full ancestor tree. The skill can then check which ancestors are `done` vs `not_started` by inspecting the graph output, or by:
   ```
   clif-d req ls --status=done --deps
   ```

4. **List done requirements to understand what's already built:**
   ```
   clif-d req ls --status=done --fields=id,title,implementation_commit
   ```
   Combined with `git log` and `git show <sha>`, this gives the skill a complete picture of what exists without guessing.

5. **Set status to in_progress when planning begins:**
   ```
   clif-d req start REQ-007
   ```

6. **Look up context and architecture refs:**
   ```
   clif-d ctx show CTX-003
   clif-d arch show ARCH-002
   ```

**Skill text changes:**
- **Remove** the section instructing Claude to "recursively read dependencies of dependencies until you have the full subgraph" and "identify which dependencies are already implemented by examining the codebase." Replace with CLI commands.
- **Remove** the paragraph about manually parsing prd.json to find the target requirement.
- **Add** a "PRD interrogation" step at the start of the skill that uses CLI commands to gather requirement details, dependency graph, and done-requirement context.
- **Add** guidance to combine `clif-d req ls --status=done` with `git log` and `git show` for understanding implemented state.
- **Keep** the codebase exploration step -- the CLI tells you what *should* be done, git and code reading tell you what *actually* exists. Both are needed.

---

### implement-plan

**Current behavior:** Claude executes the plan, then directly edits prd.json to set `status: "done"` and `implementation_commit: <sha>` on each completed requirement. This is a separate commit from the implementation.

**CLI integration:**

1. **Mark requirement done with commit SHA:**
   ```
   clif-d req done REQ-007 --commit=abc1234
   ```
   This replaces manual JSON editing, adds validation (SHA format, requirement exists, etc.), and ensures atomic writes.

2. **Verify PRD state after update:**
   ```
   clif-d validate
   ```

3. **List what was just completed (for the commit message):**
   ```
   clif-d req show REQ-007 --format=table
   ```

**Skill text changes:**
- **Remove** the section instructing Claude to "open prd.json, find the requirement by ID, set its status field to done, and set implementation_commit to the SHA." This is the most error-prone manual edit in the pipeline.
- **Replace** with: "Run `clif-d req done <REQ-ID> --commit=<SHA>` for each completed requirement."
- **Remove** any instructions about "be careful not to modify other fields" or "preserve JSON formatting" -- the CLI handles this.
- **Keep** the instruction that PRD updates are a separate commit from the implementation commit.

---

### extend-low-level-requirements (planned skill)

This skill doesn't exist yet, but the CLI is designed to support it:

```
# See what's done and what's next
clif-d req ls --status=done --abstraction=high
clif-d req ls --status=not_started --abstraction=low

# Find the next available ID
clif-d id next REQ

# Add new low-level requirements
echo '{"title":"...","description":"...","abstraction_level":"low",...}' | clif-d req add

# Wire up dependencies
clif-d req dep add REQ-020 REQ-019

# Validate
clif-d validate
```

---

### check-clif-d-consistency (planned skill)

This skill maps almost entirely to `clif-d validate`, plus additional cross-artifact checks:

```
# PRD internal consistency
clif-d validate

# List all done requirements and their commits -- cross-check with git
clif-d req ls --status=done --fields=id,title,implementation_commit

# List all requirements without architecture_refs -- potential gaps
clif-d req ls --fields=id,title,architecture_refs
```

The planned skill will need checks beyond what `validate` provides (e.g., checking that `architecture.md` content matches ARCH items in the PRD, that `backpressure.md` configuration matches the backpressure context item). Those are skill-level logic, not CLI logic.

---

### compact-planning-artifacts (planned skill)

Minimal CLI interaction -- this skill works with plan markdown files, not the PRD directly. It may use:

```
# Confirm which requirements are done (to know which plans are safe to compact)
clif-d req ls --status=done --fields=id,implementation_commit
```

---

### workshop-names

**No CLI integration.** This skill does not interact with the PRD.

---

### create-product-concept

**No CLI integration.** This skill produces `concept.md`, not PRD data.

---

## Open questions

### Array merge semantics in `req edit`

When `req edit` receives `{"context_refs": ["CTX-005"]}` and the requirement already has `{"context_refs": ["CTX-001", "CTX-002"]}`, should the result be:

- **Replace:** `["CTX-005"]` (caller must include all desired values)
- **Append:** `["CTX-001", "CTX-002", "CTX-005"]` (deduplicated)

Replace is simpler and less surprising. Append is more convenient for the common "add one more ref" case. Recommendation: **replace semantics by default**, with a `--merge-arrays` flag for append behavior. Skills that want to add a single ref can use the specific `dep add` command (for dependencies) or read-then-write (for context_refs and architecture_refs).

Alternatively: add `clif-d req ref add <REQ-ID> <CTX-ID|ARCH-ID>` and `ref rm` commands parallel to `dep add`/`dep rm`, which avoids the merge question entirely.

### PRD file locking

If two Claude Code sessions (e.g., on different branches) both try to modify the PRD simultaneously, the CLI has no locking mechanism. This is consistent with the README's explicit statement that the PRD is not for cross-machine coordination. Git merge is the conflict resolution mechanism. The CLI does not need file locking.

### Schema versioning

The PRD schema will evolve. The `schema copy` command always copies the version bundled with the current plugin release. If the schema changes in a breaking way, existing PRDs may fail validation. The CLI should report the schema version mismatch clearly but not attempt automatic migration.

### `--format=table` scope

Human-readable table output is useful for developer-facing commands (`req ls`, `req show`). For commands that output complex nested objects (full requirement with cli_spec), table format may not be practical. Consider limiting `--format=table` to `ls` commands and `dep graph`, with `show` always outputting JSON unless a simpler summary format is defined.

---

## Implementation priorities

The commands are not equally valuable. Recommended implementation order based on skill pain points:

**Phase 1 -- Unblock plan-requirement and implement-plan (highest value):**
- `req ls` (with `--status` and `--abstraction` filters)
- `req show`
- `req next`
- `req done` (with `--commit`)
- `req start`
- `req block`
- `validate`

**Phase 2 -- Support PRD mutation by architecture and backpressure skills:**
- `req add` (stdin)
- `req edit` (stdin)
- `req dep add` / `req dep rm`
- `req dep graph`
- `ctx ls` / `ctx show` / `ctx add` / `ctx edit`
- `arch ls` / `arch show` / `arch add` / `arch edit`
- `id next`

**Phase 3 -- Quality of life:**
- `schema copy` / `schema path`
- `--format=table` for all read commands
- `--format=dot` for dep graph

---

## Non-goals

- **Interactive TUI.** The CLI is for scripts and agent consumption, not human browsing. `--format=table` is the concession to human readability.
- **PRD creation from scratch.** The `create-initial-prd` skill generates the first PRD. The CLI operates on existing PRDs.
- **Multi-file operations.** The CLI operates on one PRD file per invocation. Cross-repo or multi-PRD coordination is out of scope.
- **Git operations.** The CLI does not commit, push, or branch. Skills orchestrate git; the CLI orchestrates JSON.
- **External system sync.** No Linear, Jira, GitHub Issues integration. The CLI is the in-repo layer; external coordination is a separate concern (per README "Drawbacks").
