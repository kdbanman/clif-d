# Implementation Plan: Backpressure gates for duplication, function size, and complexity

**Requirements:** REQ-027
**PRD:** `cli-prd.json`
**Backpressure:** `cli/clif-d/backpressure.md` (section 3 Guardrail Decisions, section 6 Hook Architecture)
**Preceding plans:** none -- this plan adds tooling; the code-side refactor in `plan-REQ-024-REQ-026-REQ-028-REQ-029.md` is an independent parallel track. Sequencing note: run the refactor plan *first* so the new gates are introduced against already-clean code and thresholds can be set at the post-refactor baseline.

**Date:** 2026-04-14
**Status:** Draft

## 1. Objective

Add automated pre-commit gates that would have caught the quality issues motivating REQ-024: a copy-paste detector (jscpd) plus ESLint rules for function size, cyclomatic complexity, and nesting depth. Thresholds are tuned to the post-refactor baseline so the gates are hard-caps going forward, not aspirational warnings. The backpressure design document records every new guardrail, its threshold, and its rationale.

## 2. Context Summary

### REQ-027 -- Backpressure gates for duplication, function size, and complexity

**Acceptance criteria (Given-When-Then):**
- **Given:** A commit that introduces a duplicated multi-line block, a function exceeding the size threshold, or a procedure exceeding the complexity threshold.
- **When:** The agent attempts `git commit`.
- **Then:** The pre-commit hook fails with a message identifying the specific violation (duplication location, function size, complexity score). `cli/clif-d/backpressure.md` documents every new guardrail, its threshold, its justification, and any relaxations made to pass the existing codebase at baseline.

### Relevant context

- **CTX-001:** Zero runtime dependencies. New tooling is a devDep only and never bundled into `bin/clif-d`.
- **CTX-002:** Single-file distribution. Gates target one file.
- **CTX-010:** All guardrails must pass pre-commit.
- **CTX-012:** Internal modularity discipline. These gates operationalize CTX-012 -- they are the mechanism that prevents the single-file constraint from degenerating into a single flat script.

### Current guardrails (see `cli/clif-d/backpressure.md` section 3)

Prettier, ESLint (unicorn + n + security), TypeScript checkJs strict, node:test. Pre-commit hook runs `cd cli && npm run check`. Husky-managed, installed by the `prepare` script.

### New guardrails added by this plan

Already documented at the PRD level in `cli/clif-d/backpressure.md` (section 3 table -- added in the same commit series that created this plan). This plan makes them real:

- **jscpd** -- copy-paste detector. DevDep. Run against `bin/clif-d` with a `minLines` threshold tuned so the post-refactor codebase passes cleanly and a single duplicated 5-10 line block triggers a failure.
- **ESLint `max-lines-per-function`** -- set the threshold to the size of the largest post-refactor function plus a small margin. Document the threshold in backpressure.md.
- **ESLint `complexity`** -- cyclomatic complexity cap. Threshold tuned to post-refactor baseline.
- **ESLint `max-depth`** -- nesting depth cap. Threshold: 3 (documented in backpressure.md).

### Error handling conventions

Gate failures exit the pre-commit hook with a nonzero status, blocking the commit. Each tool prints its own violation report to stderr/stdout; no wrapper is needed beyond what `npm run check` already provides.

### Quality guardrails (run from `cli/`)

- `npm run check` -- aggregate. Must include the new gates after this plan.
- Individual: `npm run lint`, and a new `npm run dup` (or similar) for jscpd.

## 3. Prerequisites

- **Strongly preferred:** the code refactor in `plan-REQ-024-REQ-026-REQ-028-REQ-029.md` is executed first. Rationale: if this plan runs first, thresholds must be set loosely enough for today's (duplicated, long-function) code to pass, which defeats the point. After the refactor, set tight thresholds against a clean baseline.
- `cli/package.json` must be able to accept new devDependencies; `npm ci` must be runnable.
- Network access to the npm registry (one-time, at install).

If the refactor plan is not done first, this plan is still executable, but the "Threshold tuning" step must set values generous enough to pass the current code, and a TODO entry must be added to the backpressure document noting that thresholds need tightening after the refactor lands.

## 4. Implementation Steps

### Step 1: Add jscpd as a devDependency and a check script

**Test first:**
- File: `cli/test/backpressure-dup.test.js` (new).
- Description: A test that creates a temporary copy of `bin/clif-d` with a deliberately-duplicated 10-line block appended twice, runs `npx jscpd` against it (or the configured `npm run dup`), and asserts the exit code is nonzero. Also asserts the opposite: running jscpd against the real `bin/clif-d` exits zero. This is the executable proof that the gate works and is tuned correctly.

