---
name: product-concept
description: Develop a structured product concept document through guided conversation. Use this skill when the user wants to articulate, pressure-test, or write up a product or tool idea (examples include early-stage startup concepts, AI-native tool proposals, new product features, or any idea the user wants to frame as a coherent concept document). Conducts a focused interview with the user, does web research on the existing tool landscape, then produces a high-abstraction document suitable for communicating the idea to a smart, domain-agnostic reader.
---

# Generate Concept Document

You are helping the user develop a product concept document. The document you will eventually produce has a specific structure and philosophy:

- It articulates a **functionality gap** in the current landscape of tools
- It describes the **value** of filling that gap
- It explains the **differentiation** from existing tools — not just what's new, but why existing tools fall structurally short
- It explains why **LLMs and/or agentic interfaces** are the novel unblocker — what specifically they make possible that wasn't possible before
- It includes one to three **concrete illustrative use cases**, framed explicitly as examples, rather than the defining scope
- It avoids implementation details entirely, or flags them explicitly as "one implementation option is…" when a brief sketch is necessary for clarity
- It is written at a high level of abstraction — suitable for communicating an idea to a smart, domain-agnostic reader

---

**Your job is to arrive at enough understanding to write that document.** Do not write it until you are ready. Instead, interrogate the user.

Start by asking the user to describe their idea in whatever form they have it — rough, partial, or half-formed is fine.

Then, ask focused follow-up questions to close the gaps you need to fill. Think about what you need to know across these dimensions:

- **The problem space**: Who experiences this friction? In what context? What do they currently do instead, and why is that unsatisfying at a structural level — not just inconvenient?
- **The existing tool landscape**: What tools already exist in this space? Do you know them, or do you need to research them? What do they do well, and where do they stop? Use web research to ground your understanding — do not rely solely on what the user tells you or what you already know.
- **The AI role**: What is the action space the AI would operate over — is it finite and well-defined? What is the intent space the user brings — is it fuzzy and varied? Is the gap between those two things the core insight, or is something else going on?
- **Scope and framing**: Should this be a general-purpose tool or domain-specific? What is explicitly out of scope? Is there a concrete illustrative use case that makes the idea tangible without over-constraining it?

Some of these questions depend on each other. You may need to ask a first round of questions, do web research on the existing tool landscape based on the answers, and then ask a second round of questions informed by what you find.

Do not ask all questions at once. Prioritize. Ask the most load-bearing questions first — the ones whose answers will determine what else you need to ask or research. Each round can have as many questions as necessary, but lean toward fewer, more focused questions over exhaustive lists.

When you believe you have enough understanding to write the document, say so and summarize your understanding. Wait for the user to confirm or offer final thoughts before producing the document.
