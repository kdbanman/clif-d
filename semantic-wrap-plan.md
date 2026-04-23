# Semantic-wrap reformat plan (temporary)

Goal: reformat the repo's Markdown prose from paragraph-per-line to
sentence-per-line ("semantic line breaks" / "ventilated prose") so that
line-by-line diffs become sentence-scoped. Rendered output is identical
because Markdown collapses consecutive non-blank lines into a paragraph.

This file is temporary. Delete it after the reformat lands.

## Scope

**In scope (actively edited docs):**

- `README.md`
- `CLAUDE.md`
- `bin/CLAUDE.md`
- `cli-design-notes.md`
- `cli-integration-plan.md`
- `cli/clif-d/backpressure.md`
- `cli/clif-d/dev-environment.md`
- `skills/*/SKILL.md` (10 files)
- `skills/*/references/*.md` (18 files)

**Out of scope (historical records, low-value to reformat):**

- `cli/clif-d/plans/active/*.md` -- only `plan-REQ-023.md` is live; one file, trivial to reformat by hand if desired. Default: skip.
- `cli/clif-d/plans/executed/*.md` -- frozen completion records. Skip.
- `cli/clif-d/plans/archive/*.md` -- already compacted, frozen. Skip.
- `cli/clif-d/plans/lessons_learned/*.md` -- awaiting compactification (will be deleted). Skip.

Rationale: reformatting historical artifacts inflates the diff for no forward-looking review benefit. They either never change again or get deleted. Revisit if a plan/lesson file is ever edited post-hoc.

## Approach: one-shot Node script

### Script

- Location: `cli/scripts/semantic-wrap.mjs` (sits alongside the existing bash scripts; `cli/` is dev-only, never ships).
- Runtime: Node 18+, zero npm deps (ESM, stdlib only). Matches the zero-dep ethos of `bin/clif-d`.
- Invocation: `node cli/scripts/semantic-wrap.mjs <file> [<file> ...]`. Processes each file in place, idempotent (running twice is a no-op).
- Top-of-file comment: terse, 3-5 lines -- what it does, when to run it, the fact that it is a maintenance tool not part of the shipped plugin. No separate README entry.

### Behavior

For each input file, split prose paragraphs at sentence boundaries. Leave every other construct untouched.

**Must skip (pass through byte-for-byte):**

