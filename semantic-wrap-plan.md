# Semantic-wrap reformat plan (temporary)

Goal: reformat the repo's Markdown prose from paragraph-per-line to
sentence-per-line ("semantic line breaks" / "ventilated prose") so that
line-by-line diffs become sentence-scoped. Rendered output is identical
because Markdown collapses consecutive non-blank lines into a paragraph.

This file is temporary. Delete it after the reformat lands (see "Commit and merge shape" below).

## Scope

In-scope files are numbered. The numbers are stable handles for subagent coordination -- "run the script on file 12" refers to `skills/create-architecture/SKILL.md` throughout this document's life.

### In-scope files

1. `README.md`
2. `CLAUDE.md`
3. `bin/CLAUDE.md`
4. `cli-design-notes.md`
5. `cli-integration-plan.md`
6. `cli/clif-d/backpressure.md`
7. `cli/clif-d/dev-environment.md`
8. `skills/bootstrap-dev-environment/SKILL.md`
9. `skills/compactify-artifacts/SKILL.md`
10. `skills/create-architecture/SKILL.md`
11. `skills/create-architecture/references/testing-organization.md`
12. `skills/create-architecture/references/testing-strategy.md`
13. `skills/create-architecture/references/testing-types.md`
14. `skills/create-initial-prd/SKILL.md`
15. `skills/create-initial-prd/references/cli-design-guide.md`
16. `skills/create-product-concept/SKILL.md`
17. `skills/design-backpressure/SKILL.md`
18. `skills/design-backpressure/references/testing-coverage.md`
19. `skills/design-backpressure/references/testing-enforcement.md`
20. `skills/design-backpressure/references/testing-smoke.md`
21. `skills/extend-low-level-requirements/SKILL.md`
22. `skills/implement-plan/SKILL.md`
23. `skills/implement-plan/references/git-hygiene.md`
24. `skills/implement-plan/references/testing-cheat-sheet.md`
25. `skills/implement-plan/references/testing-integration.md`
26. `skills/implement-plan/references/testing-overview.md`
27. `skills/implement-plan/references/testing-principles.md`
28. `skills/implement-plan/references/testing-unit.md`
29. `skills/plan-requirement/SKILL.md`
30. `skills/plan-requirement/references/testing-acceptance.md`
31. `skills/plan-requirement/references/testing-organization.md`
32. `skills/plan-requirement/references/testing-strategy.md`
33. `skills/plan-requirement/references/testing-types.md`
34. `skills/workshop-names/SKILL.md`
35. `skills/workshop-names/references/evaluation-filters.md`
36. `skills/workshop-names/references/sound-symbolism.md`

### Out of scope (historical records)

- `cli/clif-d/plans/active/*.md` -- only one active plan (`plan-REQ-023.md`); reformat by hand if touched.
- `cli/clif-d/plans/executed/*.md` -- frozen completion records.
- `cli/clif-d/plans/archive/*.md` -- already compacted, frozen.
- `cli/clif-d/plans/lessons_learned/*.md` -- awaiting compactification (will be deleted).

Rationale: reformatting historical artifacts inflates diffs for no forward-looking review benefit. Revisit if a plan/lesson file is ever edited post-hoc.

## Tooling

**Script:** `cli/scripts/semantic-wrap.mjs`. Node ESM, lives under `cli/` (dev-only tree, never shipped). Uses remark / mdast (`unified`, `remark-parse`, `remark-gfm`, `remark-frontmatter`, `unist-util-visit-parents`) as devDependencies so block-level Markdown structure is identified by a real parser rather than hand-rolled regex. The script itself is the source of truth for parser choices, skip rules, abbreviation guards, and idempotence checks; this plan does not re-document them. Run `node cli/scripts/semantic-wrap.mjs <file>` from the repo root.

**Dev-only dependencies are fine.** The runtime CLI (`bin/clif-d`) stays zero-dep per CTX-001, but this script lives in `cli/scripts/` alongside other dev tooling; adding remark to `cli/package.json` devDependencies matches the existing ESLint/Prettier/tsc/jscpd/husky model.

**Invariants the script enforces (asserted at runtime):**

- After writing, running the script on the output is a no-op (idempotence).
- Inline self-tests run on every invocation before any file is touched; failure aborts before writing anything.

## Execution: one subagent per file

The coordination model is **one subagent per in-scope file**. Each subagent owns a short-lived branch, produces one PR, and reports back.

### Base branch

This PR's branch (`claude/improve-readme-formatting-xs3Oa`) is the integration trunk. It carries the plan, the script, and the `CLAUDE.md` rule. Subagent branches fork from it, subagent PRs target it, and only after all subagent PRs merge does this branch merge to `main`.

### Subagent prompt template

For each in-scope file number N, spawn one subagent with this self-contained prompt:

