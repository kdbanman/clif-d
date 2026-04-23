# clif-d CLI -- Skill Integration Plan

How each existing skill should call the CLI, and what existing skill instructions should change.

- `./cli-design-notes.md`
- `./cli-prd.json`

---

## create-initial-prd

**Current behavior:** Claude generates the entire prd.json by writing raw JSON.

**CLI calls to add:**

The initial PRD is a bulk creation -- the CLI is not the right tool for generating it from scratch.
Two post-creation steps change:

```bash
# Copy the schema into the product repo so $schema is repo-relative
clif-d schema copy clif-d/

# Validate the generated PRD
clif-d validate clif-d/prd.json
```

**Skill text changes:**
- CHANGE the `$schema` guidance in the "Generation process" section.
  Currently tells the skill to set `$schema` to a relative path pointing at the plugin's `assets/prd-schema.json`.
  Should instead instruct: "Run `clif-d schema copy clif-d/` to place the schema alongside the PRD, then set `$schema` to `prd-schema.json`."
- ADD a final step to the generation process: "Run `clif-d validate` to verify the PRD."
- REMOVE any ad-hoc "validate the JSON structure" instructions -- the CLI validate command replaces them.

---

## create-architecture

**Current behavior:** Claude reads the full PRD by parsing prd.json.
Directly edits the JSON to append scaffolding requirements and backfill architecture_refs on existing requirements.

**CLI calls to add:**

```bash
# Read PRD for analysis (still read the file directly for bulk analysis)
# No CLI needed here -- Claude reads prd.json as a whole document.

# Add scaffolding requirements (one per call, auto-assigns IDs)
echo '{"title":"Initialize package manifest","description":"...","acceptance_criteria":{"given":"...","when":"...","then":"..."},"abstraction_level":"low","priority":1}' | clif-d req add

echo '{"title":"Create directory skeleton","description":"...","acceptance_criteria":{"given":"...","when":"...","then":"..."},"abstraction_level":"low","priority":1,"dependencies":["REQ-013"]}' | clif-d req add

# Add dependency edges between scaffolding requirements
clif-d req dep add REQ-014 REQ-013

# Backfill architecture_refs on existing requirements
echo '{"architecture_refs":["ARCH-001","ARCH-003"]}' | clif-d req edit REQ-002
echo '{"architecture_refs":["ARCH-002"]}' | clif-d req edit REQ-005

# Add architecture items to the PRD if needed
echo '{"title":"CLI-to-Core Boundary","description":"...","level":"component"}' | clif-d arch add

# Validate
clif-d validate
```

**Skill text changes:**
- REMOVE all instructions about "carefully edit the JSON array" or "append to requirements ensuring valid JSON." These are the most fragile instructions in the skill.
- REPLACE with instructions to use `clif-d req add` (piping JSON to stdin) for each scaffolding requirement and `clif-d arch add` for each architecture item.
- REMOVE manual ID assignment instructions ("find the highest REQ-NNN and increment").
  Replace with: "Let `clif-d req add` auto-assign IDs, or use `clif-d id next REQ` if you need to know the ID before constructing the object."
- REPLACE dependency manipulation instructions with `clif-d req dep add`.
- REPLACE architecture_refs backfilling instructions with `clif-d req edit` calls.
- ADD a final `clif-d validate` step.

---

## design-backpressure

**Current behavior:** Claude reads architecture.md and prd.json.
May add a backpressure constraint context item.
May backfill context_refs on requirements.

**CLI calls to add:**

```bash
# Check if a backpressure context item already exists
clif-d ctx ls --type=constraint

# Add backpressure context item if missing
echo '{"title":"Quality backpressure guardrails","description":"...","type":"constraint","reference_link":"clif-d/backpressure.md"}' | clif-d ctx add

# Backfill context_refs on requirements affected by backpressure
# Note: replace semantics -- must include ALL desired context_refs, not just the new one.
# Read existing refs first if the requirement already has context_refs.
clif-d req show REQ-001  # check existing context_refs
echo '{"context_refs":["CTX-001","CTX-005"]}' | clif-d req edit REQ-001

# Validate
clif-d validate
```

**Skill text changes:**
- REMOVE manual JSON editing instructions for adding context items to the context array.
- REPLACE with `clif-d ctx add` piping JSON to stdin.
- REPLACE context_refs backfilling with `clif-d req show` (to read existing refs) followed by `clif-d req edit` (to write the complete new array).
- ADD validation step.

