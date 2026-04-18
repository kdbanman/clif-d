# CLIF-D

CLIF-D (CLI-First Decomposition) is a collection of Claude Code skills for structured product development -- from initial concept through naming, requirements, implementation planning, and code. Each skill guides a focused, interactive session and produces a structured artifact that feeds the next stage of the pipeline. The methodology emphasizes decomposing systems into testable, composable CLI tools as the primary implementation target.

## Skills

| Skill | Purpose |
|---|---|
| `create-product-concept` | Interviews the user, researches the landscape, and produces a high-abstraction concept document articulating a functionality gap and why LLMs are the novel unblocker |
| `workshop-names` | Structured naming workshop based on Lexicon Branding's Diamond Framework and SMILE/SCRATCH evaluation -- produces 100+ candidates filtered to 5-10 contextual finalists |
| `create-initial-prd` | Generates a JSON PRD from a concept document, following CLIF-D: complete high-level requirements and a partial set of clear first-step low-level requirements, each with CLI specs |
| `create-architecture` | Takes a PRD and produces a detailed architecture document down to C4 code level -- concrete technology decisions, module decomposition, interfaces, data flow, testing architecture |
| `design-backpressure` | Researches and designs quality guardrails -- aggressive linting, maximal type enforcement, pre-commit hooks -- as hard local gates that block low-quality code before it enters the repo. Produces the backpressure design document; the implementation is handed off to `bootstrap-dev-environment` |
| `bootstrap-dev-environment` | Turns the architecture's toolchain decisions and the backpressure design into a reproducible, agent-executable environment -- containerization or version-pinned setup script, the actual linter/type-check/hook configuration that realizes the backpressure design (including the suppression scanner and pre-existing-suppression audit), verification that every Technology Decisions command and hook stage runs, and an agent instruction file (CLAUDE.md) so Claude Code inherits environment context |
| `plan-requirement` | Takes PRD requirement IDs, resolves the full dependency graph, explores the codebase, and produces a self-contained implementation plan (Markdown) with TDD step ordering |
| `implement-plan` | Executes an implementation plan step-by-step with strict Red-Green-Refactor discipline, running all quality checks after every step |
| `compactify-artifacts` | Compacts a small chunk of executed plans and per-plan lessons per run into terse archive entries; silently discards low-signal lessons and routes high-signal survivors -- per explicit user authorization -- into either an upstream design doc edit or a glob-scoped `.claude/rules/*.md` file in the product repo; deletes the chunk's originals (git history preserves them) and flags upstream design docs that have drifted from what shipped |

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
                                    └──▶ design-backpressure
                                                │
                                                └──▶ bootstrap-dev-environment
                                                            │
                                                            └──▶ plan-requirement  (repeats per requirement)
                                                                        │
                                                                        └──▶ implement-plan  (repeats per plan)
                                                                                    │
                                                                                    └──▶ compactify-artifacts  (periodic; compacts a chunk of executed/ and lessons_learned/ each run)
