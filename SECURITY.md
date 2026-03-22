# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| `main` branch | Yes |
| All other branches | No |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

### Responsible Disclosure

1. Email `security@your-org.example.com` with:
   - A description of the vulnerability
   - Steps to reproduce
   - Potential impact assessment
   - Any suggested mitigations

2. You will receive an acknowledgement within **48 hours**.

3. We aim to provide a fix or mitigation plan within **7 business days** for Critical/High severity issues.

4. Once a fix is deployed, we will credit you in the release notes (unless you prefer to remain anonymous).

### Scope

The following are **in scope** for responsible disclosure:

- Bypass of the agent scope-gating mechanism (allowing tool calls against out-of-scope resources)
- AWS credential exposure or unauthorized cross-account access
- SQL injection or database access control issues
- Authentication/authorization bypasses in the API
- SSE stream data leakage between sessions
- XSS vulnerabilities in the frontend security dashboard

The following are **out of scope**:

- Social engineering attacks
- Physical security
- Denial-of-service attacks
- Issues in third-party dependencies that are already publicly known (check `pnpm audit` first)

## Security Hardening Notes

### Agent Scope Enforcement

Every tool call made by the autonomous agent passes through `artifacts/api-server/src/lib/scope.ts` before execution. Blocked calls are:

1. Returned to Claude as an error (explaining the scope violation)
2. Logged to the `tool_invocations` database table with `scopeAllowed: false`
3. Streamed to the frontend as a `tool_blocked` SSE event

### AWS IAM Least Privilege

The ECS task role (`arnievulnai-ecs-task`) is restricted to:
- **Read-only** access to GuardDuty, Inspector v2, Security Hub
- **Read/write** to the `arnievulnai-artifacts` S3 bucket only
- **Read/write** to `/arnievulnai/*` CloudWatch log groups only
- **Read** from specific Secrets Manager secrets

The GitHub Actions deploy role uses OIDC (no long-lived AWS access keys stored in GitHub).

### Secrets Management

- All secrets are stored in AWS Secrets Manager and injected into ECS tasks at runtime
- The VirusTotal API key is fetched at runtime from Secrets Manager, not bundled in the image
- The `.env.example` file documents all required variables without any real values
- The `.gitignore` excludes `.env*` files and `infra/secrets.auto.tfvars`
