# CLIF-D

CLIF-D (CLI-First Decomposition) is a collection of Claude Code skills for structured product development — from initial concept through naming, requirements, implementation planning, and code. Each skill guides a focused, interactive session and produces a structured artifact that feeds the next stage of the pipeline. The methodology emphasizes decomposing systems into testable, composable CLI tools as the primary implementation target.

## Skills

| Skill | Purpose |
|---|---|
| `create-product-concept` | Interviews the user, researches the landscape, and produces a high-abstraction concept document articulating a functionality gap and why LLMs are the novel unblocker |
| `workshop-names` | Structured naming workshop based on Lexicon Branding's Diamond Framework and SMILE/SCRATCH evaluation — produces 100+ candidates filtered to 5–10 contextual finalists |
| `create-initial-prd` | Generates a JSON PRD from a concept document, following CLIF-D: complete high-level requirements and a partial set of clear first-step low-level requirements, each with CLI specs |
| `create-architecture` | Takes a PRD and produces a detailed architecture document down to C4 code level — concrete technology decisions, module decomposition, interfaces, data flow, testing architecture |
| `design-backpressure` | Researches and implements quality guardrails — aggressive linting, maximal type enforcement, pre-commit hooks — as hard local gates that block low-quality code before it enters the repo |
| `plan-requirement` | Takes PRD requirement IDs, resolves the full dependency graph, explores the codebase, and produces a self-contained implementation plan (Markdown) with TDD step ordering |
| `implement-plan` | Executes an implementation plan step-by-step with strict Red-Green-Refactor discipline, running all quality checks after every step |

## Pipeline

```
create-product-concept
        │
        ├──▶ workshop-names
        │
        └──▶ create-initial-prd
                        │
                        └──▶ create-architecture
                                    │
                                    └──▶ bootstrap-dev-environment  (planned)
                                                │
                                                └──▶ design-backpressure
                                                            │
                                                            └──▶ plan-requirement  (repeats per requirement)
                                                                        │
                                                                        └──▶ implement-plan  (repeats per plan)
```

## The `clif-d/` directory

All CLIF-D artifacts for a given product live in a single `clif-d/` directory at the root of the product repository. This directory is version-controlled alongside the code.

### Layout

```
<product-repo>/
  clif-d/
    concept.md              # create-product-concept
    prd.json                # create-initial-prd (living document)
    architecture.md         # create-architecture
    architecture/           # create-architecture (diagram files, optional)
      *.mmd
    backpressure.md         # design-backpressure (design record + practitioner reference)
    plans/
      active/               # plan-requirement writes here
        plan-REQ-NNN.md
      executed/             # implement-plan moves completed plans here
        plan-REQ-NNN.md
      archive/              # compact-planning-artifacts compacts executed plans here
        ...
  <source code, tests, configs...>
```

All design documents (concept, PRD, architecture, backpressure) live inside `clif-d/`. The backpressure document includes both the design rationale and the practitioner-facing quick reference (setup commands, how to run checks, suppression policy).

### Artifact precedence and lifecycle

Artifacts are listed here in **order of authority**. When two artifacts disagree, the earlier one takes precedence unless the later one has explicitly superseded it:

1. **`concept.md`** — *Why this product exists.* Written once, changes rarely. Updated only when the product's fundamental purpose shifts.
2. **`prd.json`** — *What the product does.* **Living document.** Grows continuously as implementation progresses and low-level requirements are added (the "bow wave"). Represents the current agreed-upon behavior of the system.
3. **`architecture.md`** — *How the product is structured.* Updated when structural decisions change. New scaffolding requirements are added to `prd.json` when the architecture document is generated.
4. **`backpressure.md`** — *What quality standards the product enforces.* Updated when guardrails change. Every change should be a deliberate, documented decision — relaxations especially.
5. **`plans/active/*.md`** — *How specific requirements will be implemented.* Short-lived. Each plan targets a set of requirements and is consumed by `implement-plan`. After implementation is complete, plans are moved to `plans/executed/` by `implement-plan`.
6. **`plans/executed/*.md`** — *Completed plans with implementation commit SHAs.* Full step-by-step detail is preserved. These accumulate until `compact-planning-artifacts` compacts them into `plans/archive/`.
7. **`plans/archive/*.md`** — *Historical record of what was implemented and how.* Compacted to preserve traceability (requirement IDs, commit SHAs, acceptance criteria verification) without keeping the full step-by-step detail.

### The PRD as a living document

The PRD (`clif-d/prd.json`) is the most operationally important artifact and deserves special attention. It is a **living document** — it grows and evolves throughout the project's life. High-level requirements are written early and change rarely. Low-level requirements are added continuously, as the "bow wave" of planning detail stays just ahead of the implementation ship.

