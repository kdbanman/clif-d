# CLIF-D plugin repo

This is a Claude Code plugin, not an application. It contains Skills (Markdown files with YAML frontmatter) that Claude Code loads at runtime. There is no source code to compile, no build step, and no test suite — verification is reading the changed Markdown and checking it for consistency with other skills and the README.

**Read @README.md before editing any skill.** It is the cross-skill knowledge base: what CLIF-D is, the skill pipeline, the artifact lifecycle, and the canonical TODO list of planned skills.

# Layout

- `skills/<skill-name>/SKILL.md` — one skill per directory, with optional `references/` and `assets/` subdirectories. Skills are auto-discovered by Claude Code; no registration step is needed when adding one.
- `.claude-plugin/` — plugin manifest and marketplace catalog. Update `plugin.json` only if the plugin's name, version, or description changes.

# IMPORTANT: two meanings of `clif-d/`

- `clif-d/` as **this repository** = the plugin source. You are in it now.
- `clif-d/` as **referenced inside skill text** (e.g. "save to `clif-d/prd.json`") = a directory in the *user's product repository* where CLIF-D artifacts live. It is NOT a directory in this plugin repo.

Do not confuse them when editing skills. When a skill says "the `clif-d/` directory", it always means the user's product repo, never this one.

# Editing skills

- **Read a sibling `SKILL.md` before writing or substantially editing one.** The existing skills share a recognizable structure (philosophy → interrogation → output structure → generation process) and tone (opinionated, terse, concrete). Match it.
- **No emojis.**
- **Skills are self-contained.** A user invoking one skill should not need to read another skill's text to understand it. Cross-skill knowledge lives in the README, not in skills referencing each other's internals.
- **Interface changes ripple.** When you change a skill's inputs, outputs, artifact paths, or position in the pipeline, check the pipeline diagram in @README.md and update upstream/downstream skills that depend on the change.

# CLI subproject (`bin/clif-d` + `cli/`)

This repo also contains the `clif-d` CLI -- a zero-dependency Node.js tool that skills invoke to read and mutate `prd.json`. It is an independent subproject with its own PRD and quality gates.

**Key paths:**
- `bin/clif-d` -- the shipped CLI (single file, zero runtime deps, `#!/usr/bin/env node`). Never add `require`/`import` of any npm package here.
- `cli/` -- dev tooling only: ESLint, Prettier, TypeScript (`checkJs`), husky, `node:test`. Never published.
- `cli-prd.json` -- PRD for the CLI (repo root).
- `cli-design-notes.md`, `cli-integration-plan.md` -- design rationale and per-skill integration plan for the CLI.
- `cli/clif-d/backpressure.md` -- quality backpressure design (what guardrails, why, how to suppress).
- `cli/clif-d/dev-environment.md` -- this subproject's bootstrap design and rationale.
- `cli/clif-d/plans/active/` -- active implementation plans for CLI requirements.

**Commands (run from repo root):**
- Bootstrap: `./cli/scripts/bootstrap.sh`
- Verify: `./cli/scripts/verify-env.sh`
- Aggregate check (what pre-commit runs): `cd cli && npm run check`
- Individual checks: `cd cli && npm run format:check | lint | typecheck | test`

**Gotchas:**
- Do not add runtime dependencies to `bin/clif-d` -- CTX-001 forbids it.
- Do not convert `bin/clif-d` to ES modules -- CTX-002 requires single-file CommonJS, no transpilation.
- Node is pinned to major `18` in `cli/.nvmrc`. Do not upgrade without updating `cli-prd.json` CTX-001 first.
- `bin/clif-d` is linted/type-checked via a symlink at `cli/clif-d.js -> ../bin/clif-d`; edit the original, not the symlink. See backpressure §4.
- Pre-commit hook is wired by husky via `cli/package.json`'s `prepare` script. It runs `npm run check` on every commit.
