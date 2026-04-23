# Git Commit Hygiene

Reference guide for writing commit messages that serve as a durable implementation log.
The git history should be useful to humans and AI agents doing deep dives months or years later -- regression archaeology via `git bisect` and `git blame`, understanding why a design decision was made, recovering the rationale behind non-obvious code.

The core principle: **a commit message is permanent, searchable infrastructure.** Treat it like a page in a history book, not a sticky note.

---

## Subject line

Format: `<area>: <imperative summary>`

- **Imperative mood.** "Add parser for CSV rows", not "Added parser" or "Adding parser." Git itself uses imperative for merge and revert messages -- match it.
- **Capitalized after the prefix.** `cli: Add --verbose flag`, not `cli: add --verbose flag`.
- **No trailing period.**
- **72 characters hard limit.** Aim for 50 if the summary can be that terse, but do not sacrifice clarity to hit 50. GitHub truncates display around 72.
- **Area prefix is kernel-style**, not Conventional Commits.
  Use the subsystem, module, or component name.
  Examples: `cli:`, `parser:`, `tests:`, `prd:`.
  Keep it short and consistent within the project.

---

## Body

The body is **mandatory**.
Never use `git commit -m` -- it encourages a terse, argument-style mindset.
Use a heredoc or editor.

Wrap all lines at **72 characters**.
This is a display constraint: `git log` indents by 4, and an 80-column terminal minus 4 on each side gives 72.

Separate the subject from the body with a **blank line**.
Tools like `git rebase` and `git log --oneline` break without it.

### What to cover

The body should address these topics, in roughly this order.
Not every topic applies to every commit -- cover what is relevant.

**Context and motivation.** Which requirement is being satisfied, which plan step is being executed, why this change is needed now.
The diff shows what changed; the body explains why.

**Non-obvious design choices.** Do not narrate the diff ("added function X, modified file Y").
Instead, explain choices that would surprise a reader of the diff: why this data structure, why this module boundary, why this ordering.
If the choice is obvious from the diff, skip it.

**Alternatives tried or rejected.** Encouraged when non-trivial; omit when the happy path just worked.
Keep it terse -- one or two sentences per alternative.
This is the single highest-value habit for future regression archaeology, because diffs never show what was not done.
Do not duplicate detailed analysis that belongs in the plan's lessons-learned file -- a brief mention here with a pointer to the lessons file is sufficient.

**Constraints preserved.** When a piece of code looks the way it does because of a non-obvious invariant -- a backpressure rule, a CTX constraint, a platform quirk, a performance requirement -- say so explicitly.
This prevents future "simplification" that unknowingly violates the constraint.

**Verification performed.** Which quality checks passed: test suite, linter, type checker, formatter.
Name the commands if they are non-obvious.
This is especially useful for bisect: if a commit claims all checks passed, and a later bisect lands on it, the investigator knows the regression was introduced by a subsequent commit, not a latent failure.

---

## Trailers

Trailers are machine-parseable metadata lines at the end of the commit body.
They follow git-trailer conventions: `Key: value`, one per line, with a blank line separating them from the body prose.

Use these trailers in roughly this order:

- **`Requirement: REQ-NNN`** -- links the commit to the PRD requirement it satisfies.
  One line per requirement.
  Enables `git log --grep="Requirement: REQ-042"` to find every commit touching that requirement.
- **`Plan: clif-d/plans/active/plan-REQ-NNN.md`** -- the plan being executed.
  Use the path at the time of commit (active, not executed -- the plan has not been moved yet when the implementation commit is made).
- **`Step: N/M`** -- which step of the plan this commit implements, and how many steps total.
  Useful for understanding progress and commit grouping.
- **`Fixes: <12-char sha> ("<subject of fixed commit>")`** -- for regression fixes.
  Links this fix to the commit that introduced the bug.
  Use the Linux kernel format: 12 hex digits of the SHA, space, then the buggy commit's subject in parentheses and quotes.
  This makes `git bisect` results immediately actionable -- the fixing commit already names its culprit.
- **`Refs: <sha>`** -- references to related commits.
  For sibling commits in a plan series (e.g., the bookkeeping commit referencing the implementation commit, or vice versa), list their SHAs here.
  Comma-separated if multiple.
- **`Link: <full url>`** -- full URL to an external resource: issue tracker, design document, discussion thread.
  Use full URLs, not bare ticket IDs -- URLs survive tracker migrations and are directly actionable by agents.

---

## Self-containment

A future reader -- human or agent -- should be able to understand a commit from its message and diff alone, without chasing external links.
The trailers provide traceability to external context, but the body should stand on its own.
If understanding the commit requires reading the linked plan or issue, the body is too sparse.

This is the Linux kernel's "self-contained description" rule, and it is the foundation of a durable implementation log.

---

## Bookkeeping commits

The lifecycle commit (PRD status updates, plan file moves, lessons-learned file) uses the same format but serves a different purpose.
Its body should:

- Name the implementation commit's SHA and reference it in a `Refs:` trailer.
- List the PRD status transitions made (e.g., "REQ-042: not_started -> done").
- List plan-lifecycle file moves (e.g., "plans/active/plan-REQ-042.md -> plans/executed/plan-REQ-042.md").
- Name the lessons-learned file if one was created.

This keeps the implementation commit clean (focused on code) and the bookkeeping commit self-explanatory (focused on lifecycle state changes).
