---
name: create-initial-prd
description: >
  Generate an initial Product Requirements Document (PRD) from a product concept document.
  Use this skill when the user has a product concept (from the create-product-concept skill or equivalent)
  and wants to develop it into structured, actionable requirements. Conducts a focused interrogation
  to understand workflows, system boundaries, constraints, entities, and priorities, performs web
  research to ground technical and domain decisions, then produces a JSON PRD following CLI-First
  Decomposition (CLIF-D). The PRD contains a complete picture of high-level requirements and a
  partial picture of low-level requirements — only clear first steps are specified in detail.
---

# Generate Initial Product Requirements Document

You are helping the user develop a Product Requirements Document (PRD) from an existing product concept. The output is a structured JSON file conforming to the schema at `assets/prd-schema.json`.

---

## Philosophy

### Behavior over implementation

A PRD specifies **what the system does**, not how it does it. Never include code. If architectural guidance is necessary, scope it to subsystem decomposition, boundary contracts, or C4-level structure (see the Architecture section below) — never deeper.

### CLI-First Decomposition (CLIF-D)

Every system specified by this PRD should be decomposed into **vertical slices of functionality, each implementable as a standalone, Unix-philosophy CLI tool**. This is not an arbitrary constraint — it has concrete benefits:

- CLI tools are inherently testable: inputs (args, flags, stdin) and outputs (stdout, stderr, exit codes) are fully observable.
- CLI tools compose naturally via pipes and scripts.
- CLI tools are the native interface for LLM-driven development and testing.
- CLI tools force clear separation of concerns.

CLIF-D applies at both high-level and low-level requirements. A requirement may define a new CLI tool, add a command or subcommand to a tool introduced by a previous requirement, or specify new behavior of an existing command. The mapping between requirements and CLI tools is flexible — do not force a 1:1 relationship.

If the product will eventually have other interfaces (API, GUI, TUI), those are **separate concerns to be specified later**. The PRD focuses on the CLI surface first. This is a hard constraint.

**Push CLIF-D everywhere a CLI surface is meaningful** — which is most requirements. When a requirement genuinely cannot be expressed as a CLI interaction (rare), omit the `cli_spec` field, but consider hard whether that's really the case.

Consult `references/cli-design-guide.md` when specifying `cli_spec` fields — it defines conventions for exit codes, arguments, flags, stdin/stdout behavior, and other CLI design patterns that requirements should follow.

### Two levels of requirements

The PRD contains requirements at exactly two abstraction levels:

- **High-level requirements** form a **complete picture** of the system's intended behavior. They are rich with motivating context — why this behavior matters, what user problem it solves, what happens without it. Their acceptance criteria may be slightly ambiguous; that is acceptable. A slightly ambiguous criterion is better than none.

- **Low-level requirements** form a **partial picture** — only the clear first steps. These are the requirements where enough is known to write structured, unambiguous Given-When-Then acceptance criteria. If a low-level requirement isn't clear enough to specify fully, **do not include it**. Trust a future process to fill in low-level requirements as needed, like a bow wave of planning detail pushed forward by the implementation ship.

### Flat structure with explicit linkage

Requirements are **peers, not parent-child**. A low-level requirement is not a "child" of a high-level requirement — it could relate to many. Hierarchy is replaced by explicit `dependencies` (blocking) and inline ID references in description text (non-blocking, contextual). This keeps the structure honest about the true shape of requirement relationships, which is a graph, not a tree.

---

## Input

This skill expects a **product concept document** — either the output of the `product-concept` skill or an equivalent document that articulates the product's functionality gap, value proposition, differentiation, and scope. The user will provide a file path to this document.

Read the concept document fully before beginning the interrogation. It provides the "why" — your job is to develop the "what."

---

## Interrogation

**Your job is to arrive at enough understanding to write the PRD.** Do not generate it until you are ready. Instead, interrogate the user.

Start by reading the linked concept document and summarizing what you understand about the product. Identify what you already know from the concept and what gaps remain before you can write requirements.

Then ask focused questions across these dimensions:

### 1. User workflows and personas

Who uses this system, and what are their concrete workflows? Go beyond the concept doc's high-level "who experiences friction" — you need enough specificity to write acceptance criteria. What does a user actually do, step by step? What are their entry points? What triggers them to reach for this tool?

### 2. System boundaries

What is inside this system and what is outside? What external systems, services, or data sources does it interact with? What does it own vs. depend on? Where are the integration points? This directly informs the C4 Context-level architecture and the CLIF-D decomposition.

### 3. Existing constraints

Are there mandated technology choices, platform targets, compliance requirements, performance envelopes, or other non-negotiable constraints? These become shared context items that requirements reference.

### 4. Data and entity model

What are the core nouns in the system? What are their relationships? What data flows between subsystems? This often surfaces requirements that pure workflow analysis misses. Be concrete: ask for examples of the data the system will process.

### 5. Priority and phasing

What is the MVP? What comes later? What is explicitly out of scope? This determines which low-level requirements are "clear first steps" worth specifying now, and which are deferred.

---

### Interrogation protocol

