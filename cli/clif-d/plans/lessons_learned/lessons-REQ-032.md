# Lessons Learned: REQ-032

**Implementation commit:** a6d9f9a
**Plan:** `cli/clif-d/plans/executed/plan-REQ-032.md`

## Summary

Seven-step plan (one per skill plus bookkeeping) executed mechanically. The plan was well-specified -- most steps were verbatim insertions of prescribed text. No regressions, no surprise failures, no user corrections. Two small interpretation calls worth recording; otherwise unremarkable.

## Step 7 `#### 0` placement was structurally ambiguous

Step 7a instructed: "Identify the first step of the per-step execution cycle ... Immediately before it, insert `#### 0. Announce work on the target requirement(s)`". Literal reading would place the new subsection inside the "For each step / Follow this sequence exactly:" block, which implies it runs on every iteration -- inconsistent with the "idempotent safety net" language (which is only load-bearing if the call happens once).

Resolution: placed the heading at the top of the "For each step" section but explicitly labeled the step "(once, before the first step)" and added narrative clarifying that it runs once before the per-step loop begins iterating. A stricter reading would have moved it to a new item 5 under "Before starting" instead; that may be structurally cleaner, but the plan's explicit `#### 0` formatting pulls toward the current placement.

**Lesson for plan authors:** when a step's position affects its execution semantics (one-shot vs per-iteration), state the semantics in the plan, not just the heading placement. Example: "insert `#### 0` ... runs exactly once before the iteration begins."

## Pre-commit hook runs full CLI gate on SKILL.md-only commits

Every commit in this sweep triggered `cd cli && npm run check` via the husky pre-commit hook, even though none of the commits touched `bin/clif-d` or anything under `cli/`. The full gate (prettier, eslint, jscpd, tsc, node --test) ran six times on unchanged CLI code. This is expected by design -- the hook doesn't scope the check to changed files -- but it adds ~5-10 seconds of latency to each SKILL.md commit.

Not a bug, and the belt-and-suspenders is cheap insurance against someone editing a SKILL.md in the same commit as a CLI change. Worth recording that sweep-style plans across documentation files will pay this fixed cost per commit. If it ever becomes painful, a path-based hook predicate would avoid it, but on this project it is a strict improvement to have the gate run unconditionally.

## No other surprises

Six skill edits, six commits, one lifecycle commit. Every edit was grep-verified before committing. Every commit's CLI gate passed. `clif-d validate cli-prd.json` exited clean after every mutation, including the `req start REQ-032` at the top of the sweep and the `req done REQ-032 --commit=a6d9f9a` at the end.
