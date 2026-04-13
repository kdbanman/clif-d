# CLIF-D

CLIF-D (CLI-First Decomposition) is a collection of Claude Code skills for structured product development — from initial concept through naming, requirements, implementation planning, and code. Each skill guides a focused, interactive session and produces a structured artifact that feeds the next stage of the pipeline. The methodology emphasizes decomposing systems into testable, composable CLI tools as the primary implementation target.

## Skills

| Skill | Purpose |
|---|---|
| `create-product-concept` | Interviews the user, researches the landscape, and produces a high-abstraction concept document articulating a functionality gap and why LLMs are the novel unblocker |
| `workshop-names` | Structured naming workshop based on Lexicon Branding's Diamond Framework and SMILE/SCRATCH evaluation — produces 100+ candidates filtered to 5–10 contextual finalists |
| `create-initial-product-requirements` | Generates a JSON PRD from a concept document, following CLIF-D: complete high-level requirements and a partial set of clear first-step low-level requirements, each with CLI specs |

## Pipeline

```
create-product-concept
        │
        ├──▶ workshop-names
        │
        └──▶ create-initial-product-requirements
                        │
                        └──▶ plan-requirement  [TODO]
                                    │
                                    └──▶ implement-plan  [TODO]
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
- [ ] **Implement `plan-requirement` skill** — a skill that takes one or more requirements from a CLIF-D PRD and produces a detailed implementation plan. Should emphasize strong TDD: each plan item should specify the tests to write first, expected inputs/outputs at the CLI boundary, and acceptance criteria. The skill's own shape (interrogation protocol, output format) needs to be designed as part of implementation.
- [ ] **Implement `plan-backpressure` skill** — a skill that specifically plans backpressure systems and other agent harness features, informed by Anthropic's guidance at https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents and https://www.anthropic.com/engineering/harness-design-long-running-apps. Should produce a structured plan for concurrency control, rate limiting, retry logic, observability hooks, and graceful degradation appropriate to the target system.
- [ ] **Implement `implement-plan` skill** — a skill that consumes a plan produced by `plan-requirement` or `plan-backpressure` and drives implementation. Should be intentionally lightweight — the plan artifact should be self-contained enough that the skill's main job is orientation: how to load the plan, interpret linked artifacts and acceptance criteria, and sequence work. Should include guidance on maintaining the TDD discipline established during planning.
- [ ] **Implement `clif-d` CLI for PRD CRUD operations** — a command-line tool for reading and mutating PRD JSON files without hand-editing. Key commands:
  - `clif-d req next [prd.json]` — print the highest-priority `not_started` requirement whose dependencies are all `done`
  - `clif-d req start <REQ-ID> [prd.json]` — set a requirement's `status` to `in_progress`
  - `clif-d req done <REQ-ID> [prd.json]` — set a requirement's `status` to `done`
  - `clif-d req block <REQ-ID> [prd.json]` — set a requirement's `status` to `blocked`
  - `clif-d req ls [prd.json]` — list requirements with their status; supports `--status=<value>` filter and `--abstraction=high|low` filter
  - `clif-d req dep add <REQ-ID> <DEP-ID> [prd.json]` — add a dependency edge from REQ-ID to DEP-ID
  - `clif-d req dep rm <REQ-ID> <DEP-ID> [prd.json]` — remove a dependency edge
