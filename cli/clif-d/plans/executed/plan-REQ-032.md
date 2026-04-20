# Implementation Plan: Migrate skills from raw PRD edits to clif-d CLI commands

**Requirements:** REQ-032
**PRD:** `cli-prd.json`
**Preceding plans:** `cli/clif-d/plans/executed/plan-REQ-031.md` -- comparable broad mechanical sweep across many Markdown files. Also note `plan-REQ-019-REQ-020.md` and `plan-REQ-018-REQ-021-REQ-022.md` for context on the ctx/arch/schema-copy CLI commands this plan relies on.

**Date:** 2026-04-18
**Status:** Executed
**Implementation commit:** fc589c5

## 1. Objective

Replace every raw PRD read/write directive in the six skills that touch `clif-d/prd.json` with a concrete `clif-d` CLI invocation. After this plan, no skill under `skills/` instructs Claude to hand-edit `clif-d/prd.json`. Skills become token-cheaper, deterministic, and automatically validated against the PRD schema on every mutation.

## 2. Context Summary

### REQ-032 -- Migrate CLIF-D skills from raw PRD edits to clif-d CLI commands

**Acceptance criteria (Given-When-Then), copied verbatim from `cli-prd.json`:**

- **Given:** Skills under skills/ currently contain directives to read, parse, and mutate clif-d/prd.json via raw Read/Edit/Write operations, and the clif-d CLI is feature-complete for every such operation.
- **When:** The migration is complete.
- **Then:** No skill under skills/ contains a directive to hand-edit clif-d/prd.json. implement-plan uses `clif-d req done <REQ-ID> --commit=<sha>` (not raw JSON edits) and also calls `clif-d req start <REQ-ID>` at the top of its flow as an idempotent safety net, ending its PRD work with `clif-d validate`. plan-requirement uses `clif-d req next`, `clif-d req show`, `clif-d req ls --status=done`, and `clif-d req dep graph --root=<ID>` for PRD reads, and transitions the target requirement to in_progress via `clif-d req start` as its final action. create-architecture uses `clif-d arch add` for ARCH items, `clif-d req add` for new scaffolding requirements (embedding dependencies in the payload when known at creation), `clif-d req edit` for architecture_refs backfill on existing requirements, and `clif-d validate` as a final step. bootstrap-dev-environment and design-backpressure each use `clif-d ctx add` for their respective constraint context item and `clif-d req edit` to backfill context_refs, ending with `clif-d validate`. create-initial-prd runs `clif-d validate` after generating the PRD and uses `clif-d schema copy` to resolve the $schema path TODO. Every skill that uses `req edit` documents the replace-semantics gotcha (arrays are replaced wholesale; callers must read-then-write). create-product-concept and workshop-names remain unchanged. Plan-file mv from active/ to executed/ remains a shell op. `clif-d validate cli-prd.json` still exits 0.

### Why this matters

Skills authored before the CLI existed taught Claude to hand-edit JSON. Every such edit costs tokens proportional to the PRD size, risks malformed output, and skips the structural validation the CLI runs on every mutation (referential integrity, acyclicity, ID uniqueness, schema conformance). The CLI is now feature-complete for the full surface area these skills touch.

### CLI commands the migration relies on (all currently implemented; see `cli-prd.json` status fields)

| Command | Purpose | Implementing REQ |
|---|---|---|
| `clif-d req ls [--status=...] [--abstraction=...] [--plain]` | Filtered requirement listing | REQ-008 |
| `clif-d req show <REQ-ID>` | Full JSON object for one requirement | REQ-009 |
| `clif-d req next` | Highest-priority not_started req whose deps are done | REQ-010 |
| `clif-d req start <REQ-ID>` | Transition to in_progress (idempotent) | REQ-012 |
| `clif-d req done <REQ-ID> --commit=<sha>` | Transition to done with mandatory commit SHA | REQ-011 |
| `clif-d validate [prd-path]` | Full structural validation, JSON issue array on stdout | REQ-014 |
| `clif-d req add < requirement.json` | Add a requirement from stdin; auto-assigns REQ-NNN | REQ-015 |
| `clif-d req edit <REQ-ID> < patch.json` | Replace-semantics field update | REQ-016 |
| `clif-d req dep add/rm <REQ> <DEP>` | Single dependency edge management | REQ-017 |
| `clif-d req dep graph --root=<ID>` | Dependency subgraph (JSON/DOT/plain) | REQ-018 |
| `clif-d ctx add/edit/show/ls` | Context item CRUD | REQ-019 |
| `clif-d arch add/edit/show/ls` | Architecture item CRUD | REQ-020 |
| `clif-d schema copy <dest-dir>` | Copy PRD schema into product repo | REQ-022 |

