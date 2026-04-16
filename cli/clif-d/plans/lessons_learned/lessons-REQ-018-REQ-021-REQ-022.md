# Lessons Learned: REQ-018, REQ-021, REQ-022

**Plan:** `cli/clif-d/plans/executed/plan-REQ-018-REQ-021-REQ-022.md`
**Implementation commit:** 718ad14

## Plan deviations

- **Steps 1 and 2 merged.** The `--root` filtering (Step 2) was implemented
  alongside the base `req dep graph` (Step 1) because ESLint's `no-unused-vars`
  rule rejected the `flags` parameter in `reqDepGraph` when it wasn't yet used.
  Rather than suppress the rule or use a dummy reference, the root filtering
  was implemented immediately. The Step 2 tests were still written separately
  and verified the behavior.

## Surprise failures

- **`req dep graph --root` flag rejected by outer enforceKnownFlags.** The
  `routeReq` function's flag enforcement ran before dispatching to `routeReqDep`,
  rejecting `--root` as an unknown flag for `req dep`. Fix: skip flag enforcement
  for the `dep` case, delegate entirely to `routeReqDep`.

- **`req dep graph --help` showed `req dep` help.** The help check in `routeReq`
  caught `--help` for the `dep` command label before `routeReqDep` had a chance
  to identify the `graph` sub-verb. Fix: skip help handling for `dep` in
  `routeReq`, let `routeReqDep` handle it per sub-verb.

## Refactoring required by backpressure

- **main function exceeded max-lines-per-function (115) and max-depth (3).**
  Adding three new domain cases pushed the main function past the limits.
  Extracted `routeReq`, `routeReqDep`, `routeId`, and `routeSchema` functions.
  Also converted the top-level domain dispatch from if/else-if to switch
  (required by unicorn/prefer-switch).

- **`security/detect-non-literal-regexp` warning in nextId.** The shared
  `nextId(prefix, items)` helper constructs a regex from the prefix parameter.
  Suppressed with an eslint-disable comment since the prefix comes from the
  internal `ID_PREFIX_TO_ARRAY` map, not user input.
