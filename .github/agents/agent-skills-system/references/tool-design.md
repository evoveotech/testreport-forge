# Tool Design Loop

Tools are contracts between deterministic software and nondeterministic agents. Design and test them as behavioral interfaces.

## Design

- Expose a few distinct, high-impact tools with minimal functional overlap.
- Use semantic names, familiar identifiers, flat schemas, strict validation, and explicit inputs/outputs.
- Prefer workflow-level operations over thin wrappers around every API endpoint.
- Provide concise defaults plus pagination, filtering, ranges, or detailed response modes.
- Return relevant context and actionable errors, not opaque identifiers or raw dumps.
- Mark destructive, open-world, networked, or sensitive operations clearly.

## Evaluate

Use realistic multi-step tasks. Track outcome accuracy, tool selection, invalid calls, redundant calls, latency, and tokens. Include positive and negative routing cases and avoid over-specifying one valid tool sequence.

Inspect transcripts when a grader fails. Improve descriptions, schemas, defaults, or implementation based on observed confusion. Re-run across supported model/provider combinations because interface behavior can change with the model.

## Deterministic Enforcement

Use scripts, schemas, hooks, or policy controls for zero-exception requirements. Sanitize hook inputs and paths; hooks execute with real permissions and can become a security boundary themselves.
