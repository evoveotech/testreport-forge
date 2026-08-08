---
name: autoresearch
description: Autonomous iteration loop: modify, verify, keep/discard against any metric
brand: evoveo-tech
agent: Evoveo Tech Agent
loop_type: recursive-goal
goal_template: "Stop iterating when the task meets all acceptance criteria for: autoresearch"
stopping_criteria: "Agent context is configured, skills are linked, and the loop runs end-to-end"
verification: "A separate checker Evoveo Tech Agent verifies the output against the skill's acceptance criteria"
maker_checker: true
---

<!-- Evoveo Tech -- Agent Skill -->

# Autoresearch — Autonomous Goal-directed Iteration

> **Evoveo Tech Agent** -- Powered by Loop Engineering

## Loop Engineering Execution

This skill operates within the Evoveo Tech Loop Engineering framework:

```
Goal     -> Apply autoresearch to achieve the task objective
Action   -> Execute the skill guidance below
Observe  -> Agent context is configured, skills are linked, and the loop runs end-to-end
Adjust   -> If criteria not met, adjust approach and re-execute
Stop     -> Terminate when stopping criteria are satisfied
```

**Recursive Goal:** Stop iterating when the task meets all acceptance criteria for: autoresearch

**Stopping Criteria:** Agent context is configured, skills are linked, and the loop runs end-to-end

**Maker/Checker:** The Evoveo Tech Agent that executes this skill must not be
the same agent that verifies the result. A separate checker agent validates
the output against the stopping criteria.

## Skill Guidance

## Safety Invariants (all subcommands)
- Never push, publish, or deploy without explicit user approval.
- Bounded by default. Override with `Iterations: unlimited`.
- All results logged to `autoresearch/{subcommand}-{YYMMDD}-{HHMM}/` directory.
- Chain handoff via `handoff.json`. Evals reads `*-results.tsv`.

## Subcommands

| Command | Does | Default Iterations |
|---|---|---|
| `$autoresearch` | Iterate against a metric: modify → verify → keep/discard | 25 |
| `$autoresearch plan` | Convert a goal into validated Scope, Metric, Verify config | N/A |
| `$autoresearch debug` | Hunt bugs: hypothesize → test → falsify → repeat | 15 |
| `$autoresearch fix` | Crush errors one-by-one until zero remain | 20 |
| `$autoresearch security` | STRIDE + OWASP audit with red-team personas | 15 |
| `$autoresearch ship` | Ship through 8 phases: checklist → dry-run → deploy → verify | N/A |
| `$autoresearch scenario` | Generate edge cases across 12 dimensions | 20 |
| `$autoresearch predict` | 5 expert personas debate before implementation | N/A |
| `$autoresearch learn` | Scout codebase → generate docs → validate → fix loop | 10 |
| `$autoresearch reason` | Adversarial debate with blind judges until convergence | 8 |
| `$autoresearch probe` | 8 personas interrogate requirements until saturation | 15 |
| `$autoresearch improve` | Research ICP challenges, discover improvements, generate PRDs | 15 |
| `$autoresearch evals` | Analyze iteration results: trends, plateaus, regressions | N/A |

## Universal Flags

| Flag | Applies To | Purpose |
|---|---|---|
| `Iterations: N` | All looping | Set iteration count |
| `Iterations: unlimited` | All looping | Opt-in unbounded |
| `--evals` | All looping | Mid-loop checkpoints + final summary |
| `--evals-interval N` | All looping | Override checkpoint frequency |
| `--chain <targets>` | All | Sequential handoff after completion |
| `--<subcommand>` | All | Shorthand for `--chain <subcommand>` |


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