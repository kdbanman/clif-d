# Implementation Plan: bin/README.md Command Reference

**Requirements:** REQ-023
**PRD:** `cli-prd.json`
**Backpressure:** `cli/clif-d/backpressure.md`
**Preceding plans:**
- `cli/clif-d/plans/executed/plan-REQ-008-REQ-009.md` (`req ls`, `req show`)
- `cli/clif-d/plans/active/plan-REQ-010.md` (`req next`)
- `cli/clif-d/plans/active/plan-REQ-011-REQ-012-REQ-013.md` (`req done`, `req start`, `req block`)
- `cli/clif-d/plans/active/plan-REQ-014.md` (`validate`)
- `cli/clif-d/plans/active/plan-REQ-015-REQ-016-REQ-017.md` (`req add`, `req edit`, `req dep add`, `req dep rm`)
- `cli/clif-d/plans/active/plan-REQ-018-REQ-021-REQ-022.md` (`req dep graph`, `id next`; `schema copy` was retired, see superseded REQ-022)
- `cli/clif-d/plans/active/plan-REQ-019-REQ-020.md` (`ctx` and `arch` CRUD)

**Date:** 2026-04-14
**Status:** Draft

## 1. Objective

Author `bin/README.md`, the canonical command reference for `clif-d`. When complete, a developer or agent browsing the plugin repo's `bin/` directory finds a single document describing every command group (`req`, `ctx`, `arch`, `validate`, `id`, `schema`) with exact syntax, flag descriptions, stdout/stderr contracts, and exit-code semantics. The document is verified to match the implemented behavior of `bin/clif-d`.

## 2. Context Summary

### Requirement: REQ-023 -- bin/README.md command reference

**Description:** The `bin/` directory in the plugin repo houses the `clif-d` executable. A README in that directory serves as the canonical command reference for contributors and developers browsing the plugin repo -- distinct from the top-level `README.md` which covers high-level CLIF-D pipeline context. The `bin/README.md` is the place to look when you want to know the exact syntax, flags, and exit codes for any command. It should be generated last, after all commands are stable.

**Acceptance criteria (Given-When-Then):**
- **Given:** All `clif-d` commands (REQ-008 through REQ-022) are implemented and stable.
- **When:** A developer or agent browses the `bin/` directory of the plugin repo.
- **Then:** `bin/README.md` exists and documents every command group (req, ctx, arch, id, schema, validate) with: the full command syntax, all flags and arguments, stdout/stderr contract, and exit code semantics. The document matches the implemented behavior of `bin/clif-d`.

### Command inventory (complete list this README must cover)

Every command below must appear in the README. Source of truth for each is linked so the author can verify behavior against tests and implementation without guessing.

| Command | Implementing requirement | Plan |
|---|---|---|
| `clif-d req ls` | REQ-008 | `plans/executed/plan-REQ-008-REQ-009.md` |
| `clif-d req show` | REQ-009 | same |
| `clif-d req next` | REQ-010 | `plans/active/plan-REQ-010.md` |
| `clif-d req start` | REQ-012 | `plans/active/plan-REQ-011-REQ-012-REQ-013.md` |
| `clif-d req done` | REQ-011 | same |
| `clif-d req block` | REQ-013 | same |
| `clif-d req add` | REQ-015 | `plans/active/plan-REQ-015-REQ-016-REQ-017.md` |
| `clif-d req edit` | REQ-016 | same |
| `clif-d req dep add` | REQ-017 | same |
| `clif-d req dep rm` | REQ-017 | same |
| `clif-d req dep graph` | REQ-018 | `plans/active/plan-REQ-018-REQ-021-REQ-022.md` |
| `clif-d validate` | REQ-014 | `plans/active/plan-REQ-014.md` |
| `clif-d ctx ls` | REQ-019 | `plans/active/plan-REQ-019-REQ-020.md` |
| `clif-d ctx show` | REQ-019 | same |
| `clif-d ctx add` | REQ-019 | same |
| `clif-d ctx edit` | REQ-019 | same |
| `clif-d arch ls` | REQ-020 | same |
| `clif-d arch show` | REQ-020 | same |
| `clif-d arch add` | REQ-020 | same |
| `clif-d arch edit` | REQ-020 | same |
| `clif-d id next` | REQ-021 | `plans/active/plan-REQ-018-REQ-021-REQ-022.md` |

