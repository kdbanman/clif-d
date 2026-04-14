# AGENTS.md -- clif-d

A README for coding agents. Follows the `AGENTS.md` convention documented at https://agents.md/ (ecosystem-standard across 25+ agentic coding tools).

This repo is a Claude Code plugin that also contains the `clif-d` CLI subproject. The plugin surface and the CLI subproject are both documented below. If you only care about one, the section for the other still applies as context.

## Plugin surface (Markdown skills)

- No build step. No test suite. Verification is reading the changed Markdown for consistency with sibling skills and `README.md`.
- Read `README.md` before editing any skill -- it is the cross-skill knowledge base.
- Skills live under `skills/<skill-name>/SKILL.md`. Match the tone and structure of sibling skills. ASCII only; no emojis; no em-dashes (`\u2014`).

## CLI subproject (`bin/clif-d` + `cli/`)

The `clif-d` CLI is a zero-dependency Node.js tool at `bin/clif-d`. Dev tooling (ESLint, Prettier, TypeScript `checkJs`, husky, `node:test`) lives in `cli/`. The CLI is distributed as a single executable file via the plugin's `bin/` directory; it has no runtime dependencies and no build step.

### Bootstrap

```
./cli/scripts/bootstrap.sh
```

Requires Node.js 18+ on `PATH`. Installs pinned dev deps via `npm ci` and registers the husky pre-commit hook. Idempotent, non-interactive, no sudo.

### Verify

```
./cli/scripts/verify-env.sh
```

Runs prettier, eslint, tsc, node --test, and a `bin/clif-d --help` sanity check. Expect one soft warning on `node --test` until REQ-008 lands.

### Individual quality commands

Run from `cli/`:

| Command | What it does |
|---------|--------------|
| `npm run format:check` | Prettier format check on `bin/clif-d` |
| `npm run format` | Prettier write on `bin/clif-d` |
| `npm run lint` | ESLint on `bin/clif-d` (via `cli/clif-d.js` symlink) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | `node --test` |
| `npm run check` | all of the above (what the pre-commit hook runs) |

### Authoritative documents

| File | Purpose |
|------|---------|
| `cli-prd.json` | CLI product requirements (living document) |
| `cli-design-notes.md` | Open questions, non-goals, phasing rationale |
| `cli-integration-plan.md` | How each CLIF-D skill calls the CLI |
| `cli/clif-d/backpressure.md` | Quality guardrails: what, why, how to suppress |
| `cli/clif-d/dev-environment.md` | Bootstrap design and pinning |
| `cli/clif-d/plans/active/` | Active implementation plans |

### Hard constraints (do not violate)

- **Zero runtime deps in `bin/clif-d`.** CTX-001. Use only Node built-ins (`fs`, `path`, `process`, `child_process`).
- **Single-file CLI.** CTX-002. No ES module split, no transpilation.
- **Node major pinned to 18.** `cli/.nvmrc`. Do not bump without updating `cli-prd.json` CTX-001.
- **`bin/clif-d` is edited directly.** The `cli/clif-d.js` path is a symlink used to make ESLint and TypeScript see the file; never edit the symlink target.
- **No shell profile modifications.** Bootstrap does not touch `.zshrc`, `.bash_profile`, etc. Neither should you.

### What not to do

- Do not run `npm install` -- use `npm ci` (the bootstrap does this). Lockfile drift is blocked intentionally.
- Do not suppress ESLint rules inline without a justifying comment. Security rule suppressions require updating `cli/clif-d/backpressure.md` section 4.
- Do not use `// @ts-ignore`. Use `// @ts-expect-error` with an explanation.
- Do not commit without the pre-commit hook running. If the hook is missing, rerun the bootstrap.
