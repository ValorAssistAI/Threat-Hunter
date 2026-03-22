# Contributing to ArnieAI Vulnerability Agent

Thank you for contributing. This document explains how to get set up and what we expect from contributions.

## Development Setup

See the [Quick Start](README.md#quick-start-local-development) section in the README.

## Branching Strategy

| Branch | Purpose |
|---|---|
| `main` | Production-ready code. Protected — PRs only. |
| `develop` | Integration branch for features. |
| `feature/<name>` | New features |
| `fix/<name>` | Bug fixes |
| `infra/<name>` | Infrastructure / Terraform changes |
| `security/<name>` | Security fixes |

## Pull Request Process

1. Branch from `develop` (or `main` for hotfixes)
2. Make your changes following the standards below
3. Run `pnpm run typecheck` — zero errors required
4. If you changed `openapi.yaml`, run codegen and commit the generated files
5. Fill in the PR template completely
6. Request review from a CODEOWNER

## Code Standards

### TypeScript

- Strict mode is enabled — no `any` without a comment explaining why
- No `console.log` in committed code — use the `pino` logger in the API
- All new API routes must have corresponding OpenAPI spec entries

### OpenAPI Codegen Rule

**Never edit files in `lib/api-client-react/` or `lib/api-zod/` directly.**

These are generated from `lib/api-spec/openapi.yaml`. The CI `codegen-check` job will fail if generated files diverge from the spec.

Workflow:
```bash
# 1. Edit lib/api-spec/openapi.yaml
# 2. Run codegen
pnpm --filter @workspace/api-spec run codegen
# 3. Commit both the spec and the generated files
```

### Agent Tools

When adding a new agent tool:

1. Add it to `AGENT_TOOLS` in `lib/agent-tools.ts` with a clear, detailed `description` — Claude uses this to decide when to call it
2. Add the execution case to `executeTool()`
3. Update `checkScope()` in `lib/scope.ts` if the tool touches a resource type that needs scope validation
4. Update the OpenAPI spec if you're adding new REST endpoints

### Terraform

- Run `terraform fmt` before committing
- All new resources must use the `default_tags` from the AWS provider
- No hardcoded account IDs or region strings — use `var.aws_account_id` and `var.aws_region`
- Sensitive variables must be marked `sensitive = true`

## Commit Messages

Format: `type(scope): description`

Types: `feat`, `fix`, `docs`, `infra`, `security`, `refactor`, `ci`, `chore`

Examples:
```
feat(agent): add nmap port scan tool with scope validation
fix(api): handle empty GuardDuty findings list
infra(ecs): increase task memory to 2048 MiB
security(scope): tighten CIDR matching in scope checker
ci(deploy): add smoke test after ECS service stabilizes
```