### Cross-cutting conventions to describe once at the top of the README (not per command)

- **Default PRD path.** Every command that reads or writes the PRD accepts an optional trailing `[prd-path]` positional. When omitted, the CLI resolves `clif-d/prd.json` relative to the current working directory. (CTX-009.)
- **stdout / stderr split.** stdout is reserved for data (JSON by default, or TSV with `--plain` where supported). stderr carries diagnostics, error messages, and `--help` output. stdout is always valid JSON (or empty) on exit 0 from commands that claim a JSON contract. (CTX-005.)
- **Exit codes.** 0 = success; 1 = logic/validation error (ID not found, schema violation, dangling reference, cycle, no eligible requirement, etc.); 2 = usage error (missing required argument, PRD file missing or unparseable).
- **stdin.** Commands that mutate the PRD via stdin (`req add`, `req edit`, `ctx add`, `ctx edit`, `arch add`, `arch edit`) accept a single JSON document on stdin read synchronously to EOF. Empty or non-JSON stdin exits 1.
- **Atomic writes.** All mutation commands write via a temp file + rename, preserving the original PRD on validation failure. (ARCH-003.)
- **Schema location.** The CLI resolves `prd-schema.json` relative to its own location (`bin/../skills/create-initial-prd/assets/prd-schema.json`), not the cwd. (ARCH-001.)
- **--help.** Every command supports `--help` / `-h` and prints its usage to stderr, exit 0.

### Relevant architecture decisions

**ARCH-001 -- Plugin bin/ distribution:** The README lives at `bin/README.md` in this plugin repo. It documents the tool that ships alongside it.

**ARCH-002 -- Command routing architecture:** Two-level noun-verb with one three-level subtree (`req dep add|rm|graph`). The README's section structure mirrors this grouping.

### Relevant context items

**CTX-002 -- Single-file distribution.** Worth a one-line mention so readers understand why `bin/` has one binary and one README, and no node_modules.

**CTX-004 -- Claude Code agent persona.** The README's tone is agent-first: terse, machine-friendly examples, zero prose padding. No marketing.

**CTX-005 -- CLI design conventions.** Source of truth for the cross-cutting conventions section.

**CTX-010 -- Quality backpressure guardrails.** The README itself is a plain Markdown file; no lint gate applies. But the examples in it must be accurate -- Step 5 verifies them.

**CTX-011 -- Development environment bootstrap.** Not directly about the README content, but mention the one-liner (`cd cli && npm install`) in an appendix for contributors who want to hack on the CLI.

### Structure of `bin/README.md` (outline)

```
# clif-d

One-paragraph elevator pitch: what clif-d is, who it's for, where the PRD lives.

## Conventions

- Default PRD path: clif-d/prd.json relative to cwd; override with trailing [prd-path].
- stdout vs stderr split.
- Exit codes: 0, 1, 2.
- stdin for mutation-by-document commands.
- Atomic writes.
- --help on every command.

## Commands

### req -- Requirements

- req ls
- req show
- req next
- req start
- req done
- req block
- req add
- req edit
- req dep add
- req dep rm
- req dep graph

### ctx -- Context items

- ctx ls
- ctx show
- ctx add
- ctx edit

### arch -- Architecture items

- arch ls
- arch show
- arch add
- arch edit

### validate

### id next

## Hacking on clif-d

- Source lives at bin/clif-d. Single-file, zero-dep, Node 18+.
- Tests under cli/test/. Run cd cli && npm run check.
- See cli/clif-d/backpressure.md for quality gates.
```

### Per-command documentation template

Each command subsection uses an identical template so readers can skim predictably:

```
#### clif-d <command>

**Synopsis:** `clif-d <command> <ARGS> [flags] [prd-path]`

**Purpose:** One sentence describing what it does.

**Arguments:**
- `ARG-NAME` -- description.

**Flags:**
- `--flag-name` / `-f <value>` -- description.

**stdin:** (if applicable) description.

**stdout:** description of the data contract on success.

**stderr:** description of what appears on the error path.

**Exit codes:**
- `0` -- condition.
- `1` -- condition.
- `2` -- condition.

**Example:**
```
$ clif-d <command> <args>
<stdout>
```
```

Each command has its own tested behavior; the README must transcribe it, not invent it.

### Authoring process

