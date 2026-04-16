---
name: compactify-artifacts
description: >
  Compact accumulated CLIF-D execution artifacts -- finished implementation plans and per-plan
  lessons-learned files -- into terse archive entries plus a single durable lessons log. Use this
  skill when `clif-d/plans/executed/` or `clif-d/plans/lessons_learned/` are getting onerous and
  the noise is starting to obscure signal. Reads each executed plan and its matching lessons file,
  consults git history for the major commits, interrogates the user about which lessons are worth
  remembering long-term, writes one compact archive entry per plan to `clif-d/plans/archive/`,
  appends durable lessons to `clif-d/lessons.md`, flags contradictions with upstream design docs
  and lessons that imply new requirements (without silently amending them), then deletes the
  originals. Active plans are never touched.
---

# Compactify Artifacts

You are helping the user clear accumulated planning and execution artifacts. Executed plans and lessons-learned files pile up as a CLIF-D project runs. They are valuable while fresh and become noise within weeks. This skill distills durable signal out of that noise: terse archive entries that point into git history, plus a single growing `clif-d/lessons.md` of durable lessons that survive interrogation. The skill is opinionated, ruthless about deletion, and conservative about changing other documents.

---

## Philosophy

### Compactness is the point

A compact archive entry that grows beyond half a page is not compact. A `clif-d/lessons.md` entry that grows beyond a short paragraph is not durable -- it is just another long document nobody will read. If you are tempted to preserve more, ask whether git history already preserves it. It does.

### Git is the long-term record

The full text of every executed plan, every lessons file, every implementation commit message is preserved in git history. The compact archive does not duplicate that detail. Its job is to be **enough of a map** to initiate a deep dive: requirement IDs, the major commit SHAs, the acceptance-criteria checklist, a one-paragraph summary of what shipped. From any of those handles a future reader can `git log`, `git show`, or open the PR and reconstruct whatever level of detail they need.

This is the inverse of the active-plan model. Active plans are self-contained and inlined; archive entries are sparse and indexed. The reader's tools are different.

### Lessons earn their place by interrogation

Most lessons-learned content is one-off noise: a typo in a config, a momentary misread of an error message, a transient confusion about a library API. That detail does not deserve a permanent place in `clif-d/lessons.md`. Only lessons that meet at least one of these bars belong in the durable log:

- **Recurring tooling pitfalls** -- something that has bitten the project more than once, or is clearly likely to.
- **Patterns that consistently cause regressions** -- a class of bug, not a single instance.
- **Corrections that reveal a gap in a CLIF-D skill's instructions** -- something a future agent would also get wrong.
- **Reversed decisions** -- where the team learned an earlier design choice was wrong and now does the opposite.

The user is the arbiter. This skill interrogates -- it does not silently promote lessons.

### Side effects are flagged, not applied

While reading lessons you will often notice that an upstream document (concept, PRD, architecture, dev-environment, backpressure) is now inconsistent with what shipped, or that a lesson implies a new requirement -- often a new backpressure rule. These are real findings, but **this skill does not act on them**. It surfaces them to the user and recommends the appropriate downstream skill or manual edit. Silent amendments to authoritative documents would violate the artifact precedence laid out in `README.md` -- those documents change deliberately, not as a housekeeping side effect.

### Aggressive cleanup

After compaction, the originals in `clif-d/plans/executed/` and `clif-d/plans/lessons_learned/` are **deleted**. The durable content is now in the archive entry, in `clif-d/lessons.md`, and in git history. Keeping the originals around would defeat the whole purpose of compaction -- the directories would still be onerous. If a future reader needs the original detail, they recover it from git.

---

## Input

This skill expects:

1. **`clif-d/plans/executed/*.md`** -- one or more completed plans written there by `implement-plan`. If empty, exit with a message that there is nothing to compact.
2. **`clif-d/plans/lessons_learned/*.md`** -- per-plan lessons files written by `implement-plan`. May be empty for plans that ran smoothly.
3. **`clif-d/prd.json`** -- to look up requirement context and to confirm `implementation_commit` SHAs recorded against requirements.
4. **The upstream design docs** -- `clif-d/concept.md`, `clif-d/architecture.md`, `clif-d/dev-environment.md`, `clif-d/backpressure.md` -- read for cross-checking against what actually shipped.
5. **`clif-d/lessons.md`** -- if present, the existing durable lessons log. New entries are appended; existing entries are not rewritten.
6. **Git history** -- `git log`, `git show`, `git log -- <path>` to verify implementation commit SHAs, locate the lifecycle commit, and identify any related commits the plan header may have missed.

Do not read or touch `clif-d/plans/active/`. Active plans are mid-flight and outside this skill's scope.

---

## Interrogation

This is a heavily HITL skill. The user's judgment is what separates durable lessons from noise and what authorizes downstream changes. Do not generate any output files until interrogation is complete and the user has confirmed the findings summary.

### 1. Scope confirmation

List every file in `clif-d/plans/executed/` and `clif-d/plans/lessons_learned/`. Confirm with the user which to compact in this pass. Default to all of them, but allow scoping (e.g., "only plans older than N", "skip these two -- I want to revisit them").

### 2. Per-plan summary

For each executed plan in scope:

1. Read the plan's header (requirement IDs, implementation commit SHA, date).
2. Read the matching `lessons-REQ-NNN.md` if it exists.
3. Identify the **major commits** associated with the plan. At minimum: the `implementation_commit` from the plan header and the `implement-plan` lifecycle commit (PRD update + plan move). Use `git log` and `git log -- clif-d/plans/executed/plan-REQ-NNN.md` to confirm they exist and surface any related commits the plan header missed (e.g., follow-up fixes on the same branch).
4. Cross-check the SHAs against `clif-d/prd.json` -- the requirement's `implementation_commit` field should match.
5. Draft a one-paragraph summary of what shipped in plain language: the user-visible behavior, the modules touched, any major design choices.
6. Present the summary to the user for confirmation. Adjust if they redirect.

