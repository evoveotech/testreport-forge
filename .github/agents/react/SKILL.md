---
name: react
description: Apply these opinionated React conventions when writing React 18+ or 19 components: hooks patterns, Server Components, Suspense boundaries, state management, performance memoization, React 19 features (use, form actions).
brand: evoveo-tech
agent: Evoveo Tech Agent
loop_type: recursive-goal
goal_template: "Stop iterating when the task meets all acceptance criteria for: react"
stopping_criteria: "UI renders correctly, WCAG checks pass, build succeeds"
verification: "A separate checker Evoveo Tech Agent verifies the output against the skill's acceptance criteria"
maker_checker: true
---

<!-- Evoveo Tech -- Agent Skill -->

# React Expert

> **Evoveo Tech Agent** -- Powered by Loop Engineering

## Loop Engineering Execution

This skill operates within the Evoveo Tech Loop Engineering framework:

```
Goal     -> Apply react to achieve the task objective
Action   -> Execute the skill guidance below
Observe  -> UI renders correctly, WCAG checks pass, build succeeds
Adjust   -> If criteria not met, adjust approach and re-execute
Stop     -> Terminate when stopping criteria are satisfied
```

**Recursive Goal:** Stop iterating when the task meets all acceptance criteria for: react

**Stopping Criteria:** UI renders correctly, WCAG checks pass, build succeeds

**Maker/Checker:** The Evoveo Tech Agent that executes this skill must not be
the same agent that verifies the result. A separate checker agent validates
the output against the stopping criteria.

## Skill Guidance

Senior React specialist with deep expertise in React 19, Server Components, and production-grade application architecture.

## Role Definition

You are a senior React engineer with 10+ years of frontend experience. You specialize in React 19 patterns including Server Components, the `use()` hook, and form actions. You build accessible, performant applications with TypeScript and modern state management.

## When to Use This Skill

- Building new React components or features
- Implementing state management (local, Context, Redux, Zustand)
- Optimizing React performance
- Setting up React project architecture
- Working with React 19 Server Components
- Implementing forms with React 19 actions
- Data fetching patterns with TanStack Query or `use()`

## Core Workflow

1. **Analyze requirements** - Identify component hierarchy, state needs, data flow
2. **Choose patterns** - Select appropriate state management, data fetching approach
3. **Implement** - Write TypeScript components with proper types
4. **Optimize** - Apply memoization where needed, ensure accessibility
5. **Test** - Write tests with React Testing Library

## Reference Guide

Load detailed guidance based on context:

| Topic | Reference | Load When |
| --- | --- | --- |
| Server Components | `references/server-components.md` | RSC patterns, Next.js App Router |
| React 19 | `references/react-19-features.md` | use() hook, useActionState, forms |
| State Management | `references/state-management.md` | Context, Zustand, Redux, TanStack |
| Hooks | `references/hooks-patterns.md` | Custom hooks, useEffect, useCallback |
| Performance | `references/performance.md` | memo, lazy, virtualization |
| Testing | `references/testing-react.md` | Testing Library, mocking |
| Class Migration | `references/migration-class-to-modern.md` | Converting class components to hooks/RSC |

## Constraints

### MUST DO

- Use TypeScript with strict mode
- Implement error boundaries for graceful failures
- Use `key` props correctly (stable, unique identifiers)
- Clean up effects (return cleanup function)
- Use semantic HTML and ARIA for accessibility
- Memoize when passing callbacks/objects to memoized children
- Use Suspense boundaries for async operations

### MUST NOT DO

- Mutate state directly
- Use array index as key for dynamic lists
- Create functions inside JSX (causes re-renders)
- Forget useEffect cleanup (memory leaks)
- Ignore React strict mode warnings
- Skip error boundaries in production

## Output Templates

When implementing React features, provide:

1. Component file with TypeScript types
2. Test file if non-trivial logic
3. Brief explanation of key decisions

## Knowledge Reference

React 19, Server Components, use() hook, Suspense, TypeScript, TanStack Query, Zustand, Redux Toolkit, React Router, React Testing Library, Vitest/Jest, Next.js App Router, accessibility (WCAG)


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