```

## Skill disposition: HITL vs HOTL

Every CLIF-D skill is classified by **where uncertainty gets resolved**. HITL skills resolve it in-session by interrogating the user; HOTL skills consume resolutions that upstream artifacts have already made. This determines whether the skill interrogates or runs without intervention.

- **HITL (human-in-the-loop) skills interrogate ruthlessly.** They resolve uncertainty that only the user can resolve -- product intent, brand taste, which lessons are durable, which trade-off to accept. They block progress until ambiguity is closed. The interrogation *is* the skill's main work.
- **HOTL (human-out-of-the-loop) skills execute without interruption.** They do not resolve uncertainty themselves -- they consume the resolutions that upstream artifacts have already made. They trace upstream, research, and only stop when an upstream artifact proves wrong, silent, or self-contradictory on a load-bearing question. A well-run HOTL skill produces a complete artifact end-to-end without a single AskUserQuestion call.
- **HITL-lite skills sit between.** They research autonomously, draft provisional decisions, and present the whole package for one confirmation gate per phase -- not a loop on every micro-decision.

The load-bearing assumption: **HOTL skills can only stay HOTL if the upstream HITL skills do their job.** If a PRD is vague, `plan-requirement` degrades into interrogation. If an architecture is incomplete, `implement-plan` stalls. The rubric is symbiotic: HITL skills pay the attention cost up front so HOTL skills do not have to pay it in a loop.

### Classification

| Skill | Disposition | Resolves |
|---|---|---|
| `create-product-concept` | HITL | Product intent, functionality gap, scope |
| `workshop-names` | HITL | Brand positioning, taste, polarization tolerance |
| `create-initial-prd` | HITL | User workflows, system boundaries, priorities |
| `create-architecture` | HITL-lite | Technology decisions (research-informed, single confirmation gate) |
| `design-backpressure` | HITL-lite | Strictness trade-offs, suppression policy, hook architecture |
| `bootstrap-dev-environment` | HOTL | Toolchain installation, hook wiring, verification (one HITL gate: pre-existing-suppression audit) |
| `plan-requirement` | HOTL | Step decomposition, test ordering, codebase state |
| `implement-plan` | HOTL | Red-Green-Refactor execution, quality checks |
| `compactify-artifacts` | HITL | Which lessons are durable, where each one routes |

`compactify-artifacts` is a special case: it silently discards most lesson noise via aggressive pre-filter, then escalates high-signal survivors to the user one at a time via AskUserQuestion. Every routed lesson requires explicit per-lesson authorization -- no silent amendments to design docs.

### Interrogation discipline

**HITL skills MUST:**

- Ask load-bearing questions first -- the ones whose answers determine what else needs to be asked or researched.
- Interrogate in rounds, not exhaustive dumps.
- Summarize understanding and wait for confirmation before generating output.
- Use web research to ground answers that *can* be researched; do not use research to replace questions only the user can answer.

**HOTL skills MUST:**

- Trace upstream documents before asking the user anything. Most ambiguity is already resolved in the PRD, architecture, backpressure, dev-environment, or preceding plans.
- Escalate only when the upstream graph is silent, contradictory, or impossible on a load-bearing question.
- Prefer a documented assumption over a blocking question, and surface the assumption in the output (e.g. the plan's Open Questions section).
- Treat any AskUserQuestion call as a signal that an upstream artifact may be inadequate -- flag it back to the user.

**HITL-lite skills MUST:**

- Do the research pass before the confirmation pass.
- Present provisional decisions, not open-ended questions. "I would pin Python to 3.12.7 because X; does that work?" beats "What Python version should we use?"
- Use a single confirmation gate per phase, not a per-decision loop.

Every AskUserQuestion call is a tax on user attention. HITL skills spend that tax to earn clarity; HOTL skills hoard it.

A SKILL.md that does not reflect the discipline its disposition requires is a smell -- either the skill is misclassified, or its instructions have not caught up with the rubric. Audit for this when revising skills.

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
    dev-environment.md      # bootstrap-dev-environment (design record + setup instructions + backpressure implementation map)
    plans/
      active/               # plan-requirement writes here
        plan-REQ-NNN.md
      executed/             # implement-plan moves completed plans here; compactify-artifacts clears a chunk per run
        plan-REQ-NNN.md
      lessons_learned/      # implement-plan writes post-implementation lessons here; compactify-artifacts clears a chunk per run
        lessons-REQ-NNN.md
      archive/              # compactify-artifacts writes compact archive entries here
        plan-REQ-NNN.md
  .claude/
    rules/                  # compactify-artifacts may write glob-scoped rule files here for tactical lessons
      <topic>.md
  <source code, tests, configs...>
```

All design documents (concept, PRD, architecture, backpressure, dev-environment) live inside `clif-d/`. The backpressure document includes both the design rationale and the practitioner-facing quick reference (how to run checks, suppression policy); the dev-environment document records how those guardrails were actually installed and wired to the toolchain. Strategic lessons distilled by `compactify-artifacts` are merged back into these design documents under explicit user authorization; tactical, file-pattern-specific lessons land in `.claude/rules/<topic>.md` files (sibling to `clif-d/`) so they re-enter the agent's context only when matching files are touched.

