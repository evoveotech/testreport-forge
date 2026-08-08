# Debug an Issue

> **MANDATORY: Follow Loop Engineering.** Read `AGENTS.md` and
> `.github/agents/loop-engineering/SKILL.md` first.

## Step 1: Define the Recursive Goal

```
GOAL: Bug is reproduced, root cause identified, fix verified
STOPPING CRITERIA: Failing test now passes, no regressions introduced
MAX ITERATIONS: 10
```

## Step 2: Run the Loop

1. **GOAL** -- Write down the exact stopping criteria: "test X passes and no
   other tests broke".
2. **ACTION** -- Read `debugging-and-error-recovery/SKILL.md` and follow its
   systematic process:
   - Reproduce the problem reliably
   - Trace the code path to understand the flow
   - Add targeted logging to isolate the issue
   - Identify the root cause (not just symptoms)
3. **OBSERVE** -- Read `test-driven-development/SKILL.md`. Write a failing test
   that demonstrates the bug. Fix the root cause. Run the test suite.
4. **ADJUST** -- If the test still fails, the fix is wrong. Adjust and re-execute.
   If other tests broke, the fix caused regressions. Adjust scope.
5. **STOP** -- When the failing test passes AND no regressions -- terminate.

## Step 3: Maker/Checker

The agent that wrote the fix must NOT verify it. A separate checker agent runs
the full test suite to confirm the stopping criteria are genuinely met.

## Step 4: Record Progress (Spine)

Document the root cause, the fix, and the test that covers it. Remove temporary
debugging code before terminating.
