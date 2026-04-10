---
name: design-backpressure
description: >
  Design and implement quality guardrails for a codebase — aggressive linting, maximal type enforcement, mandatory
  test passing, and pre-commit hooks that enforce all of the above as hard local gates. Use this skill when the user
  has an architecture document (from the create-architecture skill or equivalent) and wants to set up quality
  backpressure before implementation begins. Researches the most aggressive viable styleguide and linter configuration
  for the project's language, domain, and libraries, configures the strictest type-checking mode, sets up test
  enforcement, and wires everything into pre-commit hooks so that no code enters the repository without passing all
  gates. The goal is to create friction against low-quality code so that agentic implementation naturally produces
  high-quality output.
---

# Design Quality Backpressure

You are helping the user set up **quality backpressure** — hard, automated guardrails that enforce code quality locally before code can be committed. This is especially important for agentic (LLM-driven) implementation workflows, where the agent needs clear, fast signals about whether its output meets quality standards.

The metaphor is backpressure: these guardrails create resistance that pushes back against low-quality code, forcing the implementation process (human or agentic) to meet standards before moving forward.

---

## Philosophy

### Hard gates, not suggestions

Every guardrail must be a **hard gate** — a check that runs automatically and blocks progress (commit, push, or CI) on failure. Advisory warnings, optional lints, and "recommended" checks are not backpressure. If it doesn't block, it doesn't count.

### Maximal strictness as the starting point

Start with the **strictest viable configuration** for every tool, then relax only with explicit justification. This means:

- The most aggressive linter preset available (not "recommended" — the one that makes experienced developers uncomfortable)
- The strictest type-checking mode the language supports
- Zero tolerance for test failures
- Zero tolerance for linter violations (no `// eslint-disable`, no `# type: ignore` without documented justification)

The rationale: it's easy to relax a rule that proves counterproductive. It's hard to tighten rules after a codebase has accumulated violations. Start strict.

### Fast feedback loops

Guardrails must be **fast enough to run on every commit**. If a check takes more than a few seconds, it belongs in CI, not in pre-commit. Optimize for the tightest feedback loop possible:

1. **Pre-commit hooks**: Format, lint, type-check, run unit tests. Must complete in seconds.
2. **Pre-push hooks** (if needed): Longer integration tests, full test suite. Must complete in under a minute.
3. **CI** (out of scope for this skill): Everything else.

### Language-native tooling

Use the language ecosystem's own tools wherever possible. Don't add a generic multi-language linter when the language has a mature, specific one. Don't add a generic test runner when the language has a standard one. Native tools have better error messages, better editor integration, and better community support.

---

## Input

This skill expects:

1. **An architecture document** (from the `create-architecture` skill or equivalent) that specifies the language, runtime, test framework, and project structure.
2. **The CLIF-D PRD** referenced by the architecture document.

Read both fully before beginning. The architecture document's Technology Decisions and Testing Architecture sections are your primary inputs.

If no architecture document exists yet, you can work from a PRD alone or even from a bare codebase — but you'll need to interrogate more heavily to determine the technology stack.

---

## Interrogation

**Your job is to arrive at a concrete, implementable quality guardrail configuration.** Do not generate configuration files until you are ready. Interrogate first.

Start by reading the architecture document (or PRD, or codebase) and summarizing the technology stack. Then identify what guardrails are appropriate and research the best options.

### 1. Research the strictest viable configurations

For the project's language, research:

- **Linting**: What is the most aggressive styleguide and linter configuration available? Not the "recommended" preset — the strictest one that a serious team would use. For example:
  - TypeScript/JavaScript: `eslint` with `eslint-config-strict` or a custom config building on `@typescript-eslint/strict-type-checked` plus `unicorn/recommended` plus `import/recommended`
  - Python: `ruff` with `ALL` rules enabled, selectively disabling only what's genuinely inapplicable
  - Rust: `clippy` with `#![deny(clippy::all, clippy::pedantic, clippy::nursery)]`
  - Go: `golangci-lint` with an aggressive `.golangci.yml` enabling `gocritic`, `gosec`, `exhaustive`, `wrapcheck`, etc.

