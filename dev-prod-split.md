# dev/prod split -- plugin architecture plan

Design record for restructuring this repo into a `dev/` source tree and a committed, compiled plugin tree.
Companion to `cli-design-notes.md` and `cli-integration-plan.md`.

See also:

- `README.md` (plugin overview, pipeline, `clif-d/` layout)
- `CLAUDE.md` (editing conventions, repo invariants)
- `cli-prd.json` (CLI subproject PRD; CTX-001/CTX-002 cover the CLI ship constraints)

---

## 1. Goal

Move this repo from a hand-maintained plugin tree to a compiled one.
Contributors edit `dev/`.
The plugin-shaped tree at repo root (`skills/`, `bin/clif-d`, `.claude-plugin/`) becomes a committed, versioned build artifact -- the thing marketplace installs ship to users.

Two motivations:

1. **DRY content that's currently duplicated across skill files.**
   The existing skills repeat substantial chunks of prose -- structural scaffolding, shared conventions, parallel section orderings -- that have to be hand-edited in N places to stay in sync.
   Templating with shared partials makes them single-source instead.
   A secondary effect: knowledge that today lives only in the README (HITL/HOTL rubric, `clif-d/` directory layout, artifact precedence list, runtime assumptions) can be pulled into the skill files that need it, since clients load skills but not the README.
   The README itself stays -- it remains the developer-facing entry point to the plugin.
2. **Separate the CLI's source from its shipped shape.**
   `bin/clif-d` is edited directly today and linted via a symlink at `cli/clif-d.js`.
   A TS source under `dev/cli/src/` compiled to a single-file, zero-runtime-dep CommonJS `bin/clif-d` keeps the ship constraint intact while unlocking type safety and modular source.

## 2. The split

End state has a clean three-way separation at repo root:

- `clif-d/` -- design artifacts for the plugin itself (concept, PRD, architecture, plans, backpressure, dev-environment).
  Produced by Wave 0 below.
  Read by humans, agents, and the CLIF-D pipeline; not loaded by clients.
- `dev/` -- build source.
  Never ships, never loaded by clients.
  Everything dev-related eventually lives here: source for skills and the CLI, templates, partials, build scripts, test fixtures, husky hooks, linter configs, `package.json`, `.nvmrc`.
- `skills/`, `bin/clif-d`, `.claude-plugin/` -- compiled plugin shape.
  Committed, versioned, shipped through the marketplace.

A build step reads `dev/` and writes into the compiled plugin shape.
A pre-commit staleness check refuses a commit whose compiled output is out of sync with `dev/`.

Why compiled output is checked in: the marketplace pulls from the default branch of the GitHub repo.
There is no install-time build step available to us, so compiled artifacts have to exist in `main`.
This rationale belongs in `clif-d/dev-environment.md` (Wave 0) and a README contributors section once the plugin's own CLIF-D artifacts are in place; this doc is the design record, not the long-term home.

### Repo inventory

Top-level layout today, with what each entry is for, who owns it, and whether it lands in the shipped plugin payload.
"Ships" means it ends up in `~/.claude/plugins/cache/<id>/` on the user's machine when they install via the marketplace; `cli/scripts/verify-plugin-payload.sh` is the authoritative gatekeeper for what the `bin/` directory may contain (currently `bin/clif-d` and `bin/CLAUDE.md`).

