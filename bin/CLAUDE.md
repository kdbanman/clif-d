# Implementation rules for `bin/clif-d`

This file scopes additional rules to anyone editing `bin/clif-d` (or the lint/typecheck symlink at `cli/clif-d.js -> ../bin/clif-d`).
Closest-file-wins: the top-level `CLAUDE.md` still applies; the rules here are additive.

Backpressure (pre-commit gates) is corrective.
The list below is preventative -- read it before writing or modifying code under this directory.

## Authoritative sources

- `cli-prd.json` (repo root) -- the living PRD.
  Read the named items (`clif-d ctx show <id>`, `clif-d arch show <id>`, or grep) before changing behavior.
- `cli/clif-d/backpressure.md` -- full guardrail list, thresholds, and suppression policy.
- `cli/clif-d/dev-environment.md` -- bootstrap commands and rules-file conventions.

## PRD items that govern code under this directory

- **CTX-001 -- Zero runtime dependencies.** Never `require` or `import` an npm package from `bin/clif-d`.
  Node built-ins only (`fs`, `path`, `process`, `node:test`, etc.).
  Dev tooling is in `cli/devDependencies` and is never bundled.
- **CTX-002 -- Single-file distribution.** `bin/clif-d` is one file with `#!/usr/bin/env node` and CommonJS-style code.
  Do not split it across files.
  Do not introduce a build/transpile step.
  Do not switch to ES modules.
- **CTX-010 -- Quality backpressure.** Every pre-commit gate must pass: prettier, eslint (incl. `max-lines-per-function: 115`, `complexity: 30`, `max-depth: 3`), jscpd (`threshold: 0`), tsc, node --test.
  Run `cd cli && npm run check` to verify locally.
- **CTX-012 -- Internal modularity discipline.** "Single file" is not a license for a flat script.
  Use module-object patterns (frozen namespaces) and small named functions.
  The function-size, complexity, depth, and duplication caps exist to make this concrete.
- **ARCH-003 -- Read-validate-write cycle.** All PRD mutations: read JSON, validate against schema, mutate the in-memory tree, write atomically (write to `<path>.tmp`, fsync, rename).
  Never partially-written files on disk.
- **ARCH-004 -- Module-object internal structure.** Group related functions into frozen namespace objects (e.g. `Projection`, `Status`).
  Export the namespace, not loose functions, when an internal grouping is meaningful.
- **ARCH-005 -- Pure-helper testability seam.** Pure helpers are exported via an env-gated export (`if (process.env.CLIF_D_TEST_EXPORTS) { module.exports = {...} }`) so tests can reach them without re-implementing CLI plumbing.

## Quick reminders

- Do not edit `cli/clif-d.js` -- it is a symlink to `bin/clif-d`.
  Edit the original.
- Do not modify the top-level `CLAUDE.md` for CLI-specific rules.
  Add to this file instead.
- Pre-commit hook is wired by husky via `cli/package.json`'s `prepare` script.
  If a gate fails, `cd cli && npm run check` reproduces the failure.
