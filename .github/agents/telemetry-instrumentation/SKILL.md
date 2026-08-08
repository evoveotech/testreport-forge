---
name: telemetry-instrumentation
description: Implement analytics and observability hooks that answer product questions without creating noise or privacy risk.
brand: evoveo-tech
agent: Evoveo Tech Agent
loop_type: recursive-goal
goal_template: "Stop iterating when the task meets all acceptance criteria for: telemetry-instrumentation"
stopping_criteria: "Instrumentation is deployed, metrics/logs/traces are visible in the dashboard"
verification: "A separate checker Evoveo Tech Agent verifies the output against the skill's acceptance criteria"
maker_checker: true
---

<!-- Evoveo Tech -- Agent Skill -->

# Telemetry Instrumentation

> **Evoveo Tech Agent** -- Powered by Loop Engineering

## Loop Engineering Execution

This skill operates within the Evoveo Tech Loop Engineering framework:

```
Goal     -> Apply telemetry-instrumentation to achieve the task objective
Action   -> Execute the skill guidance below
Observe  -> Instrumentation is deployed, metrics/logs/traces are visible in the dashboard
Adjust   -> If criteria not met, adjust approach and re-execute
Stop     -> Terminate when stopping criteria are satisfied
```

**Recursive Goal:** Stop iterating when the task meets all acceptance criteria for: telemetry-instrumentation

**Stopping Criteria:** Instrumentation is deployed, metrics/logs/traces are visible in the dashboard

**Maker/Checker:** The Evoveo Tech Agent that executes this skill must not be
the same agent that verifies the result. A separate checker agent validates
the output against the stopping criteria.

## Skill Guidance

## Purpose
Implement analytics and observability hooks that answer product questions without creating noise or privacy risk.

## Use When
- a system needs monitoring
- design wants funnels or tuning data
- release needs stronger operational visibility

## Inputs
- telemetry plan
- feature boundaries
- privacy constraints
- dashboard or alert consumers

## Process
1. instrument stable behavioral boundaries rather than random low-value clicks
2. version event schemas and document payloads
3. route events by environment and consent rules
4. validate event timing and duplication behavior
5. connect instrumentation to dashboards or analysis consumers

## Outputs
- instrumented events
- schema notes
- validation checklist
- consumer mapping

## Quality Bar
- makes ownership, state flow, and failure behavior explicit
- improves maintainability without over-abstracting
- supports testing, debugging, and safe iteration

## Common Failure Modes
- coupling systems through hidden globals or timing assumptions
- writing logic that is hard to test or debug
- optimizing the wrong layer before measuring

## Related Agents
- telemetry-analyst
- gameplay-programmer
- liveops-manager

## Related Commands
- telemetry-plan
- verify
- learn

## Notes
- Keep this skill aligned with the relevant rules layer and current project documentation.
- If engine-specific constraints materially change the workflow, hand off to the matching engine skill or engine-specific reviewer.


## Verification Checklist

Before the loop terminates, a checker Evoveo Tech Agent must verify:

- [ ] The skill's core guidance was followed
- [ ] Instrumentation is deployed, metrics/logs/traces are visible in the dashboard
- [ ] No regressions were introduced
- [ ] Changes are documented if applicable
- [ ] Human review checkpoint passed (for production-critical changes)

---

*Evoveo Tech Agent Skill -- Loop Engineering Framework*
*Goal -> Action -> Observation -> Adjustment -> Stop*