#### Principles

- **The PRD tracks the state of implementation.** It is kept in sync with what has been built and what is next. It is not a snapshot from a kickoff meeting.
- **High-level requirements form a complete picture.** They describe the whole system's intended behavior. They are rich with motivating context and may be slightly ambiguous.
- **Low-level requirements form a partial picture.** Only the clear first steps are specified at any given time. Future planning fills in more low-level detail as needed — the bow wave metaphor from `create-initial-prd`.
- **Text and documentation are executable infrastructure.** In the age of language models, a well-structured PRD is not a dead deliverable — it is a source of truth that agents read, reason about, and act on. Its structure matters because structure is what makes it machine-readable.
- **Version control the PRD.** It lives in the repo because it must evolve in lockstep with the code. A PR that changes behavior should, when appropriate, also update the PRD. This is the only way to keep the two aligned.

#### Benefits of living in the repo

- **Single source of truth.** The PRD, the code, and the tests all travel together. A clone of the repo contains everything needed to understand and work on the product.
- **Atomic changes.** A feature and its specification change in the same commit, reviewed together.
- **Diffable history.** Git log shows how the product's intended behavior has evolved over time.
- **Agent-accessible.** Agents working in the repo can read the PRD without any external integration.
- **No synchronization lag.** Unlike an external spec tool, there is no gap between "what the spec says" and "what the latest version of the spec says."

#### Drawbacks and what the PRD is NOT for

The PRD's in-repo nature makes it unsuitable for certain coordination tasks:

- **Cross-machine coordination.** Two developers (or agents) working in parallel on separate branches cannot use the PRD to coordinate who is doing what. Git will merge edits, but it will not prevent two people from starting work on the same requirement.
- **Work assignment and claiming.** The PRD does not know who is working on what. It has no concept of "in progress by X" that survives across machines.
- **Stakeholder and product-manager dashboards.** Stakeholders who are not working in the repo need a view into progress. The PRD is not that view — it is a source document, not a dashboard.
- **External discussions.** Comments, questions, and debate about requirements do not belong in the PRD. They belong in an issue tracker or a design document.
- **Scale beyond a single product.** The PRD covers one product per repo. Multi-product coordination needs to happen elsewhere.

These use cases require **external, synchronized systems** — issue trackers (Linear, Jira, GitHub Issues), project management tools, communication platforms — and there will be **some degree of duplication** between those systems and the in-repo PRD. That duplication is acceptable: each system serves a different purpose. The in-repo PRD is the authoritative specification. The external system is the coordination layer. Keep them aligned, but do not conflate them.

### Why `clif-d/` at the repo root

- **Discoverability.** An agent or developer cloning the repo sees `clif-d/` immediately and knows where to look for design artifacts.
- **Atomicity.** Code changes and design changes can be committed together.
- **No path surprises.** Every CLIF-D skill knows the layout; no search or configuration is needed to find the PRD or architecture document.
- **Separation from implementation.** Keeping design artifacts in a single subdirectory makes it easy to exclude them from search, build processes, or deployment artifacts if desired.

## Deployment

This repo is a Claude Code plugin and marketplace. Skills are namespaced as `clif-d:<skill-name>` once installed.

### Install

```
# Add the marketplace (once)
/plugin marketplace add kdbanman/clif-d

# Install the plugin
/plugin install clif-d@clif-d

# Update when new versions are pushed
/plugin marketplace update
```

The plugin structure lives in `.claude-plugin/` (manifest and marketplace catalog) and `skills/` (skill definitions). The old git-hooks sync approach (`sync-skills.sh`) is retired.

## TODO

- [ ] **Initial PRD skill should copy the PRD schema to project directory** - right now the skill seems to result in a prd.json file with a $schema field pointing into the .claude directory, which seems awkward.  It should just be a product artifact, I think?
- [ ] **Add `references/` to `design-backpressure`** — opinionated reference material on agentic quality backpressure principles
- [ ] **Implement `clif-d` CLI for PRD CRUD operations** — a command-line tool for reading and mutating PRD JSON files without hand-editing. Key commands:
  - `clif-d req next [prd.json]` — print the highest-priority `not_started` requirement whose dependencies are all `done`
  - `clif-d req start <REQ-ID> [prd.json]` — set a requirement's `status` to `in_progress`
  - `clif-d req done <REQ-ID> [prd.json]` — set a requirement's `status` to `done`
  - `clif-d req block <REQ-ID> [prd.json]` — set a requirement's `status` to `blocked`
  - `clif-d req ls [prd.json]` — list requirements with their status; supports `--status=<value>` filter and `--abstraction=high|low` filter
  - `clif-d req dep add <REQ-ID> <DEP-ID> [prd.json]` — add a dependency edge from REQ-ID to DEP-ID
  - `clif-d req dep rm <REQ-ID> <DEP-ID> [prd.json]` — remove a dependency edge
