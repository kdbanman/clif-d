# Implementation Plan: Purge non-Claude agent support

**Requirements:** REQ-031
**PRD:** `cli-prd.json`
**Backpressure:** `cli/clif-d/backpressure.md`
**Preceding plans:** none -- this is a cleanup task with no code dependencies.

**Date:** 2026-04-16
**Status:** Draft

## 1. Objective

Remove all non-Claude agent support from this plugin repo. Delete the AGENTS.md and GEMINI.md files (root and bin/), simplify the bootstrap-dev-environment skill to teach only CLAUDE.md generation, and update design docs and the PRD to stop referencing non-Claude agents. The result is a simpler repo where only Claude Code is a supported agent harness.

## 2. Context Summary

### REQ-031 -- Purge non-Claude agent support; Claude-only simplification

**Acceptance criteria (Given-When-Then):**
- **Given:** The repo currently contains AGENTS.md, GEMINI.md, bin/AGENTS.md, bin/GEMINI.md, and multi-agent references across skills, design docs, and the PRD.
- **When:** The purge is complete.
- **Then:** The four non-Claude rules files are deleted. bin/CLAUDE.md no longer references its deleted peers. The bootstrap-dev-environment skill teaches only CLAUDE.md generation. cli/clif-d/dev-environment.md section 8 documents only CLAUDE.md and bin/CLAUDE.md. CTX-011 references only CLAUDE.md. README.md references only CLAUDE.md. No non-Claude agent names appear outside of executed plan files. All quality checks pass.

### Relevant context

- **CTX-011:** Development environment bootstrap. Currently names CLAUDE.md, AGENTS.md, and GEMINI.md as agent rules files. After this plan, names only CLAUDE.md.

### What stays unchanged

- **Executed plans** (`cli/clif-d/plans/executed/`). These are historical records of what was implemented. They accurately describe multi-agent decisions made at the time. Editing them rewrites history.
- **`bin/clif-d` (the CLI)**. The CLI is agent-agnostic by design -- no agent-specific branching. This is correct and does not need changing.
- **`CLAUDE.md`**. Contains no non-Claude references. No changes needed.

## 3. Prerequisites

None. This is a deletion-and-simplification task with no code dependencies.

## 4. Implementation Steps

### Step 1: Delete the four non-Claude rules files

**Action:** Delete these files from the repository:

| File | Reason |
|------|--------|
| `AGENTS.md` | Redundant with `CLAUDE.md`; existed only for non-Claude agent harnesses |
| `GEMINI.md` | Gemini CLI-specific rules file |
| `bin/AGENTS.md` | Pointer file for non-Claude agents; `bin/CLAUDE.md` is the canonical scoped rules file |
| `bin/GEMINI.md` | Same |

**Verify:** `git status` shows all four files deleted. No broken symlinks.

### Step 2: Update `bin/CLAUDE.md` -- remove references to deleted peers

**File:** `bin/CLAUDE.md`

**Change line 26 from:**
```
- Do not modify the top-level `CLAUDE.md`/`AGENTS.md`/`GEMINI.md` for CLI-specific rules. Add to this file (and its `bin/AGENTS.md`/`bin/GEMINI.md` peers) instead.
```
**To:**
```
- Do not modify the top-level `CLAUDE.md` for CLI-specific rules. Add to this file instead.
```

**Verify:** `bin/CLAUDE.md` contains no references to AGENTS.md or GEMINI.md.

### Step 3: Simplify `skills/bootstrap-dev-environment/SKILL.md`

This is the largest change. The skill currently teaches users to generate rules files for many agents. Simplify to Claude-only throughout.

**File:** `skills/bootstrap-dev-environment/SKILL.md`

**3a. Frontmatter description (lines 10-12):**
Change `agent rules files (CLAUDE.md, AGENTS.md, etc.) so that whichever coding agent the user runs inherits clear, terse instructions` to `agent rules files (CLAUDE.md) so that Claude Code inherits clear, terse instructions`.

**3b. Opening paragraph (line 17):**
Change `any coding agent (Claude Code, Gemini CLI, OpenCode, Cline, etc.) invoked on that machine` to `a Claude Code agent invoked on that machine`.