| File                                                                                                 | Purpose                                                                     | Audience                               | Owner/source                                              |
|------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------|----------------------------------------|-----------------------------------------------------------|
| `clif-d/`                                                                                            |                                                                             |                                        |                                                           |
| `+-- .claude/`                                                                                       | agent session config                                                        | Claude Code in this repo               | maintainer (manual)                                       |
| `\|   +-- settings.json`                                                                             | SessionStart hook -> cli/scripts/bootstrap.sh                               | as above                               | as above                                                  |
| `+-- .claude-plugin/`                                                                                | plugin manifest dir; ships                                                  | clients via marketplace                | maintainer (manual; bumped per release)                   |
| `\|   +-- plugin.json`                                                                               | name/version/author; ships                                                  | clients                                | maintainer (manual)                                       |
| `\|   +-- marketplace.json`                                                                          | catalog entry; ships                                                        | clients                                | maintainer (manual)                                       |
| `+-- .git/, .gitignore`                                                                              | VCS; not shipped                                                            | maintainers                            | git/maintainers                                           |
| `+-- bin/`                                                                                           | on the Bash-tool PATH for installed users; ships                            | clients                                | maintainer (manual today; compiled by Wave 2)             |
| `\|   +-- clif-d`                                                                                    | the CLI executable; ships, on PATH                                          | clients invoke; agents invoke via Bash | maintainer (manual today; compiled later)                 |
| `\|   +-- CLAUDE.md`                                                                                 | agent instructions for bin/; ships, not on PATH                             | Claude Code agents                     | maintainer (manual)                                       |
| `+-- cli/`                                                                                           | dev infra only; never ships                                                 | maintainers/contributors               | maintainer                                                |
| `\|   +-- package.json, package-lock.json`                                                           | npm deps & scripts (lint, test, etc.)                                       | maintainers                            | maintainer; lock auto-updated by npm                      |
| `\|   +-- node_modules/`                                                                             | npm install output                                                          | maintainers locally                    | npm; gitignored                                           |
| `\|   +-- .nvmrc`                                                                                    | pins Node 18                                                                | maintainers/agents                     | maintainer                                                |
| `\|   +-- .husky/`                                                                                   | git hooks installed by husky                                                | maintainers                            | husky via prepare script                                  |
| `\|   +-- eslint.config.js, tsconfig.json, .jscpd.json`                                              | quality-gate configs                                                        | maintainers                            | maintainer                                                |
| `\|   +-- clif-d.js`                                                                                 | symlink to ../bin/clif-d for linting                                        | tooling                                | maintainer; retires Wave 2                                |
| `\|   +-- scripts/`                                                                                  | bootstrap, verify-env, verify-plugin-payload, semantic-wrap, verify-changes | maintainers/CI                         | maintainer                                                |
| `\|   +-- test/`                                                                                     | node:test suites for bin/clif-d                                             | maintainers                            | maintainer                                                |
| `\|   +-- clif-d/`                                                                                   | CLI subproject's own CLIF-D artifacts                                       | maintainers/agents                     | maintainer; Wave 4 transforms                             |
| `\|       +-- backpressure.md, dev-environment.md, plans/{active,executed,lessons_learned,archive}/` |                                                                             |                                        |                                                           |
| `+-- skills/`                                                                                        | ten skill directories; each ships                                           | clients                                | maintainer (manual today; compiled by Wave 1)             |
| `\|   +-- <skill-name>/SKILL.md`                                                                     | auto-discovered by Claude Code; ships                                       | clients                                | maintainer                                                |
| `\|   +-- <skill-name>/references/`                                                                  | optional; ships when present                                                | clients                                | maintainer                                                |
| `\|   +-- <skill-name>/assets/`                                                                      | optional; ships when present                                                | clients                                | maintainer                                                |
| `+-- CLAUDE.md`                                                                                      | agent instructions for the repo; not shipped                                | Claude Code agents in this repo        | maintainer (manual)                                       |
| `+-- README.md`                                                                                      | developer-facing project doc; not shipped                                   | maintainers/contributors               | maintainer (manual)                                       |
| `+-- LICENSE`                                                                                        | MIT; ships (referenced by plugin.json)                                      | clients                                | maintainer                                                |
| `+-- cli-design-notes.md`                                                                            | CLI-only design rationale; not shipped                                      | maintainers                            | maintainer (manual; relocated by Pre-step B)              |
| `+-- cli-integration-plan.md`                                                                        | CLI-only integration plan; not shipped                                      | maintainers                            | maintainer (manual; relocated by Pre-step B)              |
| `+-- cli-prd.json`                                                                                   | CLI subproject PRD; not shipped                                             | maintainers/agents                     | maintainer (manual + clif-d CLI; relocated by Pre-step B) |
| `+-- dev-prod-split.md`                                                                              | this design doc; not shipped                                                | maintainers                            | maintainer (manual)                                       |

End state adds `clif-d/` (Wave 0) for plugin-level CLIF-D artifacts and `dev/` (Wave 1 onward) for build source; the `cli/` directory eventually drains into `dev/` (see migration blockers in section 5).
This inventory is a candidate for templating into `CLAUDE.md` and a README contributors section once Wave 1 makes that easy.

