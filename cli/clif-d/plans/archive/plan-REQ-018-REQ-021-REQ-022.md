# Compact Archive: req dep graph, id next, schema copy

**Requirements:** REQ-018, REQ-021, REQ-022
**Implementation commit:** 718ad14
**Lifecycle commit (PRD + plan move):** aa0aa9a
**Date archived:** 2026-04-16
**Source plan:** previously at `cli/clif-d/plans/executed/plan-REQ-018-REQ-021-REQ-022.md` (deleted; recover via `git log --diff-filter=D -- cli/clif-d/plans/executed/plan-REQ-018-REQ-021-REQ-022.md`)

## Summary

Added three utility commands and, as a side effect, introduced the three-level sub-router pattern the rest of the CLI will follow. Commands: `req dep graph [--root=REQ-ID]` (JSON adjacency list of the full graph or the sub-graph reachable from a root; also supports `--plain` one-edge-per-line), `id next <namespace>` (next available ID in a namespace -- max+1, not gap-filling), and `schema copy <dest>` (byte-for-byte copy of the canonical `prd-schema.json` into a product repo). This plan was also where the main dispatcher first exceeded the `max-lines-per-function: 115` and `max-depth: 3` caps -- the fix extracted `routeReq`, `routeReqDep`, `routeId`, and `routeSchema` and converted the top-level dispatch from if/else-if to `switch`. The `routeReqDep` sub-router owns its own `--help` and flag enforcement because the outer `routeReq` cannot validate flags for a verb it hasn't resolved yet.

## Acceptance criteria

- [x] REQ-018: With a chain REQ-005 -> REQ-003 -> REQ-001, `req dep graph --root=REQ-005` emits `{"REQ-005": ["REQ-003"], "REQ-003": ["REQ-001"], "REQ-001": []}` -- verified by `cli/test/req-dep-graph.test.js`.
- [x] REQ-021: With requirements up to REQ-012, `id next REQ` emits `REQ-013` -- verified by `cli/test/id-next.test.js`.
- [x] REQ-022: `schema copy clif-d/` creates `clif-d/prd-schema.json` identical to the canonical schema and writes the absolute path to stdout -- verified by `cli/test/schema-copy.test.js`.

## Pointers for deep dive

- Implementation: `git show 718ad14` (PR kdbanman/clif-d#15)
- Lifecycle: `git show aa0aa9a`
- Test files: `cli/test/req-dep-graph.test.js`, `cli/test/id-next.test.js`, `cli/test/schema-copy.test.js`
- Lessons promoted from this plan: see `cli/clif-d/lessons.md` entry "Sub-router hierarchies own their own flag and help delegation" (2026-04-16)