**Implement:**
- File: `cli/package.json`.
- Add `jscpd` to `devDependencies` (pin a specific version; keep lockfile in sync via `npm install`).
- Add a script: `"dup": "jscpd ../bin/clif-d"` (adjust path or config per tool specifics).
- Add jscpd configuration (either `.jscpd.json` in `cli/` or an entry in `package.json`) with a `minLines` and `minTokens` threshold chosen so the current `bin/clif-d` passes cleanly. Document the threshold and rationale in the backpressure doc (Step 4).
- Wire `npm run dup` into the aggregate `npm run check` script so it runs pre-commit.

**Verify:**
- `cd cli && npm install` succeeds, lockfile updates.
- `npm run dup` against the current tree exits 0.
- The new test in `cli/test/` passes.
- `npm run check` still passes end to end.

### Step 2: Add ESLint function-size, complexity, and depth rules

**Test first:**
- File: `cli/test/backpressure-lint.test.js` (new).
- Description: For each of the three new rules, write a test that creates a tiny fixture file in a tempdir violating only that rule, runs `npx eslint` against it with the project config (ESLint can be pointed at an arbitrary file), and asserts the exit code is nonzero and the stderr/stdout contains the rule name. Also assert that a minimal compliant fixture passes.

**Implement:**
- File: `cli/eslint.config.js`.
- Add to the `rules` block:
  - `"max-lines-per-function": ["error", { max: <N>, skipBlankLines: true, skipComments: true }]`
  - `"complexity": ["error", <M>]`
  - `"max-depth": ["error", 3]`
- Choose `<N>` and `<M>` by running the current lint against `bin/clif-d` with progressively tighter values and settling on the smallest that still passes. Record the chosen values in the backpressure doc (Step 4).

**Verify:**
- `cd cli && npm run lint` against the current tree passes.
- The new test file passes.
- `npm run check` passes.

### Step 3: Verify the gates catch regressions (integration-style)

**Test first:**
- File: extend `cli/test/backpressure-lint.test.js` and `cli/test/backpressure-dup.test.js`.
- Description: For each new gate, add one assertion that demonstrates the *full* pre-commit path fails. Approach: run `npm run check` in a tempdir clone of the tree that has a deliberate violation injected (e.g., a copy of `bin/clif-d` with a single function blown past the size limit). Assert nonzero exit and that the output mentions the rule/tool that caught it.

**Implement:**
- No production code changes. If this step reveals the gates are not actually firing in `npm run check` (e.g., the `dup` script is not wired), fix the wiring.

**Verify:** each gate demonstrably fails the aggregate check when a violation is injected.

### Step 4: Document the new guardrails in `cli/clif-d/backpressure.md`

**Implement:**
- File: `cli/clif-d/backpressure.md`.
- Confirm that section 3 (Guardrail Decisions) table entries for jscpd, `max-lines-per-function`, `complexity`, and `max-depth` are present and that their thresholds match what was wired in Steps 1 and 2. (The table rows were added at PRD time; this step syncs the numbers.)
- Confirm section 6 (Hook Architecture) lists the new checks in the pre-commit order.
- Add to section 4 (Relaxations) any rule tunings required to pass the current tree -- for instance, if `max-lines-per-function` has to be set to an unusually high value before the refactor, record that number and why.
- Update section 8 (Practitioner Quick Reference) with the new `npm run dup` command and a one-line "how to suppress" note for jscpd (the tool supports inline ignore comments; cite the policy from section 5).

**Verify:** doc reads consistently with the actual config. A fresh reader can set up the gates locally from section 8 alone.

### Step 5: Surface the quality-relevant PRD items to coding agents via rules files

Backpressure only bites after code is written. Agents will do a better job if they know which CTX and ARCH items govern implementation style *before* they type anything. This step makes those items discoverable to any coding agent operating in the repo (Claude Code, Cursor, Aider, Codex, etc.) via the agent rules files the repo already ships (`CLAUDE.md`, `AGENTS.md`, and any equivalents the dev-environment document tracks).

**Implement:**
- Files: `CLAUDE.md`, `AGENTS.md` (and any other agent rules files declared in `cli/clif-d/dev-environment.md` -- check that document for the canonical list). If a `.claude/rules/` directory convention is preferred over appending to `CLAUDE.md`, follow whatever convention the dev-environment document already establishes; do not invent a new one.
- Add a short "Implementation style and quality" section (or equivalent) pointing at the PRD items that govern how code should be written in `bin/clif-d`. The section must be short enough that agents read it by default. Specifically name:
  - **CTX-001** -- zero runtime dependencies (never `require`/`import` a non-built-in in `bin/clif-d`).
  - **CTX-002** -- single-file distribution (no splitting `bin/clif-d`, no transpilation).
  - **CTX-010** -- quality backpressure (all four gates run pre-commit).
  - **CTX-012** -- internal modularity discipline (single-file is not a license for a flat script).
  - **ARCH-003** -- read-validate-write cycle for all mutations.
  - **ARCH-004** -- module-object internal structure (frozen namespace objects).
  - **ARCH-005** -- pure-helper testability seam (env-gated export).