### CLI invariants skills must rely on

- **Default PRD path** is `clif-d/prd.json` relative to CWD; always appears as the last positional argument when overriding.
- **Atomic writes**: every mutation writes to a temp file and atomically renames, so the PRD is never left partial on disk.
- **Structural validation on load** (REQ-029): every command validates the PRD before executing, so reads on a corrupt PRD fail cleanly rather than returning partial data.
- **Exit codes**: 0 success, 1 logic/validation error, 2 usage or fatal I/O error.
- **Replace semantics on `req edit`**: any array field sent in the stdin JSON replaces the existing array wholesale; it is not merged. Callers must read-then-write when extending `architecture_refs` or `context_refs`.

### Current skill state (as of 2026-04-18)

| Skill | Current PRD interaction style | Delta this plan introduces |
|---|---|---|
| `create-initial-prd` | Writes the whole PRD wholesale; "Validate ... for structural correctness" is vague (step 10); `$schema` set as a relative path to the plugin's schema file (step 2) | Name `clif-d validate` explicitly; introduce optional `clif-d schema copy` to resolve the $schema TODO |
| `create-architecture` | Raw append for scaffolding requirements (Part B); raw backfill of `architecture_refs` (Part C) | Route Part B through `clif-d req add`; route Part C through `clif-d req show` + `clif-d req edit`; add `clif-d validate` as final step; mention `clif-d arch add` if new ARCH items emerge |
| `design-backpressure` | Raw add of a constraint context item and raw backfill of `context_refs` (Generation step 2) | Route through `clif-d ctx add` and `clif-d req edit` (read-then-write pattern); add `clif-d validate` as final step |
| `bootstrap-dev-environment` | Raw add of a constraint context item and raw backfill of `context_refs` (Generation step 10, around line 334) | Same pattern as design-backpressure |
| `plan-requirement` | Raw reads across the Exploration phase (§1 "Resolve the requirement graph", §2 "Read preceding plans"); §5 already uses `clif-d req start` and `clif-d req done` inside plan text | Replace raw reads with `clif-d req show`, `clif-d req dep graph --root=<ID>`, `clif-d req ls --status=done`; add a final `clif-d req start <target>` step so the PRD reflects claimed work immediately |
| `implement-plan` | §5 already uses `clif-d req done --commit=<sha>` and `clif-d req start` for status transitions (lines 158-162) | Add a safety-net `clif-d req start` at the top of the flow; add `clif-d validate` before creating the lifecycle commit |
| `create-product-concept` | No PRD interaction | Unchanged |
| `workshop-names` | No PRD interaction | Unchanged |

### What stays raw

- Markdown artifacts (`concept.md`, `architecture.md`, `backpressure.md`, `dev-environment.md`, plan files, lessons-learned files) are free-form prose and have no CLI surface.
- Plan-file `mv` from `clif-d/plans/active/` to `clif-d/plans/executed/` -- the CLI roadmap does not include a `plan archive` command. `implement-plan` step 6 keeps its shell-level move.
- Scaffolding configuration artifacts generated by `bootstrap-dev-environment` (Dockerfile, linter configs, hook scripts, `CLAUDE.md`).
- Initial PRD creation in `create-initial-prd`: `clif-d req add` piecewise would be noisier than one atomic write of the whole document. The skill's output is the first valid PRD; only validation and schema copy become CLI-driven.

## 3. Prerequisites

- The `clif-d` CLI is on PATH. In CLIF-D plugin-installed environments this is automatic (the plugin's `bin/` directory is added to the Bash tool's PATH). In development, invoke as `./bin/clif-d` from the repo root.
- Every CLI command in §2 is implemented and `done` in `cli-prd.json`. Verified before plan creation.
- No concurrent edits to the target SKILL.md files are in flight.
- This plan is Markdown-only. The repo's quality backpressure (`cli/clif-d/backpressure.md`) runs on `bin/clif-d` and `cli/` code; SKILL.md files are not linted or type-checked. "Verification" in this plan means human re-reading and CLI invocation dry-runs, not automated gates.

