---
name: create-architecture
description: >
  Generate a detailed architecture document from a CLIF-D PRD, extending the PRD's C4 context/container/component
  architecture down to the code level (C4 Level 4). Use this skill when the user has a PRD (from the
  create-initial-prd skill or equivalent) and wants to make concrete technology, repository structure, module
  decomposition, and interface decisions before planning implementation. Conducts a focused interrogation to resolve
  ambiguities, performs web research on technology options and conventions, then produces a structured architecture
  document with Mermaid diagrams that serves as the bridge between PRD and implementation planning.
  Pipeline position: after create-initial-prd; before design-backpressure. Outputs clif-d/architecture.md
  (and optional clif-d/architecture/*.mmd diagrams); also appends scaffolding requirements to clif-d/prd.json.
  Most relevant CLI: clif-d arch add, clif-d req add, clif-d validate.
---

# Generate Detailed Architecture

You are helping the user develop a detailed architecture document from an existing CLIF-D PRD.
The PRD already contains C4 context, container, and component-level architecture items.
Your job is to take those one level deeper -- to the **C4 code level** -- and make the concrete decisions that implementation planning needs.

---

## Philosophy

### Architecture as implementation bridge

The PRD intentionally stops at the level of abstraction needed for CLIF-D decomposition.
This skill fills the gap between "what the system does" (PRD) and "how we build it" (implementation plan).
The output should give a developer enough structural clarity to plan and implement any requirement without needing to make architectural decisions on the fly.

### Decisions, not descriptions

The PRD's architecture items describe responsibilities and boundaries.
This skill makes **decisions**: specific languages, frameworks, libraries, file layouts, module interfaces, data structures, error handling strategies, and dependency management approaches.
Every decision should include a brief rationale -- not a lengthy justification, but enough that a reader understands *why*, not just *what*.

### CLIF-D alignment

All architectural decisions must reinforce CLI-First Decomposition.
The architecture should make it natural and easy to:

- Build each requirement as a standalone, testable CLI tool or command
- Compose tools via pipes and standard I/O
- Test via inputs (args, flags, stdin) and outputs (stdout, stderr, exit codes)
- Maintain clear module boundaries that map to CLI surfaces

### Opinionated defaults, explicit trade-offs

Prefer established, well-documented tools over novel ones.
Prefer strict over permissive defaults (strict type checking, aggressive linting, explicit error handling).
When multiple viable options exist, choose one and state what was traded off -- do not present menus of options for the user to choose from unless the trade-off is genuinely load-bearing and preference-dependent.

---

## Input

This skill expects:

1. **A CLIF-D PRD** (JSON file from the `create-initial-prd` skill or equivalent).
   The user will provide a file path.
2. **The product concept document** referenced by the PRD's `concept_summary.reference_link`.

Read both fully before beginning the interrogation.
The PRD's `architecture` array is your starting point -- you are extending it, not replacing it.

---

## Interrogation

**Your job is to arrive at enough understanding to make concrete architectural decisions.** Do not generate the architecture document until you are ready.
Instead, interrogate the user.

Start by reading the PRD and its referenced concept document.
Summarize the existing architecture items and identify what decisions remain open.

Then ask focused questions across these dimensions:

### 1. Technology preferences and constraints

What languages, runtimes, and package managers does the team use or prefer?
Are there existing codebases this must integrate with?
What deployment targets matter (OS, containerization, etc.)?
Check the PRD's `context` items for `constraint` type entries -- many of these may already be answered.

### 2. Repository and project structure

Monorepo or multi-repo?
How do CLI tools map to packages/modules/crates?
What's the directory layout convention?
Where do shared libraries live relative to CLI entry points?

### 3. Data flow and persistence

How does data move between CLI tools?
What serialization formats?
Is there local state (config files, caches, databases)?
What are the storage and retrieval patterns?

### 4. Error handling and observability

What's the error propagation strategy from library code to CLI exit codes and stderr messages?
How are errors classified?
Is there structured logging?
What diagnostic information is available via `--debug`?

### 5. Testing strategy

What testing frameworks?
How are CLI tools tested end-to-end (process invocation, stdout/stderr capture, exit code assertion)?
How are internal modules unit-tested?
What's the boundary between unit and integration tests?

### 6. Dependency management and versioning

How are dependencies pinned?
What's the update strategy?
How are internal dependencies between CLI tools managed?
Is there a workspace/monorepo tool?

### Interrogation protocol

- **Do not ask all questions at once.** Many will be answered by the PRD's context items or by researching the chosen language ecosystem.
  Ask only what you can't determine yourself.
- **Use web research aggressively.** Once you know the language, research its ecosystem: the idiomatic project structure, the dominant test framework, the standard linter, the strictest type-checking configuration.
  Prefer authoritative sources (official docs, widely-adopted community standards).
- **Make provisional decisions and present them for confirmation** rather than asking open-ended questions.
  "I'd use X because Y -- does that work for you?" is better than "What do you want to use for X?"
- **Iterate.** First round: resolve language/runtime/constraints.
  Second round: present provisional structural decisions informed by research.
  Third round: confirm details.
- **When you believe you have enough understanding**, summarize the full architecture organized by section (see Output Structure below).
  Wait for the user to confirm before generating.

---

## Output Structure

This skill produces **two outputs**:

1. **A Markdown architecture document** with Mermaid diagrams, saved as `clif-d/architecture.md` in the product repository.
   This is the primary design artifact.
2. **Scaffolding requirements appended to the PRD.** After the architecture is decided, enough is known to specify the concrete scaffolding work that must happen before any feature implementation -- initializing the package manifest, creating the directory skeleton, adding baseline dependencies, wiring up the test runner, creating a minimal CLI entry point.
   These become **low-level requirements** added to `clif-d/prd.json`, which flow naturally through `plan-requirement` and `implement-plan` like any other low-level requirement.

The architecture document structure below describes Output 1. The "Generation process" section describes how to produce both outputs.

### 1. Overview

A brief summary (2-3 paragraphs) of the architectural approach.
Reference the PRD by file path.
State the primary language, runtime, and any foundational choices.
Explain how the architecture supports CLIF-D.

### 2. Technology Decisions

A table or structured list of every concrete technology choice:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language | ... | ... |
| Runtime/version | ... | ... |
| Package manager | ... | ... |
| Test framework | ... | ... |
| Linter | ... | ... |
| Type checking | ... | ... |
| CLI argument parsing | ... | ... |
| Serialization | ... | ... |
| ... | ... | ... |

Include version constraints where they matter.

### 3. Repository Structure

The directory layout, annotated.
Show where CLI entry points live, where shared libraries live, where tests live, where configuration lives.
Use a tree format:

```
product-name/
  src/
    cli/           # CLI entry points -- one per tool
    lib/           # Shared library modules
  tests/
    unit/
    integration/   # CLI end-to-end tests
  ...
```

Explain the organizing principle (e.g., "each CLI tool is a separate binary that depends on shared library crates" or "each command is a module under `src/commands/` with a shared core").

### 4. Module Architecture (C4 Code Level)

For each container or component from the PRD's architecture, decompose it into **modules, interfaces, and key data structures**.
This is the C4 code level -- the internal structure of each deployable unit.

For each module:
- **Responsibility**: What it does, in one sentence.
- **Public interface**: The functions, types, or traits it exposes.
  Use the chosen language's idiom.
- **Dependencies**: What other modules or external packages it depends on.
- **Key data structures**: The primary types it defines or operates on, with field-level detail where important.

Include Mermaid diagrams showing module relationships within each container/component.
Use C4Component or class diagrams as appropriate.

### 5. CLI-to-Module Mapping

A clear mapping from each CLI tool/command (from the PRD's `cli_spec` entries) to the modules that implement it.
This is the bridge from requirements to code:

| CLI Tool | Command | Entry Point | Core Modules |
|----------|---------|-------------|--------------|
| `mytool` | `auth login` | `src/cli/auth.rs` | `auth`, `credentials`, `config` |
| ... | ... | ... | ... |

### 6. Data Flow

How data moves through the system.
Cover:
- **Between CLI tools**: pipe formats, intermediate files, shared storage
- **Within a tool**: how input flows through modules to output
- **Persistence**: config files, caches, local databases -- their format, location, and access patterns

Include Mermaid sequence or flowchart diagrams for the most important flows.

### 7. Error Handling Strategy

The concrete error handling approach:
- How errors are represented in library code (error types, result types)
- How library errors map to CLI exit codes and stderr messages
- Error classification (user error vs. system error vs. bug)
- The `--debug` behavior: what additional information is shown

### 8. Testing Architecture

The concrete testing approach:
- **Unit tests**: Where they live, what framework, how modules are tested in isolation
- **Integration tests**: How CLI tools are tested end-to-end (process spawning, I/O capture, exit code assertion)
- **Test data**: Where fixtures live, how test data is managed
- **Coverage expectations**: What's targeted, what's explicitly excluded

### 9. Cross-Cutting Concerns

Anything that spans multiple modules:
- Logging and diagnostics
- Configuration loading (precedence, file locations, environment variables)
- Shared CLI conventions (output formatting, color handling, `--json`/`--plain` modes)
- Versioning strategy

### 10. PRD Traceability

A reference table linking architecture decisions back to PRD items:

| Architecture Decision | PRD References |
|-----------------------|----------------|
| Module X | ARCH-001, REQ-003, CTX-002 |
| ... | ... |

---

## Generation process

Once the user confirms your understanding:

### Part A: Generate the architecture document

1. **Name the output file** `architecture.md`, placed in the product repository's `clif-d/` directory.
   Create the directory if it does not yet exist.
   See the README section "The `clif-d/` directory" for the full artifact layout and lifecycle.
2. **Generate all sections** following the output structure above.
3. **Generate Mermaid diagrams** as code blocks within the markdown document.
   Use C4Component diagrams for module decomposition and sequence/flowchart diagrams for data flow.
   Separate `.mmd` files (if used) go in `clif-d/architecture/`.
4. **Cross-reference PRD items** by their IDs (ARCH-*, REQ-*, CTX-*) throughout the document.
5. **Review for completeness**: every CLI tool from the PRD should appear in the CLI-to-Module Mapping.
   Every architectural component from the PRD should be decomposed at the code level.

### Part B: Add scaffolding requirements to the PRD

After the architecture is settled, the concrete scaffolding work is now fully specifiable.
Add low-level requirements to `clif-d/prd.json` via `clif-d req add` so the standard `plan-requirement` -> `implement-plan` cycle will execute them as the first rounds of implementation.
These are not part of the architecture document -- they live in the PRD like any other requirement.

**What scaffolding requirements typically cover:**

- **Package manifest initialization**: Creating `Cargo.toml` / `package.json` / `pyproject.toml` / `go.mod` with the decided name, version, and baseline dependencies.
- **Directory skeleton**: Creating the directories specified in the architecture document's Repository Structure section (empty or with placeholder files).
- **Baseline dependencies**: Installing the core libraries chosen in the Technology Decisions table (CLI argument parser, serialization library, test framework).
- **Test runner wiring**: Ensuring the chosen test framework is installed and a trivial test passes end-to-end.
- **Minimal CLI entry point**: A "hello world" invocation of the primary CLI tool that exits successfully -- enough to verify the argument parser, entry point, and build pipeline all work.
- **Build verification**: A command that builds the project from scratch and succeeds.

**How to write them:**

- Use `abstraction_level: "low"` with structured Given-When-Then acceptance criteria -- scaffolding work is concrete and must be unambiguously verifiable.
- Embed `dependencies` inline in the `req add` payload when order is known (scaffolding almost always has a natural order).
  The CLI validates acyclicity on every add.
- Set `architecture_refs` to the relevant ARCH items (repository structure, technology decisions).
- Use `priority: 1` -- scaffolding blocks everything else.
- Include a `cli_spec` where applicable (e.g., the minimal CLI entry point requirement should specify its command, stdout, stderr, and exit codes).

Pipe each requirement's JSON object into `clif-d req add`; the CLI auto-assigns the `REQ-NNN` ID and prints the added requirement.
If an ARCH item is missing from the PRD, create it with `clif-d arch add` before the requirements that reference it.

**Important:** Do not perform the scaffolding yourself.
The purpose of this step is to *specify* the scaffolding as requirements, so it flows through the standard backpressure -> plan -> implement pipeline.
This ensures scaffolding code is written to the same quality standards as feature code and is covered by tests from day one.

### Part C: Backfill PRD references

Now that the architecture document exists, update `clif-d/prd.json` so existing requirements reference the architecture they relate to.
For each requirement that should reference one or more ARCH items (determined from the CLI-to-Module Mapping in §5 and the module decomposition in §4), read its current `architecture_refs` with `clif-d req show` and write back the full union with `clif-d req edit`.

**Gotcha:** `clif-d req edit` replaces array fields wholesale rather than merging, so you MUST read-then-write and send the full union.
Omitting an existing ref deletes it.

This step closes the referencing gap: the architecture document traces back to PRD items (§10), and now PRD items trace forward to architecture items.

### Part D: Confirm

Run `clif-d validate clif-d/prd.json` and fix any reported errors before handoff.
Report to the user: where `clif-d/architecture.md` was written, how many scaffolding requirements were added (with IDs and titles), how many requirements had `architecture_refs` backfilled, and the recommended next step -- run `design-backpressure`, then `bootstrap-dev-environment`, then `plan-requirement` on the scaffolding requirements.

---

## Testing References

This skill's references directory contains guidance on *designing* a testing architecture -- choosing test types, proportions, frameworks, directory structure, coverage strategy, and performance expectations.
Consult them when writing the "Testing Architecture" section (§8) of the architecture document.

- **Strategy**: [Testing strategy](references/testing-strategy.md) -- pyramid vs. trophy vs. honeycomb, risk-based prioritization, concrete examples of mapping components to test approaches
- **Test types**: [Testing types overview](references/testing-types.md) -- what each type is, when to use it, scope boundaries, relationships between types
- **Organization**: [Test organization and maintenance](references/testing-organization.md) -- file structure, naming conventions, coverage strategy, performance guidelines, flakiness management

These references focus on *structural* decisions about testing.
The architecture document specifies the testing infrastructure; downstream skills consume it.
The plan-requirement skill uses the testing architecture to decide which tests to plan for each requirement.
The implement-plan skill uses it to know where tests live and what frameworks to use.
The design-backpressure skill uses it to decide the enforcement gates; the bootstrap-dev-environment skill wires those gates into the toolchain.
This skill sets the foundation that all of them depend on.
