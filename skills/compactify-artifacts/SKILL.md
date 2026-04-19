---
name: compactify-artifacts
description: >
  Compact a chunk of accumulated CLIF-D execution artifacts (finished implementation plans and
  per-plan lessons-learned files) into terse archive entries and route durable lessons to their
  proper home. Use when `clif-d/plans/executed/` or `clif-d/plans/lessons_learned/` are getting
  onerous and noise is obscuring signal. Each run picks a small, coherent slice (not the whole
  pile), reads each plan and its matching lessons file, consults git history for major commits,
  silently discards low-signal lessons, escalates high-signal candidates to the user one at a
  time with structured options, writes one compact archive entry per plan to
  `clif-d/plans/archive/`, edits the upstream design doc or writes a glob-scoped
  `.claude/rules/*.md` file for each user-approved lesson, flags drift in upstream docs and
  lessons that imply new requirements (without silently amending them), then deletes the
  originals in the chunk. Untouched plans remain for a future run. Active plans are never
  touched.
---

# Compactify Artifacts

You are helping the user clear accumulated planning and execution artifacts. Executed plans and lessons-learned files pile up as a CLIF-D project runs. They are valuable while fresh and become noise within weeks. This skill distills durable signal out of that noise: terse archive entries that point into git history, plus targeted edits to upstream design docs or new glob-scoped `.claude/rules/*.md` files for the rare lessons that earn a permanent home. The skill is opinionated, runs on a small chunk per invocation, ruthless about silently dropping noise, and conservative about touching other documents -- every doc edit is gated by an explicit per-lesson user authorization.

---

## Philosophy

### Compactness is the point

Archive entries should fit in half a page. Lessons worked into a design doc should fit in a short paragraph. A `.claude/rules/*.md` file that grows beyond a few lines stops being a glanceable signpost and starts being context-window weight. If you are tempted to preserve more, ask whether git history already preserves it. It does.

### Git is the long-term record

The full text of every executed plan, every lessons file, every implementation commit message is preserved in git history. The compact archive does not duplicate that detail. Its job is to be **enough of a map** to initiate a deep dive: requirement IDs, the major commit SHAs, the acceptance-criteria checklist, a one-paragraph summary of what shipped. From any of those handles a future reader can `git log`, `git show`, or open the PR and reconstruct whatever level of detail they need.

This is the inverse of the active-plan model. Active plans are self-contained and inlined; archive entries are sparse and indexed. The reader's tools are different.

### Scope a chunk, not the pile

Each invocation handles a small, coherent slice of executed plans -- not the full backlog. A reasonable chunk is 3-5 plans clustered by temporal proximity, module overlap, or a requirement-dependency arc. Leave the rest for the next run. Running this skill often on small slices is the intended cadence; trying to compact everything in one pass produces shallow summaries and exhausts the user's attention before the high-signal lessons get scrutinized.

### Pre-filter hard, then interrogate

Most lessons-learned content is one-off noise: a typo in a config, a momentary misread of an error message, a transient library-API confusion, a lint or type-check violation that the backpressure system would catch on the next commit anyway. Discard that silently. Do not narrate it to the user; do not present it as a discard-or-keep choice. Just count it and move on.

Only lessons that meet at least one of these bars survive pre-filter and reach the user:

- **Recurring tooling pitfalls** -- something that has bitten the project more than once, or is clearly likely to.
- **Patterns that consistently cause regressions** -- a class of bug, not a single instance.
- **Corrections that reveal a gap in a CLIF-D skill's instructions** -- something a future agent would also get wrong.
- **Reversed decisions** -- where the team learned an earlier design choice was wrong and now does the opposite.

Even among survivors, also drop anything already covered by an existing rule (in `backpressure.md`, in `architecture.md`, in an existing `.claude/rules/*.md` file): the duplicate would only dilute the original. The user's attention is the scarcest resource in this skill. Do not spend it on candidates that will not save meaningful time or prevent a class of mistake.

### Lessons route to their destination, with per-lesson authorization

