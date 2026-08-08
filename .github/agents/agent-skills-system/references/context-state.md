# Context And State Lifecycle

Treat context as a finite attention budget. Preserve the smallest high-signal state that lets work continue correctly.

## Four Stores

1. **Always-on instructions**: short durable rules and routing metadata.
2. **On-demand references**: detailed modes, policies, schemas, and examples loaded only when needed.
3. **Task ledger**: goal, plan, decisions, progress, verification, open risks, and next action.
4. **Lossless trace**: append-only logs, commits, artifacts, or session history used for audit and recovery, not loaded wholesale.

## Retrieval

- Keep identifiers, file paths, queries, and source links in working context.
- Retrieve detailed content just in time with targeted searches and reads.
- Summarize noisy exploration before returning it to the main task.
- Clear stale raw tool output after its decisions and evidence are captured.

## Compaction Contract

Preserve:

- user goal, authority, constraints, and acceptance criteria
- current mode, plan, and completed milestones
- decisions with rationale
- changed artifacts and last verification state
- unresolved failures, risks, and next action

Discard redundant narration, superseded hypotheses, and raw outputs that can be reproduced or retrieved by reference. Maximize recall first; reduce excess only after critical state is reliably preserved.

## Session Boundaries

At the start of a resumed task, inspect the ledger, recent history, and baseline health. At the end, leave a clean state and update progress, evidence, unresolved items, and next action.
