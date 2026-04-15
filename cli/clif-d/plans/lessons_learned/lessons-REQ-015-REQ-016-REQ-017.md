# Lessons Learned: REQ-015, REQ-016, REQ-017

Implementation went smoothly. A few minor notes worth preserving:

## Linter gotchas (small, recurring)

- `unicorn/catch-error-name` requires the catch parameter to be named
  `error`, not `err`. The plan's sketch used `err`; Prettier/ESLint flagged
  it on first check. Cheap fix but recurrent across this codebase.
- `unicorn/no-useless-undefined` flags `return undefined;` used as a
  TypeScript control-flow hint after `exit(n)`. The established pattern in
  this file is `return exit(n);` (treating `exit` as a `never`-like return).
  Match that pattern instead of `exit(n); return undefined;`.

## Router-level positional handling for three-level commands

`req dep add <REQ-ID> <DEP-ID>` has three positionals before any optional
`prd-path`. Inside the `dep` router branch, `positional[0]` is the verb
(`add` / `rm`), so the reqId/depId live at indices 1 and 2, and
`resolvePrdPath` needs `expectedPositional = 3` to treat a trailing JSON
path correctly. Easy to get wrong by one and produce confusing errors.

## Plan/reality match

No material deviations from the plan. TDD worked as intended: every step's
tests went red first, green after implementation, and the full suite stayed
green throughout. No regressions in prior command tests.