- **Source every behavior from tests and implementation, not the PRD.** The PRD describes intended behavior; `bin/clif-d` plus its tests describe actual behavior. Read each command's implementation and its test file. Where they disagree, treat the tests as authoritative for the documented contract (tests gate commits; the PRD lags merged code).
- **Run each example.** Don't copy example stdout from memory. For each example included in the README, run the command against a throwaway PRD fixture and paste the real output.
- **No invented flags.** If a flag is not in `parseFlags`, do not document it.
- **Short paragraphs, dense tables.** The agent persona (CTX-004) values information density.

### Quality guardrails

The README itself is Markdown; no ESLint / TypeScript / node:test gate applies. But:
- `npx prettier --write bin/README.md` to normalize whitespace.
- Run the full CLI test suite afterwards to confirm the documentation effort did not accidentally touch `bin/clif-d`: `cd cli && npm run check`.
- A final manual review pass is mandatory (Step 5).

### Lessons learned to apply

- **Agent-friendly output is already enforced in the implementation.** The README just needs to accurately report what the CLI does, not advocate for its style.
- **Watch for drift between plan and implementation.** The REQ-008/009 executed plan notes that field order in some `--plain` output differs from the plan's early sketch. For each command, consult the actual `bin/clif-d` behavior (run it) rather than the plan.

## 3. Prerequisites

- **All of REQ-008 through REQ-022 merged.** REQ-023 is terminal documentation -- it cannot be written before the commands exist and stabilize.
- Status at time of planning (2026-04-14):
  - REQ-008, REQ-009: done.
  - REQ-010: planned.
  - REQ-011, REQ-012, REQ-013: planned.
  - REQ-014: planned.
  - REQ-015, REQ-016, REQ-017: planned.
  - REQ-018, REQ-021, REQ-022: planned.
  - REQ-019, REQ-020: planned.
- This plan is therefore parked until those merge. The implementer should check the PRD (`./bin/clif-d req ls --status=done`) to confirm all prerequisite IDs are done before starting.
- Node.js 18+ available. Dev tooling installed (for verification examples).

## 4. Implementation Steps

This plan has a different shape from the prior plans because the deliverable is a Markdown document, not code. TDD does not apply directly -- the "test" for documentation accuracy is running each documented example and comparing to the README.

### Step 1: Verify all prerequisite requirements are done

**Test first:**
- Manual verification.
- Description: Before writing any prose, confirm every REQ-008 through REQ-022 is marked `done` in `cli-prd.json`. Also check for any late-added low-level requirements (REQ-024+) that document a command -- if they exist, decide with the user whether to include them in this pass or defer.
- Check commands:
```bash
./bin/clif-d req ls --status=done | jq -r '.[].id'
./bin/clif-d req ls --status=not_started --abstraction=low
```

**Implement:**
- Nothing to write. If any command is missing, STOP and surface the gap to the user. Do not write documentation for a command that isn't merged.

**Verify:**
- All prerequisite REQ IDs present in the `done` list.

### Step 2: Draft the top-of-file conventions section

**Test first:**
- File: scratch notes (not committed).
- Description: Before touching `bin/README.md`, walk through `bin/clif-d` top-to-bottom and list every cross-cutting behavior: PRD path resolution, stdout/stderr split, exit codes, stdin handling, atomic writes, schema-path resolution, `--help`. Compare to the "cross-cutting conventions" list in this plan's Context Summary. Any new conventions discovered in the code go into the README; any conventions not reflected in code get flagged back to this plan as Open Questions.

**Implement:**
- File: `bin/README.md`
- Description: Write the top of the file: title, one-paragraph elevator pitch, and the `## Conventions` section. Use the outline from Context Summary. Keep the paragraph count minimal.

**Verify:**
- Read the section aloud. Every claim must be checkable with a command example or a line of code. If a claim cannot be checked, delete it.

### Step 3: Document the `req` domain commands

**Test first:**
- Manual per-command verification.
- For each of: `req ls`, `req show`, `req next`, `req start`, `req done`, `req block`, `req add`, `req edit`, `req dep add`, `req dep rm`, `req dep graph`:
  1. Read the corresponding test file in `cli/test/`.
  2. Read the handler in `bin/clif-d`.
  3. Run at least one happy path and one error case against a fixture PRD.
  4. Record the exact stdout/stderr and exit code.

