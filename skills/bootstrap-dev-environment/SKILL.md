---
name: bootstrap-dev-environment
description: >
  Bootstrap a reproducible, agent-executable development environment for a CLIF-D project, and wire in the quality
  guardrails from the backpressure design. Use after create-architecture and design-backpressure, when the toolchain
  and guardrails are specified but nothing has verified the tools are installed, version-pinned, and invokable from
  an agent subshell, and nothing has wired up the hooks, linters, type checker, or suppression scanner. Researches
  the ecosystem for the most reproducible bootstrap mechanism (containers, devcontainers, version-pinned setup
  scripts), generates setup artifacts and the configs and hook scripts that realize the backpressure design, runs
  the pre-existing-suppression audit, verifies every Technology Decisions command and hook stage runs end-to-end,
  and writes a CLAUDE.md so Claude Code inherits environment context. Produces clif-d/dev-environment.md plus the
  setup artifacts and guardrail implementation.
---

# Bootstrap Dev Environment

You are helping the user make their project's development environment **reproducible and agent-accessible**, and you are **implementing the quality backpressure** that `design-backpressure` specified. The architecture document has already decided the toolchain; the backpressure document has already decided the quality standards and hook architecture. Your job is to turn those decisions into a concrete, version-pinned, idempotent setup -- including the actual linter configs, hook scripts, suppression scanner, and pre-existing-suppression audit -- that works for three audiences simultaneously: the user on their local machine, a Claude Code agent invoked on that machine, and a cloud agent runtime that starts from a near-empty container.

The division of labor is strict: `design-backpressure` decides *what* guardrails exist and how strict they are; this skill makes them *real*. If the bootstrap uncovers a design problem (a tool does not exist at the pinned version, a hook framework is incompatible with the containerization choice), return to `clif-d/backpressure.md` and amend it -- do not work around it in a config file.

---

## Philosophy

### The agent subshell problem

A user's `.zshrc` or `.bash_profile` puts tools like `uv`, `cargo`, `rustup`, `nvm`, `pnpm`, or `pyenv` on `PATH` through shell hooks. A coding agent's non-interactive subshell does **not** inherit those hooks the same way. A project that builds fine in the user's terminal can be completely inert to the agent sitting next to them. Every bootstrap decision should be validated from an environment that resembles the agent's - likely your own shell - not the user's login shell.

The same problem is worse on cloud agent runtimes, which begin from a bare image and have no user profile at all.

### Reproducibility over convenience

Prefer the mechanism that is **most reproducible**, not the one that is fastest to set up on the user's current machine. A one-line `brew install` that happens to work today is worse than a version-pinned installer that will still work in six months on a fresh machine. Versions must be pinned. Installers must be scripted. System-level prerequisites must be declared, not assumed.

### Containers first, scripts second

The ideal: the agent and CI both run inside the same container image. The container is the environment. A devcontainer or Dockerfile removes the whole class of "works on my machine" problems at once. Prefer this when the project allows it.

Fall back to a **setup script** (a `Makefile` target, a `scripts/bootstrap.sh`, or equivalent) only when containerization is genuinely unworkable - for example, projects that need direct access to host GPUs, macOS-only toolchains, or hardware peripherals. The fallback must still pin versions and be idempotent.

Reach for heavier provisioning (Ansible, Nix, etc.) only when the setup genuinely has multi-step system-level dependencies that a shell script cannot manage cleanly. Prefer simpler mechanisms first.

### Idempotent, non-interactive, offline-capable

The bootstrap must be safe to run repeatedly, must not require human input (no `y/N` prompts, no editor opens), and should work with whatever network access the agent has. An agent running your bootstrap should either succeed or fail cleanly - never hang.

### Verify what the architecture promises

The architecture document's Technology Decisions table lists commands: the test framework, the linter, the package manager, the CLI entry point. Every single one must be invokable after bootstrap completes. The verification step is not optional - it is the proof that the environment actually matches the architecture.

### Implement what the backpressure design promises