## 3. Decisions locked

1. **Source-tree root: `dev/`** at repo root.
   Sibling to the existing compiled-shape directories (`skills/`, `bin/`, `.claude-plugin/`).
2. **Templating engine: Nunjucks.**
   Rationale: Jinja-like syntax familiar to anyone who has touched Python web tooling; Mozilla-maintained and stable; first-class support for `{% include %}`, template inheritance, macros, and conditionals -- the four mechanisms skill composition will actually need.
   Its `{% %}` / `{{ }}` syntax collides with markdown less than EJS's `<% %>`.
   Handlebars was considered and rejected: its logic-less design pushes skill-variation logic into data files, which is awkward when the variations are prose-shaped.
   Eta was a strong "small and tight" alternative but shares EJS's syntax concern and offers less for no offsetting gain.
   A hand-rolled ~100-line include engine was considered and rejected on maintenance grounds.
   Nunjucks is a devDependency; its footprint never ships.
   This rationale belongs in `clif-d/dev-environment.md` and a README contributors section after Wave 0 lands; this doc is the design record, not the long-term home.
3. **Staleness enforcement: fail if stale.**
   Pre-commit hook runs the build into a scratch location and diffs against on-disk files; nonzero exit with a "run `npm run build` and re-stage" message if any differ.
   No silent rebuild-and-restage: modifying the working tree during commit surprises contributors and conceals source/output drift.
4. **Skill migration cadence: one skill per PR.**
   The build tolerates a mixed tree throughout the transition: a skill is either sourced (listed in a manifest, `dev/skills/<name>/` renders into `skills/<name>/`) or hand-maintained (build leaves `skills/<name>/` alone).
5. **CLI keeps its own PRD.**
   The plugin-level PRD (Wave 0) and the CLI subproject's PRD (currently `cli-prd.json`, relocated to `cli/clif-d/prd.json` by Pre-step B below) stay separate.
   The CLI's REQs do not fold into the plugin-level PRD as low-level requirements: the CLI is a sub-project with its own scope, lifecycle, and ship boundary, and treating its REQs as plugin-level low-level requirements would conflate two different planning timelines.
   Wave 4 transforms the relocated `cli-prd.json` into a properly structured CLIF-D PRD under `cli/clif-d/`.
6. **No shipped plugin file changes during the dev/prod split itself.**
   The whole migration must be transparent to clients: `bin/`, `skills/`, `.claude-plugin/`, and `LICENSE` stay byte-identical from the base of the migration branch through Wave 2.
   Pre-step A installs a `verify-shipped-unchanged.sh` gate that enforces this; every wave runs it.
   Wave 3 is the one deliberate exception (it intentionally rewords `bin/CLAUDE.md`) and bumps the baseline on its commit.

## 4. Slicing strategy

Two pre-steps and five waves.
Pre-step A installs the no-shipped-changes gate that every later step runs; Pre-step B relocates CLI-only design docs out of the repo root.
Both pre-steps are unblocked and can land in either order.
Wave 0 bootstraps the plugin's own CLIF-D artifacts; Waves 1-4 each land independently after that.

### Pre-step A -- ship-unchanged verification

Goal: a script that fails if any shipped plugin file differs from a baseline commit (default: the merge-base of the migration branch with `main`).
Every step below gates on it.
Decision 6 is the policy this step enforces.

Why this exists separately from the staleness check (decision 3): staleness only proves source and output are in sync.
A correctly-configured templating system that drops a single trailing newline could pass the staleness check while silently changing every shipped skill file for every installed user.
The ship-unchanged gate is the second layer that catches that.

Compatibility with everything else planned in this doc:

- **Pre-step B** (relocate CLI-only design docs) -- those files do not ship; gate passes.
- **Wave 0** (dogfood CLIF-D on the plugin) -- writes only into the new plugin-level `clif-d/` and may augment the repo-root `CLAUDE.md`; none of those ship; gate passes.
- **Wave 1** (skills templated from `dev/`) -- the rendered output under `skills/` must be byte-identical to the current contents.
  This gate enforces it.