Every surviving lesson has a destination, and the skill writes there directly -- but only after the user explicitly authorizes that specific lesson and that specific destination via the AskUserQuestion tool. The two destinations are:

- **An upstream design doc** (`clif-d/architecture.md`, `clif-d/backpressure.md`, `clif-d/dev-environment.md`, `clif-d/prd.json`, rarely `clif-d/concept.md`) for strategic, system-shaping lessons. Edit the named section directly.
- **A glob-scoped rule file** (`.claude/rules/<topic>.md` in the product repo, with `globs:` frontmatter) for tactical, file-pattern-specific lessons that should re-enter the agent's context only when matching files are touched. See `cli/clif-d/plans/executed/plan-REQ-027.md` for the precedent format used in this plugin repo.

Per-lesson authorization is the deliberate change the authoritative docs require -- it is not a silent housekeeping amendment. Drift noticed in passing that does not correspond to a promoted lesson stays a finding (see Output 3); the user decides what to do with it.

### Aggressive cleanup

After compaction, the originals in `clif-d/plans/executed/` and `clif-d/plans/lessons_learned/` -- but only those that were in the confirmed chunk -- are **deleted**. The durable content is now in the archive entry, in the design doc or rule file the lesson was routed to, and in git history. Keeping the originals around would defeat the whole purpose of compaction -- the directories would still be onerous. If a future reader needs the original detail, they recover it from git. Files outside the confirmed chunk are left untouched for the next run.

---

## Input

This skill expects:

1. **`clif-d/plans/executed/*.md`** -- one or more completed plans written there by `implement-plan`. If empty, exit with a message that there is nothing to compact.
2. **`clif-d/plans/lessons_learned/*.md`** -- per-plan lessons files written by `implement-plan`. May be empty for plans that ran smoothly.
3. **`clif-d/prd.json`** -- to look up requirement context and to confirm `implementation_commit` SHAs recorded against requirements.
4. **The upstream design docs** -- `clif-d/concept.md`, `clif-d/architecture.md`, `clif-d/dev-environment.md`, `clif-d/backpressure.md` -- read for cross-checking against what actually shipped and as candidate destinations for promoted lessons.
5. **The product repo's `.claude/rules/*.md` directory** (if present) -- read existing scoped rule files so promoted lessons can extend them rather than create duplicates.
6. **Git history** -- `git log`, `git show`, `git log -- <path>` to verify implementation commit SHAs, locate the lifecycle commit, and identify any related commits the plan header may have missed.

Do not read or touch `clif-d/plans/active/`. Active plans are mid-flight and outside this skill's scope.

---

## Interrogation

This is a heavily HITL skill. The user's judgment is what separates durable lessons from noise and what authorizes downstream changes. Do not generate any output files, edit any design doc, or write any rule file until interrogation is complete and the user has confirmed the action summary in step 7.

### 1. Inventory

List every file in `clif-d/plans/executed/` and `clif-d/plans/lessons_learned/`. Note for each plan whether a matching lessons file exists, and the plan's date and requirement IDs (parsed from the header). If both directories are empty, exit with a message that there is nothing to compact.

### 2. Chunk proposal

Cluster the inventory and propose one small chunk to compact in this run. Use one or more of these clustering signals:

- **Temporal proximity** -- plans completed in the same week or as part of the same feature push (visible in `git log --diff-filter=A -- clif-d/plans/executed/`).
- **Module overlap** -- plans whose headers list overlapping file paths, or whose implementation commits touched the same files (`git log --name-only <sha>`).
- **Requirement-dependency arc** -- plans whose requirements form a dependency chain in `prd.json`, queryable with `clif-d req dep` if the CLI is available, or by reading the requirement's `dependencies` field directly.

Default chunk size is 3-5 plans, or the smallest coherent cluster, whichever is smaller. Present the proposed chunk with a one-line rationale for the clustering choice. Use the AskUserQuestion tool with options: accept this chunk, expand it to include adjacent plans, narrow it, or pick a different cluster (specify which). The chunk confirmed here is the hard boundary for the rest of the run -- nothing outside it is touched.