- For each listed item, include one sentence naming the item and one sentence stating the behavioral rule it implies, followed by a pointer to `cli-prd.json` as the authoritative source. Do NOT copy the PRD prose into the rules file -- the PRD stays authoritative; the rules file is a signpost.
- Instruct the agent to read the named items from `cli-prd.json` before writing or modifying code in `bin/clif-d`. Use `clif-d ctx show <id>` / `clif-d arch show <id>` if those commands exist; fall back to grep or manual inspection otherwise (check current CLI capabilities).
- Include a one-line pointer to `cli/clif-d/backpressure.md` for the full guardrail list and the practitioner quick reference.

**Rationale:**
The rules file is preventative; the backpressure gates are corrective. Together they close the loop: agents know the rules before writing, and the gates catch lapses before commit. This also improves the feedback quality when a gate fires -- an agent that has already read CTX-012 understands *why* `max-lines-per-function` failed, rather than just grinding against the threshold.

**Verify:**
- A fresh read of `CLAUDE.md` (or equivalent) from the top makes clear which CTX/ARCH items to consult and where they live.
- Pointers resolve: `cli-prd.json` contains every listed ID; `cli/clif-d/backpressure.md` is reachable from the repo root.
- No duplication of PRD prose into the rules file (authority stays with the PRD).

### Step 6: Final pre-commit dry run

**Implement:**
- Make a no-op change in a scratch branch; run `git commit` to confirm the full hook (including the two new gates) fires and passes on clean code.
- Make a deliberately-violating change; confirm the commit is blocked with a clear message.
- Revert the violating change.

**Verify:** pre-commit gates behave identically to the aggregate `npm run check`.

## 5. Acceptance Criteria Verification

- [ ] **A commit with a duplicated multi-line block is blocked with a message identifying the duplication** -- verified by Step 1 test and Step 3 integration check.
- [ ] **A commit with a function exceeding the size threshold is blocked with a message identifying the function** -- verified by Step 2 test and Step 3.
- [ ] **A commit with a procedure exceeding the complexity threshold is blocked** -- verified by Step 2 test and Step 3.
- [ ] **`cli/clif-d/backpressure.md` documents every new guardrail, threshold, justification, and any relaxations** -- verified by Step 4.

## 6. Files Created or Modified

| File | Action | Step |
|------|--------|------|
| `cli/package.json` | Modify (devDependencies, scripts) | 1 |
| `cli/package-lock.json` | Modify (npm install side effect) | 1 |
| `cli/.jscpd.json` or equivalent config | Create | 1 |
| `cli/eslint.config.js` | Modify (add three rules) | 2 |
| `cli/test/backpressure-dup.test.js` | Create | 1, 3 |
| `cli/test/backpressure-lint.test.js` | Create | 2, 3 |
| `cli/clif-d/backpressure.md` | Modify (thresholds, relaxations, practitioner reference) | 4 |
| `CLAUDE.md` | Modify (add implementation-style signpost) | 5 |
| `AGENTS.md` | Modify (same signpost content) | 5 |
| Other agent rules files per `cli/clif-d/dev-environment.md` | Modify (same signpost content) | 5 |

No changes to `bin/clif-d`. No new runtime dependencies (CTX-001 preserved).

## 7. Open Questions and Assumptions

- **Assumption:** jscpd is the correct duplication detector. Rationale: broadly used, zero-config capable, supports JavaScript, runs as a CLI. If the implementer finds it problematic (e.g., noisy on docstring-like JSDoc blocks), an equivalent alternative is acceptable provided it is documented in backpressure.md section 3.
- **Assumption:** Thresholds will be set post-refactor against a clean baseline. If this plan is executed first, the implementer must add a TODO in backpressure.md noting that thresholds are provisional and must be tightened after `plan-REQ-024-REQ-026-REQ-028-REQ-029.md` lands.
- **Assumption:** `max-depth: 3` is tight enough to nudge decomposition without being punishing. If the existing code cannot pass at 3 even after the refactor, raise to 4 and document in section 4 Relaxations.
- **Open question (minor):** Whether to run jscpd against only `bin/clif-d` or also `cli/test/`. Default: `bin/clif-d` only. Tests often legitimately duplicate setup boilerplate; duplication there is less harmful than in production code. Revisit if test duplication becomes painful.
