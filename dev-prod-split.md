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

1. **DRY cross-skill knowledge into skill files that actually load at runtime.**
   The README today houses the HITL/HOTL rubric, the `clif-d/` directory layout, the artifact precedence list, and runtime assumptions.
   Clients load skills but not the README, so that knowledge is effectively invisible at skill-invocation time.
   Templating lets us compose self-contained `SKILL.md` files that include shared fragments without hand-duplicating prose and without violating the "skills are self-contained" invariant.
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
3. **Staleness enforcement: fail if stale.**
   Pre-commit hook runs the build into a scratch location and diffs against on-disk files; nonzero exit with a "run `npm run build` and re-stage" message if any differ.
   No silent rebuild-and-restage: modifying the working tree during commit surprises contributors and conceals source/output drift.
4. **Skill migration cadence: one skill per PR.**
   The build tolerates a mixed tree throughout the transition: a skill is either sourced (listed in a manifest, `dev/skills/<name>/` renders into `skills/<name>/`) or hand-maintained (build leaves `skills/<name>/` alone).
5. **Diagram rendering: plain Mermaid fenced blocks, GitHub-native rendering.**
   `beautiful-mermaid` is out of scope for Slice 0; its SVG output is a diff-hostile blob and the gain over `classDef`-styled Mermaid is marginal for this diagram's size.
   Re-evaluate once the YAML source exists and the rendered Mermaid is visible in a PR.

## 4. Slicing strategy

