---
name: workshop-names
description: >
  A structured naming workshop for creating product, company, and feature names.
  Use this skill whenever someone needs to name something -- a product, company,
  feature, service, app, or project. Trigger on phrases like "name my product,"
  "I need a name for," "help me brainstorm names," "what should I call,"
  "naming ideas," "brand name," or any request involving choosing or evaluating
  names. Also trigger when someone asks to rename something, evaluate existing
  name candidates, or understand why a name works or doesn't. Even casual
  mentions like "I'm stuck on what to call this" should trigger the skill.
  Do NOT use for naming variables in code, naming files, or other non-branding contexts.
---

# Brand Namer: A Strategic Naming Workshop

## Philosophy

A good name describes what you do. The *right* name creates compounding competitive
advantage that builds value every time it's spoken, typed, or searched. This skill
guides founders and PMs through a rigorous, evidence-based naming process drawn from
the leading practitioners in the field.

The process has three phases: **Identify** (strategic discovery), **Invent** (high-volume
generation), and **Evaluate & Present** (ruthless filtering and contextual presentation).

Never skip Phase 1. The most common naming failure is jumping straight to brainstorming
without understanding what the name needs to *do*. As David Placek (founder of Lexicon
Branding, the firm behind Pentium, Swiffer, BlackBerry, Sonos, Azure, Windsurf, and
Vercel) puts it: focus on how the company wants to *behave* and how the market should
*behave toward* the brand -- not on describing what the product does.

Two critical mindset principles before starting:

1. **Comfort is the enemy.** If a name feels immediately safe and comfortable, it
   probably lacks the tension needed to stand out. When Lexicon presented "Pentium"
   to Intel, the room split -- half wanted the safe "Pro Chip," half were drawn to
   Pentium. CEO Andy Grove recognized the polarization as a signal of energy.
   If a name provokes debate, that's a *feature*, not a bug.

2. **Experience over identity.** A name should not describe the product's function;
   it should evoke the experience or behavior the brand wants to inspire. Nobody
   wanted a "ProMop" -- but "Swiffer" evoked speed, lightness, and a new way of
   cleaning. The name *created* a category rather than describing one.

---

## Phase 1: IDENTIFY (Strategic Discovery)

This phase uses interactive questions to understand the founder's strategic position
before generating a single name. Use the `ask_user_input` tool and natural
conversation to work through these exercises.

### Step 1.1: The "Win" Diamond

Walk the user through four questions, one at a time. This framework (from David
Placek / Lexicon Branding) shifts the focus from finding words to defining behavior
and experience.

Draw or describe the diamond shape, then ask each point:

- **Top -- "Win":** What does winning look like for this company in 3-5 years?
  Not revenue targets, but *market position* and *perception*. How do customers
  talk about you when you're not in the room?

- **Right -- "Why":** Why do you deserve to win? What are your current, honest core
  strengths? What do you have today that competitors don't?

- **Bottom -- "What":** What do you *need* to win? What's missing -- technology,
  trust, distribution, talent? What gap must the name help bridge?

- **Left -- "How":** How should the win *feel*? What's the experience or "vibe" the
  brand must project? If your brand were a person at a dinner party, how would
  they act? What adjectives describe the *experience* of interacting with you?

Capture and synthesize the answers into a **Creative Framework** -- a short paragraph
(3-5 sentences) that defines the behavioral and experiential territory the name
should occupy. This is not a list of objectives; it's a *window* for exploration.

### Step 1.2: Competitive Landscape

Ask the user to name their top 3-5 competitors. Then classify each competitor's
name using the naming taxonomy (read `references/evaluation-filters.md` for
definitions):

- **Functional** -- describes what it does (e.g., E*Trade, Dropbox)
- **Invented** -- fabricated word (e.g., Sonos, Pentium, Xerox)
- **Experiential** -- connects to direct human experience (e.g., Safari, Explorer)
- **Evocative** -- uses metaphor to represent the brand's soul (e.g., Virgin, Patagonia, Amazon)