The backpressure document lists guardrails: every linter rule set, every type-checker mode, every pre-commit step, the suppression scanner's pattern set, the hook framework, the exact setup command. Every single one must exist after bootstrap completes and must be wired into the hook mechanism. A guardrail that is designed but not installed is worse than no guardrail at all: it signals a commitment the repo is not actually keeping. End-to-end verification includes a negative test -- attempt to introduce a suppression directive into a scratch file and confirm the scanner blocks the commit with the expected message -- so the guardrail is proven live, not merely configured.

### Agent instruction files are part of the environment

A coding agent that does not know about `clif-d/` or the project's build commands will flail. The standard mechanism to tell it is an "instruction file" -- `CLAUDE.md` for Claude Code, always loaded into the agent's context. This is part of the bootstrap because it is how the environment makes itself known to the agent. Do not skip it.

Note: instruction files are distinct from **rule files**. Rule files live under `.claude/rules/*.md`, carry `globs:` frontmatter, and re-enter the agent's context only when a matching file is read or edited. They are out of scope for this skill; `compactify-artifacts` is the skill that creates them.

### Hooks must survive fresh clones and ephemeral environments

`.git/hooks/` is not version-controlled. A fresh clone -- whether on a new laptop, a worktree, or a cloud agent runtime that spins up a container per session -- starts with zero hooks installed. A backpressure gate that depends on `.git/hooks/` without a propagation mechanism is silently inert everywhere except the machine where it was originally installed.

The bootstrap is the only place this problem gets solved. Three properties must all hold:

1. **Committed source.** Hook definitions (or the generator that produces them) live at a stable, version-controlled path named in `clif-d/backpressure.md` -- `.husky/<hook>`, `.pre-commit-config.yaml`, `scripts/hooks/<hook>`, or equivalent.
2. **Idempotent activation.** The bootstrap's hook-activation step (an npm `prepare` lifecycle, `pre-commit install`, a `git config core.hooksPath`, or a small script that symlinks from `.git/hooks/` into the committed source) is safe to run any number of times. It converges the live hook state to what is committed, without requiring manual cleanup.
3. **Automatic re-invocation.** The bootstrap script itself runs on every environment that matters. For Claude Code, a SessionStart hook in `.claude/settings.json` that invokes the bootstrap is the standard mechanism -- it guarantees that a cloud session starting from a fresh clone re-activates hooks before the agent does anything else. Ship one.

A backpressure-design change that updates a hook definition must propagate the moment a developer or agent pulls and re-bootstraps. No manual "re-run `design-backpressure`" step is acceptable, because those skills are not run again after initialization.

---

## Input

This skill expects:

1. **An architecture document** at `clif-d/architecture.md` in the product repository. Read its Technology Decisions, Repository Structure, and Testing Architecture sections in full - they are your primary input for the environment itself.
2. **A backpressure design document** at `clif-d/backpressure.md` (from `design-backpressure`). Read every section. The Guardrail Decisions table, the Relaxations table, the Hook Architecture section, and the suppression-scanner specification are your primary input for the guardrail implementation. Every tool, rule, pattern, and command you install or wire must come from this document.
3. **The CLIF-D PRD** at `clif-d/prd.json`. The scaffolding requirements appended by `create-architecture` reveal which build and test commands must be invokable. The backpressure context item recorded by `design-backpressure` is the constraint you are making real.
4. **Any existing setup artifacts** in the repo (`Dockerfile`, `devcontainer.json`, `Makefile`, `scripts/`, lockfiles, linter configs, `.husky/`, pre-commit configs). Read before overwriting.

If no architecture document exists, stop and tell the user to run `create-architecture` first. This skill is not equipped to invent technology decisions - it implements them.

If no backpressure document exists, stop and tell the user to run `design-backpressure` first. This skill is not equipped to invent quality-guardrail decisions either -- it implements them. (If the user is explicitly deferring backpressure, they can say so; in that case run the bootstrap for the environment only and explicitly note in the dev-environment document that guardrail implementation is deferred and a later invocation of this skill must complete it.)