- **Wave 2** (CLI compiled from `dev/`) -- compiled `bin/clif-d` must be byte-identical to the current `bin/clif-d`, down to the shebang and trailing newline.
  This gate enforces it.
- **Wave 3** (constraint doc reword) -- this is the one wave that deliberately changes a shipped file (`bin/CLAUDE.md`).
  Wave 3 lands after Waves 1-2 so wording reflects the actual machinery, and its commit is the only place that bumps the verifier's baseline; nothing else under the shipped surface changes in that wave.
- **Wave 4** (dogfood CLIF-D on the CLI subproject) -- writes only into `cli/clif-d/`; nothing ships from there; gate passes.

So the no-shipped-changes invariant is compatible with every change in this plan.
Wave 3 is the single, deliberate exception; the explicit baseline-bump makes that exception visible rather than silent.

Deliverables:

- `cli/scripts/verify-shipped-unchanged.sh` (long-term home: `dev/scripts/verify-shipped-unchanged.sh` post-Wave-2).
  Reuses `cli/scripts/verify-plugin-payload.sh`'s definition of the shipped surface (`bin/`, `skills/`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `LICENSE`).
  Implementation: `git diff --quiet "$BASELINE" -- <paths>`; nonzero exit on any drift, plus a `git diff --stat` dump for human inspection.
- A baseline-recording mechanism so the verifier knows what to diff against.
  Lean: hard-coded `git merge-base HEAD origin/main`, with a `--baseline=<sha>` flag for explicit override and a tracked `.shipped-baseline` SHA file that Wave 3's commit updates.
- A `verify:shipped` script entry in the active `package.json` (`cli/package.json` near-term, `dev/package.json` post-migration).
- Pre-commit wiring under husky: any commit that touches a path under the shipped surface runs the verifier and refuses if it fails.
  Wave 3 lifts this against `bin/CLAUDE.md` only on the commit that bumps the baseline.

Exit criteria:

- `verify:shipped` passes on the unmodified branch tip.
- A test edit to `bin/clif-d` makes `verify:shipped` fail with a clear diff against the baseline.
- A test edit to `dev-prod-split.md` (non-shipped) leaves `verify:shipped` passing.
- The pre-commit hook refuses a commit that hand-edits a shipped file.

This step itself does not introduce any change to a shipped plugin file.

If a better verification primitive presents itself during implementation (a checked-in manifest of expected hashes; a CI-only check rather than a local hook; a `git notes`-based marker), substitute it -- the contract that matters is "no shipped file drifts without a deliberate, separately-tracked decision," not the specific mechanism.

### Pre-step B -- relocate CLI-only design docs

