# Dev Environment -- clif-d CLI

## 1. Overview

This document defines how the `clif-d` CLI development environment is bootstrapped and how coding agents inherit context about it. The CLI itself is a zero-dependency single-file Node.js executable (`bin/clif-d`) shipped as part of the CLIF-D Claude Code plugin; the development tooling that lints, type-checks, and tests it lives in `cli/` as a small npm project.

The authoritative inputs are `cli-prd.json` (repo root) and `cli/clif-d/backpressure.md`. No `architecture.md` exists for this tool -- the CLI's scope is small enough that the PRD's context items (CTX-001 through CTX-010) and architecture items (ARCH-001 through ARCH-003) have served as the design contract.

The bootstrap is script-based, not containerized. A single entry-point script (`cli/scripts/bootstrap.sh`) installs pinned dev dependencies, registers the git pre-commit hook, and leaves the repo ready for development, linting, type checking, and testing. The same script works from the user's shell, from a coding agent's non-interactive subshell, and from a near-empty cloud agent runtime, provided Node.js 18+ is already on `PATH`.

## 2. Target Environments

### Local user machine (macOS default)

Starting state: Node.js 18+ on PATH (typical via nvm, fnm, volta, mise, asdf, homebrew, or a direct install). Git installed. Bash available.

Bootstrap produces: `cli/node_modules/` populated from the lockfile, git pre-commit hook installed via husky, all quality checks invokable.

Out of scope: installing Node itself, installing a Node version manager, modifying `.zshrc`/`.bash_profile`.

### Local coding-agent subshell

Starting state: same machine as above, but a non-interactive shell that does not inherit the user's login-shell hooks. `PATH` may be minimal; `node` must still resolve.

Bootstrap produces: identical to the local user case. The script is deliberately written so every step works under `env -i bash --noprofile --norc` when Node is on PATH.

Out of scope: any step that requires interactive input. The script is idempotent and non-interactive.

### Cloud agent runtime

Starting state: a near-empty Linux container with Node.js 18+ and git available. No user profile. No shell hooks.

Bootstrap produces: identical to the local cases. The script detects Node version and npm availability and fails loudly with an actionable message if they are absent.

Out of scope: container image construction, base-image choice (handled by whatever spawns the runtime), system package installation.

## 3. Technology Stack

| Tool | Version | Installer | Install Command |
|------|---------|-----------|-----------------|
| Node.js | 18+ (major pin) | External to this repo (Claude Code guarantees 18+; elsewhere use nvm, fnm, volta, mise, asdf, or OS package) | Not installed by bootstrap. Pin recorded in `cli/.nvmrc` as `18`. |
| npm | Ships with Node | Bundled with Node | Not installed by bootstrap. |
| npm dev deps | pinned by `cli/package-lock.json` | npm | `npm ci` run from `cli/` by the bootstrap script |
| Prettier | `^3.0.0` (resolved by lockfile) | npm devDependency | via `npm ci` |
| ESLint | `^9.0.0` (resolved by lockfile) | npm devDependency | via `npm ci` |
| eslint-plugin-unicorn | `^56.0.0` | npm devDependency | via `npm ci` |
| eslint-plugin-n | `^17.0.0` | npm devDependency | via `npm ci` |
| eslint-plugin-security | `^3.0.0` | npm devDependency | via `npm ci` |
| TypeScript (`tsc --noEmit`, `checkJs`) | `^5.4.0` | npm devDependency | via `npm ci` |
| husky | `^9.0.0` | npm devDependency | via `npm ci`; `prepare` hook registers `.husky/` on install |
| @types/node | `^18.0.0` | npm devDependency | via `npm ci` |
| Test runner | `node:test` (built-in) | Bundled with Node | Not installed. |

Exact versions are pinned in `cli/package-lock.json`. The bootstrap uses `npm ci` (frozen-lockfile semantics), never `npm install`. The Node pin is the major version only (`18`), matching the floor that Anthropic guarantees for Claude Code plugin environments; pinning a minor would cause spurious failures on runtimes that ship 18.x.y for any y.

## 4. Bootstrap Mechanism

Script-based. Three artifacts, all inside `cli/`:

- `cli/.nvmrc` -- contains the literal string `18`. Respected by nvm, fnm, volta, mise, and asdf. Informational only; the bootstrap does not invoke any version manager.
- `cli/scripts/bootstrap.sh` -- the single bootstrap entry point. Verifies Node major version, runs `npm ci` in `cli/`, prints status, exits non-zero on failure.
- `cli/scripts/verify-env.sh` -- the post-bootstrap verification script. Runs every command listed in Technology Decisions / backpressure §8, plus a sanity invocation of `bin/clif-d --help`.