---

## plan-requirement

**This is the highest-value integration.** The skill currently has the most pain around PRD interaction.

**Current behavior:** Claude reads the full PRD, recursively resolves the dependency graph, reads executed plans and the codebase to determine what is already implemented.

**CLI calls to add:**

```bash
# Step 1: Find the next implementable requirement (when user doesn't specify one)
clif-d req next

# Step 2: Read the target requirement's full detail
clif-d req show REQ-007

# Step 3: Resolve the dependency subgraph (what must be done before this?)
clif-d req dep graph --root=REQ-007

# Step 4: List done requirements to understand what's already built
clif-d req ls --status=done --fields=id,title,implementation_commit

# Step 5: Cross-reference done requirements with git history
# (combine CLI output with git commands for full picture)
clif-d req ls --status=done --fields=id,implementation_commit --plain
# then: git show <sha> for each relevant commit

# Step 6: Look up context and architecture items referenced by the requirement
clif-d ctx show CTX-003
clif-d arch show ARCH-002

# Step 7: Mark the requirement as in-progress
clif-d req start REQ-007
```

**Skill text changes:**
- REMOVE the instruction block (currently around lines 80-83 of plan-requirement/SKILL.md) that says: "Read its full entry from the PRD (description, acceptance criteria, CLI spec, dependencies, context refs, architecture refs).
  Read every item it references: dependency requirements, context items, architecture items.
  Recursively read dependencies of dependencies until you have the full subgraph.
  Identify which dependencies are already implemented (by examining the codebase) and which are not."
- REPLACE with a "PRD interrogation" step that uses the CLI commands listed above.
  The new instruction should emphasize the two-source pattern: the CLI tells you what SHOULD be done (requirement state), git and code reading tell you what ACTUALLY exists (implementation state).
  Both are needed.
- ADD explicit guidance to use `clif-d req ls --status=done` combined with `git log` and `git show` for understanding implemented state.
  This addresses the README "Potential Issues" item directly.
- KEEP the codebase exploration step -- the CLI doesn't replace reading code, it replaces parsing PRD JSON.
- KEEP the executed-plans reading step (clif-d/plans/executed/) -- those provide implementation detail the CLI doesn't have.
- ADD `clif-d req start REQ-NNN` as a step when planning begins.

---

## implement-plan

**Current behavior:** Claude executes the plan, then directly edits prd.json to set status to "done" and implementation_commit to the commit SHA.
This is a separate commit from the implementation.

**CLI calls to add:**

```bash
# After implementation is complete and committed:

# Mark each completed requirement as done with the commit SHA
clif-d req done REQ-007 --commit=abc1234def5678

# Validate the PRD
clif-d validate

# Then commit the PRD change (separate commit, as before)
```

**Skill text changes:**
- REMOVE the instruction block (currently around lines 154-155 of implement-plan/SKILL.md) that says: "Set `status` to `\"done\"`.
  Set `implementation_commit` to the commit SHA from step 4." These two lines describe a manual JSON edit that the CLI replaces entirely.
- REPLACE with: "Run `clif-d req done <REQ-ID> --commit=<SHA>` for each completed requirement, where SHA is the implementation commit from the previous step."
- REMOVE any cautionary language about "be careful not to modify other fields" or "preserve JSON formatting" -- the CLI handles this.
- KEEP the instruction that PRD updates go in a separate commit from the implementation commit.
- KEEP the instruction about moving the plan file from active/ to executed/.
- ADD a `clif-d validate` step before the PRD update commit.

---

## workshop-names

**No CLI integration.** This skill does not interact with the PRD.

---

## create-product-concept

**No CLI integration.** This skill produces concept.md, not PRD data.

---

## Planned skills

### extend-low-level-requirements

Heavy CLI user.
Would use `clif-d req ls` to survey current state, `clif-d req add` to append new low-level requirements, `clif-d req dep add` to wire dependencies, and `clif-d validate` to check the result.

### check-clif-d-consistency

Maps primarily to `clif-d validate` for PRD-internal checks, plus `clif-d req ls --status=done --fields=id,implementation_commit` cross-referenced with `git log` for PRD-to-code consistency.

### compactify-artifacts

Minimal CLI interaction.
May use `clif-d req ls --status=done` to confirm which plans are safe to compact.
