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

- `dev/` at repo root holds all source material.
  Never ships, never loaded by clients.
- The plugin-shaped tree at repo root (`skills/`, `bin/clif-d`, `.claude-plugin/`, and any other generated assets) holds compiled output.
  Committed, versioned, shipped through the marketplace.
- A build step reads `dev/` and writes into the compiled tree.
- A pre-commit staleness check refuses a commit whose compiled output is out of sync with `dev/`.

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

Four phases.
Each lands independently.

### Slice 0 -- pipeline diagram via dev/prod machinery

Goal: prove the dev/prod machinery on one low-risk target before it's holding up skills or the CLI.
`dev/pipeline.yaml` renders a Mermaid diagram block injected into `README.md` alongside the existing ASCII tree.

Deliverables:

- Install `nunjucks` and `yaml` (or a small TOML/JSON alternative) as devDependencies under `cli/package.json`.
- Create `dev/pipeline.yaml` describing skills, dispositions, forward edges, back edges, and per-skill primary artifact filenames.
- Create `dev/templates/pipeline-diagram.njk` producing a `flowchart TD` Mermaid block with `classDef`-colored HITL/HOTL/HITL-lite nodes, solid forward edges, dashed feedback edges, and a `codebase` store node.
- Create `cli/scripts/build-dev.mjs` that loads the pipeline source, renders templates, and writes generated content into target files between explicit markers.
- Add `<!-- GENERATED:pipeline-diagram:START -->` / `<!-- GENERATED:pipeline-diagram:END -->` markers in `README.md` at the spot where the Mermaid block lives.
- Add `cli/scripts/check-dev-stale.sh` that runs the build into a temp tree and diffs against on-disk files.
- Add a `build` script to `cli/package.json` that invokes `build-dev.mjs`.
- Wire staleness-check into `cli/package.json`'s `check` target and the husky `pre-commit` hook.
- Update `CLAUDE.md` with one short paragraph: edit `dev/`, run `npm run build`, commit both.

Non-scope:

- No skill files get templated.
- `bin/clif-d` stays hand-authored.
- No other constraint-doc rewording.

Exit criteria:

- Editing prose inside the `README.md` generated markers and committing fails the pre-commit hook with a clear message.
- Editing `dev/pipeline.yaml`, running `npm run build`, and committing both succeeds.
- A commit that edits `dev/pipeline.yaml` without rebuilding fails staleness check.
- The rendered Mermaid diagram sits below the ASCII tree, shows all ten skills, forward edges, the two back-edges (`extend-low-level-requirements` -> `plan-requirement`, `compactify-artifacts` -> upstream design docs), HITL/HOTL/HITL-lite color-coding, and a `codebase` store node linked to `implement-plan` (write) and `plan-requirement` (read).

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

## 5. Open questions

- **Plugin-level PRD.**
  `cli-prd.json` covers the CLI subproject.
  The plugin itself has no PRD; the dev/prod split is plugin-level.
  Options: expand `cli-prd.json`'s scope, create `plugin-prd.json`, or keep this design doc authoritative until the structure grows.
  Near-term lean: keep this doc authoritative through Slice 0 and reassess before Wave 1.
- **Build-script home.**
  Near-term: `cli/scripts/build-dev.mjs` because husky and `node_modules` already live under `cli/`.
  Long-term: likely moves to `dev/build/` once `cli/` retires or folds.
- **Generated-file marker convention.**
  Slice 0 uses `<!-- GENERATED:<tag>:START --> ... <!-- GENERATED:<tag>:END -->` pairs.
  Works for markdown; needs an equivalent for other file types we may generate later (e.g. JSON assets, shell snippets).
- **How rebuilds interact with `cli/package.json` dependencies.**
  Near-term: Nunjucks and YAML parser go into `cli/package.json` devDependencies.
  A plugin-level `dev/package.json` may subsume this later; not worth splitting now.

## 6. Next step

Execute Slice 0.
A dedicated plan document may be written at that point if the slice grows beyond what section 4 describes; if it does not, this doc is sufficient to drive the work.
