# Contributing to TestReport Forge

Thanks for your interest in helping the global testing community engineer better
reports with AI. This is a community-first project — every contribution matters.

## Ways to contribute

- **Templates** — add or improve a report template in `templates/` (any language).
- **Prompts** — share a tested AI prompt in `prompts/` with notes on when it works
  and where it fails.
- **Examples** — contribute an anonymized, real-world-inspired example report in
  `examples/`.
- **Schemas** — propose or refine a machine-readable report schema in `schemas/`.
- **Docs** — write or improve a guide in `docs/`.
- **Issues** — report gaps, request templates, or start a discussion.

## Before you contribute

1. Read the [Code of Conduct](CODE_OF_CONDUCT.md). Be kind and inclusive.
2. Check existing issues and PRs to avoid duplicate work.
3. Open an issue for anything larger than a small fix so we can align first.

## Pull request basics

1. Fork the repo and create a branch from `main`:
   `git checkout -b feat/your-short-description`
2. Keep changes focused — one concern per PR.
3. If you add a template, prompt, or schema, follow the naming conventions in
   the relevant folder's `README.md` (or propose one if none exists yet).
4. Write a clear PR description: what, why, and how to review.
5. Be responsive to review feedback.

## Naming conventions (initial)

- Use `kebab-case` for file names.
- For locale-specific content, append the language code:
  `bug-report-summary.en.md`, `bug-report-summary.es.md`.
- Tag prompts with the model family they were tested on, e.g.
  `test-summary-draft.gpt.md`, `test-summary-draft.claude.md`.

## Anonymization

Never include real customer names, URLs, credentials, or identifying data in
examples or prompts. Replace with clearly fake placeholders
(`Acme Corp`, `example.com`, `user_12345`).

## License

By contributing, you agree your contributions are licensed under the
[MIT License](LICENSE).