Plot the competitors on the taxonomy to identify which territories are *crowded*
and which are *open*. The goal is to find the quadrant where the fewest competitors
live, because that's where a name can own the conversation.

Present this analysis to the user. The most powerful strategic play is usually an
Evocative name in a category dominated by Functional or Invented names -- but
this depends on the specific landscape.

### Step 1.3: Creative Framework Confirmation

Synthesize everything from Steps 1.1 and 1.2 into a brief creative framework.
Present it to the user and get explicit confirmation before proceeding. Example:

> **Creative Framework:** "The name should signal trustworthy boldness -- a company
> that makes complex infrastructure feel approachable and inevitable. The competitive
> landscape is crowded with invented tech jargon; the opportunity is in the Evocative
> space, using metaphor to suggest clarity, power, or natural force. The name should
> feel global, slightly surprising, and impossible to confuse with a competitor."

---

## Phase 2: INVENT (High-Volume Generation)

This is where most naming exercises fail: they generate too few ideas and settle
too early. The goal of this phase is to produce **at least 100 candidate names**
across diverse approaches, then filter ruthlessly. Placek's firm typically generates
1,000-1,500 names per engagement before finding gems.

### Step 2.1: Three-Brief Generation

Lexicon's key insight is that small teams with *different* briefs outperform one
large team with the same brief. Claude simulates this by generating names from
three distinct angles:

**Brief A -- Full Context:** Generate names using the complete Creative Framework.
These candidates directly address the strategic territory. Aim for 30-40 names.

**Brief B -- Competitor Displacement:** Generate names as if you were naming a
*competitor* to the user's product -- something that would make the user's actual
competitors nervous. This produces bolder, more aggressive options. Aim for 30-40.

**Brief C -- Category Shift:** Generate names as if you were naming something in a
completely different category that shares the *experiential* qualities identified
in the Diamond (e.g., if the product should feel "fast and precise," generate names
as if naming a racing yacht or a surgical tool). Aim for 30-40.

### Step 2.2: Linguistic Engineering

Read `references/sound-symbolism.md` before this step. For each brief, apply
phonetic principles:

- Select phonemes that match the brand's desired traits (e.g., "V" for vitality
  and aliveness, plosives like P/K/T for crispness and precision, soft sounds
  like M/L/N for approachability).
- Explore **compound names** (noun+noun or adjective+noun combinations) -- these
  act as meaning multipliers (e.g., PowerBook = power × book, Windsurf = wind × surf).
- Try **invented words** built from meaningful morphemes (Greek/Latin roots,
  cross-language borrowing) that follow natural phonetic rhythm.
- Consider **palindromes** and **alliteration** for memorability (e.g., Sonos, BlackBerry).
- Test **vowel architecture** -- "A" sounds feel expansive/open, "O" sounds feel
  holistic/complete, "I" sounds feel precise/small.

### Step 2.3: Volume Output

Present the full list of 100+ candidates, loosely grouped by generation brief
(A/B/C) but don't over-organize at this stage. Include brief notes on the
*thinking* behind clusters of names, but don't evaluate yet. The user should
see the raw creative output.

---

## Phase 3: EVALUATE & PRESENT

Read `references/evaluation-filters.md` before this phase. This is where the
100+ candidates get cut to 5-10 finalists through two sequential filters.

### Step 3.1: Taxonomy Classification

Classify each candidate into the four-quadrant taxonomy (Functional / Invented /
Experiential / Evocative). Immediately eliminate any that fall into a quadrant
already crowded by competitors (identified in Phase 1). This alone typically
cuts the list by 30-50%.

### Step 3.2: SMILE Test (Positive Qualities)

Score each remaining candidate on five qualities (from Alexandra Watkins,
*Hello, My Name Is Awesome*):

