# `compactify-artifacts` skill improvement plan

# Plan: Improve `compactify-artifacts` per README TODO

## Context

The `compactify-artifacts` skill today reads every file in `clif-d/plans/executed/` and `clif-d/plans/lessons_learned/` in one pass, interrogates the user one lesson at a time as free-form chat, and routes durable lessons to a single append-only durable-lessons log. The README TODO (`/home/user/clif-d/README.md` lines 164-172) flags four problems with this:

1. Trying to compactify everything at once is unwieldy.
2. Commit SHAs need to be load-bearing, and raw originals should be deleted (mostly already true, needs reinforcement).
3. The output destination is vague; it should resolve to one of two places — high-level design docs or glob-scoped `.claude/rules/*.md` files — rather than a single catch-all log.
4. Raw lesson files are low signal-to-noise. The skill should aggressively pre-filter before interrogating the user, and when it does interrogate, it should use a structured question tool (AskUserQuestion) with enough context that a non-coding technical EM could adjudicate.

The intended outcome: a skill that runs more often on smaller slices, silently drops most noise, escalates only high-signal candidates with durable-lesson context, and routes survivors into the two canonical destinations. Retiring the old durable-lessons log ripples through the README's layout tree, artifact-lifecycle list, and skills-table description, and across the rest of the repo wherever it is mentioned.

## Files to modify

- `/home/user/clif-d/skills/compactify-artifacts/SKILL.md` — substantive rewrite (sections below).
- `/home/user/clif-d/README.md` — remove `lessons.md` from layout (line 57), prose (line 70), artifact-lifecycle item 10 (lines 83-85), skills-table description (line 15); add `.claude/rules/` convention mention; remove the resolved TODO entry (lines 164-172).

No new files. No `references/` directory added to the skill — the extra guidance fits in SKILL.md without bloating it past peer skills.

## Design changes to `compactify-artifacts/SKILL.md`

### 1. Philosophy revisions

Keep §"Compactness is the point", §"Git is the long-term record", §"Aggressive cleanup". Rewrite the others:

- **"Lessons earn their place by interrogation"** → rename to **"Pre-filter hard, then interrogate"**. State that most raw lesson content is noise and is dropped silently without reaching the user. Explicitly list auto-discard criteria: single-incident typos or transient confusion, anything the existing backpressure system (lint, type-check, test, format, pre-commit hook) already catches, anything that did not generalize past the specific step. Only candidates that pass pre-filter reach the user.
- **"Side effects are flagged, not applied"** → replace with **"Lessons route to their destination, with per-lesson authorization"**. The skill edits upstream design docs and writes `.claude/rules/*.md` files directly, but only after explicit per-lesson AskUserQuestion approval. User approval is the "deliberate change" the authoritative docs require; it is not a silent amendment. Cross-document contradictions noticed during reading that are not tied to a specific promoted lesson remain findings-only (the old philosophy still applies to drift noticed in passing).
- Add **"Scope a chunk, not the pile"**: the skill picks a small, coherent slice of executed plans (temporal, thematic, or dependency-linked) and leaves the rest for a future run. Running often on small slices is the intended cadence.

### 2. Interrogation section restructured

Replace the current §1-§5 with this sequence:

1. **Inventory** — list all files in `clif-d/plans/executed/` and `clif-d/plans/lessons_learned/`. If empty, exit.
2. **Chunk proposal** — cluster the inventory by:
   - Temporal proximity (same week / same feature arc in `git log`)
   - Module overlap (plans that touched the same files — read plan headers and check `git log -- <paths>`)
   - Requirement-dependency chains (via `clif-d req` CLI or reading `prd.json`)
   Propose one chunk (default: oldest 3-5 plans or the smallest coherent cluster) with a one-line rationale. Use AskUserQuestion with options: accept, expand, narrow, pick a different cluster. Scope confirmed here is the hard boundary for the rest of the run.
