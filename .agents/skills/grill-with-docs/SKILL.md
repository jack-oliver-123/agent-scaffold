---
name: grill-with-docs
description: Stress-test a plan or design through a decision-tree interview while recording settled domain language and durable architectural decisions. Use when the user asks to grill, challenge, sharpen, or fully specify an idea and wants the conclusions captured in repository docs.
---

# Grill With Docs

Map the design as a tree. A decision may enter the current **frontier** only when all decisions it depends on are settled.

## Interview

1. Inspect the repository for facts before asking questions. Ask the user only for decisions.
2. Ask every question on the current frontier in one numbered round. Give a concrete recommendation for each question.
3. Wait for the user's answers. Recompute the frontier from those answers; never ask a downstream question while its prerequisite remains open.
4. Challenge overloaded terms, contradictions, and edge cases with concrete scenarios.
5. Continue until the frontier is empty. State the complete shared understanding and ask the user to confirm it before implementation begins.

Each question must make the decision and trade-off explicit. A user accepting all recommendations settles the entire round.

## Record Decisions

Capture resolved language immediately in the repository-root `CONTEXT.md`. Keep it a glossary: one or two sentences per domain-specific term, followed by an `_Avoid_` line for rejected synonyms. Leave implementation details elsewhere.

Create `docs/adr/NNNN-slug.md` only when a settled decision is hard to reverse, surprising without context, and the result of a real trade-off. Use the next sequential number and normally write only a title plus one concise paragraph explaining the decision and why.

Documentation updates record the interview; they do not authorize implementation. Begin implementation only after the user explicitly confirms the shared understanding.
