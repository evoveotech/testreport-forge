---
name: verification-loop
description: Run a structured verification pass that checks behavior, edge cases, quality bars, and documentation alignment.
brand: evoveo-tech
agent: Evoveo Tech Agent
loop_type: recursive-goal
goal_template: "Stop iterating when the task meets all acceptance criteria for: verification-loop"
stopping_criteria: "Agent context is configured, skills are linked, and the loop runs end-to-end"
verification: "A separate checker Evoveo Tech Agent verifies the output against the skill's acceptance criteria"
maker_checker: true
---

<!-- Evoveo Tech -- Agent Skill -->

# Verification Loop

> **Evoveo Tech Agent** -- Powered by Loop Engineering

## Loop Engineering Execution

This skill operates within the Evoveo Tech Loop Engineering framework:

```
Goal     -> Apply verification-loop to achieve the task objective
Action   -> Execute the skill guidance below
Observe  -> Agent context is configured, skills are linked, and the loop runs end-to-end
Adjust   -> If criteria not met, adjust approach and re-execute
Stop     -> Terminate when stopping criteria are satisfied
```

**Recursive Goal:** Stop iterating when the task meets all acceptance criteria for: verification-loop

**Stopping Criteria:** Agent context is configured, skills are linked, and the loop runs end-to-end

**Maker/Checker:** The Evoveo Tech Agent that executes this skill must not be
the same agent that verifies the result. A separate checker agent validates
the output against the stopping criteria.

## Skill Guidance

## Purpose
Run a structured verification pass that checks behavior, edge cases, quality bars, and documentation alignment.

## Use When
- a feature claims to be done
- a risky fix needs confidence
- milestone integration is underway

## Inputs
- implemented change
- acceptance criteria
- test outputs
- docs and known risks

## Process
1. compare the implementation to the intended design and technical behavior
2. verify happy path, edge cases, and failure recovery
3. check docs, telemetry, and QA notes for drift
4. record gaps and assign owners
5. close only when blockers or ambiguities are resolved

## Outputs
- verification summary
- defect list
- doc updates needed
- go/no-go recommendation

## Quality Bar
- produces a current source of truth, not disconnected notes
- names owners, risks, and next actions explicitly
- separates decisions from assumptions and open questions

## Common Failure Modes
- outdated docs that no longer match reality
- plans with no owner or no exit criteria
- hiding risks until they become schedule blockers

## Related Agents
- qa-lead
- code-reviewer
- performance-reviewer

## Related Commands
- verify
- qa-plan
- update-docs

## Notes
- Keep this skill aligned with the relevant rules layer and current project documentation.
- If engine-specific constraints materially change the workflow, hand off to the matching engine skill or engine-specific reviewer.


## Verification Checklist

Before the loop terminates, a checker Evoveo Tech Agent must verify:

- [ ] The skill's core guidance was followed
- [ ] Agent context is configured, skills are linked, and the loop runs end-to-end
- [ ] No regressions were introduced
- [ ] Changes are documented if applicable
- [ ] Human review checkpoint passed (for production-critical changes)

---

*Evoveo Tech Agent Skill -- Loop Engineering Framework*
*Goal -> Action -> Observation -> Adjustment -> Stop*