No Dockerfile, no devcontainer, no Makefile. The CLI is too small to justify that overhead, and the backpressure document already prescribes `cd cli && npm install` as the only setup step -- this skill formalizes that into a checked, pinned, idempotent script.

## 5. Bootstrap Command

```
./cli/scripts/bootstrap.sh
```

Run from the repo root. Every downstream artifact (rules files, README snippets, CI examples) quotes this string verbatim.

## 6. Idempotency and Failure Modes

**Second run on a clean machine:** `npm ci` reinstalls deterministically from the lockfile. The husky `prepare` script re-registers hooks; it is a no-op if they are already installed correctly. Total wall time on a warm cache: a few seconds.

**Dependency already installed:** `npm ci` does not skip; it removes `node_modules/` and reinstalls from the lockfile. This is deliberate -- `npm ci` is the reproducible command, not the fast one. If this becomes painful, switch to `npm install --frozen-lockfile` with a staleness check; it is not painful today.

**Pinned version overridden manually:** If a developer edits `cli/package.json` to bump a version without updating the lockfile, `npm ci` fails loudly. This is the intended behavior. To update a dep: edit `package.json`, run `npm install` (which updates the lockfile), commit both.

**Missing Node:** the script prints the required version and exits with code 2. It does not attempt to install Node.

**Node too old:** the script prints the detected version, the required version (`18`), and suggests a version-manager command. Exits with code 2.

**No network access:** `npm ci` requires network unless `node_modules/` and the npm cache already cover every dep. In offline cloud runtimes, pre-populate the cache before invoking the script.

**Sudo:** never required. The script runs entirely in the user's home directory / repo. If any step would require elevation, it aborts.

**Shell profile modification:** never. The script does not touch `.zshrc`, `.bash_profile`, or any shell dotfile.

## 7. Verification

`./cli/scripts/verify-env.sh` runs, in order, failing on the first non-zero exit:

1. `node --version` -- confirms a 18+ Node is on PATH.
2. `cd cli && npm run format:check` -- Prettier over `bin/clif-d`.
3. `cd cli && npm run lint` -- ESLint over `bin/clif-d` (via the `cli/clif-d.js` symlink; see backpressure §4 configuration notes).
4. `cd cli && npm run typecheck` -- `tsc --noEmit` over the project.
5. `cd cli && npm test` -- `node --test test/**/*.test.js`. Exits 0 even when `cli/test/` is empty (node's test runner treats zero discovered tests as success). Once REQ-008 lands, real tests will run here; the verification contract does not change.
6. `./bin/clif-d --help` -- sanity check that the shebang resolves and the CLI is executable end-to-end.

Steps 2-5 collectively equal `cd cli && npm run check` (the aggregated script in `cli/package.json`); the verify script runs them individually so a single failure is attributable without interpreting combined output.

Expected first-run output on a correctly bootstrapped machine in the current PRD state:

```
[verify] node v18.x.y -- ok
[verify] prettier format:check -- ok
[verify] eslint -- ok
[verify] tsc --noEmit -- ok
[verify] node --test -- ok
[verify] bin/clif-d --help -- ok

[verify] 6 hard checks passed, 0 soft warnings.
```

## 8. Agent Rules Files

Three rules files at the repository root. Each is terse and points at the CLIF-D artifacts rather than duplicating them.

| File | Agents | Source |
|------|--------|--------|
| `CLAUDE.md` | Claude Code | Official Claude Code docs. Project-scoped, repo root. Already existed before this skill; a CLI-subproject section was merged in, not a full overwrite. |
| `AGENTS.md` | Generic multi-agent convention (covers 25+ tools including Google Antigravity-compatible tooling) | `https://agents.md/` -- verified 2026-04-14. Repo root. Monorepo convention: closest file wins, so this file covers both the plugin surface and the CLI subproject. |
| `GEMINI.md` | Gemini CLI | Gemini CLI repo docs -- verified 2026-04-14. Repo root, filename `GEMINI.md`. |

Google Antigravity: its official documentation at `antigravity.google/docs` returned no usable configuration content at verification time (2026-04-14). The `AGENTS.md` convention is documented as ecosystem-standard across the major agentic coding tools, so Antigravity is covered by it if Antigravity follows the convention; if it turns out to require a different filename, add that file later as a thin pointer to `AGENTS.md`.

Content, shared across all three files:

- Bootstrap command: `./cli/scripts/bootstrap.sh`
- Quality-check command: `cd cli && npm run check`
- Verification command: `./cli/scripts/verify-env.sh`
- Pointers to `cli-prd.json`, `cli/clif-d/backpressure.md`, `cli/clif-d/dev-environment.md`, `cli-design-notes.md`, `cli-integration-plan.md`
- Gotchas: `bin/clif-d` is zero-dep and CommonJS-style (CTX-001, CTX-002); `cli/` is dev-only; do not add runtime dependencies; do not upgrade Node past the pin without updating the PRD.

`CLAUDE.md` retains its existing plugin-repo content and gains a "CLI subproject" section appended to the end.

### Scoped rules: nested per-directory files

The top-level rules files describe the whole repo and are always in the agent's context window. They must stay terse so unrelated work (skills, plugin manifest, marketplace) is not weighed down by CLI-specific implementation rules.

For rules that only apply when an agent is editing `bin/clif-d`, this repo uses the **closest-file-wins** nested convention that all three supported harnesses respect:

| File | Loaded when... |
|------|----------------|
| `bin/CLAUDE.md` | Claude Code reads or edits files under `bin/`. Claude Code walks up from the edited file and loads each `CLAUDE.md` it finds. |
| `bin/AGENTS.md` | Generic AGENTS.md-aware agents read or edit files under `bin/`. The published `agents.md` convention is monorepo-friendly: the closest file wins. |
| `bin/GEMINI.md` | Gemini CLI reads or edits files under `bin/`. Gemini CLI uses the same closest-file walk-up. |

The nested files are signposts -- they name the governing PRD context/architecture items (CTX-001 zero deps, CTX-002 single file, CTX-010 backpressure, CTX-012 internal modularity, ARCH-003 read-validate-write, ARCH-004 module-object structure, ARCH-005 testability seam) and point at `cli-prd.json` and `cli/clif-d/backpressure.md` for the authoritative prose. They do NOT copy PRD prose. Rationale: backpressure (the pre-commit gates) is corrective; scoped rules are preventative. Together they let an agent know *why* a gate exists before they hit it.

Glob-frontmatter rule files (Cursor's `.cursor/rules/*.mdc`, Claude Code's emerging `.claude/rules/*.md` patterns) are not used here because (a) the supported harnesses already implement the nested-file scoping natively and (b) adding parallel files for unsupported harnesses spreads maintenance without coverage benefit. If a fourth harness is adopted that requires explicit globs, add the rule file alongside its peers and document it in this section.

## 9. Relaxations and Deferred Items

- **Node not installed by bootstrap.** The script detects and demands 18+ but never installs it. Justification: Claude Code guarantees 18+ in plugin environments, macOS users already have a Node via one of many managers, and cloud runtimes typically ship a Node base image. Installing Node inside the script would require choosing a manager (bad for reproducibility) or shipping a tarball-download path (brittle). Detection + actionable error is the cleaner contract.
- **Node pin is major-only.** `cli/.nvmrc` contains `18`, not `18.20.4`. Justification: the PRD's CTX-001 language is "Node.js 18+", not a specific minor. Pinning to an exact minor causes spurious failures on runtimes that ship any compatible 18.x.y.
- **No containerization.** Justification: the project is a zero-dep single-file CLI with one dev-tooling package. A container adds weight without adding reproducibility over `npm ci` against a lockfile.
- **No tests yet.** `cli/test/` is empty until REQ-008 lands. `node --test` exits 0 on zero discovered tests, so verification passes in the current baseline; adding real tests cannot regress the contract.
- **Antigravity-specific rules file deferred** pending authoritative documentation of its rules-file convention. `AGENTS.md` covers it if it follows the ecosystem standard.

## 10. PRD and Architecture Traceability

| Bootstrap Decision | PRD References |
|--------------------|----------------|
| Node 18 major pin | CTX-001 (zero-dependency Node.js constraint, "18+") |
| `npm ci` + lockfile | CTX-010 (quality backpressure guardrails); backpressure §2, §3 |
| `bin/clif-d` is single executable file, bootstrap does not touch it | CTX-002 (single-file distribution), ARCH-001 (plugin bin/ distribution) |
| No runtime deps installed by bootstrap | CTX-001 (zero-dependency constraint applies to runtime) |
| Non-interactive, scriptable entry point | CTX-004 (Claude Code agent persona -- agents cannot answer prompts) |
| Exit codes 0 / 2 with actionable stderr | CTX-005 (CLI design conventions) |
| Verification script exercises every backpressure tool | CTX-010; backpressure §8 |
| Rules files at repo root, linked to PRD/backpressure/this doc | CTX-006 (PRD as living document -- agents must be able to find the living doc) |

A new context item (proposed ID `CTX-011`, type `constraint`, titled "Development environment bootstrap") will be added to `cli-prd.json` with `reference_link: cli/clif-d/dev-environment.md`. Every existing requirement that is implemented inside this environment gains that ID in its `context_refs` -- in practice, all 23 existing requirements, since there is one dev environment covering the whole CLI.
