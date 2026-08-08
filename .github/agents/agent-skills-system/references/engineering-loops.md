# Engineering Loops

Select the smallest loop that matches the work. These are execution patterns, not additional modes.

## Alignment

Use when outcome, audience, current behavior, desired behavior, or non-goals could change implementation.

1. Inspect code, docs, issues, and tests before asking questions.
2. Resolve only blocking ambiguity.
3. Record the smallest complete unit, acceptance criteria, and stopping point.

## Feedback

Use when building or changing behavior.

1. Establish a failing behavior check through a public interface when practical.
2. Implement one vertical tracer slice.
3. Make the check pass and preserve the evidence.
4. Refactor only while the signal stays green.

Do not bulk-write speculative tests. Let each slice inform the next.

## Diagnosis

Use for bugs, regressions, flakes, and performance problems.

1. Build a fast deterministic reproduction of the reported symptom.
2. Rank falsifiable hypotheses.
3. Run probes that discriminate between hypotheses.
4. Apply the smallest root-cause fix.
5. Rerun the original reproduction and add a regression check.

Remove temporary instrumentation before completion. If no correct test seam exists, report that as an architecture finding.

## Durable Decisions

Use when terminology, constraints, decisions, or handoff state would otherwise exist only in chat.

- Put stable project vocabulary and constraints in an existing durable project file.
- Add an ADR only for surprising, consequential, hard-to-reverse decisions with real alternatives.
- Create documentation structure lazily, after a fact needs a durable home.

## Work Packaging

Use when turning a plan into work for humans or agents.

- Slice vertically into complete, independently verifiable outcomes.
- Include current and desired behavior, interfaces, acceptance criteria, blockers, and exclusions.
- Identify human-judgment checkpoints and autonomous portions.
- Prefer behavioral contracts over stale line numbers and brittle implementation instructions.

## Architecture Deepening

Use when changes are tangled, knowledge is duplicated, test seams are poor, or modules only pass data through.

- Evaluate module depth: useful behavior behind a small stable interface.
- Apply the deletion test: a valuable module prevents important complexity from spreading to callers.
- Test through the interface; inability to do so indicates a weak shape.
- Add variation seams only when variation is real or imminent.