### Artifact precedence and lifecycle

Artifacts are listed here in **order of authority**. When two artifacts disagree, the earlier one takes precedence unless the later one has explicitly superseded it:

1. **`concept.md`** -- *Why this product exists.* Written once, changes rarely. Updated only when the product's fundamental purpose shifts.
2. **`prd.json`** -- *What the product does.* **Living document.** Grows continuously as implementation progresses and low-level requirements are added (the "bow wave"). Represents the current agreed-upon behavior of the system.
3. **`architecture.md`** -- *How the product is structured.* Updated when structural decisions change. New scaffolding requirements are added to `prd.json` when the architecture document is generated.
4. **`backpressure.md`** -- *What quality standards the product enforces.* Updated when guardrails change. Every change should be a deliberate, documented decision -- relaxations especially. Authoritative for rule choices; `dev-environment.md` below implements those choices and must yield to this document on any conflict about what a rule *should* be.
5. **`dev-environment.md`** -- *How the product is built and tested on a developer or agent machine, and how the backpressure guardrails are actually installed.* Updated when toolchain versions, containerization, agent rules-file conventions, or the concrete guardrail wiring changes. Every change should be a deliberate, documented decision -- relaxations especially.
6. **`plans/active/*.md`** -- *How specific requirements will be implemented.* Short-lived. Each plan targets a set of requirements and is consumed by `implement-plan`. After implementation is complete, plans are moved to `plans/executed/` by `implement-plan`.
7. **`plans/executed/*.md`** -- *Completed plans with implementation commit SHAs.* Full step-by-step detail is preserved. These accumulate until `compactify-artifacts` distills them into `plans/archive/` and deletes the originals (git history preserves them).
8. **`plans/lessons_learned/*.md`** -- *Per-plan post-implementation lessons.* Written by `implement-plan`. Short-lived; consumed by `compactify-artifacts` one chunk at a time. Most lesson content is silently discarded by an aggressive pre-filter; high-signal survivors are presented to the user via structured AskUserQuestion calls and routed -- on per-lesson authorization -- into either an upstream design doc (items 1-5 above) or a glob-scoped `.claude/rules/*.md` file (item 10 below).
9. **`plans/archive/*.md`** -- *Compact historical map of what was implemented and how.* One terse entry per executed plan: requirement IDs, major commit SHAs, acceptance-criteria checklist, one-paragraph summary, pointers for git/PR deep dive. Not a comprehensive history -- a starting point for one.
10. **`.claude/rules/*.md`** -- *Glob-scoped tactical rules, sibling to `clif-d/`.* Each file declares a `globs:` frontmatter array; the rule re-enters the agent's context only when a matching file is read or edited. Created or extended by `compactify-artifacts` for tactical, file-pattern-specific lessons that earned a permanent home but do not belong in a top-level design doc. See `cli/clif-d/plans/executed/plan-REQ-027.md` for the format precedent. Not authoritative in the same sense as the design documents above -- the design documents stay authoritative, and rule files are signposts that point to them.

### The PRD as a living document

The PRD (`clif-d/prd.json`) is the most operationally important artifact and deserves special attention. It is a **living document** -- it grows and evolves throughout the project's life. High-level requirements are written early and change rarely. Low-level requirements are added continuously, as the "bow wave" of planning detail stays just ahead of the implementation ship.

#### Principles

