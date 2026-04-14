# GEMINI.md -- clif-d

Context file for Gemini CLI. Gemini CLI reads `GEMINI.md` from the project root automatically.

This repository has authoritative agent-facing documentation in `AGENTS.md`. **Read `AGENTS.md` for the full set of commands, constraints, and authoritative document pointers.** What follows is a terse summary plus the must-know rules.

## What this repo is

A Claude Code plugin (Markdown skills under `skills/`) plus the `clif-d` CLI subproject (`bin/clif-d` + dev tooling in `cli/`).

## Bootstrap

```
./cli/scripts/bootstrap.sh
```

Requires Node.js 18+. Installs pinned dev deps via `npm ci`, registers the husky pre-commit hook.

## Verify

```
./cli/scripts/verify-env.sh
```

## Pre-commit check

```
cd cli && npm run check
```

## Where to look first

- `README.md` -- cross-skill knowledge base.
- `AGENTS.md` -- full agent-facing reference.
- `cli-prd.json` -- CLI product requirements (living).
- `cli/clif-d/backpressure.md` -- quality guardrails and suppression policy.
- `cli/clif-d/dev-environment.md` -- bootstrap design and pinning rationale.

## Hard rules

- `bin/clif-d` has zero runtime dependencies (CTX-001) and is a single file (CTX-002). Do not add `require` of any npm package. Do not split it into multiple files.
- Node is pinned to major `18`. Do not upgrade casually.
- Suppress lint rules only with an explanatory comment; security-rule suppressions require updating `cli/clif-d/backpressure.md` section 4.
- No emojis in generated files. ASCII only; no `\u2014` (em-dash), use hyphens.
- Do not modify the user's shell profile. The bootstrap does not; neither should you.

## What not to do

- Do not run `npm install`. Use `npm ci`. The lockfile is authoritative.
- Do not use `// @ts-ignore`. Use `// @ts-expect-error` with an explanation.
- Do not commit without the pre-commit hook. If it is missing, rerun the bootstrap.
