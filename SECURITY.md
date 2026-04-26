# Security Policy

## Reporting a Vulnerability

If you believe you've found a security vulnerability in Prompt Version Control,
please report it privately so we can fix it before it's disclosed publicly.

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead:

- Email: `security@reaa.tech`
- Or use GitHub's [private vulnerability reporting](https://github.com/reaatech/prompt-version-control/security/advisories/new)

Please include:

- A description of the issue and its impact.
- Steps to reproduce, including a minimal proof-of-concept where possible.
- The version / commit you tested against.
- Any suggested mitigations.

We will acknowledge receipt within 2 business days, give you an estimated
timeline for a fix, and credit you in the release notes (unless you prefer
otherwise).

## Supported Versions

Pre-1.0 releases: only the latest minor receives security fixes. Once 1.0
ships, the latest two minor releases will be supported.

## Hardening Guidelines

When deploying PVC, you should at minimum:

- Set `API_KEY_PEPPER` so API keys are stored as HMAC-SHA-256 instead of
  plain SHA-256.
- Set `EVAL_WEBHOOK_SECRET` so inbound eval webhooks are HMAC-verified.
- Set `CORS_ALLOWED_ORIGINS` to your specific frontend origins.
- Leave `WEBHOOK_ALLOW_PRIVATE` unset — outbound webhook URLs that resolve to
  private/loopback addresses are blocked by default to prevent SSRF.
- Front the server with TLS termination (the bundled Helm ingress assumes this).
- Run the container as the non-root user it ships with (the K8s manifests do).
