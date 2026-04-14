# Quality Backpressure -- clif-d CLI

## 1. Overview

This document defines the quality guardrails for the `clif-d` CLI tool -- a zero-dependency Node.js executable shipped as part of the CLIF-D Claude Code plugin. The guardrails enforce code quality as hard local gates that block commits on failure. No code enters the repository without passing formatting, linting, type checking, and tests.

The primary consumer of this CLI is a Claude Code agent executing CLIF-D skills. Agentic implementation makes backpressure especially important: the agent needs clear, fast, deterministic signals about whether its output meets quality standards. Vague warnings are useless; hard failures with actionable messages are essential.

The PRD for this tool is at `cli-prd.json` (repo root). No architecture document exists -- this backpressure design was derived directly from the PRD and its constraints (CTX-001 through CTX-009).

## 2. Technology Stack Context

| Decision | Value |
|----------|-------|
| Language | JavaScript (ES2022), plain JS with JSDoc type annotations |
| Runtime | Node.js 18+ (guaranteed by Claude Code) |
| Distribution | Single executable file at `bin/clif-d`, `#!/usr/bin/env node` shebang |
| Runtime dependencies | None. Node.js built-in modules only (fs, path, process) |
| Dev dependencies | ESLint, Prettier, TypeScript (checkJs only), husky, @types/node |
| Test framework | Node.js built-in test runner (`node:test`, `node:assert`) |
| Project structure | `bin/clif-d` (executable), `cli/` (dev infrastructure, tests, CLIF-D artifacts) |

The zero-dependency constraint (CTX-001) and single-file distribution (CTX-002) apply to the shipped artifact only. Development tooling lives in `cli/package.json` as devDependencies and is never bundled.

## 3. Guardrail Decisions

| Guardrail | Tool | Configuration | Strictness | Rationale |
|-----------|------|---------------|------------|-----------|
| Formatting | Prettier | Default config, no overrides | Standard | Zero-config is the point. No style debates. |
| Linting | ESLint v9 (flat config) | `recommended` + unicorn + n + security | Maximum viable | Three strict plugin layers catch modern JS issues, Node.js misuse, and security bugs |
| Type checking | TypeScript `checkJs` | `strict: true`, `noUncheckedIndexedAccess`, JSDoc annotations | Maximum for plain JS | Type safety without a build step -- `tsc --noEmit` checks, never compiles |
| Test enforcement | `node --test` (built-in) | All tests must pass | Zero tolerance | Zero additional dependencies, matches the project's minimalism |
| Coverage | `node --test --experimental-test-coverage` | Tracked, not gated pre-commit | Informational locally, gated in CI | Coverage analysis belongs in CI per testing-coverage reference |

## 4. Relaxations from Maximum Strictness

Every relaxation is listed here with explicit justification. If a rule is not listed, maximum strictness applies.

| Rule | Plugin | Status | Justification |
|------|--------|--------|---------------|
| `unicorn/no-process-exit` | eslint-plugin-unicorn | Disabled | CLI tools must call `process.exit()` with specific exit codes (0, 1, 2 per CTX-005). Unicorn recommends throwing errors instead, which is wrong for a CLI that defines exit codes as part of its contract. |
| `unicorn/prevent-abbreviations` | eslint-plugin-unicorn | Disabled | `req`, `ctx`, `arch` are established CLIF-D domain vocabulary used throughout the PRD and all skills. These are not lazy abbreviations -- they are the canonical names of the command domains (ARCH-002). |
| `n/no-process-exit` | eslint-plugin-n | Disabled | Same rationale as `unicorn/no-process-exit`. Both plugins flag the same pattern. |
| `security/detect-object-injection` | eslint-plugin-security | Disabled | The CLI reads and writes JSON objects by user-supplied keys (requirement IDs, field names). Every access is against parsed PRD data, not user-controlled code paths. This rule produces false positives on every bracket notation access. |
| `unicorn/no-null` | eslint-plugin-unicorn | Disabled | JSON.parse returns null for JSON null values. The CLI operates on JSON data where null is a valid value. Forcing undefined-only is incompatible with JSON semantics. |

## 5. Suppression Policy

- Inline suppression (`// eslint-disable-next-line <rule>`) requires a comment on the same line or preceding line explaining **why the rule does not apply**, not why it is inconvenient.
- Blanket file-level suppressions (`/* eslint-disable */`) are not permitted without amending this document.
- Security-related suppressions (any `security/*` rule) require an explanation added to the Relaxations table above (section 4). Do not suppress security rules inline without updating this document.
- `// @ts-ignore` is prohibited. Use `// @ts-expect-error` with an explanation instead -- it will fail if the error is fixed, preventing stale suppressions.
- Type-level suppressions via `/** @type {any} */` are permitted only at system boundaries (parsing raw JSON input, process.argv handling) with a comment explaining the boundary.