- **Type checking**: What is the strictest mode?
  - TypeScript: `strict: true` plus additional flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, etc.)
  - Python: `mypy --strict` or `pyright` in strict mode
  - Rust: already strict by default, but add `#![deny(warnings, missing_docs)]`

- **Formatting**: What is the standard, zero-config formatter?
  - Prettier, Black, rustfmt, gofmt — whatever the ecosystem standard is. No configuration debates. Use the default style.

- **Domain-specific lints**: Are there lints specific to the libraries or domain?
  - React: `eslint-plugin-react-hooks`, accessibility lints
  - Security: `bandit` (Python), `gosec` (Go), `cargo-audit` (Rust)
  - SQL: `sqlfluff` if SQL is involved

**Use web research extensively here.** Look for blog posts, conference talks, and repos from teams known for strict quality practices. Look for "strict" or "hardcore" ESLint configs. Look for linter configurations used by well-known open-source projects in the same language.

### 2. Assess the project's testing approach

From the architecture document's Testing Architecture section:
- What test framework is specified?
- What's the expected test structure (unit + integration)?
- Are there coverage requirements?

Determine how to enforce:
- All tests pass (exit code check)
- Test coverage meets a threshold (if specified)
- New code has test coverage (if tooling supports it)

### 3. Determine the hook mechanism

Research the best pre-commit hook mechanism for the project:
- **Language-native**: `husky` + `lint-staged` (JS/TS), `pre-commit` framework (Python), git hooks in `Makefile` (Go, Rust)
- **Generic**: the `pre-commit` framework (pre-commit.com) works across languages
- **Simple**: a shell script in `.git/hooks/pre-commit` with a checked-in setup script

Prefer the approach most natural to the language ecosystem.

### 4. Present the plan for confirmation

Before generating any configuration, present:
- Every tool that will be installed and configured
- The strictness level of each tool's configuration, with specific presets/flags named
- The hook mechanism and what runs at each stage (pre-commit, pre-push)
- Any rules you're proposing to disable from the strictest preset, with rationale
- The expected developer experience: what happens when a developer (or agent) tries to commit code that violates a rule

Wait for user confirmation before generating.

---

## Output

This skill produces **two categories of output**: a design document (the durable artifact capturing decisions and rationale) and implementation artifacts (the configuration files that enforce those decisions).

---

### Output 1: Design Document — `backpressure-<product-name>.md`

A Markdown document saved in the current working directory alongside the other design artifacts (concept doc, PRD, architecture doc). This is the **authoritative record** of what quality guardrails were chosen, why, and what was deliberately relaxed.

#### Structure

**1. Overview**
Brief summary (2-3 paragraphs) of the backpressure approach. Reference the architecture document and PRD by file path. State the core principle: what quality standard this project enforces, and why agentic implementation makes this especially important.

**2. Technology Stack Context**
Summarize the relevant technology decisions from the architecture document: language, runtime, test framework, project structure. This makes the backpressure document self-contained.

**3. Guardrail Decisions**

A table of every guardrail, its tool, its configuration, and its rationale:

| Guardrail | Tool | Configuration | Strictness | Rationale |
|-----------|------|---------------|------------|-----------|
| Linting | `ruff` | `ALL` rules, 3 disabled | Maximum viable | ... |
| Type checking | `pyright` | Strict mode | Maximum | ... |
| Formatting | `black` | Default config | Standard | ... |
| Test enforcement | `pytest` | All must pass | Zero tolerance | ... |
| ... | ... | ... | ... | ... |

**4. Relaxations from Maximum Strictness**

Every rule or check that was deliberately disabled or relaxed from the absolute strictest setting, with explicit justification. If this section is empty, that's fine — it means maximum strictness was viable across the board. This section exists so that future reviewers can evaluate whether relaxations are still justified.

**5. Suppression Policy**

When and how it's acceptable to suppress a lint rule or type error inline. The default policy:
- Suppression requires an inline comment
- The comment must explain **why the rule doesn't apply**, not why it's inconvenient
- Suppression of security-related rules requires a second reviewer or explicit sign-off
- Blanket file-level suppressions are not permitted without design document amendment

**6. Hook Architecture**