3. **Per-plan summary** — for each plan in the confirmed chunk: read plan header, read matching `lessons-REQ-NNN.md`, identify implementation and lifecycle commit SHAs via `git log -- clif-d/plans/executed/plan-REQ-NNN.md`, cross-check against `prd.json` `implementation_commit`, draft one-paragraph summary. Verify each SHA with `git cat-file -e`.
4. **Silent lesson pre-filter** — for each lesson in each lessons-learned file in the chunk, classify it internally:
   - **Auto-discard**: one-off typo, transient confusion, caught-by-backpressure, non-generalizable single-incident.
   - **Candidate**: meets at least one durability bar (recurring pitfall, regression-prone pattern, skill-instruction gap, reversed decision) AND is not already caught by existing backpressure rules AND would save future time or prevent a class of mistake.
   Do not present auto-discards to the user. Log count to the chat only.
5. **Candidate interrogation** — for each surviving candidate, issue one AskUserQuestion with structured payload:
   - **Context**: what happened, written so a technical engineering manager could adjudicate without opening any file. Two to four sentences. Name the plan (REQ-ID) and any relevant module names, but no code snippets unless irreducible.
   - **Why this is a candidate**: which durability bar it meets and why it is likely to save meaningful time or prevent a recurring class of mistake. One or two sentences.
   - **Why it might not be**: the strongest counter-case (e.g., "the underlying pattern only appeared once and may not recur", "duplicates an existing rule already in `backpressure.md` §X or `architecture.md` §Y"). One sentence.
   - **Suggested destination** (proposed by the skill, confirmed by the user's answer):
     - A specific section of `clif-d/architecture.md`, `clif-d/backpressure.md`, `clif-d/dev-environment.md`, or `clif-d/prd.json` (name the exact heading), OR
     - A new or existing `.claude/rules/<topic>.md` file with a proposed `globs:` frontmatter pattern.
   - **Options** (AskUserQuestion choices): accept-as-proposed, redirect-to-different-destination, rephrase, discard.
6. **Cross-document drift scan** — lightweight pass over `architecture.md`, `backpressure.md`, `dev-environment.md`, `prd.json` to flag contradictions with what shipped that did NOT surface through a promoted lesson. These remain findings-only (no edits); listed in the final report.
7. **Confirmation summary** — before any writes, present the full plan of action: plans to archive, lessons to discard, lessons to promote with their destinations, and contradiction findings. Wait for explicit confirmation.

### 3. Output section restructured

Three outputs (was three; shape changes):

- **Output 1 — Compact archive entries** in `clif-d/plans/archive/plan-<req-ids>.md`. Mostly unchanged from today. Reinforce that SHAs are mandatory and verified with `git cat-file -e`. Remove the "Lessons promoted from this plan" back-pointer to the old durable-lessons log; replace with pointers to the specific design-doc sections or `.claude/rules/<topic>.md` files the plan's lessons were routed to.
- **Output 2 — Routed lessons**. For each user-approved candidate:
  - If destination is a design doc: edit the named section directly. Write the durable phrasing decoupled from the specific incident.
  - If destination is `.claude/rules/<topic>.md`: create (with `globs:` frontmatter) or append to the file in the product repo. Include a short "why" so a future reader hitting that glob understands why the rule exists. Note that `.claude/rules/` is the harness-convention scoped-rule location referenced in `README.md` line 167; existing precedent in the plugin repo is `cli/clif-d/plans/executed/plan-REQ-027.md`.
- **Output 3 — Findings** (chat + commit message only). Same spirit as today: stale upstream docs, implied new requirements (often new backpressure rules), recommended downstream skill to run. No silent amendments.

### 4. Generation process

Minor updates to existing numbered steps:

- Verify every SHA with `git cat-file -e` before writing archive entries (already there, keep).
- Apply design-doc edits and create/append `.claude/rules/*.md` files only for user-approved candidates.
- Delete originals only for plans in the confirmed chunk. Untouched plans remain for a future run.
- Commit message restates: chunk contents (req IDs), candidate counts (presented / promoted / discarded), per-lesson destinations, findings.

## README changes

- Line 15 (skills table `compactify-artifacts` row): rewrite to reflect chunked operation, dual output routes, no `lessons.md`.
- Line 38 (pipeline diagram caption): update from "clears executed/ and lessons_learned/" to "compacts a chunk of executed/ and lessons_learned/; runs periodically".
- Line 57 (layout tree): remove the `lessons.md` line.
- Line 70 (prose paragraph): remove the "The `lessons.md` log sits alongside them..." sentence; replace with a sentence introducing `.claude/rules/*.md` as the scoped-rules destination for tactical lessons and noting that strategic lessons are merged into the upstream design docs.
- Lines 83-85 (artifact-lifecycle item 10): delete.
- Lines 164-172 (TODO entry for compactify-artifacts improvements): delete the entire bullet.

## Critical files to read/reference while editing

- `/home/user/clif-d/skills/compactify-artifacts/SKILL.md` — current skill (full rewrite of §Philosophy, §Interrogation, §Output, minor edits to §Generation process).
- `/home/user/clif-d/skills/implement-plan/SKILL.md` lines 167-176 — source of truth for what the skill consumes (what `implement-plan` writes to executed/ and lessons_learned/).
- `/home/user/clif-d/skills/plan-requirement/SKILL.md` — tone/structure reference (peer skill).
- `/home/user/clif-d/skills/design-backpressure/SKILL.md` — light skim only, just enough to capture the essence of backpressure-catchable issues (e.g., lint violations, type errors, formatter output) for one or two illustrative auto-discard examples in the new philosophy section.
- `/home/user/clif-d/cli/clif-d/plans/executed/plan-REQ-027.md` lines 128-145 — existing precedent for `.claude/rules/<name>.md` file format and glob frontmatter.
- `/home/user/clif-d/README.md` — sections noted above.
- `/home/user/clif-d/CLAUDE.md` — style constraints: ASCII only, no emojis, no em dashes, match sibling skill tone.

## Verification

This is a plugin repo with no build/test suite; verification is reading for consistency.

1. Read the rewritten `SKILL.md` end to end. Check that philosophy, interrogation, output, and generation-process sections match the order and tone of `implement-plan/SKILL.md` and `plan-requirement/SKILL.md`.
2. Confirm every mention of `lessons.md` (the retired top-level log file -- not `lessons-REQ-NNN.md` files in `plans/lessons_learned/`) is removed from the entire repo. Verified via `Grep "lessons\.md"` returning zero matches. Today the matches are concentrated in `README.md` lines 17, 57, 70, 85 and across `skills/compactify-artifacts/SKILL.md`; no stray references exist elsewhere in the repo (checked against `cli/`, other skills, and `.claude-plugin/`).
3. Confirm every mention of `.claude/rules/*.md` matches the precedent in `cli/clif-d/plans/executed/plan-REQ-027.md` (frontmatter shape, directory location in the product repo).
4. Confirm no `\u2014` (em dash) characters and no non-ASCII / emoji content: `grep -nP '[^\x00-\x7F]' skills/compactify-artifacts/SKILL.md README.md` should return nothing.
5. Confirm the pipeline diagram in README still reads coherently after the caption edit.
6. Confirm the README artifact-lifecycle list renumbering is correct (items 1-9 remain, old item 10 removed).
7. Role-play: imagine invoking the revised skill against a project with 10 executed plans. Does §Interrogation §2 (chunk proposal) give a clear chunk? Does §5 (candidate interrogation) produce EM-readable questions? Does §Generation process leave the un-chunked plans untouched?
8. Commit and push to `claude/improve-compactify-skill-J2ogJ` once the user approves the plan.
