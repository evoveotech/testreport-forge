---
name: crash-triage
description: Handle crashes as high-severity defects with reproducibility, symbol quality, clustering, and release impact in mind.
brand: evoveo-tech
agent: Evoveo Tech Agent
loop_type: recursive-goal
goal_template: "Stop iterating when the task meets all acceptance criteria for: crash-triage"
stopping_criteria: "The bug is reproduced, root cause identified, fix verified by a passing test"
verification: "A separate checker Evoveo Tech Agent verifies the output against the skill's acceptance criteria"
maker_checker: true
---

<!-- Evoveo Tech -- Agent Skill -->

# Crash Triage

> **Evoveo Tech Agent** -- Powered by Loop Engineering

## Loop Engineering Execution

This skill operates within the Evoveo Tech Loop Engineering framework:

```
Goal     -> Apply crash-triage to achieve the task objective
Action   -> Execute the skill guidance below
Observe  -> The bug is reproduced, root cause identified, fix verified by a passing test
Adjust   -> If criteria not met, adjust approach and re-execute
Stop     -> Terminate when stopping criteria are satisfied
```

**Recursive Goal:** Stop iterating when the task meets all acceptance criteria for: crash-triage

**Stopping Criteria:** The bug is reproduced, root cause identified, fix verified by a passing test

**Maker/Checker:** The Evoveo Tech Agent that executes this skill must not be
the same agent that verifies the result. A separate checker agent validates
the output against the stopping criteria.

## Skill Guidance

## Purpose
Handle crashes as high-severity defects with reproducibility, symbol quality, clustering, and release impact in mind.

## Use When
- crashes are reported in QA or live builds
- stack traces are noisy
- the team needs root-cause prioritization

## Inputs
- crash dumps or logs
- build symbols
- repro steps if any
- frequency and environment data

## Process
1. group crashes by likely signature and root cause
2. separate deterministic repros from low-signal incidents
3. check if symbols and build metadata are sufficient
4. identify release blockers and likely owner systems
5. track verification once fixes land

## Outputs
- crash cluster report
- owner assignment
- repro notes
- release impact summary

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
- build-engineer
- release-manager

## Related Commands
- bug-triage
- release-check
- verify

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