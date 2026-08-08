# Verification Contract

Define "done" before implementation when failure would be expensive or ambiguous.

## Before Work

Record:

- observable user or system outcome
- deterministic checks available
- subjective criteria requiring review
- behaviors and files that must remain unchanged
- minimum evidence required to claim completion

## Verification Order

1. Run the narrowest deterministic check that can disprove the change.
2. Run relevant tests, type checks, lint, build, or static analysis.
3. Exercise the public interface end to end when the task has a runtime or visual surface.
4. Review the diff for regressions, unnecessary complexity, and accidental scope.
5. Use a fresh-context skeptical reviewer for high-risk or subjective work when available.

Do not let an agent's final statement substitute for environment state. Prefer outcome grading over prescribing one exact sequence of steps.

## Evidence Report

Classify completion claims:

- `verified`: supported by a named command, test, artifact, or observed end state.
- `inferred`: supported by inspection but not runtime evidence.
- `unverified`: not checked, with the reason and remaining check named.

Report failed checks and counterevidence. Never hide a partial result behind a confident summary.

## Independent Evaluation

Separate builder and evaluator roles when self-review is likely to be permissive. Give the evaluator acceptance criteria and raw artifacts, not the builder's confidence or intended diagnosis. Use hard per-criterion thresholds for release gates.