What runs at each stage, in what order, and why:
- **Pre-commit**: Format → lint → type-check → unit tests. Must complete in seconds.
- **Pre-push** (if applicable): Full test suite, integration tests. Must complete in under a minute.
- **CI** (out of scope for this skill, but note what belongs here): Coverage enforcement, security scanning, etc.

**7. Developer/Agent Experience**

A narrative description of what happens when:
- A developer (or agent) tries to commit code with a lint violation
- A developer (or agent) tries to commit code with a type error
- A developer (or agent) tries to commit code with a failing test
- A developer (or agent) tries to suppress a lint rule

This section helps the reader understand the guardrails in practice, not just in theory.

**8. PRD and Architecture Traceability**

How the guardrail decisions trace back to PRD context items and architecture decisions:

| Guardrail Decision | PRD/Architecture References |
|--------------------|-----------------------------|
| Strict type checking | CTX-003 (type safety constraint), Architecture §2 |
| ... | ... |

---

### Output 2: Implementation Artifacts — in the product repository

Once the design document is confirmed, generate the actual configuration files and hooks in the product repo.

#### Configuration files

Generate all necessary configuration files for the chosen tools. Examples (language-dependent):

- Linter config (`.eslintrc.json`, `ruff.toml`, `.golangci.yml`, `clippy.toml`, etc.)
- Type checker config (if separate from `tsconfig.json`, `pyrightconfig.json`, etc.)
- Formatter config (usually zero-config — `.prettierrc` only if necessary)
- Pre-commit hook config (`.pre-commit-config.yaml`, `.husky/`, `Makefile` targets, etc.)
- Git hooks setup script or package.json scripts

#### Setup script

A single command or script that a developer runs to install all guardrails:

```bash
# Example for a JS/TS project:
npm install  # husky hooks auto-install via prepare script

# Example for a Python project:
make setup   # installs pre-commit hooks, creates venv, installs dev deps

# Example for a Rust project:
make setup   # installs git hooks, cargo-audit, etc.
```

The setup must be idempotent — safe to run multiple times.

#### `QUALITY.md`

A practitioner-facing document at the product repo root. This is the **developer's view** of the design document — concise and actionable, not exhaustive. It covers:

1. **What guardrails are in place** — a summary of every check that runs
2. **When they run** — pre-commit, pre-push, CI
3. **How to set up** — the setup command
4. **How to run manually** — commands to run each check individually
5. **How to handle failures** — what to do when a check blocks your commit
6. **Suppression policy** — summary of the policy from the design document, with a link back to it for the full rationale
7. **How to update** — how to add or modify rules, and when an update requires amending the design document

#### Pre-commit hook behavior

The pre-commit hook should:

1. **Format** changed files (auto-fix, stage the formatted result)
2. **Lint** changed files (no auto-fix — fail and show errors)
3. **Type-check** (may need to check the full project, not just changed files)
4. **Run tests** affected by changes (or all unit tests if scoping is impractical)
5. **Block the commit** if any step fails with a non-zero exit code
6. **Print clear, actionable error messages** — the developer (or agent) should know exactly what to fix

#### What the guardrails should NOT do

- **Auto-fix lint violations silently**: Formatting is auto-fixed (it's mechanical). Lint violations are reported, not auto-fixed — the developer needs to understand and address the issue.
- **Run slow checks**: Anything taking more than ~10 seconds belongs in pre-push or CI.
- **Require network access**: All pre-commit checks must work offline.
- **Modify unstaged files**: Only operate on staged changes (use `lint-staged` or equivalent).

---

## Generation process

Once the user confirms the plan:

1. **Generate the design document** (`backpressure-<product-name>.md`) in the current working directory, following the structure above.
2. **Wait for user confirmation** of the design document before generating implementation artifacts.
3. **Generate configuration files** for each tool, placed at their conventional locations in the product repository.
4. **Generate the setup script** or `Makefile` targets.
5. **Generate `QUALITY.md`** at the product repo root, referencing the design document.
6. **Wire up git hooks** — either via the hook framework's installation mechanism or by generating hook scripts directly.
7. **Test the setup** by running the setup script and verifying each check runs successfully on the current codebase (or reports expected violations if the codebase doesn't yet exist).
8. **Report** what was generated and how to use it.
