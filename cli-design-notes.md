# clif-d CLI -- Design Notes

Open questions, non-goals, and implementation phasing rationale.
This document captures decisions that informed the PRD but do not belong in it.

See also:

- `./cli-integration-plan.md`
- `./cli-prd.json`

---

## Open questions

### Array field semantics in `req edit`

When `req edit` receives `{"context_refs": ["CTX-005"]}` and the requirement already has `{"context_refs": ["CTX-001", "CTX-002"]}`, the result should be:

- **Replace:** `["CTX-005"]` -- caller must include all desired values.
- **Append:** `["CTX-001", "CTX-002", "CTX-005"]` -- deduplicated.

The PRD specifies **replace semantics** because it is simpler, less surprising, and consistent with how JSON Merge Patch (RFC 7396) works.
Skills that want to add a single ref must read existing refs first and include them in the payload.

An alternative: add dedicated `clif-d req ref add <REQ-ID> <CTX-ID|ARCH-ID>` and `ref rm` commands, parallel to `dep add`/`dep rm`.
This avoids the merge question for the most common mutation pattern (adding one ref) but increases the command surface.
Worth considering if the read-then-write pattern proves too cumbersome in practice.

### Schema versioning

The PRD schema will evolve.
The `schema copy` command always copies the version bundled with the current plugin release.
If the schema changes in a breaking way, existing PRDs may fail validation.

Options:
1. The CLI reports the mismatch clearly but does not attempt migration.
2. The CLI includes a `schema migrate` command for known migrations.
3. Schema changes are always additive (new optional fields only), so old PRDs remain valid.

Option 3 is the ideal constraint to adopt.
Option 1 is the fallback.
Option 2 is premature.

### `--plain` output scope

Human-readable table output is useful for `ls` commands and `dep graph`.
For `show` commands that output complex nested objects (full requirement with cli_spec and structured acceptance_criteria), table format is awkward.
Consider limiting `--plain` to listing commands, with `show` always outputting JSON.

### Deterministic JSON key ordering

The CLI should write JSON with keys in a stable, predictable order matching the schema's field ordering (id, description, title, acceptance_criteria, ...).
This matters because:
- Git diffs are cleaner when key order doesn't shift between writes.
- Agents parsing the output can rely on consistent structure.

Node.js preserves insertion order for string keys in objects, so this is achievable by constructing output objects with explicit field ordering.

---

## Non-goals

### Interactive TUI

The CLI is for scripts and agent consumption, not human browsing. `--plain` is the concession to human readability.
A TUI would violate CTX-002 (single-file distribution) and CTX-001 (zero dependencies -- TUI libraries are not in Node.js stdlib).

### PRD creation from scratch

The `create-initial-prd` skill generates the first PRD through interrogation.
The CLI operates on existing PRDs.
A `clif-d init` command might seem natural, but the value of the initial PRD comes from the interrogation process, not from scaffolding an empty JSON structure.

### Multi-file operations

The CLI operates on one PRD file per invocation.
Cross-repo or multi-PRD workflows are out of scope.

### Git operations

The CLI does not commit, push, or branch.
Skills orchestrate git; the CLI orchestrates JSON.
Mixing the two would create surprising side effects (a `req done` that also commits would conflict with implement-plan's explicit separate-commit convention).

### External system sync

No Linear, Jira, or GitHub Issues integration.
The README explicitly calls out that the PRD is the in-repo specification layer, not the coordination layer.
External sync is a separate concern.

### Network access

The CLI never makes network requests.
It reads and writes local files only.
This keeps it usable in air-gapped environments and avoids timeout/retry complexity.

---

## Implementation phasing rationale

### Phase 1 -- Unblock plan-requirement and implement-plan

These two skills have the most documented pain around PRD interaction.
The README "Potential Issues" section explicitly calls out their difficulty determining what has been implemented.
Phase 1 delivers the commands they need:

- `req ls` -- survey PRD state
- `req show` -- read a requirement's full detail
- `req next` -- find the next implementable requirement
- `req done` -- mark done with commit SHA
- `req start` -- mark in-progress
- `req block` -- mark blocked
- `validate` -- verify structural integrity

These commands are also the simplest to implement: most are read-only or single-field mutations.

### Phase 2 -- Support PRD mutation by architecture and backpressure skills

Once read and status operations work, add the mutation commands that create-architecture and design-backpressure need:

- `req add` / `req edit` -- append and update requirements
- `req dep add` / `req dep rm` -- manage dependency edges
- `req dep graph` -- visualize dependencies
- `ctx ls` / `ctx show` / `ctx add` / `ctx edit` -- context item operations
- `arch ls` / `arch show` / `arch add` / `arch edit` -- architecture item operations
- `id next` -- ID sequence utility

These are more complex (stdin parsing, referential integrity checks, cycle detection) but lower urgency because the architecture and backpressure skills run less frequently.

### Phase 3 -- Quality of life

- `schema copy` / `schema path` -- schema distribution
- `--plain` for all read commands -- human readability
- `--dot` for dep graph -- visualization

Nice to have, not blocking any skill.
