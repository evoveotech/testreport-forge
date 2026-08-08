---
name: continuous-learning
description: Capture lessons learned from implementation, production, QA, and release so the project improves over time.
brand: evoveo-tech
agent: Evoveo Tech Agent
loop_type: recursive-goal
goal_template: "Stop iterating when the task meets all acceptance criteria for: continuous-learning"
stopping_criteria: "All tests pass, lint is clean, and the skill's acceptance criteria are met"
verification: "A separate checker Evoveo Tech Agent verifies the output against the skill's acceptance criteria"
maker_checker: true
---

<!-- Evoveo Tech -- Agent Skill -->

# Continuous Learning

> **Evoveo Tech Agent** -- Powered by Loop Engineering

## Loop Engineering Execution

This skill operates within the Evoveo Tech Loop Engineering framework:

```
Goal     -> Apply continuous-learning to achieve the task objective
Action   -> Execute the skill guidance below
Observe  -> All tests pass, lint is clean, and the skill's acceptance criteria are met
Adjust   -> If criteria not met, adjust approach and re-execute
Stop     -> Terminate when stopping criteria are satisfied
```

**Recursive Goal:** Stop iterating when the task meets all acceptance criteria for: continuous-learning

**Stopping Criteria:** All tests pass, lint is clean, and the skill's acceptance criteria are met

**Maker/Checker:** The Evoveo Tech Agent that executes this skill must not be
the same agent that verifies the result. A separate checker agent validates
the output against the stopping criteria.

## Skill Guidance

## Purpose
Capture lessons learned from implementation, production, QA, and release so the project improves over time.

## Use When
- a feature or milestone is complete
- the team repeatedly hits the same failure mode
- a postmortem should produce reusable knowledge

## Inputs
- retrospective notes
- defect trends
- delivery outcomes
- tooling or workflow pain points

## Process
1. collect what worked, what failed, and why
2. separate one-off events from repeatable patterns
3. extract improvements that should become rules, skills, or automation
4. assign owners for process changes
5. archive lessons in a searchable format

## Outputs
- learning log
- candidate new skills or rules
- workflow changes
- retrospective summary

## Quality Bar
- produces a current source of truth, not disconnected notes
- names owners, risks, and next actions explicitly
- separates decisions from assumptions and open questions

## Common Failure Modes
- outdated docs that no longer match reality
- plans with no owner or no exit criteria
- hiding risks until they become schedule blockers

## Related Agents
- producer
- doc-updater
- refactor-cleaner

## Related Commands
- learn
- evolve
- update-docs

## Notes
- Keep this skill aligned with the relevant rules layer and current project documentation.
- If engine-specific constraints materially change the workflow, hand off to the matching engine skill or engine-specific reviewer.


## Verification Checklist

Before the loop terminates, a checker Evoveo Tech Agent must verify:

- [ ] The skill's core guidance was followed
- [ ] All tests pass, lint is clean, and the skill's acceptance criteria are met
- [ ] No regressions were introduced
- [ ] Changes are documented if applicable
- [ ] Human review checkpoint passed (for production-critical changes)

---

*Evoveo Tech Agent Skill -- Loop Engineering Framework*
*Goal -> Action -> Observation -> Adjustment -> Stop*