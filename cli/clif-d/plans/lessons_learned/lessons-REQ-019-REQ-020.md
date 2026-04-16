# Lessons Learned: REQ-019, REQ-020

**Plan:** `cli/clif-d/plans/executed/plan-REQ-019-REQ-020.md`
**Implementation commit:** 85bf80d

## Plan deviations

- **Generic CRUD factory was required, not optional.** The plan's Open
  Question 7 framed the factory as "implementer discretion." In practice,
  the jscpd 0% duplication gate forced it: the first pass with separate
  `ctxAdd/ctxLs/ctxShow/ctxEdit` and `archAdd/archLs/archShow/archEdit`
  produced ~360 lines of nearly identical handlers and 12 clone pairs at
  4.72% duplication. A second pass introduced `DomainConfig` +
  `ItemShapeSpec` typedefs and four generic handlers
  (`itemAdd/itemLs/itemShow/itemEdit`) routed by `routeItemDomain(command,
  args, cfg)`. That collapsed the new code to ~120 lines at 0% duplication.
  Plans for future near-duplicate domains should assume the factory pattern
  upfront rather than treat it as optional polish.

- **`Projection.selectFields` and `Format.toPlain` had to be generalized
  too.** They were hard-coded against the requirement schema field order.
  Adding an optional `schemaOrder` parameter to both made them reusable
  across `req`, `ctx`, and `arch` without copying the projection logic --
  a small change that prevented a separate cluster of duplication.

## Surprise failures

- **TypeScript forward-reference errors on the second refactor.**
  `CTX_SHAPE_SPEC` and `ARCH_SHAPE_SPEC` referenced
  `VALID_CONTEXT_TYPES` and `VALID_ARCH_LEVELS` near the top of the file,
  but the enum constants were declared lower down (next to the existing
  `VALID_STATUSES`). `tsc --noEmit` flagged the use-before-declaration.
  Fix: hoist all four enum constants
  (`VALID_STATUSES, VALID_ABSTRACTION_LEVELS, VALID_CONTEXT_TYPES,
  VALID_ARCH_LEVELS`) to a single block at the top of the file alongside
  the field-order constants. Constants belong near the top of a single-file
  CLI; the previous "next to the validator that uses it" placement only
  worked because there was no shared spec referencing them.

- **Pre-commit hook took ~30 seconds.** The duplication gate runs jscpd
  three times (the real file, an injection test, and a synthetic
  duplication test), so `npm run check` is slow enough that the commit
  command appeared to hang. Use `run_in_background: true` and wait for
  the completion notification rather than blocking foreground.

## Refactoring required by backpressure

- **`unicorn/no-lonely-if` in validators.** The first-pass shape
  validators used nested `if (cond) { if (other) { push(error) } }` to
  build up the error list. Combined the conditions with `&&` to satisfy
  the rule. Worth remembering: in this codebase, build conditional
  branches as flat `&&` chains, not as nested `if`s.

- **`unicorn/switch-case-braces` in `routeItemDomain`.** Switch case
  bodies need explicit `{}` even for single-line bodies. Easy to miss
  when copy-adapting earlier router code that pre-dated the rule.

- **`unicorn/no-useless-undefined` in `findItemOrExit`.** Returning
  `undefined` after `exit(n)` (as a TypeScript narrowing hint) is
  rejected. The established pattern -- `return exit(n)` -- works because
  `exit` is treated as `never`-like; reuse it. (This was already noted
  in the REQ-015/016/017 lessons; it's recurring enough to underline.)

## Tooling friction

- **Edit tool string matching breaks after Prettier reformats.** When
  the file is edited, then `prettier --write` is run, the in-memory copy
  the agent has cached no longer matches disk. Subsequent `Edit` calls
  fail with "string not found." Always re-Read after a Prettier write
  before continuing edits.
