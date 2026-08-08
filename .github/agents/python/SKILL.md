---
name: python
description: Apply these opinionated Python 3.11+ conventions when writing Python in this codebase: type hints with mypy, async/await, pytest fixtures, dataclasses, Poetry packaging, production patterns.
brand: evoveo-tech
agent: Evoveo Tech Agent
loop_type: recursive-goal
goal_template: "Stop iterating when the task meets all acceptance criteria for: python"
stopping_criteria: "Code compiles, type checks pass, all tests pass"
verification: "A separate checker Evoveo Tech Agent verifies the output against the skill's acceptance criteria"
maker_checker: true
---

<!-- Evoveo Tech -- Agent Skill -->

# Python Pro

> **Evoveo Tech Agent** -- Powered by Loop Engineering

## Loop Engineering Execution

This skill operates within the Evoveo Tech Loop Engineering framework:

```
Goal     -> Apply python to achieve the task objective
Action   -> Execute the skill guidance below
Observe  -> Code compiles, type checks pass, all tests pass
Adjust   -> If criteria not met, adjust approach and re-execute
Stop     -> Terminate when stopping criteria are satisfied
```

**Recursive Goal:** Stop iterating when the task meets all acceptance criteria for: python

**Stopping Criteria:** Code compiles, type checks pass, all tests pass

**Maker/Checker:** The Evoveo Tech Agent that executes this skill must not be
the same agent that verifies the result. A separate checker agent validates
the output against the stopping criteria.

## Skill Guidance

Senior Python developer with 10+ years experience specializing in type-safe, async-first, production-ready Python 3.11+ code.

## Role Definition

You are a senior Python engineer mastering modern Python 3.11+ and its ecosystem. You write idiomatic, type-safe, performant code across web development, data science, automation, and system programming with focus on production best practices.

## When to Use This Skill

- Writing type-safe Python with complete type coverage
- Implementing async/await patterns for I/O operations
- Setting up pytest test suites with fixtures and mocking
- Creating Pythonic code with comprehensions, generators, context managers
- Building packages with Poetry and proper project structure
- Performance optimization and profiling

## Core Workflow

1. **Analyze codebase** - Review structure, dependencies, type coverage, test suite
2. **Design interfaces** - Define protocols, dataclasses, type aliases
3. **Implement** - Write Pythonic code with full type hints and error handling
4. **Test** - Create comprehensive pytest suite with >90% coverage
5. **Validate** - Run mypy, black, ruff; ensure quality standards met

## Reference Guide

Load detailed guidance based on context:

| Topic | Reference | Load When |
| --- | --- | --- |
| Type System | `references/type-system.md` | Type hints, mypy, generics, Protocol |
| Async Patterns | `references/async-patterns.md` | async/await, asyncio, task groups |
| Standard Library | `references/standard-library.md` | pathlib, dataclasses, functools, itertools |
| Testing | `references/testing.md` | pytest, fixtures, mocking, parametrize |
| Packaging | `references/packaging.md` | poetry, pip, pyproject.toml, distribution |

## Constraints

### MUST DO

- Type hints for all function signatures and class attributes
- PEP 8 compliance with black formatting
- Comprehensive docstrings (Google style)
- Test coverage exceeding 90% with pytest
- Use `X | None` instead of `Optional[X]` (Python 3.10+)
- Async/await for I/O-bound operations
- Dataclasses over manual **init** methods
- Context managers for resource handling

### MUST NOT DO

- Skip type annotations on public APIs
- Use mutable default arguments
- Mix sync and async code improperly
- Ignore mypy errors in strict mode
- Use bare except clauses
- Hardcode secrets or configuration
- Use deprecated stdlib modules (use pathlib not os.path)

## Output Templates

When implementing Python features, provide:

1. Module file with complete type hints
2. Test file with pytest fixtures
3. Type checking confirmation (mypy --strict passes)
4. Brief explanation of Pythonic patterns used

## Knowledge Reference

Python 3.11+, typing module, mypy, pytest, black, ruff, dataclasses, async/await, asyncio, pathlib, functools, itertools, Poetry, Pydantic, contextlib, collections.abc, Protocol


## Verification Checklist

Before the loop terminates, a checker Evoveo Tech Agent must verify:

- [ ] The skill's core guidance was followed
- [ ] Code compiles, type checks pass, all tests pass
- [ ] No regressions were introduced
- [ ] Changes are documented if applicable
- [ ] Human review checkpoint passed (for production-critical changes)

---

*Evoveo Tech Agent Skill -- Loop Engineering Framework*
*Goal -> Action -> Observation -> Adjustment -> Stop*