## 4. High-level Requirements Realized

None. REQ-032 is a low-level requirement with no parent high-level requirement. The motivation lives in the description; no transitions beyond REQ-032's own `in_progress` -> `done` lifecycle are needed.

## 5. Implementation Steps

Each step edits one SKILL.md under `skills/`. Steps are independent and can be executed in any order, though the ordering below groups the simplest first so early progress is visible. Every step has the same verification shape: re-read the edited file cold, mentally execute it against `cli-prd.json`, grep for residual raw-edit language.

**Commit granularity:** one commit per step (six commits total). Each commit touches exactly one `SKILL.md` and carries `Requirement: REQ-032`, `Plan: cli/clif-d/plans/active/plan-REQ-032.md`, and `Step: N/6` trailers. Alternative: one sweep commit across all six skills -- legitimate when the reviewer prefers single-PR diffs, but forfeits bisectability. Default to per-step commits unless the reviewer requests otherwise.

### Step 1: Transition REQ-032 to in_progress

**Action:**
```
clif-d req start REQ-032 cli-prd.json
```

**Verify:**
```
clif-d req show REQ-032 cli-prd.json | grep '"status"'
```
Expected: `"status": "in_progress"`.

No commit for this step -- `clif-d req start` writes the PRD, and the status transition rides with the lifecycle commit at the end (Step 8).

### Step 2: create-initial-prd -- name the CLI in validation and schema steps

**File:** `skills/create-initial-prd/SKILL.md`

**2a.** Step 10 of the Generation process currently reads:

```
10. **Validate** the generated PRD against the schema for structural correctness.
```

Replace with:

```
10. **Validate** the generated PRD by running `clif-d validate clif-d/prd.json`. It prints a JSON array of issue objects to stdout and exits 0 when clean. Fix any errors before handing off -- a non-empty error list means the PRD is rejected by every downstream `clif-d` command (REQ-029 enforces structural validation on every PRD load).
```

**2b.** Step 2 of the Generation process currently reads:

```
2. **Set `$schema`** to the relative path from the PRD file to `assets/prd-schema.json`.
```

Replace with:

```
2. **Copy and reference the schema.** Run `clif-d schema copy clif-d/` from the product repo root to copy the canonical PRD schema into `clif-d/prd-schema.json`. Then set the PRD's `$schema` field to `"prd-schema.json"` (a repo-relative path that works on any machine). This resolves the schema-path portability TODO noted in the top-level README.
```

**Verify:** The skill grep'd for `prd.json` and `schema` mentions only `clif-d validate` and `clif-d schema copy` (no raw file-edit language for these operations). The skill still creates the PRD wholesale via `Write`; this is intentional -- `clif-d req add` piecewise would be more expensive than one atomic write.

### Step 3: create-architecture -- route Part B and Part C through the CLI

**File:** `skills/create-architecture/SKILL.md`

**3a. Part B (around lines 221-243), "Add scaffolding requirements to the PRD":**

Replace the instruction to "Append low-level requirements to `clif-d/prd.json`" with an instruction to add each scaffolding requirement via `clif-d req add`. Keep the "What scaffolding requirements typically cover" and "How to write them" guidance -- only the mechanical add step changes.

Replace the "How to write them" block's final bullets with a concrete invocation pattern:

```
- Use `abstraction_level: "low"` with structured Given-When-Then acceptance criteria -- scaffolding work is concrete and must be unambiguously verifiable.
- Assign dependencies inline in the JSON payload when they are known at creation (the common case for scaffolding). The CLI rejects cycles, self-loops, and duplicate edges, so the payload's `dependencies` array is fully validated.
- Set `architecture_refs` to the relevant ARCH items (repository structure, technology decisions).
- Use `priority: 1` -- scaffolding blocks everything else.
- Include a `cli_spec` where applicable.

For each scaffolding requirement, write the object to a temporary file and pipe it through `clif-d req add`, letting the CLI auto-assign the `REQ-NNN` ID:

    cat <<'EOF' > /tmp/req-new.json
    {
      "title": "Initialize package manifest",
      "description": "...",
      "acceptance_criteria": {"given": "...", "when": "...", "then": "..."},
      "priority": 1,
      "abstraction_level": "low",
      "status": "not_started",
      "dependencies": [],
      "architecture_refs": ["ARCH-003"],
      "context_refs": [],
      "cli_spec": { ... }
    }
    EOF
    clif-d req add clif-d/prd.json < /tmp/req-new.json

The command echoes the added requirement (with its assigned ID) to stdout. Record the ID for use in later scaffolding requirements' `dependencies` arrays.

If a scaffolding requirement needs a dependency on another scaffolding requirement added in the same session, add it in the initial payload (recommended) or, if the dependency is discovered later, run `clif-d req dep add <REQ-ID> <DEP-ID>` to extend the edge set. The CLI enforces acyclicity on every add.
```

**3b. Part B -- if new ARCH items emerge during architecture design:**

The existing text does not explicitly discuss adding new ARCH items to the PRD's `architecture` array (create-initial-prd seeds these, and create-architecture primarily consumes and backfills references to them). If, during generation, the architecture work reveals ARCH items missing from the PRD, add them via:

```
cat <<'EOF' > /tmp/arch-new.json
{
  "title": "...",
  "description": "...",
  "level": "component"
}
EOF
clif-d arch add clif-d/prd.json < /tmp/arch-new.json
```

The CLI auto-assigns the next `ARCH-NNN`.

Add a one-paragraph note at the end of Part A (before Part B begins) naming this path explicitly, so an implementer who discovers a missing ARCH item mid-generation knows what to do.

**3c. Part C (around lines 245-252), "Backfill PRD references":**

Replace the current raw-edit instructions with:

```
Now that the architecture document exists, update `clif-d/prd.json` so that existing requirements reference the architecture they relate to:

1. For each requirement that should reference one or more ARCH items, run `clif-d req show <REQ-ID>` to read its current `architecture_refs` array.
2. Compute the **merged** array by taking the union of existing refs and the new refs to add. Do not drop existing refs.
3. Send the merged array through `clif-d req edit`:

    echo '{"architecture_refs": ["ARCH-001", "ARCH-003"]}' | clif-d req edit REQ-007 clif-d/prd.json

   **Gotcha:** `clif-d req edit` uses replace semantics -- the `architecture_refs` array in the stdin JSON replaces the existing array wholesale, it does not merge. You MUST read the current value first and compute the full new array. Omitting a ref that was already present will delete it.

4. Repeat for every requirement that gains an architecture reference.
```

**3d. Part D (around lines 254-260), "Confirm":**

Add a final numbered step before the "Report to the user" bullet:

```
- Run `clif-d validate clif-d/prd.json`. Exit 0 confirms the new scaffolding requirements, dependency edges, and architecture_refs are internally consistent. Any errors must be fixed before handoff.
```

**Verify (step-level):**
- Grep `skills/create-architecture/SKILL.md` for `Append` and `Update `clif-d/prd.json``. Zero remaining hits describing raw JSON edits.
- Grep for `clif-d req add`, `clif-d req edit`, `clif-d validate`, `clif-d arch add`. At least one of each.

### Step 4: design-backpressure -- route context backfill through the CLI

**File:** `skills/design-backpressure/SKILL.md`

**4a. Generation process step 2 (around lines 280-283), "Backfill PRD references":**

Replace with:

