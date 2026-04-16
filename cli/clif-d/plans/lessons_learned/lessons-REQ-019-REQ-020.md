# Lessons Learned: REQ-019, REQ-020

Context and architecture item CRUD (ctx/arch add/ls/show/edit) landed cleanly
on the `req` template, but the path through the jscpd guardrail was bumpier
than the plan anticipated. Several lessons are worth preserving.

## Early factoring beats post-hoc deduping

The plan's Step 5 said ctx and arch could be implemented as parallel copies
and factored later "once the parallelism is obvious from code." In practice,
copying `req`'s command bodies to `ctx` and then again to `arch` would have
tripped the REQ-027 jscpd gate (threshold 0, minLines 5, minTokens 50) long
before the last copy existed. I factored the shared structure up front --
`CTX_SPEC`/`ARCH_SPEC` ItemDomainSpec records plus a generic `itemAdd`,
`itemLs`, `itemShow`, `itemEdit` -- which let every new command be a one-line
dispatch to the generic handler. This is a deviation from the plan's literal
wording, but consistent with its intent; the plan was written before we knew
how aggressive the clone threshold felt in practice.

Generalizing: with a zero-clone gate in place, the old "duplicate twice before
abstracting" rule of thumb stops being free. Factor as soon as the second
copy would breach it, even if the third use-case is only hypothesized.

## jscpd clone shakeout

Even with the ItemDomainSpec factoring, four separate clone reports fired
during the run and each required a targeted extraction:

1. **Validator boilerplate** -- `validateRequirementShape`,
   `validateContextShape`, and `validateArchitectureShape` all did the same
   "collect missing required fields, check ID format, accumulate optional
   string-type errors." Extracted `collectMissingFields`,
   `collectIdFormatError`, `collectOptionalStringErrors`.
2. **Plain-text rendering** -- `Format.toPlain` and an ad-hoc
   `formatItemsPlain` drifted into near-duplicates. Collapsed both onto a
   single `renderTable(rows, fields)` helper.
3. **Add-command tail** -- `reqAdd` and `itemAdd` both ended with
   "report shape errors, check duplicate id, append, write, project." The
   shape-error exit and duplicate-id exit moved to `exitOnShapeErrors` and
   `exitOnDuplicateId`; `reqEdit` also adopted `exitOnShapeErrors` in the
   same pass to kill a third copy.
4. **Show/edit preamble** -- `itemShow` and `itemEdit` shared the same
   "resolve prd path, load, validate, locate by positional id, exit if not
   found" prelude. Extracted `locateItemByPositional` and `domainVerb` (the
   latter so error messages stay domain-specific: "Context item" vs.
   "Architecture item").

The pattern: every time jscpd fires, prefer a *named* helper over copy-pastes
with tweaked labels. The labels always turn out to be data, not logic.

## ESLint `prefer-switch` and `switch-case-braces`

When the `main()` dispatcher's else-if chain grew past the rule's trigger
count, `unicorn/prefer-switch` fired. Converting to a `switch (command)`
then triggered `unicorn/switch-case-braces`: each case body needed `{ ... }`
braces even for single-line dispatches. Cheap, but newly-visible on this
file as the command count grew.

## `max-lines-per-function: 115` shapes the dispatcher

`main()` had to be split into domain-level sub-dispatchers
(`dispatchReq`, `dispatchItemDomain`, `runReqCommand`, `runReqDep`,
`runItemCommand`, `dispatchValidate`) to stay under 115 lines. The split
reads naturally -- one dispatcher per noun -- but it was forced by the
line-count cap, not designed up front. Worth remembering that the cap will
force this shape on any future command router, so new commands should slot
into an existing sub-dispatcher rather than grow `main()`.

## Plan/reality match

TDD held: each step went red first, green after implementation, full suite
stayed green. The only material deviation from the plan was the Step 5
factoring-timing choice above; everything else matched.
