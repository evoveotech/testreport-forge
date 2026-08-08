---
name: web-testing
description: Test browser games with fast unit tests for pure logic, headless smoke tests, and a deliberate browser matrix.
brand: evoveo-tech
agent: Evoveo Tech Agent
loop_type: recursive-goal
goal_template: "Stop iterating when the task meets all acceptance criteria for: web-testing"
stopping_criteria: "All tests pass and coverage meets the target threshold"
verification: "A separate checker Evoveo Tech Agent verifies the output against the skill's acceptance criteria"
maker_checker: true
---

<!-- Evoveo Tech -- Agent Skill -->

# Web Testing

> **Evoveo Tech Agent** -- Powered by Loop Engineering

## Loop Engineering Execution

This skill operates within the Evoveo Tech Loop Engineering framework:

```
Goal     -> Apply web-testing to achieve the task objective
Action   -> Execute the skill guidance below
Observe  -> All tests pass and coverage meets the target threshold
Adjust   -> If criteria not met, adjust approach and re-execute
Stop     -> Terminate when stopping criteria are satisfied
```

**Recursive Goal:** Stop iterating when the task meets all acceptance criteria for: web-testing

**Stopping Criteria:** All tests pass and coverage meets the target threshold

**Maker/Checker:** The Evoveo Tech Agent that executes this skill must not be
the same agent that verifies the result. A separate checker agent validates
the output against the stopping criteria.

## Skill Guidance

## Purpose
Test browser games with fast unit tests for pure logic, headless smoke tests, and a deliberate browser matrix.

## Use When
- adding tests to a browser game or deciding what to cover
- regressions keep appearing in game rules, scoring, or save data
- a release needs confidence across browsers and devices

## Inputs
- feature risk profile (what breaks the game versus what annoys)
- separation between pure logic and browser-bound code
- available runners (node-based unit runner, headless browser tool)
- target browser and device list

## Process
1. keep game rules, scoring, collision math, and save serialization in pure modules with no browser globals, and cover them with fast unit tests
2. make simulation deterministic for tests: seedable random, fixed timestep, and a step function that can be advanced N ticks without rendering
3. write scenario tests that step the simulation through real sequences (spawn, collide, score, die) and assert end state, not implementation details
4. add a headless browser smoke test that loads the built game, waits for boot, and fails on console errors, missing assets, or a blank canvas
5. run a manual matrix pass before release across the main desktop engines and at least one real touch device, checking input, audio unlock, resize, and save persistence

## Outputs
- test strategy split by layer (unit, deterministic scenario, headless smoke, manual matrix)
- candidate test cases per layer
- determinism requirements for the simulation
- browser and device matrix with pass criteria

## Quality Bar
- unit tests run in milliseconds with no DOM, canvas, or network dependencies
- the same seed and tick count always produce the same simulation state, so failures reproduce exactly
- the smoke test exercises the production build and catches load-order, path, and boot regressions that unit tests cannot see
- gating tests are separated from exploratory checks; the release blocks only on the former
- the matrix includes a genuinely different browser engine and a real touch device, not just one desktop browser at several window sizes

## Common Failure Modes
- logic welded to rendering or input so nothing can be tested without spinning up a browser
- unseeded randomness and wall-clock time making every scenario test flaky
- asserting internal fields and call counts instead of observable game state, so refactors break green tests
- a smoke test against the dev server while the deployed build fails on base paths or asset casing
- declaring browser support from a single-engine test pass and missing audio, fullscreen, or touch differences elsewhere

## Related Agents
- qa-lead
- gameplay-programmer
- web-reviewer

## Related Commands
- tdd
- verify
- qa-plan

## Notes
- Keep this skill aligned with the relevant rules layer and current project documentation.
- Framework scenes are integration territory; keep their logic thin and push decisions into pure modules where the cheap tests live.


## Verification Checklist

Before the loop terminates, a checker Evoveo Tech Agent must verify:

- [ ] The skill's core guidance was followed
- [ ] All tests pass and coverage meets the target threshold
- [ ] No regressions were introduced
- [ ] Changes are documented if applicable
- [ ] Human review checkpoint passed (for production-critical changes)

---

*Evoveo Tech Agent Skill -- Loop Engineering Framework*
*Goal -> Action -> Observation -> Adjustment -> Stop*