Goal: move `cli-prd.json`, `cli-design-notes.md`, and `cli-integration-plan.md` from repo root into `cli/clif-d/` (the CLI subproject's existing CLIF-D directory).
These are CLI-only documents and should not pollute the repo root, where they look like plugin-level concerns and clash with the new plugin-level `clif-d/` directory that Wave 0 introduces.

This is unblocked: it can run any time, including before Wave 0, because the CLI already has a dedicated directory at `cli/clif-d/`.

Deliverables:

- `git mv cli-prd.json cli/clif-d/prd.json` (drops the redundant `cli-` prefix; the path now self-identifies as the CLI's PRD).
- `git mv cli-design-notes.md cli/clif-d/design-notes.md`.
- `git mv cli-integration-plan.md cli/clif-d/integration-plan.md`.
- Sweep `CLAUDE.md`, `README.md`, this design doc, and any scripts (e.g. `cli/scripts/verify-plugin-payload.sh` if it references them) for the old paths; update.
- Sweep `bin/CLAUDE.md` and any skill files that reference these paths.
- Update `bin/clif-d` if it has any hard-coded references to `cli-prd.json` (e.g. default `--prd-path`).
- Update `cli/package.json` scripts and `cli/.husky/pre-commit` if they reference the moved paths.

The transformation of these moved docs into proper CLIF-D artifacts (concept, architecture, etc.) is Wave 4 below; this Pre-step is just relocation.

### Wave 0 -- dogfood CLIF-D on the plugin itself

Goal: produce the plugin's own CLIF-D artifacts -- concept, PRD, architecture, backpressure, dev-environment -- using this plugin's own skills, before any build machinery lands.
The plugin has none of these today at plugin-level scope; `cli-prd.json` covers only the CLI subproject.
The dev/prod split from sections 2-3 becomes canonical in the generated `clif-d/architecture.md`.
README TODOs that belong in a PRD migrate into `clif-d/prd.json`.

Process: run each skill in order, following the skill's own process, augmented at each step by researching the codebase first rather than treating the run as greenfield.
The skills are designed to interview a user from scratch; here a substantial "what" already exists in code and docs, and the interrogation should focus on the "why" and the deliberate gaps.

Steps:

1. **`clif-d:create-product-concept`** -- follow the skill's process.
   Augmentation: before any interrogation, read `README.md`, `CLAUDE.md`, and every `skills/*/SKILL.md` to understand what the plugin already is.
   The interrogation resolves the *why*, not the *what*.
   Output: `clif-d/concept.md`.
2. **`clif-d:create-initial-prd`** -- follow the skill's process.
   Augmentation: survey the existing skills, the README TODO list, the relocated `cli/clif-d/prd.json`, and the other CLI design docs before specifying requirements.
   Per decision 5, the CLI keeps its own PRD: this plugin-level PRD does not absorb the CLI's REQs.
   Output: `clif-d/prd.json`.
3. **`clif-d:create-architecture`** -- follow the skill's process.
   Augmentation: the dev/prod split (sections 2-3 of this doc) is an existing architectural decision and must appear in the output verbatim or by reference.
   Waves 1-3 below become scaffolding requirements appended to `clif-d/prd.json`.
   Output: `clif-d/architecture.md`.
4. **`clif-d:design-backpressure`** -- follow the skill's process.
   Augmentation: read `cli/clif-d/backpressure.md` (the CLI subproject's existing design) and decide which rules generalize to the plugin and which stay CLI-scoped.
   The fail-if-stale check (decision 3) is an explicit backpressure rule that belongs in the plugin-level design.
   Output: `clif-d/backpressure.md`.
5. **`clif-d:bootstrap-dev-environment`** -- follow the skill's process.
   Augmentation: the skill assumes greenfield, but the tooling under `cli/` is partially in place.
   The skill updates `CLAUDE.md` rather than writing it from scratch and documents the migration path from `cli/` to `dev/`.
   Output: `clif-d/dev-environment.md`; updates `CLAUDE.md`.

Verification: Wave 0 only writes into `clif-d/` (new) and `CLAUDE.md` (not shipped); `verify:shipped` from Pre-step A must remain green at every commit.

Once Wave 0 completes, Waves 1-3 each correspond to requirements in `clif-d/prd.json` and are planned via `clif-d:plan-requirement` / implemented via `clif-d:implement-plan` -- the plugin runs on itself.

The pipeline diagram idea that previously sat here as Slice 0 has been moved back to the README TODO list; the dev/prod split is enough to think about on its own.

### Wave 1 -- skills templated from dev/

Goal: `skills/` becomes a compiled artifact.
Shared fragments live in `dev/partials/` and are pulled into every `SKILL.md` that needs them via `{% include %}`.

Structure:

- `dev/skills/<name>/SKILL.md.njk` and optional `dev/skills/<name>/data.yaml`.
- `dev/partials/` for cross-skill fragments.
- Build script extended to render skills; mixed-tree tolerance via a manifest listing which skills are sourced.

Candidate shared fragments (starter set, not final):

- HITL/HOTL/HITL-lite rubric and interrogation discipline.
- `clif-d/` directory layout.
- Artifact precedence and lifecycle list.
- Runtime assumptions (git, bash, node 18+, web access).
- Pipeline-position callout (one skill's upstream/downstream pointers).

Migration: one skill per PR.
First skill chosen to exercise the common fragments; simpler skills last.

Verification: per decision 6, every templated skill must render byte-identical to its current shipped form.
The wave's exit criterion includes `verify:shipped` passing on every commit, including the final mixed-tree commit that flips the last skill from hand-maintained to sourced.

Open for Wave 1:

- How do `references/` and `assets/` directories inside each skill relate to the templating pipeline?
  Likely copied through unchanged at first.
- What minimum schema do we impose on `data.yaml` so cross-skill data stays consistent?

### Wave 2 -- CLI compiled from dev/

Goal: `bin/clif-d` becomes a compiled artifact from TS source under `dev/cli/src/`.

Structure:

- `dev/cli/src/*.ts` -- modular TS source.
- Build compiles to single-file CommonJS at `bin/clif-d` with zero runtime deps (the ship constraint is preserved).
- Tests move to `dev/cli/test/`.
- The `cli/clif-d.js -> ../bin/clif-d` symlink retires.

Verification: per decision 6, the compiled `bin/clif-d` must be byte-identical to today's `bin/clif-d` -- shebang, every line, trailing newline.
`verify:shipped` is the contract; if the bundler emits a footprint that drifts even by whitespace, fix the bundler config rather than bumping the baseline.

Open for Wave 2:

- Bundler choice: esbuild (fast, single-command-to-single-file) vs tsc-plus-rollup.
  Confirm whichever we pick emits zero-runtime-dep CommonJS cleanly *and* byte-identical to the current `bin/clif-d`.
- Source decomposition inside `dev/cli/src/` -- by command group (`req.ts`, `ctx.ts`, `arch.ts`, `validate.ts`, `id.ts`) or flatter?
- Does `cli/` (husky, eslint configs) survive as-is or get folded into `dev/cli/`?
  Near-term: leave it; fold during or after Wave 2.

### Wave 3 -- constraint doc reword

Goal: every doc that assumes direct-edit gets reworded to distinguish source constraints from ship constraints.

Inventory (non-exhaustive; final pass during Wave 3):

- `CLAUDE.md` at repo root -- "Skills are self-contained", "edit `bin/clif-d`, not the symlink", "One sentence per line in prose" (this last one may need restating against `.njk` templates).
- `bin/CLAUDE.md` -- reconcile with compiled model. **(Shipped; see baseline-bump note below.)**
- `cli/clif-d/prd.json` CTX-001 (no runtime deps on `bin/clif-d`) -- still valid but applies to the shipped artifact, not the source.
- `cli/clif-d/prd.json` CTX-002 (single-file CommonJS, no transpilation) -- the no-transpilation clause inverts: source is transpiled, output is single-file CommonJS.
- `README.md` "Ship a new version" section -- add the build step.
- `cli/clif-d/backpressure.md` section 4 (symlink rationale) -- obsolete after Wave 2.
- `cli/clif-d/dev-environment.md` -- any references to direct edits.

Verification: this is the one wave with a deliberate exception to decision 6.
`bin/CLAUDE.md` is the only shipped file that intentionally changes here.
The wave's commit that touches `bin/CLAUDE.md` also bumps `.shipped-baseline` to its own SHA, so subsequent waves continue gating on a clean tree.
Every other commit in this wave (root `CLAUDE.md`, `cli/clif-d/*`, `README.md`) leaves `verify:shipped` green.

Sequencing: Wave 3 lands after Waves 1-2 so rewording reflects the actual machinery, not a speculative one.

### Wave 4 -- dogfood CLIF-D on the CLI subproject

Goal: bring the CLI subproject's design docs into proper CLIF-D shape, so `cli/clif-d/` carries a full set of artifacts (concept, PRD, architecture, backpressure, dev-environment) that mirror the plugin-level `clif-d/` Wave 0 produced.
Mirrors Wave 0 but scoped to the CLI subproject.

Process: same augmentation pattern as Wave 0 -- run each skill, augmented by reading the existing relocated docs (`cli/clif-d/prd.json`, `cli/clif-d/design-notes.md`, `cli/clif-d/integration-plan.md`) and the existing `cli/clif-d/backpressure.md` / `dev-environment.md`.

Steps:

1. `clif-d:create-product-concept` -- output `cli/clif-d/concept.md`.
   Augmentation: read the existing CLI design docs and `bin/CLAUDE.md` first.
2. `clif-d:create-initial-prd` -- refine the relocated `cli/clif-d/prd.json` into the canonical CLIF-D PRD shape.
   The existing PRD is the augmentation source; this is a refactor, not a fresh write.
3. `clif-d:create-architecture` -- output `cli/clif-d/architecture.md`.
   Captures the CLI's internal structure (single-file source, command-group decomposition once Wave 2 lands, etc.).
4. `clif-d:design-backpressure` -- refine the existing `cli/clif-d/backpressure.md` in place.
   Most rules are already captured; the skill's job is to confirm structure and fill gaps.
5. `clif-d:bootstrap-dev-environment` -- refine the existing `cli/clif-d/dev-environment.md`.
   The output may simply link to the plugin-level `clif-d/dev-environment.md` (Wave 0 step 5) where the CLI shares the parent's environment, with CLI-specific deltas documented locally.

Verification: Wave 4 only writes into `cli/clif-d/` (not shipped); `verify:shipped` stays green at every commit.

Sequencing: Wave 4 lands after Wave 3 -- the CLI's own design docs need the new `dev/cli/` paths to be real before they document them.

## 5. Migration blockers

Anticipated frictions of the `cli/` -> `dev/` consolidation.
Not a plan in themselves; a list to keep in mind when each wave schedules the relevant move.

- **Husky re-home order.**
  The `prepare` script and hooks live under `cli/`.
  Order matters: `dev/package.json` must be installed and its `prepare` script must have run before `cli/package.json` is removed, otherwise hooks vanish mid-transition.
  Hooks migrate from `cli/.husky/` to `dev/.husky/`.
- **SessionStart hook.**
  `.claude/settings.json` hard-codes `./cli/scripts/bootstrap.sh`.
  Moving the script to `dev/scripts/` requires a coordinated settings edit or the hook breaks on session start.
- **Path references across docs and scripts.**
  `CLAUDE.md` and `README.md` reference `cli/scripts/...`, `cli/.nvmrc`, `cli/package.json`, `cli/clif-d/...` in several places.
  `cli/scripts/verify-plugin-payload.sh`, `cli/scripts/bootstrap.sh`, and `cli/scripts/semantic-wrap.mjs` all run relative to their own location but may be invoked by callers assuming the old path.
  A grep-and-sweep step is mandatory with each move.
- **`cli-prd.json`, `cli-design-notes.md`, `cli-integration-plan.md` at repo root.**
  Resolved by Pre-step B (relocates them to `cli/clif-d/`) and Wave 4 (transforms them into proper CLIF-D artifacts under `cli/clif-d/`).
  Decision 5 keeps them as a separate PRD from the plugin-level one.
- **`cli/clif-d/` after Wave 0.**
  Wave 0 creates a plugin-level `clif-d/` at repo root.
  The existing `cli/clif-d/` (CLI subproject's own CLIF-D artifacts) either moves to `dev/cli/clif-d/` post-Wave-2 (preserves sub-scope) or merges into the plugin-level `clif-d/` (flattens it).
  Lean: keep sub-scoped under `dev/cli/clif-d/`.
- **Test fixtures with relative paths.**
  Tests under `cli/test/` may rely on the `cli/` cwd.
  Relocating to `dev/cli/test/` is mechanical but not zero.
- **Node version transition.**
  `cli/.nvmrc` pins Node 18; the dev session is running Node 22.
  Consolidation under `dev/.nvmrc` is a natural moment to reconcile; CTX-001 in `cli-prd.json` may need updating.
- **`cli/clif-d.js` symlink.**
  Retires with Wave 2 when lint/typecheck move to TS source under `dev/cli/src/`.
  Before that, the symlink reference in `cli/package.json` scripts still needs to point somewhere sensible if we move `cli/package.json`.

## 6. Open questions

- **Build-script home (transition only).**
  Near-term: `cli/scripts/build-dev.mjs` because husky and `node_modules` live under `cli/` today.
  Long-term: moves to `dev/scripts/build.mjs` as part of the plugin-level `dev/package.json` migration.
- **`cli/clif-d/` final placement.**
  See section 5.
  Lean noted there; decision deferred to Wave 2.

## 7. Next step

Execute Pre-step A (the ship-unchanged verifier) and Pre-step B (relocate CLI-only design docs) in either order; both are unblocked and decouple the rest of the work from later sequencing concerns.
Then Wave 0 (dogfood CLIF-D on the plugin itself).
Subsequent waves follow as requirements in `clif-d/prd.json`, planned and implemented via the normal pipeline, all gated by Pre-step A's verifier.
