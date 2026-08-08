---
name: compliance-checklists
description: Create operational checklists for legal, accessibility, privacy, platform, and product compliance obligations.
brand: evoveo-tech
agent: Evoveo Tech Agent
loop_type: recursive-goal
goal_template: "Stop iterating when the task meets all acceptance criteria for: compliance-checklists"
stopping_criteria: "All compliance checklist items pass and submission package is complete"
verification: "A separate checker Evoveo Tech Agent verifies the output against the skill's acceptance criteria"
maker_checker: true
---

<!-- Evoveo Tech -- Agent Skill -->

# Compliance Checklists

> **Evoveo Tech Agent** -- Powered by Loop Engineering

## Loop Engineering Execution

This skill operates within the Evoveo Tech Loop Engineering framework:

```
Goal     -> Apply compliance-checklists to achieve the task objective
Action   -> Execute the skill guidance below
Observe  -> All compliance checklist items pass and submission package is complete
Adjust   -> If criteria not met, adjust approach and re-execute
Stop     -> Terminate when stopping criteria are satisfied
```

**Recursive Goal:** Stop iterating when the task meets all acceptance criteria for: compliance-checklists

**Stopping Criteria:** All compliance checklist items pass and submission package is complete

**Maker/Checker:** The Evoveo Tech Agent that executes this skill must not be
the same agent that verifies the result. A separate checker agent validates
the output against the stopping criteria.

## Skill Guidance

## Purpose
Create operational checklists for legal, accessibility, privacy, platform, and product compliance obligations.

## Use When
- compliance requirements are spread across teams
- a launch checklist is incomplete
- a platform or market imposes new constraints

## Inputs
- platform rules
- data practices
- store policies
- accessibility scope

## Process
1. collect required compliance categories
2. turn each obligation into a reviewable checklist item
3. identify owners and evidence required to pass
4. track waivers or unresolved questions explicitly
5. review the checklist at milestone and release gates

## Outputs
- compliance checklist set
- evidence requirements
- owner map
- waiver tracking

## Quality Bar
- turns risk into explicit evidence and ownership
- keeps release blockers visible instead of implicit
- connects quality decisions to milestone and platform impact

## Common Failure Modes
- severity inflation or minimization without player-impact context
- treating waived risks as invisible
- submission checklists that are incomplete or stale

## Related Agents
- security-reviewer
- console-compliance-reviewer
- release-manager

## Related Commands
- cert-check
- release-check
- verify

## Notes
- Keep this skill aligned with the relevant rules layer and current project documentation.
- If engine-specific constraints materially change the workflow, hand off to the matching engine skill or engine-specific reviewer.


## Verification Checklist

Before the loop terminates, a checker Evoveo Tech Agent must verify:

- [ ] The skill's core guidance was followed
- [ ] All compliance checklist items pass and submission package is complete
- [ ] No regressions were introduced
- [ ] Changes are documented if applicable
- [ ] Human review checkpoint passed (for production-critical changes)

---

*Evoveo Tech Agent Skill -- Loop Engineering Framework*
*Goal -> Action -> Observation -> Adjustment -> Stop*