## 6. Hook Architecture

### Pre-commit (must complete in seconds)

Runs on every `git commit`. Order matters -- fast checks first, expensive checks last:

1. **Prettier** -- check formatting of `bin/clif-d`. Does not auto-fix in the hook; run `npm run format` to fix before committing.
2. **ESLint** -- lint `bin/clif-d`. No auto-fix. Fail and report violations. The developer/agent must understand and address the issue.
3. **tsc --noEmit** -- full project type check. Type errors can emerge from context changes anywhere in the file, so this checks the whole file, not just staged hunks.
4. **node --test** -- full test suite. The CLI operates on small JSON fixtures, so tests should complete in under 5 seconds.

Since `bin/clif-d` is a single file, lint-staged's incremental staging is unnecessary. Checks run directly against the file.

If any step fails, the commit is blocked.

### Pre-push

Not configured. The test suite is fast enough to run at pre-commit. If integration tests are added later and exceed the pre-commit time budget, move them to pre-push.

### CI (out of scope, noted for boundary clarity)

- Coverage enforcement (ratchet -- no decrease allowed)
- Security audit (`npm audit` on devDependencies)
- Mutation testing on critical paths (validate command, status transitions)

## 7. Developer/Agent Experience

**Lint violation:** The agent runs `git commit`. Husky fires the pre-commit hook. lint-staged runs ESLint on the staged `bin/clif-d` file. ESLint reports the rule name, line number, and message to stderr. The commit is blocked. The agent reads the error, fixes the violation in `bin/clif-d`, re-stages, and retries.

**Type error:** The agent runs `git commit`. lint-staged passes (formatting and linting OK). `tsc --noEmit` runs and reports a type error with file, line, and the expected vs actual types. The commit is blocked. The agent fixes the JSDoc annotation or the code, re-stages, and retries.

**Test failure:** The agent runs `git commit`. lint-staged and tsc pass. `node --test` runs and reports the failing test name, the assertion that failed, and the expected vs actual values. The commit is blocked. The agent fixes the code or test, re-stages, and retries.

**Suppressing a lint rule:** The agent adds `// eslint-disable-next-line <rule> -- <reason>`. If the rule is security-related, the agent must also update the Relaxations table in this document and include that change in the commit.

## 8. Practitioner Quick Reference

### What guardrails are in place

- Prettier (formatting)
- ESLint with unicorn, n, and security plugins (linting)
- TypeScript checkJs with strict mode (type checking)
- Node.js built-in test runner (test enforcement)

### When they run

All four run on every commit via a pre-commit hook.

### How to set up

```bash
cd cli
npm install
```

The `prepare` script in `package.json` automatically installs the git hooks via husky.

### How to run manually

```bash
cd cli

# Format
npx prettier --write ../bin/clif-d

# Lint
npx eslint ../bin/clif-d

# Type check
npx tsc --noEmit

# Test
node --test test/**/*.test.js

# All checks (what the pre-commit hook runs)
npm run check
```

### How to handle failures

1. Read the error message. It tells you the rule, the line, and what is wrong.
2. Fix the code, not the rule. If the rule is genuinely wrong for this case, see Suppression Policy (section 5).
3. Re-stage and retry.

### Suppression policy (summary)

- Inline suppression requires an explanatory comment.
- Security rule suppressions require updating this document.
- `// @ts-ignore` is prohibited; use `// @ts-expect-error` with explanation.
- File-level suppressions require amending this document.

### How to update guardrails

- To add or modify ESLint rules: edit `cli/eslint.config.js`. If disabling a rule from maximum strictness, add it to the Relaxations table (section 4) with justification.
- To change type checking strictness: edit `cli/tsconfig.json`. Document the change in this file.
- To add a pre-push hook: create `cli/.husky/pre-push` and document the change in Hook Architecture (section 6).

## 9. PRD and Architecture Traceability

| Guardrail Decision | PRD/Architecture References |
|--------------------|-----------------------------|
| Zero runtime dependencies for tooling | CTX-001 (zero-dependency constraint) -- devDeps are fine, runtime deps are not |
| Single file must pass all checks | CTX-002 (single-file distribution) -- all guardrails target one file |
| JSON schema validation in tests | CTX-003 (PRD schema as contract) -- test fixtures must conform to schema |
| Actionable error messages, no colors by default | CTX-004 (agent persona) -- agents need parseable errors, not pretty output |
| Exit code correctness in tests | CTX-005 (CLI design conventions) -- every command's exit codes are tested |
| Atomic write correctness in tests | ARCH-003 (read-validate-write cycle) -- tests verify no partial writes |
| process.exit() permitted | CTX-005 -- exit codes are part of the CLI contract, not a code smell |