- [ ] **Implement `bootstrap-dev-environment` skill** — runs after `create-architecture`, before `design-backpressure`. The architecture skill specifies the toolchain (language, package manager, test framework, etc.) but does not verify or install it. This skill bridges the gap between a macOS dev machine and the project's development requirements as executable by an agent. The core problem: the user's shell profile (`.zshrc`) may put tools like `uv`, `cargo`, or `node` on PATH, but the agent's execution environment does not inherit that. The skill should be opinionated about how to make the dev environment reproducible and agent-accessible. Initial thoughts on approach:
  - Prefer containerized environments (Docker, macOS Containers if available, or devcontainers) for full reproducibility — the agent runs inside the same environment CI will use
  - Fall back to a setup script (`make bootstrap` or equivalent) that installs language runtimes and package managers via version-pinned installers (e.g. `rustup`, `uv`, `nvm`)
  - Verify every command from the architecture's Technology Decisions table is executable after setup
  - Consider Ansible for multi-step provisioning if the project has complex system-level dependencies, but prefer simpler mechanisms first
  - The skill should produce a `clif-d/dev-environment.md` design document and the actual setup artifacts (Dockerfile, devcontainer.json, Makefile targets, or setup script)
- [ ] **Implement `extend-low-level-requirements` skill** — keeps the "bow wave" of low-level requirement granularity just ahead of the implementation ship. Called after a round of implementation to add the next slice of clear-first-step low-level requirements to the PRD, informed by what's now known from the code and what's newly unblocked. Must preserve the bow-wave principle from `create-initial-prd`: only specify what's clear *right now*, never more.
- [ ] **Implement `compact-planning-artifacts` skill** — runs when the `clif-d/plans/executed/` directory is getting onerous. Compacts executed plans into concise archive entries in `clif-d/plans/archive/`, preserving traceability (requirement IDs, commit SHAs, acceptance criteria verification) while dropping the step-by-step implementation detail. Operates on `executed/` plans only — active plans are untouched.
- [ ] **Implement `check-clif-d-consistency` skill** — aware of the structure, purpose, and precedence of all CLIF-D artifacts (concept, PRD, architecture, backpressure, plans). Examines them for consistency with each other and with the codebase. Flags drift: requirements without matching code, code without matching requirements, architecture decisions violated in practice, guardrails that have silently been relaxed.
- [ ] **Implement `align-claude-md` skill** — ensures the product repo's `CLAUDE.md` (agent instruction file) correctly describes where to dig for project purpose, architecture, and requirements — specifically pointing at the CLIF-D artifacts. Must look up the latest official guidance on `CLAUDE.md` structure and scope before writing, not rely on cached knowledge.
- [ ] **Implement `clif-d-help` skill (or reference file)** — a "what is CLIF-D" skill that fills the gap left by the absence of a shared cross-skill reference file. Documents the structure, purpose, and precedence of CLIF-D artifacts and their relationships. May partially overlap with the README, but the README should stay terse, so overlap is likely small. Decide whether this should be a skill or some other auto-exposed reference mechanism.
- [ ] **Review skills library against Anthropic best practices** — audit all skills in this plugin against the current Anthropic guidance at https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices. Check frontmatter conventions, description quality, skill scoping, reference file organization, and any other guidance that has emerged since these skills were authored.
- [ ] **Ensure instruction quality.**  After a complete runthrough of the project initialization skills, ensure the resulting artifacts are well interlinked and instructive.  Role play as a requirement planning agent and as a requirement implementation agent, and make sure relevant docs can be navigated to without blind searching.

## Potential Issues

- the plan-requirement skill and the implement-plan skill has a hard time figuring out what has already been implemented.  Solution ideas: Once the PRD CLI is implemented, both skills should use it to investigate what is already done.  Use the CLI to find prerequisite requirement IDs and context from the PRDs.  (Prerequisite as in requirement dependencies.)  Use the git detailed log and other git CLI commands to look at most recent work to see if anything relevant is in there.  (In general, this plugin project needs more explicit guidance on how to use git, because it's a beautiful log of changes, and can even be used to investigate changes at arbitrary detail and depth.)
- Never use \u2014 in any skill.  Only hyphens
- Never use any complex UTF or emojis.  ASCII only.

