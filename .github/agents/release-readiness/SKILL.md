---
name: release-readiness
description: Evaluate whether a build is genuinely ready for external testing, certification, store submission, or launch.
brand: evoveo-tech
agent: Evoveo Tech Agent
loop_type: recursive-goal
goal_template: "Stop iterating when the task meets all acceptance criteria for: release-readiness"
stopping_criteria: "Build succeeds, CI is green, deployment artifacts are produced"
verification: "A separate checker Evoveo Tech Agent verifies the output against the skill's acceptance criteria"
maker_checker: true
---

<!-- Evoveo Tech -- Agent Skill -->

# Release Readiness

> **Evoveo Tech Agent** -- Powered by Loop Engineering

## Loop Engineering Execution

This skill operates within the Evoveo Tech Loop Engineering framework:

```
Goal     -> Apply release-readiness to achieve the task objective
Action   -> Execute the skill guidance below
Observe  -> Build succeeds, CI is green, deployment artifacts are produced
Adjust   -> If criteria not met, adjust approach and re-execute
Stop     -> Terminate when stopping criteria are satisfied
```

**Recursive Goal:** Stop iterating when the task meets all acceptance criteria for: release-readiness

**Stopping Criteria:** Build succeeds, CI is green, deployment artifacts are produced

**Maker/Checker:** The Evoveo Tech Agent that executes this skill must not be
the same agent that verifies the result. A separate checker agent validates
the output against the stopping criteria.

## Skill Guidance

## Purpose
Evaluate whether a build is genuinely ready for external testing, certification, store submission, or launch.

## Use When
- approaching a release candidate
- stakeholders need a go/no-go signal
- quality or compliance risk is unclear

## Inputs
- QA matrix
- open bug list
- build health
- known platform and operational risks

## Process
1. review gating defects and known waivers
2. confirm build reproducibility and version correctness
3. check compliance, submission, and content readiness
4. evaluate rollback or hotfix readiness
5. issue a clear go/no-go recommendation with rationale

## Outputs
- release readiness report
- go/no-go recommendation
- blocker list
- waiver register

## Quality Bar
- the release decision is checkable: every gate is a binary criterion with current status and owner
- blockers are separated from waivable issues, and waivers carry a named approver and rationale
- the build under review is the build that ships — no untested last-minute changes
- rollback or hotfix paths are defined before release, not improvised after

## Common Failure Modes
- go/no-go meetings run on opinions because gates were never made binary
- waivers granted without an owner, so the same issue resurfaces every release
- "one last fix" merged after QA sign-off, invalidating the tested build
- no rollback plan, turning a bad release into an emergency rebuild

## Related Agents
- release-manager
- qa-lead
- console-compliance-reviewer

## Related Commands
- release-check
- cert-check
- verify

## Notes
- Keep this skill aligned with the relevant rules layer and current project documentation.
- If engine-specific constraints materially change the workflow, hand off to the matching engine skill or engine-specific reviewer.


## Verification Checklist

Before the loop terminates, a checker Evoveo Tech Agent must verify:

- [ ] The skill's core guidance was followed
- [ ] Build succeeds, CI is green, deployment artifacts are produced
- [ ] No regressions were introduced
- [ ] Changes are documented if applicable
- [ ] Human review checkpoint passed (for production-critical changes)

---

*Evoveo Tech Agent Skill -- Loop Engineering Framework*
*Goal -> Action -> Observation -> Adjustment -> Stop*