---

## Interrogation

**Your job is to arrive at a concrete, reproducible bootstrap mechanism and a verified working environment.** Do not generate artifacts until you are ready. Interrogate first.

Start by summarizing what the architecture has decided (language, runtime version, package manager, test framework, linter, type checker, any system-level dependencies) **and** what the backpressure document has decided (rule sets, type-check mode, hook framework, hook-stage command order, suppression-scanner spec, pre-existing-suppression policy, setup command name). Then work through the dimensions below.

### 1. Target audiences for the environment

Which of these must the bootstrap work for? Confirm all three, because the answer shapes every other decision.

- **The user's local machine** (macOS is the assumed default).
- **A coding agent's subshell on that same machine.** Non-interactive, does not inherit the user's `.zshrc` functions.
- **A cloud agent runtime** (Linux container, near-empty image, no user profile).

If all three are in scope, a containerized environment becomes much more attractive.

### 2. Containerization viability

Can this project run inside a container for development? Ask explicitly:

- Are there host dependencies that cannot be containerized (GPU, macOS-only toolchain, USB/hardware peripherals, code signing)?
- Does the user already use Docker Desktop, Podman, Colima, macOS Containers, or OrbStack? If so, which?
- Does the user's editor or agent support devcontainers (`devcontainer.json`)?

If containerization is viable, prefer it. If not, document why and fall back to a setup script.

### 3. Version pinning and installers

For every tool the architecture names:

- What version should be pinned? Prefer the version already specified in the architecture document. If unspecified, research the current LTS or stable release and propose a specific version.
- What is the canonical, scriptable, non-interactive installer?
  - Rust: `rustup-init -y` with a pinned toolchain in `rust-toolchain.toml`.
  - Python: `uv python install <version>`, or `pyenv install` for projects that need it.
  - Node: `corepack` + a pinned version in `.nvmrc` / `package.json` `engines` / `volta`.
  - Go: version pin in `go.mod`'s `go` directive; `gotip` or a specific tarball if needed.
  - System libraries: declare in the Dockerfile or in the setup script's `brew`/`apt` block.
- Is there a lockfile? Is it checked in? Is the install command actually honoring it (`npm ci`, `uv sync --frozen`, `cargo build --locked`)?

### 4. Bootstrap entry point

What single command will the user (and any agent) run to set everything up? Conventions:

- `make bootstrap` or `make setup`
- `./scripts/bootstrap.sh`
- Devcontainer "reopen in container" (IDE-driven, but there should still be a CLI equivalent for headless agents)

Pick one and commit to it. The command must appear in the architecture document, in `CLAUDE.md`, and in the dev-environment design document - identically.

### 5. Agent context

This skill generates a `CLAUDE.md` file for Claude Code. If one already exists, merge rather than overwrite -- the user may have hand-authored content. Research the **current** official guidance on `CLAUDE.md` location, format, and scope before generating. Do not rely on cached knowledge -- conventions move.

### 6. What the agent needs to know

The instruction file content should be terse and concrete. At minimum:

- The bootstrap command.
- The build, test, lint, and type-check commands (copied verbatim from the architecture's Technology Decisions).
- The location of CLIF-D artifacts (`clif-d/prd.json`, `clif-d/architecture.md`, etc.) and what each is for.
- Any non-obvious environment quirks (e.g. "activate the venv before running tests" - though a good bootstrap should make this unnecessary).
- What NOT to do: do not run `brew install` inline, do not modify `.zshrc`, do not downgrade pinned versions.

### 7. Verification plan

List every command from the architecture's Technology Decisions table and the PRD's scaffolding requirements. After bootstrap, each must run from a fresh subshell and exit cleanly (or with an expected exit code, for a trivial test). This list becomes the verification script. Add every hook-stage command from `clif-d/backpressure.md` to the same list -- the bootstrap must prove those run too, including a negative test of the suppression scanner.

### 8. Guardrail implementation plan

Translate each Guardrail Decision row in `clif-d/backpressure.md` into a concrete implementation task:

- **Tool installation.** Does the tool install via the language's package manager (devDependency), via a system package, via a pinned installer script, or as part of a container image? Pick the mechanism most consistent with the rest of the bootstrap.
- **Configuration file.** What filename? Where does it live? If the backpressure document did not name a path, pick the ecosystem-conventional one and note that choice in the dev-environment document (not in the backpressure document -- do not silently edit the design).
- **Rule set loading.** Translate the backpressure document's rule choices into the tool's actual config syntax. If the translation reveals an impossibility (a named rule does not exist in that version), stop and return to `design-backpressure` rather than substituting a different rule.
- **Hook framework.** The backpressure document chose one (husky, pre-commit.com, lefthook, Makefile-wrapped hooks, etc.). Identify its install command and confirm that command works inside the chosen bootstrap mechanism.
- **Hook propagation.** Confirm the hook definitions are committed at the version-controlled path the backpressure document names, that the activation command is wired into the bootstrap script (not a manual follow-up), and that the activation is idempotent -- a second bootstrap run must be a safe no-op on an already-configured clone and must update the active hooks when the committed definitions have changed. If the chosen framework writes to `.git/hooks/` (rather than redirecting via `core.hooksPath`), the bootstrap must re-write those files on every invocation so that pulled changes take effect. Also generate a SessionStart hook in `.claude/settings.json` invoking the bootstrap command, so a Claude Code session opened against a fresh clone or cloud runtime activates hooks automatically before the agent begins work. If `.claude/settings.json` already exists, merge rather than overwrite.
- **Suppression scanner.** Generate the scanner script per the backpressure spec: same language, same pattern set, same allowlist format, same failure message. Include its self-tests.
- **Pre-existing-suppression audit.** Run the scanner over the whole tree once during setup. Surface every hit to the user for delete-or-relax decisions before declaring the bootstrap complete. Never silently grandfather.

### 9. PRD coordination

`design-backpressure` has already added a `constraint`-type context item for the backpressure approach and backfilled `context_refs`. Confirm it exists before you start. If it does not, that is a signal that `design-backpressure` was skipped or did not finish -- do not paper over this by writing it yourself; return to `design-backpressure`.

### Interrogation protocol

- **Do not ask all questions at once.** Most answers come from the architecture document. Only ask when the document is silent or ambiguous.
- **Use web research aggressively** for installer conventions, pinning mechanisms, and especially the `CLAUDE.md` format - these change frequently.
- **Make provisional decisions and present them for confirmation.** "I'd containerize with a devcontainer based on the official Python 3.12 image, install `uv` via the pinned installer script, and run `uv sync --frozen` as the bootstrap command - does that work?" beats "How should we install Python?"
- **Present the full plan before generating.** Containerization choice, pinned versions, bootstrap command, the `CLAUDE.md` to generate, verification commands. Wait for confirmation.

---

## Output

This skill produces a design document and implementation artifacts.

---

### Output 1: Design Document - `clif-d/dev-environment.md`

A Markdown document saved as `clif-d/dev-environment.md` in the product repository. This is the **authoritative record** of how the environment is bootstrapped, what versions are pinned, and how agents inherit context. See the README section "The `clif-d/` directory" for the full artifact layout and lifecycle.

#### Structure

**1. Overview**
Brief summary (2-3 paragraphs). Reference the architecture document and PRD by file path. State the bootstrap mechanism (container, devcontainer, setup script) and the single entry-point command. Note which audiences the environment targets (local, local agent, cloud agent).

**2. Target Environments**
One short subsection per audience confirmed in interrogation step 1. For each: what starting state is assumed, what the bootstrap produces, what is out of scope.

**3. Technology Stack (from architecture)**
A table repeating the architecture's Technology Decisions, now with **pinned versions and installer references**:

| Tool | Version | Installer | Install Command |
|------|---------|-----------|-----------------|
| Python | 3.12.7 | `uv` | `uv python install 3.12.7` |
| ... | ... | ... | ... |

This makes the document self-contained - a reader does not need to flip to the architecture to know what gets installed.

**4. Bootstrap Mechanism**
Explain the chosen mechanism (container, devcontainer, script). For each artifact generated (Dockerfile, devcontainer.json, Makefile, bootstrap.sh), state its role and where it lives in the repo.

**5. Bootstrap Command**
The single command a user or agent runs. State it once here, verbatim, so every downstream artifact can quote it.

**6. Idempotency and Failure Modes**
How the bootstrap behaves when run a second time, when a dependency is already installed, when network access is absent, when a pinned version has been manually overridden. Document expected behavior.

**7. Verification**
The list of commands from Technology Decisions, scaffolding requirements, and every hook-stage command from `clif-d/backpressure.md` that must succeed after bootstrap. Include the verification script's location (e.g. `scripts/verify-env.sh` or a `make verify` target) and the suppression-scanner negative test. Show sample expected output.

**8. Agent Instruction Files and Session Hooks**
Which instruction files were generated and at what paths. Summarize what each contains and why. Reference the official Claude Code documentation source used to choose the file's location and format (URL + date checked - these conventions drift). Also document the `.claude/settings.json` SessionStart hook this skill emits: the command it runs (the bootstrap entry point from §5, verbatim), the rationale (hook propagation to fresh clones and cloud agent runtimes that never re-run `design-backpressure` or `bootstrap-dev-environment`), and any merged-in user content. If the bootstrap also establishes scoped **rule files** (`.claude/rules/*.md`), document them separately with their `globs:` scope -- these are out of scope for this skill but if they already exist in the repo, note their presence.

**9. Backpressure Implementation**

A subsection per guardrail from `clif-d/backpressure.md`, mapping the design decision to the concrete artifact that realizes it:

| Guardrail (from backpressure.md) | Config File | Install Mechanism | Hook Stage |
|----------------------------------|-------------|-------------------|------------|
| Linting -- ruff ALL rules        | `ruff.toml` | devDependency via `uv add --dev`  | pre-commit |
| Suppression scanner              | `scripts/no-suppressions.sh` + allowlist | checked in, run by husky | pre-commit (first step) |
| ...                              | ...         | ...               | ...        |

State the pre-existing-suppression audit result (clean, or the list of surfaced suppressions and how each was resolved). If any guardrail from the backpressure document was *not* implemented, say so explicitly in §10 (Relaxations) with a rationale and a plan to close the gap. An unimplemented guardrail is a broken commitment, not a feature.

**10. Relaxations and Deferred Items**
Anything deliberately not pinned, not containerized, not verified, or not implemented from the backpressure design, with justification. Examples:
- "Node version is pinned via `.nvmrc` but not enforced at bootstrap time - the user requested this to match their existing workflow."
- "GPU drivers are assumed present; bootstrap does not install them."
- "Coverage enforcement is deferred to CI per backpressure.md §6; local pre-commit runs `node --test` without coverage."
Empty is good - it means the bootstrap is fully specified.

**11. PRD and Architecture Traceability**

| Bootstrap Decision | PRD/Architecture/Backpressure References |
|--------------------|------------------------------------------|
| Python 3.12.7 pin | ARCH-002 (runtime), CTX-004 (version constraint) |
| Devcontainer image | ARCH-001 (deployment target) |
| Husky + lint-staged wiring | backpressure.md §6 (Hook Architecture), CTX-NNN (backpressure constraint) |
| ... | ... |

---

### Implementation Artifacts - in the product repository

Once the design is confirmed, generate the actual artifacts.

#### Containerized projects

- **`Dockerfile`** (or `.devcontainer/Dockerfile`) with pinned base image, pinned tool versions, non-root user, minimal layers. Avoid `latest` tags.
- **`.devcontainer/devcontainer.json`** if devcontainers are in use, configured so the IDE and CLI-based `devcontainer up` produce the same environment.
- **`docker-compose.yml`** only if the project needs additional services (database, cache). Otherwise keep it to one image.

#### Script-based projects

- **`scripts/bootstrap.sh`** (or a `Makefile` target invoking it) that:
  - Detects OS and fails clearly on unsupported platforms.
  - Installs version-pinned runtimes and package managers via official scripted installers.
  - Invokes the project's own dependency-install command with `--frozen`/`--locked` semantics.
  - Is idempotent: a second run should be a fast no-op on an already-configured machine.
  - Prints clear status as it goes; on failure, prints an actionable error and exits non-zero.

#### Backpressure implementation artifacts

Generate the files that realize the backpressure design. Every artifact comes from `clif-d/backpressure.md` -- do not invent rules, versions, or hook stages here.

- **Linter, formatter, type-checker, and any other tool configs** at the paths named in the backpressure document (or ecosystem-conventional paths if the design did not specify). Encode every rule choice and every relaxation from the Guardrail Decisions and Relaxations tables verbatim.
- **Hook framework wiring** per the backpressure document's chosen framework. Examples: a `.husky/` directory plus `cli/package.json` `prepare` script for husky; a `.pre-commit-config.yaml` plus `pre-commit install` invocation in the bootstrap; a `Makefile` target plus hook-install script for Makefile-wrapped hooks. The install mechanism must be idempotent and must run as part of the bootstrap -- never as a manual follow-up step. Hook definitions must be committed to version control so a fresh clone gets them; activation must converge `.git/hooks/` (or `core.hooksPath`) to the committed state on every bootstrap invocation so that future backpressure-design edits that change a hook reach every environment on the next bootstrap. The bootstrap must also include an explicit hook-presence check: after activation, the script confirms each stage named in `clif-d/backpressure.md` §6 resolves to an executable hook, and fails loudly otherwise.
- **Claude Code SessionStart hook.** Generate (or merge into) `.claude/settings.json` at the repo root with a SessionStart hook that runs the bootstrap command. This is what guarantees hook propagation in ephemeral environments: every new Claude Code session against a fresh clone, worktree, or cloud runtime re-bootstraps before the agent acts, so hooks land automatically even when `design-backpressure` and `bootstrap-dev-environment` are never re-invoked. The command field must be the single bootstrap entry point from §5 of the dev-environment design document, verbatim. If `.claude/settings.json` already has hooks or other settings, merge -- do not overwrite user content.
- **Suppression scanner** at the path and in the language named in the backpressure document. Copy the pattern set exactly. Seed the allowlist with only the minimum entries -- typically `clif-d/backpressure.md` itself -- each with a one-line justification in the backpressure document's Relaxations section. Include the scanner's self-tests per the design.
- **Pre-existing-suppression audit.** Run the scanner over the whole working tree once during bootstrap. Surface every hit to the user via the AskUserQuestion tool or an equivalent interactive choice: delete the suppression, or add a rule-level Relaxation with written rationale to `clif-d/backpressure.md` §4. Do not silently grandfather. The audit is part of the bootstrap, not an afterthought -- an unaudited repo can ship with old suppressions invisible to the new gate.

The hooks should:

1. **Scan for suppression directives** (meta-backpressure) first, so the failure message is unambiguous.
2. **Format** changed files (auto-fix, stage the formatted result).
3. **Lint** changed files (no auto-fix - fail and show errors).
4. **Type-check** (may need to check the full project, not just changed files).
5. **Run tests** affected by changes (or all unit tests if scoping is impractical).
6. **Block the commit** if any step fails with a non-zero exit code.
7. **Print clear, actionable error messages** - the developer (or agent) should know exactly what to fix.

If the backpressure document's Hook Architecture differs from this sequence, follow the backpressure document -- it is authoritative for hook ordering.

The hooks must NOT:

- **Auto-fix lint violations silently.** Formatting is auto-fixed (it's mechanical). Lint violations are reported, not auto-fixed -- the developer needs to understand and address the issue.
- **Run slow checks.** Anything taking more than ~10 seconds belongs in pre-push or CI.
- **Require network access.** All pre-commit checks must work offline.
- **Modify unstaged files.** Only operate on staged changes (use `lint-staged` or equivalent).

If the backpressure design conflicts with any of these, resolve the conflict in `clif-d/backpressure.md` first, not in the config.

#### Verification artifact

- **`scripts/verify-env.sh`** (or `make verify`) that runs every command from Technology Decisions, every scaffolding-requirement command, and every pre-commit/pre-push hook stage from the backpressure document, failing on the first non-zero exit. This is what the agent runs to confirm the environment is live. Include a negative test for the suppression scanner: the script creates a scratch file containing a suppression pragma, stages it, attempts a commit, and asserts the commit is blocked with the expected message. Also include a **hook-presence check** that asserts every hook stage named in the backpressure document resolves to an executable entry in `.git/hooks/` (or via `git config core.hooksPath`). This catches hook-propagation drift -- an environment where the committed definitions have advanced but the live hooks have not -- before it lets un-gated commits through. Leave the working tree clean when finished.

#### Agent instruction file

Generate `CLAUDE.md` at the repo root for Claude Code (project-scoped), at the location Claude Code's **current official documentation** specifies. Verify before writing. This is an *instruction file* -- always loaded, no frontmatter. It is distinct from the *rule files* (`.claude/rules/*.md`) that `compactify-artifacts` may write later; those are glob-scoped and conditional.

Content guidelines:

- Terse. A few hundred lines maximum. Links to `clif-d/` artifacts rather than duplicating them.
- State the bootstrap command, build command, test command, lint command, type-check command, and the pre-commit hook invocation. Verbatim from the Technology Decisions table and the backpressure document's Hook Architecture section.
- Point at `clif-d/prd.json`, `clif-d/architecture.md`, `clif-d/backpressure.md`, `clif-d/dev-environment.md` and name what each is for in one line each. Note that `clif-d/backpressure.md` is the authoritative source for rule changes and relaxations -- never edit a lint config without also amending that document.
- Name the gotchas: non-interactive subshell caveats, PATH expectations, which tools are pinned and must not be upgraded casually, and the suppression policy ("no line-level or function-level suppressions; directory-scoped exclusions are the escape hatch, recorded in §4 of `clif-d/backpressure.md`"; point at `clif-d/backpressure.md` §5 for the full policy).
- No emojis. ASCII only.
- If a `CLAUDE.md` already exists, **merge** rather than overwrite - the user may have hand-authored content.

#### What the artifacts should NOT do

- **Modify the user's shell profile** (`.zshrc`, `.bash_profile`). The bootstrap lives in the project, not in the user's account.
- **Install globally without pinning.** No `brew install node` without a version. No `cargo install` without `--locked`. No `pip install` outside a managed environment.
- **Require `sudo` silently.** If root is needed, the script must state so and the rationale must appear in the design document.
- **Assume network access mid-build.** If a step needs the network, document it; do not silently fail on airgap.
- **Write secrets into instruction files or Dockerfiles.** Ever.

---

## Generation process

Once the user confirms the plan:

1. **Generate the design document** at `clif-d/dev-environment.md`. Create `clif-d/` if it does not yet exist (it should, from earlier pipeline stages). Include the Backpressure Implementation section (§9) mapping every guardrail from `clif-d/backpressure.md` to its concrete artifact.
2. **Wait for user confirmation** on the design document before generating setup artifacts. Design decisions are cheaper to revise than Dockerfiles.
3. **Generate the containerization artifacts** (`Dockerfile`, `.devcontainer/devcontainer.json`, etc.) **or** the script artifacts (`scripts/bootstrap.sh`, `Makefile` targets) - whichever the design chose.
4. **Generate the backpressure implementation artifacts** per §9 and the backpressure document: tool configs, hook-framework wiring, the suppression scanner and its allowlist, and the hook scripts that invoke them in the order the backpressure document prescribes. Commit the hook definitions to version control at the path the backpressure document names so fresh clones inherit them. Seed the suppression scanner allowlist with only the minimum entries and make sure each has a justification in `clif-d/backpressure.md` §4.
5. **Generate or merge `.claude/settings.json`** at the repo root with a SessionStart hook that runs the bootstrap entry point verbatim. This closes the hook-propagation loop for Claude Code sessions started against fresh clones, worktrees, or cloud runtimes. Merge with any existing settings rather than overwriting.
6. **Generate the verification script** (`scripts/verify-env.sh` or `make verify`) covering every Technology Decisions command, every scaffolding-requirement command, every backpressure hook-stage command, a negative test for the suppression scanner, and an explicit check that each backpressure hook stage resolves to a live, executable git hook (catching propagation drift).
7. **Generate or update `CLAUDE.md`** at the repo root. Merge with any existing content rather than overwriting. Include pointers to `clif-d/backpressure.md` and the suppression policy (no line-level or function-level suppressions; directory-scoped exclusions recorded in §4 are the escape hatch).
8. **Run the bootstrap end-to-end** from a fresh subshell in the product repo. If containerized, build the image and open a shell inside. If script-based, invoke the script in a subshell that does not inherit the user's interactive shell hooks (`env -i bash --noprofile --norc` or equivalent). This is the agent's-eye view. This step must also install the hooks -- confirm a fresh clone could run one command and end up with hooks active.
9. **Run the pre-existing-suppression audit.** Run the suppression scanner over the whole working tree. For every hit, interactively ask the user whether to delete the suppression (preferred) or add a `§4` Relaxation with a written rationale in `clif-d/backpressure.md`. Do not proceed until the tree is clean of un-audited suppressions. Never silently grandfather.
10. **Run the verification script** and confirm every command exits cleanly, the suppression-scanner negative test blocks the expected commit with the expected message, and the hook-presence check passes for every stage named in `clif-d/backpressure.md`. If anything fails, fix the bootstrap or amend the backpressure design (not the config), and repeat - do not ship a verification script that does not pass.
11. **Backfill PRD references.** The dev environment is a shared constraint that affects all implementation. Update `clif-d/prd.json`:
    - Add a context item (type `constraint`) for the dev environment approach if none exists, stating the bootstrap command and containerization choice.
    - Add the dev-environment context item's ID to the `context_refs` of every requirement that will be implemented inside this environment (typically all of them).
    - This closes the referencing gap: the dev-environment document traces back to PRD items (§11), and now PRD items trace forward to the dev-environment constraint.
    - Do not re-create the backpressure context item -- `design-backpressure` already added it. Confirm it is present.
12. **Report** what was generated: design document path, setup artifact paths, backpressure config paths, suppression scanner path, `CLAUDE.md` path, `.claude/settings.json` SessionStart hook, verification result (including the scanner negative test and hook-presence check), audit result, PRD updates. Recommend the next step: run `plan-requirement` on the earliest scaffolding requirement.

---

## Handoff to plan-requirement

`plan-requirement` and `implement-plan` assume they can run the linter, type checker, test framework, and commit through the pre-commit hooks. This skill is what guarantees those assumptions. Before handing off, confirm that:

- Every tool named in the architecture's Technology Decisions and the backpressure document's Guardrail Decisions is invokable from a fresh subshell.
- The pre-commit hooks are installed and blocking: `git commit` on a staged lint violation, type error, failing test, or suppression directive must fail cleanly with an actionable message.
- Hook propagation is live: the committed hook definitions, the idempotent activation step in the bootstrap, and the SessionStart hook in `.claude/settings.json` together guarantee that a fresh clone or cloud agent runtime ends up with active hooks after one bootstrap invocation. Verify this by running the bootstrap in a fresh clone (or an equivalent clean state) and confirming the hook-presence check in the verification script passes.
- The suppression scanner self-tests pass, and the whole-tree audit has been run and resolved.
- The bootstrap command is fast enough that a developer re-running it after pulling upstream is not painful. If it is slow, document why in §6 (Idempotency and Failure Modes).
- `CLAUDE.md` states the bootstrap, build, test, lint, and type-check commands verbatim, and points at every `clif-d/` artifact.
