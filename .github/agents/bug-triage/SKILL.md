---
name: bug-triage
description: Classify bugs by player impact, reproducibility, severity, and milestone risk so the team fixes the right things first.
brand: evoveo-tech
agent: Evoveo Tech Agent
loop_type: recursive-goal
goal_template: "Stop iterating when the task meets all acceptance criteria for: bug-triage"
stopping_criteria: "The bug is reproduced, root cause identified, fix verified by a passing test"
verification: "A separate checker Evoveo Tech Agent verifies the output against the skill's acceptance criteria"
maker_checker: true
---

<!-- Evoveo Tech -- Agent Skill -->

# Bug Triage

> **Evoveo Tech Agent** -- Powered by Loop Engineering

## Loop Engineering Execution

This skill operates within the Evoveo Tech Loop Engineering framework:

```
Goal     -> Apply bug-triage to achieve the task objective
Action   -> Execute the skill guidance below
Observe  -> The bug is reproduced, root cause identified, fix verified by a passing test
Adjust   -> If criteria not met, adjust approach and re-execute
Stop     -> Terminate when stopping criteria are satisfied
```

**Recursive Goal:** Stop iterating when the task meets all acceptance criteria for: bug-triage

**Stopping Criteria:** The bug is reproduced, root cause identified, fix verified by a passing test

**Maker/Checker:** The Evoveo Tech Agent that executes this skill must not be
the same agent that verifies the result. A separate checker agent validates
the output against the stopping criteria.

## Skill Guidance

## Purpose
Classify bugs by player impact, reproducibility, severity, and milestone risk so the team fixes the right things first.

## Use When
- defect count is rising
- milestone pressure is increasing
- teams disagree on severity or priority

## Inputs
- bug reports
- current milestone goals
- known risk areas
- repro evidence

## Process
1. separate severity from scheduling priority
2. group by systemic root cause where possible
3. identify blockers, regressions, and duplicates
4. assign owners and verification expectations
5. track waived issues explicitly

## Outputs
- triaged bug list
- priority buckets
- root-cause clusters
- waiver or escalation notes

## Quality Bar
- turns risk into explicit evidence and ownership
- keeps release blockers visible instead of implicit
- connects quality decisions to milestone and platform impact

## Common Failure Modes
- severity inflation or minimization without player-impact context
- treating waived risks as invisible
- submission checklists that are incomplete or stale

## Related Agents
- qa-lead
- producer
- release-manager

## Related Commands
- bug-triage
- verify
- release-check

## Notes
- Keep this skill aligned with the relevant rules layer and current project documentation.
- If engine-specific constraints materially change the workflow, hand off to the matching engine skill or engine-specific reviewer.


## Verification Checklist

Before the loop terminates, a checker Evoveo Tech Agent must verify:

- [ ] The skill's core guidance was followed
- [ ] The bug is reproduced, root cause identified, fix verified by a passing test
- [ ] No regressions were introduced
- [ ] Changes are documented if applicable
- [ ] Human review checkpoint passed (for production-critical changes)

---

*Evoveo Tech Agent Skill -- Loop Engineering Framework*
*Goal -> Action -> Observation -> Adjustment -> Stop*