- **The PRD tracks the state of implementation.** It is kept in sync with what has been built and what is next. It is not a snapshot from a kickoff meeting.
- **High-level requirements form a complete picture.** They describe the whole system's intended behavior. They are rich with motivating context and may be slightly ambiguous.
- **Low-level requirements form a partial picture.** Only the clear first steps are specified at any given time. Future planning fills in more low-level detail as needed -- the bow wave metaphor from `create-initial-prd`.
- **Text and documentation are executable infrastructure.** In the age of language models, a well-structured PRD is not a dead deliverable -- it is a source of truth that agents read, reason about, and act on. Its structure matters because structure is what makes it machine-readable.
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
- **Stakeholder and product-manager dashboards.** Stakeholders who are not working in the repo need a view into progress. The PRD is not that view -- it is a source document, not a dashboard.
- **External discussions.** Comments, questions, and debate about requirements do not belong in the PRD. They belong in an issue tracker or a design document.
- **Scale beyond a single product.** The PRD covers one product per repo. Multi-product coordination needs to happen elsewhere.

These use cases require **external, synchronized systems** -- issue trackers (Linear, Jira, GitHub Issues), project management tools, communication platforms -- and there will be **some degree of duplication** between those systems and the in-repo PRD. That duplication is acceptable: each system serves a different purpose. The in-repo PRD is the authoritative specification. The external system is the coordination layer. Keep them aligned, but do not conflate them.

### Why `clif-d/` at the repo root

- **Discoverability.** An agent or developer cloning the repo sees `clif-d/` immediately and knows where to look for design artifacts.
- **Atomicity.** Code changes and design changes can be committed together.
- **No path surprises.** Every CLIF-D skill knows the layout; no search or configuration is needed to find the PRD or architecture document.
- **Separation from implementation.** Keeping design artifacts in a single subdirectory makes it easy to exclude them from search, build processes, or deployment artifacts if desired.

## Assumptions

CLIF-D is opinionated about its runtime environment. Skills will misbehave or fail silently if any of the following is missing.

### Required

- **Claude Code.** Every skill is authored against Claude Code's skill, tool, and hook model. Skills assume access to the `AskUserQuestion`, `Glob`, `Grep`, `Read`, `Edit`, `Write`, and `Bash` tools. Other agent runtimes are not supported.
- **Git, in the product repo.** Skills invoke `git` for history inspection, commit creation, branch management, and worktrees. `compactify-artifacts` deletes originals after archiving and relies on `git log` to preserve full text. Without git, deleted artifacts are unrecoverable and commit-SHA references in archive entries have no referent.
- **POSIX-like shell.** Bootstrap scripts under `cli/scripts/` are bash with `set -euo pipefail`. Paths are assumed to be forward-slash. Windows users need WSL or Git Bash.
- **Node.js 18 or newer.** Already implied by the Claude Code assumption above, but called out because the `bin/clif-d` CLI ships as a single-file Node script (`#!/usr/bin/env node`, zero runtime deps) and dev infra under `cli/` pins Node 18 via `cli/.nvmrc`. The CLI is a hard prerequisite even if the user's product is not written in JavaScript.

### Expected

- **Web access.** Research-phase skills (`create-product-concept`, `workshop-names`, `create-architecture`, `design-backpressure`) use web search and fetch to ground their output in current external references.
- **Artifacts at `<product-repo>/clif-d/`.** The path is hard-coded into the skills; no configuration option relocates it. `.claude/rules/` as a sibling of `clif-d/` is similarly assumed for glob-scoped tactical rule files.

### Not assumed

- **A specific product implementation language.** CLIF-D is language-agnostic. `create-architecture` picks the stack; `bootstrap-dev-environment` installs the matching toolchain. Language-specific examples inside skills are illustrative, not prescriptive.
- **A specific product type or domain.** "CLI-first decomposition" is more flexible than the name suggests. Users are often surprised at the range of products - services, libraries, integration glue, even UI-adjacent tooling - that decompose cleanly into composable CLI steps.
- **A specific version control host (GitHub, GitLab, etc.).** Skills use local `git` only. PR workflow is not prescribed by the pipeline.

## Deployment

This repo is a Claude Code plugin and marketplace. Skills are namespaced as `clif-d:<skill-name>` once installed.

### Install

Run these in a Claude Code session:

```
# Add the marketplace (once per machine)
/plugin marketplace add kdbanman/clif-d

# Install the plugin from that marketplace
/plugin install clif-d@clif-d

# Pull the latest published version
/plugin marketplace update
```