- **S**uggestive -- Does it evoke something about the brand?
- **M**emorable -- Is it based on a familiar association or pattern?
- **I**magery -- Does it create a visual in the mind's eye?
- **L**egs -- Does it have a theme for extended branding (taglines, sub-brands)?
- **E**motional -- Does it move people or create a connection?

A name should score well on at least 3 of 5. Eliminate any that score below 2.

### Step 3.3: SCRATCH Test (Red Flags)

Check each remaining candidate against seven disqualifiers (also from Alexandra
Watkins):

- **S**pelling-challenged -- Does it look like a typo?
- **C**opycat -- Is it too similar to competitors?
- **R**estrictive -- Will it limit future growth or pivots?
- **A**nnoying -- Is it forced, "cutesy," or trying too hard?
- **T**ame -- Is it flat, descriptive, or boring?
- **C**urse of Knowledge -- Is it an inside joke or too technical for the audience?
- **H**ard-to-pronounce -- Does it fail the "radio test" (can someone hear it and
  spell it correctly)?

Any name that triggers 2+ red flags should be eliminated. One flag is a caution
worth discussing with the user.

### Step 3.4: Phonetic & Sound Analysis

For the surviving candidates (ideally 10-20), do a brief phonetic analysis using
the sound symbolism reference. Note which sounds reinforce or undermine the
brand's desired traits from the Creative Framework.

### Step 3.5: Contextual Presentation

**Never show finalists in a bare list.** This is one of the most important
principles in the process. People cannot evaluate names abstractly -- they need
to see them *in context*.

For each of the top 5-10 finalists, present:

1. **The name** with a one-sentence rationale
2. **A mock usage scenario** -- e.g., "Imagine a headline: '[Name] raises $50M to
   transform how teams collaborate.'" Or: "Picture a friend saying, 'Have you
   tried [Name]? It completely changed how I manage my projects.'"
3. **Leg potential** -- one example of how the name could extend (a tagline,
   a verb form, a community name, a product line)

### Step 3.6: Speculation Over Evaluation

Frame the final discussion as **"What could this name do for us?"** rather than
**"Do you like this?"** This shifts from subjective taste to strategic potential.

For each finalist, ask the user to imagine: "Your competitor just launched a
product called [Name]. What does that make you think of them? Are you worried?"

If the user is drawn to a "safe" name, gently note the polarization principle:
if half the room loves it and half is scared, that's often a signal of energy
and distinctiveness. Consensus tends to produce forgettable names.

---

## Practical Notes

### On Domain Names
Don't let .com availability dictate the name. A URL is just an address -- use a
prefix (get[name].com, [name]app.com), a modern TLD (.ai, .co, .dev), or a
modifier. The right name with a modified URL beats a mediocre name with a perfect
domain every time. In the age of AI and app stores, direct URL navigation is
declining anyway.

### On Trademark Concerns
This skill does not provide legal advice. Always recommend the user do a basic
trademark search (USPTO TESS, EUIPO, or equivalent) and consult an IP attorney
before finalizing. Note that more distinctive names (Evocative and Invented) are
*easier* to trademark than Functional/Descriptive ones.

### Attribution
This skill synthesizes frameworks from three leading naming practitioners:
- **David Placek / Lexicon Branding** -- Diamond Framework, Three-Brief Method,
  sound symbolism research, polarization principle, contextual presentation,
  "cumulative advantage" concept
- **Alexandra Watkins / Eat My Words** -- SMILE and SCRATCH evaluation tests
  (from *Hello, My Name Is Awesome*)
- **Igor International (now Zinzin)** -- Four-quadrant naming taxonomy
  (Functional / Invented / Experiential / Evocative)

---

## Reference Files

Read these before their respective phases:

- `references/sound-symbolism.md` -- Phonetic associations for each sound class,
  vowel architecture, compound name mechanics. **Read before Phase 2.**
- `references/evaluation-filters.md` -- Detailed SMILE/SCRATCH criteria with
  examples, taxonomy definitions with examples. **Read before Phase 3.**
