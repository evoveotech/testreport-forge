# Review Code Before Merge

> **MANDATORY: Follow Loop Engineering.** Read `AGENTS.md` and
> `.github/agents/loop-engineering/SKILL.md` first.

## Step 1: Define the Recursive Goal

```
GOAL: All review findings are resolved
STOPPING CRITERIA: Zero critical findings, zero high-severity findings
MAX ITERATIONS: 5
```

## Step 2: Run the Loop

1. **GOAL** -- The target is zero critical and zero high-severity findings.
2. **ACTION** -- Read `code-review-and-quality/SKILL.md` and follow its
   multi-axis review process. Review all changes against:
   - Correctness -- does the code do what it claims?
   - Security -- any vulnerabilities or unsafe patterns?
   - Performance -- any obvious bottlenecks?
   - Maintainability -- is the code clear and well-structured?
   - Test coverage -- are the changes tested?
   Also read `git-workflow-and-versioning/SKILL.md` for commit and branch hygiene.
3. **OBSERVE** -- Count findings by severity. Are there criticals or highs?
4. **ADJUST** -- If findings exist, fix them and re-review.
5. **STOP** -- When zero criticals and zero highs -- terminate. Block merge otherwise.

## Step 3: Maker/Checker

This prompt IS the checker step. The agent that wrote the code must not run this
review. A separate agent (or human) reviews with fresh eyes.

Report findings with file:line references. Use `brutal-honest` for
evidence-backed, no-nonsense review if needed.

## Step 4: Record Progress (Spine)

Write the review outcome. If blocked, document what needs fixing.