### 3. Per-plan summary

For each executed plan in the confirmed chunk:

1. Read the plan's header (requirement IDs, implementation commit SHA, date).
2. Read the matching `lessons-REQ-NNN.md` if it exists.
3. Identify the **major commits** associated with the plan. At minimum: the implementation commit from the plan header and the `implement-plan` lifecycle commit (PRD update + plan move). Use `git log` and `git log -- clif-d/plans/executed/plan-REQ-NNN.md` to confirm they exist and surface any related commits the plan header missed (e.g., follow-up fixes on the same branch). Verify each SHA exists with `git cat-file -e <sha>`.
4. Cross-check the SHAs against `clif-d/prd.json` -- the requirement's `implementation_commit` field should match.
5. Draft a one-paragraph summary of what shipped in plain language: the user-visible behavior, the modules touched, any major design choices.
6. Present the summary to the user for confirmation. Adjust if they redirect.

### 4. Silent lesson pre-filter

Walk through every lesson in every lessons-learned file in the chunk and classify it internally. Do not present this classification to the user.

**Auto-discard** (silent, do not surface):

- Single-incident typos, transient confusion about an error message, momentary library-API misreads.
- Anything the existing backpressure system already catches or would catch (lint violations, type errors, unformatted code, failing tests, missing pre-commit hook checks). The backpressure system is the right venue for those, not a permanent lesson.
- Lessons that did not generalize past the specific step they were observed in -- a one-off observation with no pattern.
- Lessons already covered by an existing rule in `backpressure.md`, `architecture.md`, `dev-environment.md`, or an existing `.claude/rules/*.md` file. The duplicate would only dilute the original.

**Candidate** (survives pre-filter, will be presented to the user):

- Meets at least one of the four durability bars stated in the philosophy section above.
- Is not already caught by existing backpressure or covered by an existing rule.
- Has a plausible argument that recording it will save meaningful future time or prevent a class of mistake.

Tally the discards by category and report the count to the chat (e.g., "discarded 14 lessons: 9 backpressure-catchable, 3 single-incident, 2 duplicates of existing rules"). Do not name them individually. The user does not need that detail.

### 5. Candidate interrogation

For each surviving candidate, issue **one** AskUserQuestion call. Render the question body as labeled bullets so the user can scan it at a glance: each of the four fields below must appear in the user-visible question text with its bold label (`**Context:**`, `**Case for recording:**`, `**Case against recording:**`, `**Suggested destination:**`) and the argumentation inside the bullet. Do not merge the case and the counter-case into a single paragraph -- the contrast is the point.

Structured fields:

- **Context**: what happened, written so a technical engineering manager could adjudicate without opening any file. Two to four sentences. Name the plan (REQ-ID) and any relevant module names; quote code only when irreducible.
- **Case for recording**: which durability bar it meets and why recording it is likely to save meaningful future time or prevent a recurring class of mistake. One or two sentences.
- **Case against recording**: the strongest counter-case (e.g., "the underlying pattern only appeared once and may not recur", "duplicates the spirit of `backpressure.md` section X", "could be addressed by a stronger lint rule rather than a process lesson"). One sentence.
- **Suggested destination**, proposed by the skill:
  - A specific section of `clif-d/architecture.md`, `clif-d/backpressure.md`, `clif-d/dev-environment.md`, `clif-d/concept.md`, or `clif-d/prd.json` (name the exact heading or requirement ID), OR
  - A new or existing `.claude/rules/<topic>.md` file with a proposed `globs:` pattern that scopes which file edits should re-surface the rule.

Provide the user with these AskUserQuestion options:

- **Accept as proposed** -- write the lesson at the suggested destination with the drafted phrasing.
- **Redirect** -- keep the lesson, change the destination (user names the new doc/section or the new `.claude/rules/<topic>.md` file and glob).
- **Rephrase** -- keep the destination, rewrite the lesson body before writing.
- **Discard** -- the user disagrees that this is durable; drop it.

Be ready to be told "discard" often. The bar is high on purpose, and the candidate set was already filtered.