In `clif-d@clif-d`, the first `clif-d` is the plugin name and the second is the marketplace name -- both are defined in `.claude-plugin/`. After install:

- Skills are invokable as `clif-d:<skill-name>` (e.g. `clif-d:create-initial-prd`).
- The `clif-d` CLI lands on the Bash tool's `PATH` and is callable by bare name from any agent session while the plugin is enabled.

The plugin structure lives in `.claude-plugin/` (manifest and marketplace catalog), `skills/` (skill definitions), and `bin/` (the `clif-d` CLI, auto-discovered and added to `PATH`). The old git-hooks sync approach (`sync-skills.sh`) is retired.

### Ship a new version

This repo is its own marketplace: the default branch on GitHub *is* the published version. There is no registry, no release tag, and no `npm publish` step. Merging to `main` publishes.

1. **Bump both manifests.** Update `version` in `.claude-plugin/plugin.json` AND the matching `plugins[].version` entry in `.claude-plugin/marketplace.json`. They must agree -- `cli/scripts/verify-plugin-payload.sh` enforces this.
2. **Verify the payload.** Run `./cli/scripts/verify-plugin-payload.sh`. Confirms manifests parse, versions agree, `bin/clif-d` is executable with the right shebang, and the `bin/` directory contains only the expected files (everything in `bin/` ships on the user's `PATH`).
3. **If the CLI changed, run the full gate.** `cd cli && npm run check` runs prettier, eslint, jscpd, tsc, and `node --test`. The husky pre-commit hook runs this automatically on every commit that touches the CLI.
4. **Call out breakage in the commit message.** There is no official breaking-change signal for Claude Code plugins -- users pick up updates pull-style via `/plugin marketplace update` and cannot be interrogated at install time. See "Current constraints" below. Any change to `prd.json` schema, CLI flags, skill inputs/outputs, or artifact layout should be explicit in the commit message (and eventually a CHANGELOG).
5. **Merge to `main`.** Opening a PR from your feature branch and merging it publishes the new version. No additional release step.
6. **Users update** with `/plugin marketplace update` in their session (or auto-update if they have it enabled).

Semver guidance for the version bump:

- **Patch** -- bug fix in a skill or the CLI with no interface change.
- **Minor** -- new skill, new CLI subcommand, new optional field in `prd.json`, or any other additive change.
- **Major** -- backwards-incompatible change to the `prd.json` schema, a CLI flag's meaning, a skill's inputs/outputs, or the `clif-d/` artifact layout.

## Current constraints

Claude Code's plugin system lacks lifecycle hooks we would normally use for artifact change management:

- **No postinstall / postupdate hooks on the user's repo.** A plugin update cannot ship code that migrates files in the user's product repository automatically.
- **No declarative breaking-change signaling.** `plugin.json` carries a semver `version`, but there is no official mechanism to mark a release as breaking or to prompt users before an update applies.
- **Pull-based updates.** Users pick up changes via `/plugin marketplace update` or marketplace auto-update, not at a moment when they can be interrogated about migration.

**How CLIF-D copes:**

- Artifact schemas stay plugin-owned. The PRD schema lives at `skills/create-initial-prd/assets/prd-schema.json` inside the plugin, not copied into the user's repo, so the skills and CLI that consume it remain the single source of truth for the contract. (The `clif-d schema copy` command can pull a snapshot into the user's repo for local IDE tooling, but that copy is not authoritative.)
- Each versioned artifact records the plugin version that wrote it. `prd.json` carries a top-level `clifd_version` field set from `.claude-plugin/plugin.json` at authoring time. Future migration tooling can compare that against the currently-installed plugin version to detect when a PRD predates a schema change.
- Breaking changes are documented, not automated. Schema-breaking releases are called out in commit messages (and eventually a CHANGELOG); users or agents invoke migrations explicitly.

When you change a schema or artifact layout in this plugin, you are implicitly asking every user to migrate. Design the change accordingly.

## TODO