- Fenced code blocks (``` and ~~~), including the fence lines.
- Indented code blocks (4-space / tab-prefixed).
- YAML frontmatter (opening and closing `---` and everything between).
- HTML comments `<!-- ... -->`.
- Markdown tables (lines containing `|` that sit in a table region).
- Heading lines (`#`, `##`, ...).
- Blank lines (preserve exactly; they are paragraph separators and must not be collapsed).
- Existing line breaks inside paragraphs (script is idempotent -- if already split, do not re-split).
- List-item continuation lines that are already wrapped.

**Split behavior for prose paragraphs:**

- Detect sentence boundaries: `.`, `!`, `?` followed by whitespace and an uppercase letter, a digit, or `` ` ``.
- Abbreviation guard: do NOT split after `e.g.`, `i.e.`, `etc.`, `vs.`, `cf.`, `Mr.`, `Mrs.`, `Ms.`, `Dr.`, `St.`, `No.`, single-letter initials (`A.`, `B.`, ...), or after a digit (version numbers like `18.`, `1.2.`).
- Do not split inside inline code spans (`` `...` ``).
- Do not split inside link text `[...]` or link destinations `(...)`.
- For list items (`-`, `*`, `+`, or `1.`): split the leading text as usual; continuation lines are indented to align with the item text (standard Markdown continuation).

**Idempotence check:** after producing output, re-run the splitter on the output; it must equal the first output. Script asserts this before writing.

### Script test harness

Before running across the repo, add a tiny inline self-test at the top of `main()`:

- Handful of fixture strings covering: normal prose, `e.g.` guard, version-number guard, code fence pass-through, list item with two sentences, table pass-through, heading pass-through.
- If any fixture fails, exit non-zero with a diff. No external test file, no test runner -- self-contained.

## Execution

### Step 1: commit the script

Commit only `cli/scripts/semantic-wrap.mjs`. No markdown changes yet. Allows the script to be reviewed in isolation.

### Step 2: commit the CLAUDE.md rule

Add one terse bullet under the existing "ASCII only" rule in `CLAUDE.md`:

> - **One sentence per line in prose.** Markdown renders consecutive non-blank lines as a single paragraph, so physical line breaks do not change rendered output but keep diffs sentence-scoped. Skip code blocks, tables, headings.

Concern raised: `CLAUDE.md` is loaded when editing the plugin, not when running the plugin's skills in a user repo. A terse instruction is safe and does not leak into user sessions. This assumption is true as long as `CLAUDE.md` is a project-instruction file at the plugin repo root and is not bundled into skill context. Confirm before committing if uncertain.

This is a content edit, not a reformat; keep it as its own small commit.

### Step 3: per-file reformat, one commit per file

For each in-scope file, in this order (pilot first, then skills, then references, then the rest):

1. `README.md`
2. `CLAUDE.md`
3. `bin/CLAUDE.md`
4. `cli-design-notes.md`
5. `cli-integration-plan.md`
6. `cli/clif-d/backpressure.md`
7. `cli/clif-d/dev-environment.md`
8. `skills/*/SKILL.md` (alphabetical)
9. `skills/*/references/*.md` (alphabetical)

For each file:

1. Run `node cli/scripts/semantic-wrap.mjs <file>`.
2. **Mechanical check:** `git diff -w -- <file>` must be empty. This proves no words changed; only whitespace was shuffled. If non-empty, abort and investigate -- the script mangled content.
3. **Subagent verification (see next section).**
4. If both checks pass, commit with message: `docs(<short-path>): semantic line breaks`. No other changes in the commit.
5. If a check fails, revert (`git checkout -- <file>`), fix the script, re-run from step 1 after re-committing the script fix.

One commit per file keeps each review surface small. Reviewers can spot-check by rendering before/after, but the mechanical `-w` diff is the real proof.

### Subagent verification protocol

After each file reformat, spawn one general-purpose subagent per file. Self-contained prompt template:

> You are verifying a pure-reformatting change to a Markdown file. The only intended change is that sentence-ending whitespace (space after `.`, `!`, `?`) has been replaced with a newline so each sentence starts on its own line. No words, links, code, lists, tables, or headings should have changed.
>
> Task:
> 1. Run `git diff -w -- <file>` and confirm the output is empty.
> 2. Run `git diff -- <file>` and inspect the changes.
> 3. Confirm: (a) no text content changed, only whitespace; (b) code fences, tables, and YAML frontmatter were left untouched; (c) line breaks land at sentence boundaries and not mid-sentence (no `e.g.` / version-number / abbreviation splits); (d) list items are still valid Markdown (continuation lines indented correctly); (e) no paragraph got accidentally merged or split.
> 4. Report PASS or FAIL with a one-line reason. Under 100 words.

Spawn the subagents in parallel when reformatting batches of files (e.g. the 18 references). For the initial pilot files, run serially so script bugs surface early.

### Step 4: retire the plan

Delete `semantic-wrap-plan.md` in the last commit of the sequence, together with the final reformat. The CLAUDE.md rule is the durable encoding of the convention; this plan is disposable scaffolding.

## Commit shape summary

1. `cli: add semantic-wrap maintenance script`
2. `CLAUDE.md: require one sentence per line in prose`
3. `docs(README): semantic line breaks`
4. `docs(CLAUDE.md): semantic line breaks`
5. ... one commit per in-scope file ...
6. Final reformat commit also deletes `semantic-wrap-plan.md`.

All commits stay on branch `claude/improve-readme-formatting-xs3Oa`.

## Risks and mitigations

- **Sentence segmentation false positives (abbreviation not in the guard list).** Mitigation: the `git diff -w` check catches no content-change; the subagent review catches bad break points. Any false positive discovered during verification gets added to the guard list and the script re-run on the remaining files.
- **Markdown construct not in the skip list (rare HTML, definition lists, footnotes).** Mitigation: inventory the in-scope files for unusual constructs before the full run; extend the script's skip logic if any are found.
- **Idempotence bug (running twice produces a different result).** Mitigation: the script self-asserts idempotence before writing. If it fails, abort.
- **Reviewer fatigue from ~35 commits.** Mitigation: all commits are pure-reformatting with empty `-w` diff, so a reviewer can verify the whole series with one command: `git log --format=%H <base>..HEAD -- '*.md' | xargs -I{} git show -w {}` should show only metadata, no content. Worst case, the series can be squashed at merge time if preferred.

## Out of scope for this pass

- Tightening prose, cutting redundancy, rewording. Pure reformatting only.
- Reformatting `cli/clif-d/plans/**`. See scope section above.
- Enforcing the convention via a pre-commit hook. Could be a follow-up if the convention drifts; for now the CLAUDE.md rule is enough.