### 6. Cross-document drift scan

Lightweight pass over the upstream design docs to surface contradictions with what shipped that did NOT come up through a promoted lesson:

- Does `clif-d/architecture.md` still describe the system accurately?
- Does `clif-d/backpressure.md` still describe the guardrails as they are actually enforced?
- Does `clif-d/dev-environment.md` still describe the toolchain accurately?
- Does `clif-d/prd.json` still match implemented behavior, or did acceptance criteria drift in code without a corresponding PRD update?

For each contradiction, draft a short note: which document, which section, what is now stale, and the recommended fix or downstream skill to run. These are findings only -- they are not edited by this skill (see Output 3).

### 7. Action summary and confirmation

Before writing any output, present the user with the full plan of action:

- The plans in the chunk, with their drafted one-paragraph summaries.
- The candidate count: how many lessons reached interrogation, how many the user accepted (with their destinations), how many were discarded.
- The discard tally from the silent pre-filter (categories and counts only).
- Drift findings from the cross-document scan.
- Implied new requirements -- typically new backpressure rules -- that the skill noticed but does not act on.

Wait for explicit user confirmation before writing any files or deleting anything.

---

## Output Structure

### Output 1: Compact archive entries

One Markdown file per executed plan, saved at `clif-d/plans/archive/plan-<requirement-ids>.md` in the product repo. Create the `clif-d/plans/archive/` directory if it does not yet exist. Filenames mirror the executed plan's filename so grep across history is easy.

Each archive entry is intentionally sparse. Target half a page or less. Structure:

```markdown
# Compact Archive: <Requirement Title(s)>

**Requirements:** REQ-003, REQ-007
**Implementation commits:** <sha1>, <sha2>
**Lifecycle commit (PRD + plan move):** <sha>
**Date archived:** YYYY-MM-DD
**Source plan:** previously at `clif-d/plans/executed/plan-REQ-003.md` (deleted; recover via `git log --diff-filter=D -- clif-d/plans/executed/plan-REQ-003.md`)

## Summary

One paragraph describing what shipped, in plain language. The user-visible behavior, the modules touched, the major design choices. Enough that a reader can decide whether to dig deeper.

## Acceptance criteria

- [x] "Given X, when Y, then Z" -- verified by `path/to/test::test_name`
- [x] "The tool outputs valid JSON to stdout" -- verified by `path/to/test::test_json`

## Pointers for deep dive

- Implementation: `git show <sha>` (commit on branch `<branch>`, PR `<owner>/<repo>#<num>` if applicable)
- Related follow-up commits: `<sha>`, `<sha>` (if any)
- Test files: `path/to/test_file_1`, `path/to/test_file_2`
- Lessons promoted from this plan: `clif-d/architecture.md` section X (commit `<sha>`); `.claude/rules/<topic>.md` (commit `<sha>`) -- list each routed destination, or "none" if every candidate was discarded
```

The **Pointers for deep dive** section is the load-bearing part. It must contain enough handles -- SHAs, PR numbers, file paths, branch names -- that a future reader can run `git log`, `git show`, or open the PR without guessing. Do not paraphrase commit messages. Do not summarize the diff. Just point. The whole purpose is to make a future deep dive *initiable*, not to perform it preemptively.

### Output 2: Routed lessons

For each candidate lesson the user accepted in interrogation step 5, write the durable phrasing at the destination they confirmed. There are two destination shapes.

#### 2a. Edits into upstream design docs

For strategic, system-shaping lessons. Open the named file (`clif-d/architecture.md`, `clif-d/backpressure.md`, `clif-d/dev-environment.md`, `clif-d/concept.md`, or `clif-d/prd.json`), locate the named section, and edit it to incorporate the lesson. The phrasing is decoupled from the specific incident that produced it -- a future reader of the doc should understand it without reference to a plan or commit. Match the surrounding tone and structure of the doc you are editing.

If the lesson is being added rather than refining existing prose, place it in the most relevant existing section. Do not invent a new top-level section unless the user explicitly directed you to. For `prd.json`, use the `clif-d req` CLI (e.g., `clif-d req add ...`) rather than hand-editing JSON; if the CLI does not cover the kind of edit needed, surface that as a finding and skip the edit.

#### 2b. New or appended `.claude/rules/*.md` files

For tactical, file-pattern-specific lessons. Create or append to a Markdown file at `.claude/rules/<topic>.md` in the product repo (NOT in this plugin repo). The file uses YAML frontmatter with a `globs:` array that scopes which file edits should re-surface the rule in the agent's context. See `cli/clif-d/plans/executed/plan-REQ-027.md` for the format precedent established in this plugin repo.

Skeleton:

```markdown
---
globs: ["<glob1>", "<glob2>"]
---

# <Topic>

<One short paragraph stating the rule, why it exists, and the corrective action. Decoupled from the specific incident.>

<Optional: pointer to the authoritative source -- a PRD requirement ID, a backpressure section, or an architecture decision -- so the rule does not duplicate but reinforces.>
```

Keep each rule file short. If a topic file already exists and is the right home for a new lesson, append to it rather than create a sibling. If two lessons routed to the same file would conflict or repeat each other, fold them.

### Output 3: Findings (chat and commit message only, not separate files)

A summary list reported to the user and restated in the compaction commit body:

- Upstream design docs that appear stale (from the cross-document drift scan), with the recommended downstream action. Example: "`clif-d/architecture.md` section 4 still describes module X as synchronous; the implementation in commit `<sha>` made it async. Recommend a manual edit, or rerun `create-architecture` if the change was structural."
- Lessons or observations that imply new requirements, with the recommended downstream skill. Example: "Drift between shipped behavior and `prd.json` REQ-NNN suggests acceptance criteria need updating. Recommend running `extend-low-level-requirements`."

These findings are reported, not acted upon. The user decides what to do next. Findings are distinct from the lessons routed in Output 2: those were promoted via per-lesson AskUserQuestion authorization, while findings are surface-level observations that need user judgment to action and may span multiple plans.

---

## Generation process

Once the user confirms the action summary:

1. **Create `clif-d/plans/archive/`** if it does not yet exist.
2. **Write each compact archive entry** at `clif-d/plans/archive/plan-<requirement-ids>.md`, following the structure above. Every SHA referenced must already have been verified with `git cat-file -e <sha>` during the per-plan summary.
3. **Apply each routed lesson** at the destination the user authorized in interrogation step 5. Edit the named section of the design doc, or create/append the named `.claude/rules/<topic>.md` file with its `globs:` frontmatter. Do not edit any doc or rule file the user did not specifically approve in interrogation; this is the load-bearing constraint that prevents silent amendments.
4. **Delete the originals.** Remove every compacted plan from `clif-d/plans/executed/` and every processed file from `clif-d/plans/lessons_learned/`. Delete only files that belonged to the chunk confirmed in interrogation step 2; everything else stays for a future run.
5. **Commit the compaction** as a single commit. The commit message should:
   - State the chunk: how many plans were compacted, the requirement IDs touched.
   - State the lesson tally: how many candidates were presented, how many were promoted, how many were discarded (with the silent pre-filter category counts).
   - List each promoted lesson and the destination it was routed to.
   - Restate the findings reported to the user, so they have a permanent breadcrumb in `git log`.
6. **Report to the user**:
   - Number of plans compacted in this chunk, with their requirement IDs and archive file paths.
   - Each promoted lesson with the file and section it landed in.
   - Discard counts (silent pre-filter and post-interrogation).
   - The findings list (re-stated, since chat may scroll).
   - The compaction commit SHA.
   - Recommended next steps for any findings (which downstream skill to run, or which doc to edit manually).
   - How many plans remain in `clif-d/plans/executed/` and `clif-d/plans/lessons_learned/` for future runs of this skill.

Do not push. The user controls when the branch is pushed. Do not edit upstream design docs, `prd.json`, or `.claude/rules/*.md` files for any lesson the user did not explicitly approve.
