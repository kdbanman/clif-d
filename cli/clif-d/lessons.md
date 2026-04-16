# clif-d CLI Lessons Log

Durable lessons learned across the life of the `clif-d` CLI subproject, distilled by `compactify-artifacts` from per-plan `lessons_learned/` files. Append-only. Each entry meets at least one of the durability bars: recurring tooling pitfall, regression-prone pattern, gap in a CLIF-D skill's instructions, or a reversed design decision. Entries are decoupled from the specific incident that produced them and should be readable on their own.

Scope: this log is for lessons that apply to the `clif-d` CLI at `bin/clif-d` and its surrounding dev tooling in `cli/`. Lessons that apply to the CLIF-D plugin repo as a whole live elsewhere.

---

## 2026-04-16 -- TypeScript `noUncheckedIndexedAccess` and `process.exit` narrowing

**Source:** REQ-008, REQ-009 (`cli/clif-d/plans/archive/plan-REQ-008-REQ-009.md`)
**Category:** recurring tooling pitfall

The `cli/` subproject runs `tsc --noEmit` with `strict: true` and `noUncheckedIndexedAccess: true` against plain JavaScript via `checkJs`. Under these settings, every indexed access -- `argv[2]`, `positionals[0]`, `.at(-1)`, `map.get(key)` -- has type `T | undefined` regardless of any runtime bounds check the human reader can see. The compiler will not narrow from surrounding `if (positionals.length >= 1)` guards, so either annotate each access with a JSDoc `/** @type {T} */` cast or use a non-null assertion helper. Additionally, `process.exit()` is typed `never` but the TypeScript control-flow analyzer does not treat a bare `exit(2)` as terminating flow; functions that exit in catch blocks must use `return exit(2)` (or follow the call with an unreachable `return`) to satisfy return-type checking. Both patterns appear all over `bin/clif-d` by precedent -- match the existing style rather than trying to rewrite it. If you find yourself fighting either of these, the fix is almost always a single JSDoc cast, not a structural refactor.

---

## 2026-04-16 -- Sub-router hierarchies own their own flag and help delegation

**Source:** REQ-018, REQ-021, REQ-022 (`cli/clif-d/plans/archive/plan-REQ-018-REQ-021-REQ-022.md`)
**Category:** regression-prone pattern

When adding a three-level command (`clif-d <namespace> <group> <verb>` -- for example `clif-d req dep add`), the top-level dispatcher routes on the namespace but cannot validate flags or print help for a subcommand it has not yet resolved. If the outer router applies `enforceKnownFlags` or a `--help` short-circuit before delegating, two regressions follow: (a) flags legal for the leaf verb are rejected as unknown at the outer level; (b) `--help` prints the group-level help rather than the verb-level help (and can print nothing at all if the outer router matches before the sub-router runs). The fix is a rule: every sub-router owns its own `--help` handling, its own `enforceKnownFlags` with its own `COMMAND_FLAG_SPECS` entry, and its own positionals slicing before forwarding to the verb handler. The outer router's only job for a multi-level namespace is to dispatch unchanged argv onward. The pattern to follow is already visible in `routeReqDep` in `bin/clif-d` -- copy that shape when adding another namespace with sub-verbs.