**3c. Philosophy section -- "Agent rules files are part of the environment" (line 51):**
Replace the multi-agent enumeration. Change:
```
The standard mechanism to tell it is a "rules file" - `CLAUDE.md` for Claude Code, `AGENTS.md` for several others, `.cursorrules`, `.windsurfrules`, etc. These are part of the bootstrap because they are how the environment makes itself known to the agent. Do not skip them.
```
To:
```
The standard mechanism to tell it is a "rules file" -- `CLAUDE.md` for Claude Code. This is part of the bootstrap because it is how the environment makes itself known to the agent. Do not skip it.
```

**3d. Interrogation section 4 -- Bootstrap entry point (line 114):**
Change `in `CLAUDE.md` / `AGENTS.md`, and in the dev-environment design document` to `in `CLAUDE.md` and in the dev-environment design document`.

**3e. Interrogation section 5 -- Agent and editor context (lines 118-127):**
Replace the entire multi-agent enumeration. The new section should read:

```
### 5. Agent context

This skill generates a `CLAUDE.md` file for Claude Code. If one already exists, merge rather than overwrite -- the user may have hand-authored content. Research the **current** official guidance on `CLAUDE.md` location, format, and scope before generating. Do not rely on cached knowledge -- conventions move.
```

This eliminates the need to ask which agents are in use -- the answer is always Claude Code.

**3f. Output section -- Agent rules files (lines 236-251):**
Replace the multi-agent generation list. Change:
```
- `CLAUDE.md` at the repo root for Claude Code (project-scoped).
- `AGENTS.md` at the repo root for the multi-agent convention.
- `.cursorrules` or `cursor.rules` for Cursor (check which is current).
- `.windsurfrules` for Windsurf.
- Others as the user named them.
```
To:
```
- `CLAUDE.md` at the repo root for Claude Code (project-scoped).
```

**3g. Generation process step 5 (line 271):**
Change `Generate the agent rules files for each agent the user named, at the location each agent's current documentation specifies. Merge with existing files rather than overwriting.` to `Generate or update `CLAUDE.md` at the repo root. Merge with any existing content rather than overwriting.`

**Verify:** Grep the skill file for `AGENTS.md`, `GEMINI.md`, `Gemini`, `Cursor`, `Windsurf`, `OpenCode`, `Cline`, `Continue`, `Aider`, `Copilot`, `Antigravity`, `cursorrules`, `windsurfrules`, `multi-agent`. Zero matches.

### Step 4: Update `cli/clif-d/dev-environment.md` section 8

**File:** `cli/clif-d/dev-environment.md`

**4a. Agent rules files table (lines 120-128):**
Replace the three-row table and the Antigravity paragraph with a single-row table:

```
| File | Agent | Source |
|------|-------|--------|
| `CLAUDE.md` | Claude Code | Official Claude Code docs. Project-scoped, repo root. Already existed before this skill; a CLI-subproject section was merged in, not a full overwrite. |
```

Remove the Antigravity paragraph entirely (line 128).

**4b. "Content, shared across all three files" paragraph (line 130):**
Change `Content, shared across all three files:` to `Content:`.

**4c. Line 138:**
Remove `CLAUDE.md retains its existing plugin-repo content and gains a "CLI subproject" section appended to the end.` -- this was scaffolding context for the initial multi-file generation.

**4d. Scoped rules table and surrounding text (lines 140-154):**
Replace the three-row scoped rules table with a single row:

```
| File | Loaded when... |
|------|----------------|
| `bin/CLAUDE.md` | Claude Code reads or edits files under `bin/`. Claude Code walks up from the edited file and loads each `CLAUDE.md` it finds. |
```

Replace the surrounding paragraph. Remove the reference to "all three supported harnesses" and the paragraph about Cursor glob-frontmatter patterns and the "fourth harness" contingency (line 154). The new text should say the nested `bin/CLAUDE.md` file provides scoped rules via Claude Code's closest-file-wins walk-up.

**4e. Relaxations section -- Antigravity deferred item (line 162):**
Delete the line: `- **Antigravity-specific rules file deferred** pending authoritative documentation of its rules-file convention. \`AGENTS.md\` covers it if it follows the ecosystem standard.`

