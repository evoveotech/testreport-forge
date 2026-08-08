## Privacy & Security Checklist

Before this PR can be merged, confirm the following:

- [ ] **No secrets committed** -- no API keys, passwords, tokens, or credentials in the code
- [ ] **No PII** -- no real user data, emails, names, or personal information
- [ ] **No production data** -- no real test results, screenshots, or traces from production systems
- [ ] **Environment variables only** -- any new secrets use env vars, not hardcoded values
- [ ] **No telemetry added** -- no new external calls, analytics, or phone-home behavior
- [ ] **Dependencies are safe** -- any new dependencies are from trusted sources and pinned

## Description

<!-- What does this PR do? Why is it needed? -->

## Type of Change

- [ ] Bug fix (non-breaking)
- [ ] New feature (non-breaking)
- [ ] Breaking change
- [ ] Documentation
- [ ] Test improvement
- [ ] Security fix

## Testing

- [ ] Tests pass locally (`npm test`)
- [ ] Lint passes (`npm run lint` or equivalent)
- [ ] Build succeeds (`npm run build`)
- [ ] New tests added for new functionality

## Loop Engineering (for agent-assisted PRs)

If this PR was created with AI agent assistance:

- [ ] **Goal defined** -- the recursive goal and stopping criteria were stated
- [ ] **Maker/Checker** -- a separate checker verified the output
- [ ] **Human review** -- a human reviewed and understood the changes
- [ ] **No comprehension debt** -- the human understands what was generated

## Related Issues

<!-- Link to any related issues: Fixes #123, Closes #456 -->
