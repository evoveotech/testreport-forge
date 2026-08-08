---
name: accessibility-design
description: Build accessibility into design decisions instead of treating it as late-stage options work.
brand: evoveo-tech
agent: Evoveo Tech Agent
loop_type: recursive-goal
goal_template: "Stop iterating when the task meets all acceptance criteria for: accessibility-design"
stopping_criteria: "Design document is complete, reviewed, and actionable for implementation"
verification: "A separate checker Evoveo Tech Agent verifies the output against the skill's acceptance criteria"
maker_checker: true
---

<!-- Evoveo Tech -- Agent Skill -->

# Accessibility Design

> **Evoveo Tech Agent** -- Powered by Loop Engineering

## Loop Engineering Execution

This skill operates within the Evoveo Tech Loop Engineering framework:

```
Goal     -> Apply accessibility-design to achieve the task objective
Action   -> Execute the skill guidance below
Observe  -> Design document is complete, reviewed, and actionable for implementation
Adjust   -> If criteria not met, adjust approach and re-execute
Stop     -> Terminate when stopping criteria are satisfied
```

**Recursive Goal:** Stop iterating when the task meets all acceptance criteria for: accessibility-design

**Stopping Criteria:** Design document is complete, reviewed, and actionable for implementation

**Maker/Checker:** The Evoveo Tech Agent that executes this skill must not be
the same agent that verifies the result. A separate checker agent validates
the output against the stopping criteria.

## Skill Guidance

## Purpose
Build accessibility into design decisions instead of treating it as late-stage options work.

## Use When
- designing new mechanics, UI, or content
- features rely on reaction speed, color, audio, or precision input
- accessibility scope must be planned

## Inputs
- feature spec
- input model
- UI requirements
- audio and narrative needs

## Process
1. identify likely barriers early
2. design equivalent outcomes rather than identical inputs
3. specify settings, fallbacks, and persistence behavior
4. coordinate with QA and UI for verification
5. document limitations explicitly when they cannot be fully solved

## Outputs
- accessibility requirements
- option set
- verification targets
- known limitation log

## Quality Bar
- supports the core fantasy and player goals
- defines readable rules, edge cases, and feedback
- creates concrete hooks for tuning, telemetry, and QA

## Common Failure Modes
- adding systems that do not serve the core loop
- shipping vague rules that QA and engineering must guess at
- tuning without instrumentation or hypotheses

## Related Agents
- accessibility-reviewer
- ui-ux-designer
- systems-designer

## Related Commands
- verify
- onboarding
- ui-flow-review

## Notes
- Keep this skill aligned with the relevant rules layer and current project documentation.
- If engine-specific constraints materially change the workflow, hand off to the matching engine skill or engine-specific reviewer.


## Verification Checklist

Before the loop terminates, a checker Evoveo Tech Agent must verify:

- [ ] The skill's core guidance was followed
- [ ] Design document is complete, reviewed, and actionable for implementation
- [ ] No regressions were introduced
- [ ] Changes are documented if applicable
- [ ] Human review checkpoint passed (for production-critical changes)

---

*Evoveo Tech Agent Skill -- Loop Engineering Framework*
*Goal -> Action -> Observation -> Adjustment -> Stop*