```
2. **Backfill PRD references.** The backpressure guardrails are shared constraints that affect all implementation. Update `clif-d/prd.json` via the CLI:

    a. Check whether a backpressure context item already exists: `clif-d ctx ls clif-d/prd.json | grep -i backpressure`. If one exists, record its ID and skip step 2b.

    b. If none exists, create one:

        cat <<'EOF' > /tmp/ctx-backpressure.json
        {
          "title": "Quality backpressure guardrails",
          "description": "<copy or summarize the practitioner-facing guardrail standards and suppression prohibition from clif-d/backpressure.md>",
          "type": "constraint",
          "reference_link": "clif-d/backpressure.md"
        }
        EOF
        clif-d ctx add clif-d/prd.json < /tmp/ctx-backpressure.json

       The CLI echoes the added item with its assigned `CTX-NNN` ID to stdout. Record it as `$CTX_ID` for step 2c.

    c. For every requirement subject to the guardrails (typically all of them), add `$CTX_ID` to the requirement's `context_refs`:

        clif-d req show REQ-007 clif-d/prd.json        # read current context_refs
        echo '{"context_refs": ["CTX-001", "CTX-002", "<CTX_ID>"]}' | clif-d req edit REQ-007 clif-d/prd.json

       **Gotcha:** `clif-d req edit` uses replace semantics. You MUST read the current `context_refs` first and send the full merged array; otherwise existing refs are deleted.

    d. Run `clif-d validate clif-d/prd.json`. Exit 0 confirms all backfilled refs resolve and no invariants were violated.
```

**Verify (step-level):** Grep the file for raw-edit language (`Update `clif-d/prd.json``, `add one (type `constraint`)` outside the CLI block). Zero hits.

### Step 5: bootstrap-dev-environment -- route context backfill through the CLI

**File:** `skills/bootstrap-dev-environment/SKILL.md`

**5a. Generation process (around line 334), "Backfill PRD references":**

Apply the same pattern as Step 4, substituting "dev environment" for "backpressure" in the CTX item content and adjusting the `title`, `description`, and `reference_link` accordingly:

```
10. **Backfill PRD references.** The dev environment is a shared constraint that affects all implementation. Update `clif-d/prd.json` via the CLI:

    a. Check whether a dev-environment context item already exists: `clif-d ctx ls clif-d/prd.json | grep -i "dev environment"`. If one exists, record its ID and skip step 10b.

    b. If none exists, create one:

        cat <<'EOF' > /tmp/ctx-dev-env.json
        {
          "title": "Development environment bootstrap",
          "description": "<copy or summarize the approach from clif-d/dev-environment.md>",
          "type": "constraint",
          "reference_link": "clif-d/dev-environment.md"
        }
        EOF
        clif-d ctx add clif-d/prd.json < /tmp/ctx-dev-env.json

       Record the assigned `CTX-NNN` as `$CTX_ID` for step 10c.

    c. For every requirement that will be implemented inside this environment (typically all of them), add `$CTX_ID` to the requirement's `context_refs`:

        clif-d req show REQ-007 clif-d/prd.json        # read current context_refs
        echo '{"context_refs": ["CTX-001", "<CTX_ID>"]}' | clif-d req edit REQ-007 clif-d/prd.json

       **Gotcha:** `clif-d req edit` uses replace semantics. Read current `context_refs` first and send the full merged array.

    d. Run `clif-d validate clif-d/prd.json`. Exit 0 confirms all backfilled refs resolve.
```

**Verify (step-level):** Same shape as Step 4.

### Step 6: plan-requirement -- route reads through the CLI and set in_progress at plan creation

**File:** `skills/plan-requirement/SKILL.md`

**6a. Exploration §1 "Resolve the requirement graph" (around lines 80-86):**

Replace the "Read its full entry from the PRD" / "Read every item it references" bullets with explicit CLI invocations:

```
For each target requirement:
- Read its full entry: `clif-d req show <REQ-ID> clif-d/prd.json`.
- Walk the blocking-dependency subgraph: `clif-d req dep graph --root=<REQ-ID> clif-d/prd.json` prints the JSON adjacency list of ancestors (requirements that must be done before this one can be implemented). Every ID in that graph should be fetched via `clif-d req show` for full detail.
- Fetch referenced context and architecture items: `clif-d ctx show <CTX-ID>` and `clif-d arch show <ARCH-ID>`.
- Identify which dependencies are already implemented by comparing against `clif-d req ls --status=done --plain clif-d/prd.json`. Cross-check against `git log` for commits touching the relevant code paths.
```

**6b. Exploration §2 "Read preceding plans" (around lines 88-96):**

Leave the file-path references to `clif-d/plans/executed/` and `clif-d/plans/active/` intact -- these are Markdown files, no CLI. Add a one-sentence note that requirement status for preceding work can be cross-checked with `clif-d req ls --status=done`.

**6c. Generation process (around lines 294-302), add a final step:**