Five phases.
Wave 0 runs first (bootstraps the plugin's own CLIF-D artifacts); Slice 0 and Waves 1-3 each land independently after that.

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
   Augmentation: survey the existing skills, the README TODO list, `cli-prd.json`, and the existing design docs before specifying requirements.
   Decide how `cli-prd.json` relates; see section 6.
   Output: `clif-d/prd.json`.
3. **`clif-d:create-architecture`** -- follow the skill's process.
   Augmentation: the dev/prod split (sections 2-3 of this doc) is an existing architectural decision and must appear in the output verbatim or by reference.
   Slice 0 and Waves 1-3 below become scaffolding requirements appended to `clif-d/prd.json`.
   Output: `clif-d/architecture.md`.
4. **`clif-d:design-backpressure`** -- follow the skill's process.
   Augmentation: read `cli/clif-d/backpressure.md` (the CLI subproject's existing design) and decide which rules generalize to the plugin and which stay CLI-scoped.
   The fail-if-stale check (decision 3) is an explicit backpressure rule that belongs in the plugin-level design.
   Output: `clif-d/backpressure.md`.
5. **`clif-d:bootstrap-dev-environment`** -- follow the skill's process.
   Augmentation: the skill assumes greenfield, but the tooling under `cli/` is partially in place.
   The skill updates `CLAUDE.md` rather than writing it from scratch and documents the migration path from `cli/` to `dev/`.
   Output: `clif-d/dev-environment.md`; updates `CLAUDE.md`.

Once Wave 0 completes, Slice 0 and Waves 1-3 each correspond to requirements in `clif-d/prd.json` and are planned via `clif-d:plan-requirement` / implemented via `clif-d:implement-plan` -- the plugin runs on itself.

### Slice 0 -- pipeline diagram via dev/prod machinery

Goal: prove the dev/prod machinery on one low-risk target before it's holding up skills or the CLI.
`dev/pipeline.yaml` renders a Mermaid diagram block injected into `README.md` alongside the existing ASCII tree.

Deliverables:

- Install `nunjucks` and a YAML parser as devDependencies.
  Near-term home is `cli/package.json`; the plugin-level `dev/package.json` migration (section 5) may move them before Slice 0 lands.
- Create `dev/pipeline.yaml` describing skills, dispositions, forward edges, back edges, and per-skill primary artifact filenames.
- Create `dev/templates/pipeline-diagram.njk` producing a `flowchart TD` Mermaid block with `classDef`-colored HITL/HOTL/HITL-lite nodes, solid forward edges, dashed feedback edges, and a `codebase` store node.
- Create a build script (`cli/scripts/build-dev.mjs` near-term, `dev/scripts/build.mjs` post-migration) that loads the pipeline source, renders templates, and writes generated content to dedicated output files.
  No mid-file injection, no marker protocol: generated content lives in its own file (e.g. `pipeline-diagram.md` at repo root) and the hand-maintained README adds a one-line link near the ASCII tree.
- Add a staleness-check script that runs the build into a temp tree and diffs against on-disk files.
- Add a `build` script to the active `package.json`; wire the staleness-check into `check` and into the husky `pre-commit` hook.
- Update `CLAUDE.md` with one short paragraph: edit `dev/`, run `npm run build`, commit both.

Non-scope:

- No skill files get templated.
- `bin/clif-d` stays hand-authored.
- No other constraint-doc rewording.

Exit criteria:

- Editing `dev/pipeline.yaml`, running `npm run build`, and committing both succeeds.
- A commit that edits `dev/pipeline.yaml` without rebuilding fails the staleness check.
- A commit that hand-edits the generated `pipeline-diagram.md` directly (without touching `dev/`) fails the staleness check.
- The rendered Mermaid diagram, reachable from the README's one-line link, shows all ten skills, forward edges, the two back-edges (`extend-low-level-requirements` -> `plan-requirement`, `compactify-artifacts` -> upstream design docs), HITL/HOTL/HITL-lite color-coding, and a `codebase` store node linked to `implement-plan` (write) and `plan-requirement` (read).

Wave 1 may later fold this back into an inline README block once the README itself is templated; for now, standalone generated file plus link keeps Slice 0 small.

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

Open for Wave 1:

- Does `dev/pipeline.yaml` (from Slice 0) merge with per-skill `data.yaml`, or stay separate?
- How do `references/` and `assets/` directories inside each skill relate to the templating pipeline?
  Likely copied through unchanged at first.
- What minimum schema do we impose on `data.yaml` so the pipeline source and the per-skill data stay consistent?

### Wave 2 -- CLI compiled from dev/

Goal: `bin/clif-d` becomes a compiled artifact from TS source under `dev/cli/src/`.

Structure:

- `dev/cli/src/*.ts` -- modular TS source.
- Build compiles to single-file CommonJS at `bin/clif-d` with zero runtime deps (the ship constraint is preserved).
- Tests move to `dev/cli/test/`.
- The `cli/clif-d.js -> ../bin/clif-d` symlink retires.

Open for Wave 2:

- Bundler choice: esbuild (fast, single-command-to-single-file) vs tsc-plus-rollup.
  Confirm whichever we pick emits zero-runtime-dep CommonJS cleanly.
- Source decomposition inside `dev/cli/src/` -- by command group (`req.ts`, `ctx.ts`, `arch.ts`, `validate.ts`, `id.ts`) or flatter?
- Does `cli/` (husky, eslint configs) survive as-is or get folded into `dev/cli/`?
  Near-term: leave it; fold during or after Wave 2.

### Wave 3 -- constraint doc reword

Goal: every doc that assumes direct-edit gets reworded to distinguish source constraints from ship constraints.

Inventory (non-exhaustive; final pass during Wave 3):

- `CLAUDE.md` at repo root -- "Skills are self-contained", "edit `bin/clif-d`, not the symlink", "One sentence per line in prose" (this last one may need restating against `.njk` templates).
- `bin/CLAUDE.md` -- reconcile with compiled model.
- `cli-prd.json` CTX-001 (no runtime deps on `bin/clif-d`) -- still valid but applies to the shipped artifact, not the source.
- `cli-prd.json` CTX-002 (single-file CommonJS, no transpilation) -- the no-transpilation clause inverts: source is transpiled, output is single-file CommonJS.
- `README.md` "Ship a new version" section -- add the build step.
- `cli/clif-d/backpressure.md` section 4 (symlink rationale) -- obsolete after Wave 2.
- `cli/clif-d/dev-environment.md` -- any references to direct edits.

Sequencing: Wave 3 lands after Waves 1-2 so rewording reflects the actual machinery, not a speculative one.

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
  These are CLI-subproject design docs.
  "All dev under `dev/`" implies they move; Wave 0 may subsume `cli-prd.json` into the plugin-level PRD anyway (its REQs fold in as low-level requirements under a plugin-level CLI high-level requirement).
  Final placement decided during Wave 0 / Wave 2.
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
- **Relationship between `cli-prd.json` and the new plugin-level PRD.**
  Most likely the CLI's REQs fold in as low-level requirements under a plugin-level "CLI subproject" high-level requirement, and `cli-prd.json` is either deleted (its content absorbed) or left as a historical record.
  Decided during Wave 0 step 2.

## 7. Next step

Execute Wave 0 (dogfood CLIF-D on the plugin itself).
Slice 0 and later waves follow as requirements in `clif-d/prd.json`, planned and implemented via the normal pipeline.
