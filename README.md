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
                                    └──▶ design-backpressure
                                                │
                                                └──▶ plan-requirement  (repeats per requirement)
                                                            │
                                                            └──▶ implement-plan  (repeats per plan)
```

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

- [ ] **Rename repo to `clif-d`** — remote should become `kdbanman/clif-d` to match plugin/marketplace name
- [x] **Package skills as a Claude plugin** — repo is now a Claude Code plugin + marketplace (`clif-d`). Skills live in `skills/`, manifests in `.claude-plugin/`. Git-hooks sync retired.
- [x] **Implement `create-architecture` skill** — C4 code-level architecture from PRD
- [x] **Implement `design-backpressure` skill** — quality guardrails as hard local gates (replaces old `plan-backpressure` concept which was about concurrency/rate-limiting — the actual need is linting, type enforcement, test enforcement, pre-commit hooks)
- [x] **Implement `plan-requirement` skill** — TDD-first implementation plans as self-contained Markdown files, with backpressure gate check
- [x] **Implement `implement-plan` skill** — strict Red-Green-Refactor execution of plans with quality checks after every step
- [ ] **Add `references/` to `design-backpressure`** — opinionated reference material on agentic quality backpressure principles

### Gaps in the initial/bootstrap phase

- [ ] **Repo scaffolding skill** — there's currently no skill that initializes the empty product repo from the architecture document's decisions (package manifest, directory skeleton, git init, etc.). Falls into a gap between `create-architecture` and `design-backpressure`. Could be its own skill (`scaffold-repo`?) or folded into `design-backpressure`'s setup step.
- [ ] **Design artifact location convention** — no skill has an opinion on where the concept/PRD/architecture/backpressure docs live relative to the product repo (inside the repo? sibling directory? separate docs repo?). Needs to be decided and enforced across skills before consistency-checking and `CLAUDE.md`-alignment skills can work reliably.

### Continued execution phase

- [ ] **Implement `extend-low-level-requirements` skill** — keeps the "bow wave" of low-level requirement granularity just ahead of the implementation ship. Called after a round of implementation to add the next slice of clear-first-step low-level requirements to the PRD, informed by what's now known from the code and what's newly unblocked. Must preserve the bow-wave principle from `create-initial-prd`: only specify what's clear *right now*, never more.
- [ ] **Implement `compact-planning-artifacts` skill** — runs after a round of implementation is complete and the planning artifact directory (`plan-*.md` files) is getting onerous. Compacts completed plans into a concise archive, preserving traceability (requirement IDs, commit SHAs, acceptance criteria verification) while dropping the step-by-step implementation detail. Keeps active plans distinct from archived ones.
- [ ] **Implement `check-clif-d-consistency` skill** — aware of the structure, purpose, and precedence of all CLIF-D artifacts (concept, PRD, architecture, backpressure, plans). Examines them for consistency with each other and with the codebase. Flags drift: requirements without matching code, code without matching requirements, architecture decisions violated in practice, guardrails that have silently been relaxed.
- [ ] **Implement `align-claude-md` skill** — ensures the product repo's `CLAUDE.md` (agent instruction file) correctly describes where to dig for project purpose, architecture, and requirements — specifically pointing at the CLIF-D artifacts. Must look up the latest official guidance on `CLAUDE.md` structure and scope before writing, not rely on cached knowledge.
- [ ] **Implement `clif-d-help` skill (or reference file)** — a "what is CLIF-D" skill that fills the gap left by the absence of a shared cross-skill reference file. Documents the structure, purpose, and precedence of CLIF-D artifacts and their relationships. May partially overlap with the README, but the README should stay terse, so overlap is likely small. Decide whether this should be a skill or some other auto-exposed reference mechanism.
- [ ] **Review skills library against Anthropic best practices** — audit all skills in this plugin against the current Anthropic guidance at https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices. Check frontmatter conventions, description quality, skill scoping, reference file organization, and any other guidance that has emerged since these skills were authored.
