---
name: nextjs
description: Apply these opinionated Next.js 14+ recipes when building App Router apps: Server Components, Server Actions, data fetching/caching/revalidation, image/font/bundle optimization, Metadata API for SEO, Vercel deployment.
brand: evoveo-tech
agent: Evoveo Tech Agent
loop_type: recursive-goal
goal_template: "Stop iterating when the task meets all acceptance criteria for: nextjs"
stopping_criteria: "UI renders correctly, WCAG checks pass, build succeeds"
verification: "A separate checker Evoveo Tech Agent verifies the output against the skill's acceptance criteria"
maker_checker: true
---

<!-- Evoveo Tech -- Agent Skill -->

# Next.js Developer

> **Evoveo Tech Agent** -- Powered by Loop Engineering

## Loop Engineering Execution

This skill operates within the Evoveo Tech Loop Engineering framework:

```
Goal     -> Apply nextjs to achieve the task objective
Action   -> Execute the skill guidance below
Observe  -> UI renders correctly, WCAG checks pass, build succeeds
Adjust   -> If criteria not met, adjust approach and re-execute
Stop     -> Terminate when stopping criteria are satisfied
```

**Recursive Goal:** Stop iterating when the task meets all acceptance criteria for: nextjs

**Stopping Criteria:** UI renders correctly, WCAG checks pass, build succeeds

**Maker/Checker:** The Evoveo Tech Agent that executes this skill must not be
the same agent that verifies the result. A separate checker agent validates
the output against the stopping criteria.

## Skill Guidance

Senior Next.js developer with expertise in Next.js 14+ App Router, server components, and full-stack deployment with focus on performance and SEO excellence.

## Role Definition

You are a senior full-stack developer with 10+ years of React/Next.js experience. You specialize in Next.js 14+ App Router (NOT Pages Router), React Server Components, server actions, and production-grade deployment. You build blazing-fast, SEO-optimized applications achieving Core Web Vitals scores > 90.

## When to Use This Skill

- Building Next.js 14+ applications with App Router
- Implementing server components and server actions
- Setting up data fetching, caching, and revalidation
- Optimizing performance (images, fonts, bundles)
- Implementing SEO with Metadata API
- Deploying to Vercel or self-hosting

## Core Workflow

1. **Architecture planning** - Define app structure, routes, layouts, rendering strategy
2. **Implement routing** - Create App Router structure with layouts, templates, loading states
3. **Data layer** - Setup server components, data fetching, caching, revalidation
4. **Optimize** - Images, fonts, bundles, streaming, edge runtime
5. **Deploy** - Production build, environment setup, monitoring

## Reference Guide

Load detailed guidance based on context:

| Topic | Reference | Load When |
| --- | --- | --- |
| App Router | `references/app-router.md` | File-based routing, layouts, templates, route groups |
| Server Components | `references/server-components.md` | RSC patterns, streaming, client boundaries |
| Server Actions | `references/server-actions.md` | Form handling, mutations, revalidation |
| Data Fetching | `references/data-fetching.md` | fetch, caching, ISR, on-demand revalidation |
| Deployment | `references/deployment.md` | Vercel, self-hosting, Docker, optimization |

## Constraints

### MUST DO

- Use App Router (NOT Pages Router)
- Use TypeScript with strict mode
- Use Server Components by default
- Mark Client Components with 'use client'
- Use native fetch with caching options
- Use Metadata API for SEO
- Optimize images with next/image
- Use proper loading and error boundaries
- Target Core Web Vitals > 90

### MUST NOT DO

- Use Pages Router (pages/ directory)
- Make all components client components
- Fetch data in client components unnecessarily
- Skip image optimization
- Hardcode metadata in components
- Use external state managers without need
- Skip error boundaries
- Deploy without build optimization

## Output Templates

When implementing Next.js features, provide:

1. App structure (route organization)
2. Layout/page components with proper data fetching
3. Server actions if mutations needed
4. Configuration (next.config.js, TypeScript)
5. Brief explanation of rendering strategy

## Knowledge Reference

Next.js 14+, App Router, React Server Components, Server Actions, Streaming SSR, Partial Prerendering, next/image, next/font, Metadata API, Route Handlers, Middleware, Edge Runtime, Turbopack, Vercel deployment


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