**Verify:** Grep the file for `AGENTS.md`, `GEMINI.md`, `Gemini`, `Cursor`, `Windsurf`, `Antigravity`, `Copilot`, `multi-agent`. Zero matches.

### Step 5: Update CTX-011 in `cli-prd.json`

**File:** `cli-prd.json`

Change the CTX-011 description. Replace `agent rules files (CLAUDE.md, AGENTS.md, GEMINI.md)` with `agent rules files (CLAUDE.md)`.

**Verify:** Grep `cli-prd.json` for `AGENTS.md` and `GEMINI.md`. Zero matches.

### Step 6: Update `README.md`

**File:** `README.md`

Change the `bootstrap-dev-environment` row in the skills table (line 13). Replace `agent rules files (CLAUDE.md, AGENTS.md, etc.) so coding agents inherit environment context` with `agent rules files (CLAUDE.md) so Claude Code inherits environment context`.

**Verify:** Grep `README.md` for `AGENTS.md` and `GEMINI.md`. Zero matches.

### Step 7: Final verification sweep

Run a repo-wide grep for non-Claude agent references, excluding `cli/clif-d/plans/executed/`:

```
grep -r --include='*.md' --include='*.json' \
  -E 'AGENTS\.md|GEMINI\.md|\.cursorrules|\.windsurfrules|Antigravity' \
  --exclude-dir='plans/executed' .
```

Expected: zero matches (or only matches inside `cli/clif-d/plans/executed/`, which are historical).

Run quality checks:
```
cd cli && npm run check
```

Expected: all checks pass (no code was changed, only Markdown and JSON).

## 5. Acceptance Criteria Verification

- [ ] **AGENTS.md, GEMINI.md, bin/AGENTS.md, bin/GEMINI.md are deleted** -- verified by Step 1.
- [ ] **bin/CLAUDE.md contains no references to deleted peers** -- verified by Step 2.
- [ ] **bootstrap-dev-environment skill teaches only CLAUDE.md generation** -- verified by Step 3.
- [ ] **cli/clif-d/dev-environment.md section 8 documents only CLAUDE.md and bin/CLAUDE.md** -- verified by Step 4.
- [ ] **CTX-011 references only CLAUDE.md** -- verified by Step 5.
- [ ] **README.md references only CLAUDE.md** -- verified by Step 6.
- [ ] **No non-Claude agent names appear outside executed plans** -- verified by Step 7.
- [ ] **All quality checks pass** -- verified by Step 7.

## 6. Files Created or Modified

| File | Action | Step |
|------|--------|------|
| `AGENTS.md` | Delete | 1 |
| `GEMINI.md` | Delete | 1 |
| `bin/AGENTS.md` | Delete | 1 |
| `bin/GEMINI.md` | Delete | 1 |
| `bin/CLAUDE.md` | Modify (remove references to deleted peers) | 2 |
| `skills/bootstrap-dev-environment/SKILL.md` | Modify (simplify to Claude-only throughout) | 3 |
| `cli/clif-d/dev-environment.md` | Modify (section 8: Claude-only tables and text) | 4 |
| `cli-prd.json` | Modify (CTX-011 description) | 5 |
| `README.md` | Modify (skills table row) | 6 |

No changes to `bin/clif-d`. No changes to executed plans. No code changes.

## 7. Open Questions and Assumptions

- **Assumption:** Executed plans are historical and should not be edited. They contain accurate descriptions of multi-agent decisions made at the time they were written. The git history is the archive.
- **Assumption:** The CLI (`bin/clif-d`) needs no changes. It is already agent-agnostic -- it has no agent-specific code paths. Being agent-agnostic (no branching by agent type) is different from being multi-agent (actively maintaining support for multiple agents). The CLI is the former; the rules files and skills were the latter.
- **Assumption:** `CLAUDE.md` at the repo root already contains everything an agent needs and does not require content to be ported from AGENTS.md. Verified: CLAUDE.md's content is a superset -- AGENTS.md was generated as a parallel summary, not as a source of unique information.