After step 6 ("Commit the plan"), add step 7:

```
7. **Transition the target requirement to in_progress.** Run `clif-d req start <REQ-ID>` for each target requirement. This announces that planning (and soon implementation) is underway, so cross-worktree or cross-session agents can see the work is claimed. `implement-plan` will call `clif-d req start` again as an idempotent safety net -- calling it here makes the PRD reflect reality as early as possible.
```

**6d. Exploration §5 "Identify high-level requirements realized" and §5 "Status transition steps" inside Output Structure (lines 243-255):**

These already reference `clif-d req start` and `clif-d req done` -- no change. Leave as is.

**Verify (step-level):** Grep for `Read its full entry from the PRD` -- zero hits (replaced by CLI invocations). Grep for `clif-d req show`, `clif-d req dep graph`, `clif-d req ls --status=done`, `clif-d ctx show`, `clif-d arch show` -- at least one of each.

### Step 7: implement-plan -- add safety-net req start and terminal validate

**File:** `skills/implement-plan/SKILL.md`

The skill's status-transition block at lines 158-162 already uses `clif-d req done --commit=<sha>` and `clif-d req start`. Only two deltas are needed.

**7a. Add a safety-net `clif-d req start` at the top of the skill's execution flow.**

Identify the first step of the "per-step" execution cycle (the one that reads the plan and begins work on step 1 of the plan). Immediately before it, insert:

```
#### 0. Announce work on the target requirement(s)

For each low-level requirement and each partially-realized high-level requirement listed in the plan's §4 "High-level Requirements Realized":

    clif-d req start <REQ-ID> clif-d/prd.json

This is idempotent -- if `plan-requirement` already transitioned the requirement to `in_progress`, the command is a no-op. If the plan was hand-written or skipped that step, this call ensures the PRD reflects claimed work before any code is written.
```

**7b. Add `clif-d validate` before the lifecycle commit.**

In step 8 "Commit the lifecycle updates" (line 175), add a sub-bullet before the commit itself:

```
- Before creating the lifecycle commit, run `clif-d validate clif-d/prd.json`. Exit 0 means the PRD is structurally consistent after all status transitions. If the command reports errors, fix them before committing -- do not ship a corrupt PRD.
```

**7c. (No change needed to steps 6 or 7.)** The plan-file move from `active/` to `executed/` stays a shell `mv`, and the lessons-learned Markdown file stays a raw `Write`. No CLI covers either.

**Verify (step-level):** Grep for `raw JSON`, `hand-editing `prd.json``, or any direct prd.json-edit instruction. Only the prohibition at line 158 remains ("Execute them with the `clif-d req` CLI, never by hand-editing `prd.json`"). Grep for `clif-d validate` -- at least one hit (the new one in step 8).

### Step 8: Close REQ-032

After Steps 2-7 are complete and all six skill files are committed:

```
clif-d req done REQ-032 --commit=<sha> cli-prd.json
```

Where `<sha>` is the SHA of the last commit in the sweep (or a dedicated closing commit if a sweep commit is not used).

Then move this plan file from `cli/clif-d/plans/active/` to `cli/clif-d/plans/executed/` and append `**Implementation commit:** <sha>` to the header. Write a lessons-learned file at `cli/clif-d/plans/lessons_learned/lessons-REQ-032.md` noting any skill patterns that resisted CLI abstraction -- or write a short "nothing notable" note if the sweep was mechanical.

Commit the lifecycle changes (PRD status transition, plan move, lessons file) as a separate commit.

## 6. Acceptance Criteria Verification

Each acceptance-criterion clause from §2 maps to a specific step.