> **Goal:** apply the semantic-wrap reformat to file N of the plan in `semantic-wrap-plan.md` and open a PR against `claude/improve-readme-formatting-xs3Oa` with the result.
>
> **Steps:**
> 1. Read `semantic-wrap-plan.md` on the base branch and confirm which file is number N.
> 2. Check out a new branch off `claude/improve-readme-formatting-xs3Oa` named `claude/semantic-wrap-NN-<short-slug>` (two-digit N, short slug of the file path).
> 3. Run `node cli/scripts/semantic-wrap.mjs <path-to-file-N>` from the repo root.
> 4. **Mechanical check:** non-whitespace content must be byte-identical. Run `cmp <(tr -d '[:space:]' < <(git show HEAD:<path-to-file-N>)) <(tr -d '[:space:]' < <path-to-file-N>)`; it must exit 0 with no output. This proves no non-whitespace character changed. (`git diff -w` is not sufficient because the transformation changes line counts, which `-w` treats as add/delete rather than reflow.) If the check fails, stop and report.
> 5. **Semantic check:** read the diff (`git diff -- <path-to-file-N>`) and confirm: no content changed; code fences, tables, headings, and frontmatter untouched; breaks land at sentence boundaries (no `e.g.` / version-number / abbreviation splits); list-item continuations stay valid Markdown; no paragraph was merged or split at the block level.
> 6. Commit with message: `docs: semantic line breaks in <path-to-file-N>`. No other changes.
> 7. Push the branch and open a PR against `claude/improve-readme-formatting-xs3Oa`.
> 8. In the PR body, report: PASS or any issues found (e.g. unexpected Markdown constructs, false-positive splits, script bugs). Include suggested script adjustments if any.
>
> **Do not** modify the script or the plan. If the script needs changes, surface them in the PR report; a separate PR on the base branch will fix the script and subagents will be re-run.

### Batching

- Pilot: run subagents for files 1-3 serially first. Any script bug surfaces early with low blast radius.
- Main wave: files 4-36 in parallel. remark-based parsing is robust enough that parallel runs should not have cross-file interference (subagents operate on separate branches anyway).
- If a pilot surfaces a script bug: fix the script on the base branch in its own commit, re-spawn the affected subagents, then proceed.

### What the orchestrator does

- Spawns subagents per the template.
- Reviews each subagent PR: mechanical `-w` diff empty, break points sensible, no unrelated changes.
- Merges each subagent PR into the base branch (`claude/improve-readme-formatting-xs3Oa`).
- If a subagent reports a script issue, patches the script on the base branch and re-spawns affected subagents.
- After all 36 subagent PRs merge, opens the final commit on the base branch: delete `semantic-wrap-plan.md`. Then merges the base PR to `main`.

## CLAUDE.md rule

Add one terse bullet under the existing "ASCII only" rule:

> - **One sentence per line in prose.** Markdown renders consecutive non-blank lines as a single paragraph, so physical line breaks do not change rendered output but keep diffs sentence-scoped. Skip code blocks, tables, headings.

Concern to verify: `CLAUDE.md` at the plugin repo root is loaded when editing the plugin, not when skills run in a user's product repo. Confirm this before committing the rule so the instruction does not leak into user sessions.

This rule is added as a single small content commit on the base branch (not on a subagent branch), in the same commit as the script or alongside it.

## Commit and merge shape

On the base branch, in order:

1. Plan commit (already landed): `Add semantic-wrap reformat plan`
2. Script commit: `cli: add semantic-wrap maintenance script` (adds `cli/scripts/semantic-wrap.mjs` and devDependencies)
3. `CLAUDE.md` rule commit: `CLAUDE.md: require one sentence per line in prose`
4. 36 subagent PR merges, one per in-scope file, each as a separate merge commit.
5. Final commit: `Delete semantic-wrap plan` (removes `semantic-wrap-plan.md`).
6. Merge base PR into `main`.

Squashing at merge time is an option if 40+ commits feels noisy; default is to keep the history granular since each per-file commit is independently verifiable.

## Risks and mitigations

- **Sentence-segmentation false positive.** The non-whitespace byte-compare catches content change; subagent review catches bad break points. Any false positive gets added to the script's abbreviation list on the base branch; affected files re-run.
- **Markdown construct not handled by remark plugins loaded.** remark-parse + remark-gfm + remark-frontmatter covers the observed constructs in scope. Anything exotic (definition lists, custom extensions) would surface as either an empty script change or an unexpected diff; the subagent reports it.
- **Idempotence bug.** Script self-asserts idempotence before writing. Failure aborts with non-zero exit.
- **Long-lived base PR.** 36 merges accumulate on this branch before it lands on main. Keep the base branch up to date with `main` via rebase or merge if other work lands; flag subagents to rebase their branches if the base moves.

## Known limitations

- Single-letter words at end of sentence (e.g. "A equals B. C equals D.") are not split, because the script cannot distinguish them from initials ("B. Smith"). Under-splitting is preferred to mis-splitting a name. The subagent review can flag cases where a manual split would improve readability; those can be fixed in a follow-up.
- Blockquote content is not split. Blockquote continuation in Markdown requires a `> ` prefix on each line; handling this correctly adds complexity that the in-scope docs do not need (few blockquotes, mostly one-liners).