- **Add `references/` to `design-backpressure`** -- opinionated reference material on agentic quality backpressure principles
- **Implement `extend-low-level-requirements` skill** -- keeps the "bow wave" of low-level requirement granularity just ahead of the implementation ship. Called after a round of implementation to add the next slice of clear-first-step low-level requirements to the PRD, informed by what's now known from the code and what's newly unblocked. Must preserve the bow-wave principle from `create-initial-prd`: only specify what's clear *right now*, never more.
- **Implement `clif-d-health-check` skill** -- aware of the structure, purpose, and precedence of all CLIF-D artifacts (concept, PRD, architecture, backpressure, plans). Examines them for consistency with each other and with the codebase. Flags drift: requirements without matching code, code without matching requirements, architecture decisions violated in practice, guardrails that have silently been relaxed.
- **Implement `align-claude-md` skill** -- ensures the product repo's `CLAUDE.md` (agent instruction file) correctly describes where to dig for project purpose, architecture, and requirements -- specifically pointing at the CLIF-D artifacts. Must look up the latest official guidance on `CLAUDE.md` structure and scope before writing, not rely on cached knowledge.  Minimalism wins here - there's a lot of potential context to uncover, and we want that to work as progressive disclosure.  So just describe and link the next step of references to dig into.
- **Implement `clif-d-help` skill (or reference file)** -- a "what is CLIF-D" skill that fills the gap left by the absence of a shared cross-skill reference file. Documents the structure, purpose, and precedence of CLIF-D artifacts and their relationships. May partially overlap with the README, but the README should stay terse, so overlap is likely small. Decide whether this should be a skill or some other auto-exposed reference mechanism.
- **Make all docs better line-separated.**  Right now, all markdown (skill files, reference files, instruction files, etc) have a lot of content per line.  That makes line-by-line diffs hard to review.  We should make better use of newline separation (e.g. between sentences) to make reviewing and surgical editing better.
- **Review skills library against Anthropic best practices** -- audit all skills in this plugin against the current Anthropic guidance at https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices. Check frontmatter conventions, description quality, skill scoping, reference file organization, and any other guidance that has emerged since these skills were authored. Includes a per-skill audit against the HITL vs HOTL rubric above: does each skill's interrogation discipline match the discipline its disposition requires?
- **Ensure instruction quality.**  After a complete runthrough of the project initialization skills, ensure the resulting artifacts are well interlinked and instructive.  Role play as a requirement planning agent and as a requirement implementation agent, and make sure relevant docs can be navigated to without blind searching.

## Potential Issues

- the plan-requirement skill and the implement-plan skill might sometimes have a hard time figuring out what has already been implemented.  Solution ideas: Once the PRD CLI is implemented, both skills should use it to investigate what is already done.  Use the CLI to find prerequisite requirement IDs and context from the PRDs.  (Prerequisite as in requirement dependencies.)  Use the git detailed log and other git CLI commands to look at most recent work to see if anything relevant is in there.  (In general, this plugin project needs more explicit guidance on how to use git, because it's a beautiful log of changes, and can even be used to investigate changes at arbitrary detail and depth.)
- The current workflow with PRD JSON files may not coordinate well across worktrees.  The PRD file in the main worktree has no way to know when requirements are in progress in other worktrees.  When Claude Code spawns a new worktree-based session, the agent in that worktree modifies its own local copy of the PRD JSON on its own branch -- the main worktree and its checked-out branch never see those changes until the branch merges back.  This is a fundamental limitation of a git-versioned PRD: each worktree has its own copy, and there is no cross-worktree synchronization.  Possible mitigations: a Claude Code hook that writes worktree status to a shared location outside the repo (e.g. a dotfile, a local SQLite database, or even a file in `~/.claude/`), a pre-plan or post-plan hook that updates a lightweight coordination file on the main branch, or accepting the limitation and relying on branch-merge discipline plus the `clif-d req` CLI to reconcile status after merge.  Worth investigating whether Claude Code plugin hooks can bridge this gap.

