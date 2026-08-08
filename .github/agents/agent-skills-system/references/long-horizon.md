# Long-Horizon Work

Use this contract for multi-hour work, autonomous iterations, large migrations, or tasks likely to cross context boundaries.

## Task Ledger

Maintain a living, self-contained artifact with:

- goal and observable outcome
- baseline and exact run/verification commands
- constraints, non-goals, and risk boundaries
- milestones and current progress
- decisions, discoveries, and unresolved hypotheses
- modified artifacts and last verification result
- next action and stopping condition

The ledger must be sufficient for a fresh agent to resume without replaying chat.

## Incremental Sessions

1. Read the ledger and recent version-control history.
2. Run a baseline health check before new work.
3. Choose one highest-value incomplete vertical slice.
4. Complete and verify it end to end.
5. Leave the repository clean enough for the next slice.
6. Update the ledger with evidence and the next action.

Do not declare the project complete from a superficial scan. Completion is the conjunction of acceptance criteria and verified outcomes.

## Bounded Optimization Loop

For experiments, research, ports, performance work, or other strongly graded tasks:

1. Freeze the evaluator and establish a baseline.
2. Allow one scoped change per trial.
3. Use a fixed time/resource budget and primary metric.
4. Record outcome, complexity, and evidence.
5. Keep or discard the change, then repeat.

Do not generalize hands-off loops to durable production code unless maintainability, safety, and comprehension are also graded. Stop when the budget, success threshold, diminishing-return rule, or escalation condition is reached.