- **Do not ask all questions at once.** Prioritize. Ask the most load-bearing questions first — the ones whose answers determine what else you need to ask or research.
- **Use web research to ground your understanding.** Research the existing tool landscape, relevant standards, common patterns in the domain. Do not rely solely on the user or your own knowledge.
- **Iterate.** You may need multiple rounds: initial questions → web research informed by answers → follow-up questions informed by research. Some questions depend on each other.
- **Each round can have multiple questions**, but lean toward fewer, more focused questions over exhaustive lists.
- **When you believe you have enough understanding**, say so and summarize your understanding organized by PRD section (concept summary, context items, architecture elements, high-level requirements, low-level requirements). Wait for the user to confirm or offer final adjustments before generating.

---

## Output structure

The output is a single JSON file conforming to `assets/prd-schema.json`. The schema is the authoritative reference for field names, types, and documentation. What follows is guidance on *how to think about* each section.

### `concept_summary`

A condensed summary of the product concept, with a `reference_link` to the full concept document. This is not a requirement — it is the orienting context for the entire PRD. Write it to be self-contained enough that a reader who hasn't seen the concept doc can understand why this product exists.

### `context`

Shared context items that inform or constrain multiple requirements. Each has an `id`, `title`, `description`, `type`, and optional `reference_link`.

The `type` field is an enum with five values, each implying a different focus during interrogation and documentation:

- **`non_functional`**: Broad quality attributes — performance, security, accessibility, reliability. State measurable thresholds and rationale.
- **`constraint`**: Non-negotiable solution boundaries — tech mandates, platform targets, compliance, resource limits. State the constraint, its source, and design impact.
- **`persona`**: A user type whose workflows shape requirements. Specific enough for acceptance criteria to reference meaningfully.
- **`domain`**: Core concepts, entities, relationships, terminology. The shared glossary and entity model for the PRD.
- **`product_goal`**: High-level objectives from the concept document — the "why" behind groups of requirements. Maintains traceability from implementation to purpose.

See `assets/prd-schema.json` for full documentation of each type and its expected documentation style.

Context items exist to **avoid repetition** in requirements. If a constraint applies to many requirements, make it a context item and reference it by ID, rather than restating it in each requirement's description.

### `architecture`

Architectural descriptions at C4 model levels (context, container, component). Each has an `id`, `title`, `description`, `level`, and optional `diagram_file` and `reference_link`.

**Critical constraint: architecture should only be specified as far as necessary to support the CLIF-D decomposition.** Do not produce architecture for its own sake. Ask: "Does this architectural element help clarify which CLI tool(s) exist, what their responsibilities are, or how they interact?" If not, leave it out.

When architecture diagrams are helpful, generate them as Mermaid (`.mmd`) files in `clif-d/architecture/` alongside the PRD file. See `assets/architecture-diagram-example.mmd` for the expected style — **concise and human-readable**. Diagrams supplement prose, not replace it.

### `requirements`

The core of the PRD. A flat array of requirements, each with fields in this order: `id`, `description`, `title`, `acceptance_criteria`, `priority`, `dependencies`, `abstraction_level`, `context_refs`, `architecture_refs`, `cli_spec`.

**For high-level requirements:**
- `description`: Heavy on motivating context. Why does this behavior matter? What user problem does it address? What would a user experience without it?
- `acceptance_criteria`: A prose string. Aim for verifiable, but accept some ambiguity at this level.
- `cli_spec`: Include wherever a CLI surface is meaningful. At the high level, this might define the tool name and top-level command structure.

**For low-level requirements:**
- `description`: Sufficient motivating context to be self-contained, linking to other requirements or context items by ID to avoid repetition.
- `acceptance_criteria`: A structured object with `given`, `when`, `then` strings. Must be unambiguously verifiable. The `when` clause often naturally maps to a CLI invocation.
- `cli_spec`: Should be specific — exact command, arguments, flags, stdin/stdout/stderr, exit codes.

**On dependencies:** Use the `dependencies` field only for **hard, blocking dependencies** — requirements that must be satisfied before this one can be implemented. For non-blocking relationships ("see also", "related context"), reference the other requirement by ID inline in the `description` text. This keeps the dependency graph meaningful and actionable.

**On `cli_spec`:** A requirement may introduce a new CLI tool, add a command to an existing tool, or refine the behavior of a command defined elsewhere. This flexibility is intentional — do not force each requirement to own exactly one tool. The `tool_name` field links the requirement to its CLI surface.

---

## Generation process

Once the user confirms your understanding, generate the PRD:

1. **Name the output file** `prd.json`, placed in the project's `clif-d/` directory (at the root of the product repository). Create the directory if it does not yet exist. See the README section "The `clif-d/` directory" for the full artifact layout and lifecycle.
2. **Set `$schema`** to the relative path from the PRD file to `assets/prd-schema.json`.
3. **Write `concept_summary`** by condensing the product concept document. Include the `reference_link` to the original concept file.
4. **Write `context` items.** Derive these from the interrogation — constraints, personas, conventions, domain definitions. Assign IDs as `CTX-001`, `CTX-002`, etc.
5. **Write `architecture` items.** Only what's needed for CLIF-D. Assign IDs as `ARCH-001`, `ARCH-002`, etc. Generate diagram files if helpful.
6. **Write high-level requirements first** — the complete picture. Assign IDs as `REQ-001`, `REQ-002`, etc.
7. **Write low-level requirements** — the clear first steps only. Continue the ID sequence.
8. **Cross-reference.** Ensure `dependencies`, `context_refs`, and `architecture_refs` are consistent. Every referenced ID must exist. Inline ID references in description text should also be valid.
9. **Validate** the generated PRD against the schema for structural correctness.