- [ ] **No skill under skills/ contains a directive to hand-edit clif-d/prd.json** -- verified by Step 2-7 final greps. Final repo-wide grep: `grep -rnE "(hand.edit|raw.edit|manually edit).*prd\.json" skills/` should return zero hits.
- [ ] **implement-plan uses `clif-d req done <REQ-ID> --commit=<sha>`** -- already present; preserved by Step 7.
- [ ] **implement-plan calls `clif-d req start` at the top of its flow as a safety net** -- verified by Step 7a.
- [ ] **implement-plan ends its PRD work with `clif-d validate`** -- verified by Step 7b.
- [ ] **plan-requirement uses `clif-d req next`, `clif-d req show`, `clif-d req ls --status=done`, `clif-d req dep graph --root=<ID>`** -- verified by Step 6a. (`clif-d req next` is already recommended for auto-selection in the skill's inputs section; confirm by grep.)
- [ ] **plan-requirement transitions the target requirement to in_progress via `clif-d req start` as its final action** -- verified by Step 6c.
- [ ] **create-architecture uses `clif-d arch add` for ARCH items** -- verified by Step 3b.
- [ ] **create-architecture uses `clif-d req add` for new scaffolding requirements (embedding dependencies in payload)** -- verified by Step 3a.
- [ ] **create-architecture uses `clif-d req edit` for architecture_refs backfill** -- verified by Step 3c.
- [ ] **create-architecture ends with `clif-d validate`** -- verified by Step 3d.
- [ ] **bootstrap-dev-environment uses `clif-d ctx add` and `clif-d req edit`, ending with `clif-d validate`** -- verified by Step 5.
- [ ] **design-backpressure uses `clif-d ctx add` and `clif-d req edit`, ending with `clif-d validate`** -- verified by Step 4.
- [ ] **create-initial-prd runs `clif-d validate` after generating the PRD** -- verified by Step 2a.
- [ ] **create-initial-prd uses `clif-d schema copy` to resolve the $schema path TODO** -- verified by Step 2b.
- [ ] **Every skill using `req edit` documents the replace-semantics gotcha** -- verified by grep across Steps 3c, 4, 5: every `clif-d req edit` instance is accompanied by a "Gotcha: replace semantics" paragraph.
- [ ] **create-product-concept and workshop-names are unchanged** -- `git status` shows no modifications to their SKILL.md files.
- [ ] **Plan-file mv from active/ to executed/ remains a shell op** -- implement-plan step 6 is untouched.
- [ ] **`clif-d validate cli-prd.json` still exits 0** -- run as final verification in §7 below.

## 7. Files Created or Modified

| File | Action | Step |
|------|--------|------|
| `skills/create-initial-prd/SKILL.md` | Modify | 2 |
| `skills/create-architecture/SKILL.md` | Modify | 3 |
| `skills/design-backpressure/SKILL.md` | Modify | 4 |
| `skills/bootstrap-dev-environment/SKILL.md` | Modify | 5 |
| `skills/plan-requirement/SKILL.md` | Modify | 6 |
| `skills/implement-plan/SKILL.md` | Modify | 7 |
| `cli-prd.json` | Modify (REQ-032 status transitions) | 1, 8 |
| `cli/clif-d/plans/active/plan-REQ-032.md` | Move to executed/ | 8 |
| `cli/clif-d/plans/lessons_learned/lessons-REQ-032.md` | Create | 8 |

No source code (`bin/clif-d`, `cli/`) is modified. No tests are added -- SKILL.md files are not under automated quality gates. Verification is human re-reading plus CLI dry-runs.

## 8. Open Questions and Assumptions

- **Assumption:** The CLI's zero-dependency, atomic-write, validate-on-load guarantees are stable contracts that skills can rely on. If any of REQ-008 through REQ-022 are later relaxed or changed, this plan's integration points may need revisiting.
- **Assumption:** Every CLI invocation shown in this plan uses `clif-d/prd.json` as the explicit PRD path. In skills running inside the product repo's root, this is also the CLI's default, so the trailing argument could be omitted. The plan includes it everywhere for clarity; the implementer may omit it if the skill's existing style prefers defaults.
- **Assumption:** Skills do not need a fallback path for environments where the CLI is unavailable. The CLIF-D plugin installs `bin/clif-d` onto the Bash tool's PATH automatically; invocation failures indicate a broken plugin install, not a missing feature. No graceful-degradation prose is warranted.
- **Open question (deferred to implementer):** One sweep commit versus six per-skill commits. Default to per-step commits for bisectability; switch if the reviewer prefers a single-PR diff. Not a blocker.
- **Open question (deferred to implementer):** Exact invocation style in the skill prose -- inline code fences versus prose-embedded backticks versus HEREDOC examples. Match whatever tone the surrounding skill uses. Step 3's HEREDOC form is shown once and referenced thereafter by pattern.
