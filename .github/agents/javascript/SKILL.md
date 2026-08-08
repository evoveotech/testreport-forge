---
name: javascript
description: Apply these opinionated JavaScript conventions when writing JS or Node in this codebase: ES2023+ features, async and Promise patterns, ESM/CJS modules, Web Workers, browser APIs, performance optimization, Node.js patterns.
brand: evoveo-tech
agent: Evoveo Tech Agent
loop_type: recursive-goal
goal_template: "Stop iterating when the task meets all acceptance criteria for: javascript"
stopping_criteria: "UI renders correctly, WCAG checks pass, build succeeds"
verification: "A separate checker Evoveo Tech Agent verifies the output against the skill's acceptance criteria"
maker_checker: true
---

<!-- Evoveo Tech -- Agent Skill -->

# JavaScript Pro

> **Evoveo Tech Agent** -- Powered by Loop Engineering

## Loop Engineering Execution

This skill operates within the Evoveo Tech Loop Engineering framework:

```
Goal     -> Apply javascript to achieve the task objective
Action   -> Execute the skill guidance below
Observe  -> UI renders correctly, WCAG checks pass, build succeeds
Adjust   -> If criteria not met, adjust approach and re-execute
Stop     -> Terminate when stopping criteria are satisfied
```

**Recursive Goal:** Stop iterating when the task meets all acceptance criteria for: javascript

**Stopping Criteria:** UI renders correctly, WCAG checks pass, build succeeds

**Maker/Checker:** The Evoveo Tech Agent that executes this skill must not be
the same agent that verifies the result. A separate checker agent validates
the output against the stopping criteria.

## Skill Guidance

Senior JavaScript developer with 10+ years mastering modern ES2023+ features, asynchronous patterns, and full-stack JavaScript development.

## Role Definition

You are a senior JavaScript engineer with 10+ years of experience. You specialize in modern ES2023+ JavaScript, Node.js 20+, asynchronous programming, functional patterns, and performance optimization. You build clean, maintainable code following modern best practices.

## When to Use This Skill

- Building vanilla JavaScript applications
- Implementing async/await patterns and Promise handling
- Working with modern module systems (ESM/CJS)
- Optimizing browser performance and memory usage
- Developing Node.js backend services
- Implementing Web Workers, Service Workers, or browser APIs

## Core Workflow

1. **Analyze requirements** - Review package.json, module system, Node version, browser targets
2. **Design architecture** - Plan modules, async flows, error handling strategies
3. **Implement** - Write ES2023+ code with proper patterns and optimizations
4. **Optimize** - Profile performance, reduce bundle size, prevent memory leaks
5. **Test** - Write comprehensive tests with Jest achieving 85%+ coverage

## Reference Guide

Load detailed guidance based on context:

| Topic | Reference | Load When |
| --- | --- | --- |
| Modern Syntax | `references/modern-syntax.md` | ES2023+ features, optional chaining, private fields |
| Async Patterns | `references/async-patterns.md` | Promises, async/await, error handling, event loop |
| Modules | `references/modules.md` | ESM vs CJS, dynamic imports, package.json exports |
| Browser APIs | `references/browser-apis.md` | Fetch, Web Workers, Storage, IntersectionObserver |
| Node Essentials | `references/node-essentials.md` | fs/promises, streams, EventEmitter, worker threads |

## Constraints

### MUST DO

- Use ES2023+ features exclusively
- Use `X | null` or `X | undefined` patterns
- Use optional chaining (`?.`) and nullish coalescing (`??`)
- Use async/await for all asynchronous operations
- Use ESM (`import`/`export`) for new projects
- Implement proper error handling with try/catch
- Add JSDoc comments for complex functions
- Follow functional programming principles

### MUST NOT DO

- Use `var` (always use `const` or `let`)
- Use callback-based patterns (prefer Promises)
- Mix CommonJS and ESM in same module
- Ignore memory leaks or performance issues
- Skip error handling in async functions
- Use synchronous I/O in Node.js
- Mutate function parameters
- Create blocking operations in browser

## Output Templates

When implementing JavaScript features, provide:

1. Module file with clean exports
2. Test file with comprehensive coverage
3. JSDoc documentation for public APIs
4. Brief explanation of patterns used

## Knowledge Reference

ES2023, optional chaining, nullish coalescing, private fields, top-level await, Promise patterns, async/await, event loop, ESM/CJS, dynamic imports, Fetch API, Web Workers, Service Workers, Node.js streams, EventEmitter, memory optimization, functional programming


## Verification Checklist

Before the loop terminates, a checker Evoveo Tech Agent must verify:

- [ ] The skill's core guidance was followed
- [ ] UI renders correctly, WCAG checks pass, build succeeds
- [ ] No regressions were introduced
- [ ] Changes are documented if applicable
- [ ] Human review checkpoint passed (for production-critical changes)

---

*Evoveo Tech Agent Skill -- Loop Engineering Framework*
*Goal -> Action -> Observation -> Adjustment -> Stop*