# Security Policy

## Reporting a Vulnerability

We take the security of TestReport Forge seriously. If you believe you have
found a security vulnerability, please report it responsibly.

### How to Report

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please report vulnerabilities using one of these methods:

1. **GitHub Security Advisories (preferred):**
   - Go to the [Security tab](https://github.com/evoveotech/testreport-forge/security/advisories/new)
   - Click "Report a vulnerability"
   - Fill in the details

2. **Email:** security@evoveo.tech

### What to Include

Please include as much of the following as possible:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)
- Your contact information (if you want follow-up)

### Response Timeline

| Step | Target |
|------|--------|
| Acknowledge receipt | Within 48 hours |
| Initial assessment | Within 5 business days |
| Fix or mitigation | Within 30 days (severity dependent) |
| Public disclosure | After fix is released, coordinated with reporter |

### Scope

This policy covers:
- The `evoveo-smart-reporter` npm package
- The reporter's HTML generation and rendering
- AI failure analysis integration (API key handling)
- CI/CD workflows in this repo
- The QA Spec Kit agent skills system

### Out of Scope

- Vulnerabilities in third-party dependencies (report to upstream maintainers)
- Issues in AI provider APIs (report to Anthropic, OpenAI, or Google)
- Social engineering or phishing attacks

### Safe Harbor

We will not pursue legal action against security researchers who:
- Make a good-faith effort to avoid privacy violations, data destruction, and
  disruption of service
- Give us reasonable time to respond before public disclosure
- Do not access or modify data that does not belong to them

## Security Measures in This Repo

### For Contributors

- **Branch protection:** `main` is protected -- no direct pushes
- **PR reviews:** At least 1 review required before merge
- **CI checks:** All tests must pass before merge
- **No secrets in code:** API keys are loaded from environment variables only
- **Privacy:** Do not commit real user data, PII, or production credentials

### For Users

- **API keys:** AI analysis uses your own keys via environment variables --
  keys are never stored, logged, or transmitted to anyone except your chosen
  AI provider
- **No telemetry:** The reporter does not phone home or collect usage data
- **No external calls:** Except to your AI provider (only if you set an API key)

## Disclosure Policy

We follow **coordinated disclosure**:
1. We acknowledge the report privately
2. We develop and test a fix
3. We release the fix and publish a security advisory
4. We credit the reporter (if they want)