### 3. Lessons interrogation

Walk through each lesson, one at a time. For each:

1. Quote the lesson verbatim.
2. State which durability bar (if any) it appears to meet -- recurring pitfall, regression-prone pattern, skill-instruction gap, reversed decision -- or note that it looks like one-off noise.
3. Ask the user: **keep in `clif-d/lessons.md`, absorb into a specific design doc, or discard**.
4. If "keep", draft the durable phrasing -- shorter than the original, decoupled from the specific incident, written so a future reader with no memory of the event can act on it.
5. If "absorb into a design doc", note which doc and what the change should be. Do not edit the doc -- this becomes a finding (see §5).

Be willing to discard most lessons. The bar is high on purpose.

### 4. Cross-document consistency check

After processing the lessons, scan the upstream design docs for contradictions with what actually shipped:

- Does `clif-d/architecture.md` still describe the system accurately?
- Does `clif-d/backpressure.md` still describe the guardrails as they are actually enforced?
- Does `clif-d/dev-environment.md` still describe the toolchain accurately?
- Does `clif-d/prd.json` still match implemented behavior, or did acceptance criteria drift in code without a corresponding PRD update?

For each contradiction, draft a short note: which document, which section, what is now stale, and the recommended fix or downstream skill to run.

### 5. Findings summary

Before writing any output, present the user with:

- The list of executed plans to be compacted, with their drafted summaries
- The lessons that will be promoted to `clif-d/lessons.md`, with their drafted phrasing
- The lessons that will be discarded
- Contradictions found in upstream design docs (as findings, not as edits)
- New requirements implied by lessons (as findings, not as edits) -- typically new backpressure rules or new low-level requirements

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
- Lessons promoted from this plan: see `clif-d/lessons.md` entries dated YYYY-MM-DD (if any survived interrogation)
```

The **Pointers for deep dive** section is the load-bearing part. It must contain enough handles -- SHAs, PR numbers, file paths, branch names -- that a future reader can run `git log`, `git show`, or open the PR without guessing. Do not paraphrase commit messages. Do not summarize the diff. Just point. The whole purpose is to make a future deep dive *initiable*, not to perform it preemptively.

### Output 2: Durable lessons log

A single Markdown file at `clif-d/lessons.md` in the product repo (top-level CLIF-D artifact, not under `plans/`). Append-only: new entries are added at the bottom, existing entries are never rewritten by this skill.

If the file does not yet exist, create it with a brief header:

```markdown
# CLIF-D Lessons Log

Durable lessons learned across the project, distilled by `compactify-artifacts` from per-plan `lessons-learned/` files. Append-only. Each entry meets one of the durability bars: recurring tooling pitfall, regression-prone pattern, gap in a CLIF-D skill's instructions, or a reversed design decision. Entries are decoupled from the specific incident that produced them and should be readable on their own.
```

Each entry:

```markdown
## YYYY-MM-DD -- <one-line title>

**Source:** REQ-NNN (`clif-d/plans/archive/plan-REQ-NNN.md`)
**Category:** recurring tooling pitfall | regression-prone pattern | skill-instruction gap | reversed decision

The durable phrasing of the lesson -- decoupled from the specific incident, written so a future reader (human or agent) with no memory of the original event can understand what to do or avoid. One short paragraph. If a concrete corrective action is recommended (e.g., "always run `npm ci` not `npm install` in CI"), state it explicitly.
```

The `Source` field is for traceability; the lesson body should make sense without reading the source plan or archive entry.

### Output 3: Findings (chat only, not on disk)

A summary message to the user listing:

- Upstream design docs that appear stale, with the recommended downstream action. Example: "`clif-d/architecture.md` §4 still describes module X as synchronous; the implementation in commit `<sha>` made it async. Recommend a manual edit, or rerun `create-architecture` if the change was structural."
- Lessons that imply new requirements, with the recommended downstream skill. Example: "Lesson dated YYYY-MM-DD about flaky integration tests suggests a new backpressure rule. Recommend running `design-backpressure` to add a flake-detection gate."

These findings are reported, not acted upon. The user decides what to do next. The compaction commit message should also list them so the chat findings have a permanent breadcrumb.

---

## Generation process

Once the user confirms the findings summary:

1. **Create `clif-d/plans/archive/`** if it does not yet exist.
2. **Write each compact archive entry** at `clif-d/plans/archive/plan-<requirement-ids>.md`, following the structure above. Verify every SHA is real (`git cat-file -e <sha>`).
3. **Write or append to `clif-d/lessons.md`** with the user-confirmed durable lessons. Create the file with the header above if it does not yet exist.
4. **Delete the originals.** Remove every compacted plan from `clif-d/plans/executed/` and every processed file from `clif-d/plans/lessons_learned/`. Do not delete files that were excluded from the scope confirmed in interrogation step 1.
5. **Commit the compaction** as a single commit. The commit message should:
   - State how many plans were compacted and how many lessons were promoted
   - List the requirement IDs touched
   - Restate the findings reported to the user, so they have a permanent breadcrumb in `git log`
6. **Report to the user**:
   - Number of plans compacted, with their requirement IDs and archive file paths
   - Number of lessons promoted to `clif-d/lessons.md`, with their titles
   - Number of lessons discarded
   - The findings list (re-stated, since chat may scroll)
   - The compaction commit SHA
   - Recommended next steps for any findings (which downstream skill to run, or which doc to edit manually)

Do not push. The user controls when the branch is pushed. Do not edit upstream design docs or `clif-d/prd.json` -- those changes are for the user or the relevant downstream skill.
