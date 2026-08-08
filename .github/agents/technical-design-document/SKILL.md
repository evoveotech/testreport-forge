---
name: technical-design-document
description: Turn feature intent into a Technical Design Document that is implementable, reviewable, and testable.
brand: evoveo-tech
agent: Evoveo Tech Agent
loop_type: recursive-goal
goal_template: "Stop iterating when the task meets all acceptance criteria for: technical-design-document"
stopping_criteria: "Documentation is complete, accurate, and passes review"
verification: "A separate checker Evoveo Tech Agent verifies the output against the skill's acceptance criteria"
maker_checker: true
---

<!-- Evoveo Tech -- Agent Skill -->

# Technical Design Document

> **Evoveo Tech Agent** -- Powered by Loop Engineering

## Loop Engineering Execution

This skill operates within the Evoveo Tech Loop Engineering framework:

```
Goal     -> Apply technical-design-document to achieve the task objective
Action   -> Execute the skill guidance below
Observe  -> Documentation is complete, accurate, and passes review
Adjust   -> If criteria not met, adjust approach and re-execute
Stop     -> Terminate when stopping criteria are satisfied
```

**Recursive Goal:** Stop iterating when the task meets all acceptance criteria for: technical-design-document

**Stopping Criteria:** Documentation is complete, accurate, and passes review

**Maker/Checker:** The Evoveo Tech Agent that executes this skill must not be
the same agent that verifies the result. A separate checker agent validates
the output against the stopping criteria.

## Skill Guidance

## Purpose
Turn feature intent into a Technical Design Document that is implementable, reviewable, and testable.

## Use When
- a feature has non-trivial architecture or integration risk
- multiple systems need stable interfaces
- save/load, networking, tooling, or migration impact exists

## Inputs
- approved design intent
- project constraints
- engine constraints
- testing and performance expectations

## Process
1. define goals, non-goals, constraints, and assumptions
2. map runtime architecture, state ownership, and interfaces
3. document failure modes, migration concerns, and rollout strategy
4. capture testing, telemetry, and performance impact
5. highlight decisions that should become ADRs

## Outputs
- technical design document
- interface and ownership notes
- risk list
- test and rollout considerations

## Quality Bar
- every system boundary names its owner module, public interface, and the data it persists
- risks are stated with a concrete mitigation or an explicit accepted-risk note
- decided items are separated from deferred items, and each deferral has a revisit trigger
- a developer new to the project could implement a section without re-deriving the architecture

## Common Failure Modes
- architecture described as diagrams with no interface or data contracts
- decisions recorded without the constraint or trade-off that motivated them
- a TDD written once and never updated after implementation diverges
- deferred decisions with no trigger for when they must be made

## Related Agents
- technical-design-lead
- architect
- gameplay-programmer

## Related Commands
- tech-design
- plan
- verify

## Notes
- Keep this skill aligned with the relevant rules layer and current project documentation.
- If engine-specific constraints materially change the workflow, hand off to the matching engine skill or engine-specific reviewer.


## Verification Checklist

Before the loop terminates, a checker Evoveo Tech Agent must verify:

- [ ] The skill's core guidance was followed
- [ ] Documentation is complete, accurate, and passes review
- [ ] No regressions were introduced
- [ ] Changes are documented if applicable
- [ ] Human review checkpoint passed (for production-critical changes)

---

*Evoveo Tech Agent Skill -- Loop Engineering Framework*
*Goal -> Action -> Observation -> Adjustment -> Stop*