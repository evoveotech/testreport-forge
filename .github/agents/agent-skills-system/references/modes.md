# Mode Contracts

Read only the selected mode and any transition section needed for the current task.

## `karpathy_mode`

Use for unfamiliar algorithms, opaque systems, debugging a core mechanism, research prototypes, and teaching artifacts.

- Optimizes: comprehension, correctness of the mental model, hackability.
- Sacrifices: broad coverage, framework convenience, surface polish.
- First move: restate the task as the smallest mechanism and name its core loop.
- Required artifact: a minimal working reference path, an inspectable trace or test, and explicit material assumptions.
- Switch signal: the mechanism is explainable in one pass and comprehension is no longer the bottleneck.
- Hard no: speculative layers, forests of stubs, or abstractions that hide the critical path.

## `rauch_mode`

Use for user-facing products, onboarding, trusted product surfaces, landing pages after validation, and developer experience.

- Optimizes: UX clarity, perceived performance, product taste, strong defaults.
- Sacrifices: maximum flexibility and fastest rough draft.
- First move: map the primary journey, default path, and visible states.
- Required artifact: a previewable happy path plus empty, loading, error, and success states.
- Switch signal: trust, clarity, and perceived performance are no longer limiting adoption.
- Hard no: generic hierarchy, needless configuration, or a critical flow without complete states.

## `levels_mode`

Use for MVPs, waitlists, market tests, founder-led launches, and pre-product-market-fit work.

- Optimizes: time to demand signal, revenue, public learning, momentum.
- Sacrifices: exhaustive robustness, deep abstractions, broad polish.
- First move: name the offer, audience, CTA, and fastest public artifact that tests them.
- Required artifact: a public surface, measurable commitment event, and continue-or-kill criterion.
- Switch signal: behavior justifies hardening or polish, or the work crosses into auth, money, persistent data, or shared APIs.
- Hard no: private planning as validation, premature infrastructure, or polish before exposure.

## `swyx_mode`

Use for AI products, ecosystem research, agent tooling, reusable prompts/evals/docs, and knowledge-heavy work.

- Optimizes: learning loops, provenance, reusable artifacts, ecosystem leverage.
- Sacrifices: isolated craftsmanship and purely local optimization.
- First move: scan current authoritative sources before inventing, then preserve useful findings outside chat.
- Required artifact: a reusable asset, claim-to-source mapping, and a record of what was adopted or rejected.
- Switch signal: the learning is captured and execution, validation, or production correctness is now limiting progress.
- Hard no: unsupported synthesis, transient-only decisions, or AI features without an evaluation surface.

For research, prefer primary sources, include dates, distinguish measured evidence from internal case studies and practitioner opinion, and state bounded uncertainty.

## `theo_mode`

Use for production applications, APIs, auth, billing, persistent data, migrations, and durable shared code.

- Optimizes: maintainability, typed and validated boundaries, operational correctness.
- Sacrifices: theoretical purity and experimentation in hard-to-reverse foundations.
- First move: mark auth, billing, data, API, environment, and migration boundaries; choose the boring center.
- Required artifact: validated contracts, one working vertical slice, and clear ownership of shared state/config.
- Switch signal: risky boundaries are reliable and UX or workflow speed becomes the new bottleneck.
- Hard no: duplicated ownership, unvalidated important data, or fashionable foundations without concrete payoff.

## `amjad_mode`

Use for agent products, live environments, workflow runners, internal automation, and safely parallelizable work.

- Optimizes: run-path clarity, environment ergonomics, observability, collaboration.
- Sacrifices: minimal tool surface and single-threaded craftsmanship.
- First move: make the system runnable in one obvious way, expose logs/preview, and assign ownership.
- Required artifact: one run path, live feedback surface, durable context, and recovery or integration plan.
- Switch signal: environment friction is gone and correctness or core-mechanism understanding becomes limiting.
- Hard no: hidden setup, write conflicts, unbounded parallelism, or workflows without checkpoints and recovery.

Parallelism is conditional, not a default. Use it for independent breadth-first work or isolated noisy exploration. Prefer one writer per subsystem, explicit budgets, and summaries or artifact paths returned to the lead.

## Common Transitions

- `karpathy_mode -> theo_mode`: turn an understood reference path into durable production code.
- `levels_mode -> rauch_mode`: improve trust and conversion after demand is demonstrated.
- `swyx_mode -> amjad_mode`: operationalize a captured AI-native workflow.
- `amjad_mode -> theo_mode`: harden an agent-built flow around data and shared boundaries.
- `theo_mode -> rauch_mode`: improve experience after contracts are stable.

Avoid mode blending. When concerns overlap, keep one phase owner and apply cross-cutting safety or verification rules separately.
