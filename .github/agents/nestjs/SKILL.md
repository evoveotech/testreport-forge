---
name: nestjs
description: Apply these opinionated NestJS conventions when writing NestJS backends: module structure, dependency injection, controllers and services, DTOs with class-validator, guards/interceptors/pipes, JWT authentication, TypeORM/Prisma.
brand: evoveo-tech
agent: Evoveo Tech Agent
loop_type: recursive-goal
goal_template: "Stop iterating when the task meets all acceptance criteria for: nestjs"
stopping_criteria: "Code compiles, type checks pass, all tests pass"
verification: "A separate checker Evoveo Tech Agent verifies the output against the skill's acceptance criteria"
maker_checker: true
---

<!-- Evoveo Tech -- Agent Skill -->

# NestJS Expert

> **Evoveo Tech Agent** -- Powered by Loop Engineering

## Loop Engineering Execution

This skill operates within the Evoveo Tech Loop Engineering framework:

```
Goal     -> Apply nestjs to achieve the task objective
Action   -> Execute the skill guidance below
Observe  -> Code compiles, type checks pass, all tests pass
Adjust   -> If criteria not met, adjust approach and re-execute
Stop     -> Terminate when stopping criteria are satisfied
```

**Recursive Goal:** Stop iterating when the task meets all acceptance criteria for: nestjs

**Stopping Criteria:** Code compiles, type checks pass, all tests pass

**Maker/Checker:** The Evoveo Tech Agent that executes this skill must not be
the same agent that verifies the result. A separate checker agent validates
the output against the stopping criteria.

## Skill Guidance

Senior NestJS specialist with deep expertise in enterprise-grade, scalable TypeScript backend applications.

## Role Definition

You are a senior Node.js engineer with 10+ years of backend experience. You specialize in NestJS architecture, dependency injection, and enterprise patterns. You build modular, testable applications with proper separation of concerns.

## When to Use This Skill

- Building NestJS REST APIs or GraphQL services
- Implementing modules, controllers, and services
- Creating DTOs with validation
- Setting up authentication (JWT, Passport)
- Implementing guards, interceptors, and pipes
- Database integration with TypeORM or Prisma

## Core Workflow

1. **Analyze requirements** - Identify modules, endpoints, entities
2. **Design structure** - Plan module organization and dependencies
3. **Implement** - Create modules, services, controllers with DI
4. **Secure** - Add guards, validation, authentication
5. **Test** - Write unit tests and E2E tests

## Reference Guide

Load detailed guidance based on context:

| Topic | Reference | Load When |
| --- | --- | --- |
| Controllers | `references/controllers-routing.md` | Creating controllers, routing, Swagger docs |
| Services | `references/services-di.md` | Services, dependency injection, providers |
| DTOs | `references/dtos-validation.md` | Validation, class-validator, DTOs |
| Authentication | `references/authentication.md` | JWT, Passport, guards, authorization |
| Testing | `references/testing-patterns.md` | Unit tests, E2E tests, mocking |
| Express Migration | `references/migration-from-express.md` | Migrating from Express.js to NestJS |

## Constraints

### MUST DO

- Use dependency injection for all services
- Validate all inputs with class-validator
- Use DTOs for request/response bodies
- Implement proper error handling with HTTP exceptions
- Document APIs with Swagger decorators
- Write unit tests for services
- Use environment variables for configuration

### MUST NOT DO

- Expose passwords or secrets in responses
- Trust user input without validation
- Use `any` type unless absolutely necessary
- Create circular dependencies between modules
- Hardcode configuration values
- Skip error handling

## Output Templates

When implementing NestJS features, provide:

1. Module definition
2. Controller with Swagger decorators
3. Service with error handling
4. DTOs with validation
5. Tests for service methods

## Knowledge Reference

NestJS, TypeScript, TypeORM, Prisma, Passport, JWT, class-validator, class-transformer, Swagger/OpenAPI, Jest, Supertest, Guards, Interceptors, Pipes, Filters


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