**Implement:**
- File: `bin/README.md`
- Description: For each command in order, write a subsection using the template from Context Summary. Cross-check against tests and implementation as you go. One pass per command -- do not try to batch.
- Key decisions:
  - **Group the three-level commands (`req dep add`, `req dep rm`, `req dep graph`) under a single `### req dep` subheading** if the three share enough to warrant it, or keep them flat -- implementer's call.
  - **Every flag must include short form and value expectations.** Example: `--status, -s <val>` with the explicit enum of accepted values.
  - **Example commands use `clif-d` (not `./bin/clif-d`).** Assume the reader has the plugin installed; document the public surface, not the dev path.

**Verify:**
- For each command subsection, run the example command against a throwaway fixture. Paste actual output into the example block.

### Step 4: Document the `ctx`, `arch`, `validate`, `id`, `schema` commands

**Test first:**
- Same as Step 3, for each of the remaining commands.

**Implement:**
- File: `bin/README.md`
- Description: Add `### ctx`, `### arch`, `### validate`, `### id next` sections. Reuse the template. `ctx` and `arch` are near-mirrors of each other -- write `ctx` first, then adapt for `arch`. Do not collapse them into a single table -- readers scanning the file should be able to find either with Ctrl-F on the command name.

**Verify:**
- Examples run; output matches; no invented flags.

### Step 5: Document the "Hacking on clif-d" appendix

**Test first:**
- Confirm the commands work from a clean clone:
```bash
cd cli && npm install && npm run check
```

**Implement:**
- File: `bin/README.md`
- Description: Add a short appendix pointing to `cli/` for dev setup and to `cli/clif-d/backpressure.md` for quality gates. One short paragraph plus a code block with the bootstrap commands.

**Verify:**
- Fresh clone walk-through (or a clean reset inside a worktree) reproduces every step.

### Step 6: End-to-end proof read and example re-run

**Test first:**
- Full file read; every example re-run against a fresh throwaway fixture.

**Implement:**
- File: `bin/README.md`
- Description: Fix anything the proof read surfaces. Run `npx prettier --write bin/README.md` for whitespace consistency.

**Verify:**
- `cd cli && npm run check` -- confirm no unrelated CLI changes slipped in.
- Every example in the README has been re-run and the transcript matches.
- The README lists every command from the inventory table in Context Summary. Diff the two lists -- they must be identical.

## 5. Acceptance Criteria Verification

- [ ] **REQ-023 criterion:** "bin/README.md exists and documents every command group (req, ctx, arch, id, schema, validate) with: the full command syntax, all flags and arguments, stdout/stderr contract, and exit code semantics. The document matches the implemented behavior of bin/clif-d."
  - **Verified by:**
    - Step 2: cross-cutting conventions section covers exit codes, stdout/stderr split, PRD path, stdin, atomic writes, `--help`.
    - Step 3: every `req` command has a subsection matching the template.
    - Step 4: `ctx`, `arch`, `validate`, `id`, `schema` subsections exist with matching templates.
    - Step 6: end-to-end re-run of every example confirms behavior match.

## 6. Files Created or Modified

| File | Action | Step |
|------|--------|------|
| `bin/README.md` | Create | 2, 3, 4, 5, 6 |

## 7. Open Questions and Assumptions

- **Assumption: behavior-first, PRD-second.** Where implementation and PRD wording disagree (possible after merges), the README documents what the code does today and flags the discrepancy as a follow-up requirement update rather than documenting a behavior that doesn't exist.
- **Assumption: install-based examples.** Examples use `clif-d <command>`, not `./bin/clif-d <command>`. This matches the public surface the plugin distributes. The "Hacking" appendix mentions the dev path.
- **Assumption: no per-command `.md` files under `bin/`.** A single `bin/README.md` is the canonical location. Splitting into a `bin/docs/` directory adds navigation overhead without improving discoverability at CLIF-D's current scale.
- **Open question: should `bin/README.md` regenerate from command `--help` output instead of being hand-authored?** Long-term this is attractive (single source of truth). Short-term it requires a help-output standardization pass and a generator script. Out of scope for REQ-023 -- track as a follow-up in the top-level README TODO list if the manual maintenance burden proves painful.
- **Open question: late-added requirements.** If new low-level requirements (REQ-024+) introduce additional commands before this plan executes, confirm with the user whether to include them or defer.
