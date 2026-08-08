---
name: store-submission
description: Prepare store-facing assets, metadata, compliance paperwork, and packaging details for submission.
brand: evoveo-tech
agent: Evoveo Tech Agent
loop_type: recursive-goal
goal_template: "Stop iterating when the task meets all acceptance criteria for: store-submission"
stopping_criteria: "All compliance checklist items pass and submission package is complete"
verification: "A separate checker Evoveo Tech Agent verifies the output against the skill's acceptance criteria"
maker_checker: true
---

<!-- Evoveo Tech -- Agent Skill -->

# Store Submission

> **Evoveo Tech Agent** -- Powered by Loop Engineering

## Loop Engineering Execution

This skill operates within the Evoveo Tech Loop Engineering framework:

```
Goal     -> Apply store-submission to achieve the task objective
Action   -> Execute the skill guidance below
Observe  -> All compliance checklist items pass and submission package is complete
Adjust   -> If criteria not met, adjust approach and re-execute
Stop     -> Terminate when stopping criteria are satisfied
```

**Recursive Goal:** Stop iterating when the task meets all acceptance criteria for: store-submission

**Stopping Criteria:** All compliance checklist items pass and submission package is complete

**Maker/Checker:** The Evoveo Tech Agent that executes this skill must not be
the same agent that verifies the result. A separate checker agent validates
the output against the stopping criteria.

## Skill Guidance

## Purpose
Prepare store-facing assets, metadata, compliance paperwork, and packaging details for submission.

## Use When
- approaching launch or major update submission
- store requirements are not yet consolidated
- platform and marketing dependencies are diverging

## Inputs
- release candidate build
- store requirements
- screenshots and metadata
- age rating and legal needs

## Process
1. build a submission checklist for each platform/store
2. validate asset and metadata completeness
3. check versioning, entitlement, and region requirements
4. coordinate with localization and support information
5. track platform-specific blockers through submission

## Outputs
- store submission checklist
- metadata package
- asset-completeness report
- submission blocker list

## Quality Bar
- turns risk into explicit evidence and ownership
- keeps release blockers visible instead of implicit
- connects quality decisions to milestone and platform impact

## Common Failure Modes
- severity inflation or minimization without player-impact context
- treating waived risks as invisible
- submission checklists that are incomplete or stale

## Related Agents
- release-manager
- producer
- doc-updater

## Related Commands
- release-check
- patch-notes
- cert-check

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