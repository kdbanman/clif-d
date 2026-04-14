---
name: bootstrap-dev-environment
description: >
  Bridge the gap between a macOS developer's shell and a reproducible, agent-executable development environment for a
  CLIF-D project. Use this skill after create-architecture and before design-backpressure, when the architecture
  document specifies a toolchain (language, package manager, test framework, build commands) but nothing has verified
  that those tools are installed, version-pinned, and invokable from an agent's non-interactive subshell. Researches
  the project's ecosystem for the most reproducible bootstrap mechanism (containers, devcontainers, setup scripts with
  version-pinned installers), generates the setup artifacts, verifies every command from the architecture's
  Technology Decisions table runs end-to-end, and wires in agent rules files (CLAUDE.md, AGENTS.md, etc.) so that
  whichever coding agent the user runs inherits clear, terse instructions about the environment. Produces
  clif-d/dev-environment.md plus the actual setup artifacts.
---

# Bootstrap Dev Environment

You are helping the user make their project's development environment **reproducible and agent-accessible**. The architecture document has already decided the toolchain. Your job is to turn those decisions into a concrete, version-pinned, idempotent setup that works for three audiences simultaneously: the user on their local machine, any coding agent (Claude Code, Gemini CLI, OpenCode, Cline, etc.) invoked on that machine, and a cloud agent runtime that starts from a near-empty container.

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

### Agent rules files are part of the environment

A coding agent that does not know about `clif-d/` or the project's build commands will flail. The standard mechanism to tell it is a "rules file" - `CLAUDE.md` for Claude Code, `AGENTS.md` for several others, `.cursorrules`, `.windsurfrules`, etc. These are part of the bootstrap because they are how the environment makes itself known to the agent. Do not skip them.

---

## Input

This skill expects:

1. **An architecture document** at `clif-d/architecture.md` in the product repository. Read its Technology Decisions, Repository Structure, and Testing Architecture sections in full - they are your primary input.
2. **The CLIF-D PRD** at `clif-d/prd.json`. The scaffolding requirements appended by `create-architecture` reveal which build and test commands must be invokable.
3. **Any existing setup artifacts** in the repo (`Dockerfile`, `devcontainer.json`, `Makefile`, `scripts/`, lockfiles). Read before overwriting.

If no architecture document exists, stop and tell the user to run `create-architecture` first. This skill is not equipped to invent technology decisions - it implements them.

---

## Interrogation

**Your job is to arrive at a concrete, reproducible bootstrap mechanism and a verified working environment.** Do not generate artifacts until you are ready. Interrogate first.

Start by summarizing what the architecture has decided: language, runtime version, package manager, test framework, linter, type checker, any system-level dependencies (databases, browsers, native libraries). Then work through the dimensions below.

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

Pick one and commit to it. The command must appear in the architecture document, in `CLAUDE.md` / `AGENTS.md`, and in the dev-environment design document - identically.

### 5. Agent and editor context

Ask the user explicitly: **which coding agents and editors will be used on this project?** Examples:

- Claude Code (`CLAUDE.md`, `.claude/` directory)
- Gemini CLI (`GEMINI.md` or the agent's documented convention)
- OpenCode, Cline, Continue, Aider (each has its own convention - research the current state, do not guess)
- Cursor (`.cursorrules` or the newer `cursor.rules` format - research)
- Windsurf (`.windsurfrules`)
- The generic `AGENTS.md` convention (multi-agent)

For each agent the user names, research the **current** official guidance on rules file location, format, and scope before generating anything. Do not rely on cached knowledge - these conventions move.

### 6. What the agent needs to know

The rules file content should be terse and concrete. At minimum:

- The bootstrap command.
- The build, test, lint, and type-check commands (copied verbatim from the architecture's Technology Decisions).
- The location of CLIF-D artifacts (`clif-d/prd.json`, `clif-d/architecture.md`, etc.) and what each is for.
- Any non-obvious environment quirks (e.g. "activate the venv before running tests" - though a good bootstrap should make this unnecessary).
- What NOT to do: do not run `brew install` inline, do not modify `.zshrc`, do not downgrade pinned versions.

### 7. Verification plan

List every command from the architecture's Technology Decisions table and the PRD's scaffolding requirements. After bootstrap, each must run from a fresh subshell and exit cleanly (or with an expected exit code, for a trivial test). This list becomes the verification script.

### Interrogation protocol

- **Do not ask all questions at once.** Most answers come from the architecture document. Only ask when the document is silent or ambiguous.
- **Use web research aggressively** for installer conventions, pinning mechanisms, and especially agent rules file formats - these change frequently.
- **Make provisional decisions and present them for confirmation.** "I'd containerize with a devcontainer based on the official Python 3.12 image, install `uv` via the pinned installer script, and run `uv sync --frozen` as the bootstrap command - does that work?" beats "How should we install Python?"
- **Present the full plan before generating.** Containerization choice, pinned versions, bootstrap command, agent rules files to generate, verification commands. Wait for confirmation.

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
The list of commands from Technology Decisions and scaffolding requirements that must succeed after bootstrap. Include the verification script's location (e.g. `scripts/verify-env.sh` or a `make verify` target). Show sample expected output.

**8. Agent Rules Files**
Which rules files were generated, for which agents, at what paths. Summarize what each contains and why. Reference the official documentation source used to choose each file's location and format (URL + date checked - these conventions drift).

**9. Relaxations and Deferred Items**
Anything deliberately not pinned, not containerized, or not verified, with justification. Examples:
- "Node version is pinned via `.nvmrc` but not enforced at bootstrap time - the user requested this to match their existing workflow."
- "GPU drivers are assumed present; bootstrap does not install them."
Empty is good - it means the bootstrap is fully specified.

**10. PRD and Architecture Traceability**

| Bootstrap Decision | PRD/Architecture References |
|--------------------|-----------------------------|
| Python 3.12.7 pin | ARCH-002 (runtime), CTX-004 (version constraint) |
| Devcontainer image | ARCH-001 (deployment target) |
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

#### Verification artifact

- **`scripts/verify-env.sh`** (or `make verify`) that runs every command from Technology Decisions and any scaffolding-requirement command, failing on the first non-zero exit. This is what the agent runs to confirm the environment is live.

#### Agent rules files

For each agent the user named, generate its rules file at the location that agent's **current official documentation** specifies. Typical candidates (verify before using):

- `CLAUDE.md` at the repo root for Claude Code (project-scoped).
- `AGENTS.md` at the repo root for the multi-agent convention.
- `.cursorrules` or `cursor.rules` for Cursor (check which is current).
- `.windsurfrules` for Windsurf.
- Others as the user named them.

Content guidelines (apply to every rules file, adapted to the agent's expected format):

- Terse. A few hundred lines maximum. Links to `clif-d/` artifacts rather than duplicating them.
- State the bootstrap command, build command, test command, lint command, type-check command. Verbatim from the Technology Decisions table.
- Point at `clif-d/prd.json`, `clif-d/architecture.md`, `clif-d/backpressure.md`, `clif-d/dev-environment.md` and name what each is for in one line each.
- Name the gotchas: non-interactive subshell caveats, PATH expectations, which tools are pinned and must not be upgraded casually.
- No emojis. ASCII only.
- If a `CLAUDE.md` already exists, **merge** rather than overwrite - the user may have hand-authored content.

#### What the artifacts should NOT do

- **Modify the user's shell profile** (`.zshrc`, `.bash_profile`). The bootstrap lives in the project, not in the user's account.
- **Install globally without pinning.** No `brew install node` without a version. No `cargo install` without `--locked`. No `pip install` outside a managed environment.
- **Require `sudo` silently.** If root is needed, the script must state so and the rationale must appear in the design document.
- **Assume network access mid-build.** If a step needs the network, document it; do not silently fail on airgap.
- **Write secrets into rules files or Dockerfiles.** Ever.

---

## Generation process

Once the user confirms the plan:

1. **Generate the design document** at `clif-d/dev-environment.md`. Create `clif-d/` if it does not yet exist (it should, from earlier pipeline stages).
2. **Wait for user confirmation** on the design document before generating setup artifacts. Design decisions are cheaper to revise than Dockerfiles.
3. **Generate the containerization artifacts** (`Dockerfile`, `.devcontainer/devcontainer.json`, etc.) **or** the script artifacts (`scripts/bootstrap.sh`, `Makefile` targets) - whichever the design chose.
4. **Generate the verification script** (`scripts/verify-env.sh` or `make verify`) covering every Technology Decisions command and every scaffolding-requirement command.
5. **Generate the agent rules files** for each agent the user named, at the location each agent's current documentation specifies. Merge with existing files rather than overwriting.
6. **Run the bootstrap end-to-end** from a fresh subshell in the product repo. If containerized, build the image and open a shell inside. If script-based, invoke the script in a subshell that does not inherit the user's interactive shell hooks (`env -i bash --noprofile --norc` or equivalent). This is the agent's-eye view.
7. **Run the verification script** and confirm every command exits cleanly. If anything fails, fix the bootstrap and repeat - do not ship a verification script that does not pass.
8. **Backfill PRD references.** The dev environment is a shared constraint that affects all implementation. Update `clif-d/prd.json`:
   - Add a context item (type `constraint`) for the dev environment approach if none exists, stating the bootstrap command and containerization choice.
   - Add the dev-environment context item's ID to the `context_refs` of every requirement that will be implemented inside this environment (typically all of them).
   - This closes the referencing gap: the dev-environment document traces back to PRD items (§10), and now PRD items trace forward to the dev-environment constraint.
9. **Report** what was generated: design document path, setup artifact paths, agent rules file paths, verification result, PRD updates. Recommend the next step: run `design-backpressure`.

---

## Handoff to design-backpressure

`design-backpressure` assumes it can run the linter, type checker, and test framework. This skill is what guarantees that assumption. Before handing off, confirm that:

- Every tool `design-backpressure` will configure (linter, type checker, test framework, formatter) is invokable from a fresh subshell.
- The pre-commit hook mechanism the project will use (husky, pre-commit framework, Makefile hooks) is installable from the bootstrap - or will be installed by `design-backpressure` itself as a documented extension.
- The bootstrap command is fast enough that a developer re-running it after pulling upstream is not painful. If it is slow, document why in §6 (Idempotency and Failure Modes).
