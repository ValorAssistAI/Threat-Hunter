# Architecture

## System Overview

ArnieAI is a full-stack security operations platform. A React frontend communicates with an Express API server. The API integrates with AWS security services (GuardDuty, Inspector, Security Hub, S3, CloudWatch) and hosts an autonomous agent loop powered by Claude Sonnet with extended thinking.

## Component Map

```
Browser
  └── React + Vite (SOC dark theme, Tailwind + Radix UI)
        │  React Query for data fetching
        │  fetch() + ReadableStream for SSE agent streams
        │
        └── Express API (Node.js, esbuild bundle, Fargate)
              │
              ├── REST Routes
              │     ├── /dashboard     → GuardDuty + Inspector + SecurityHub summary
              │     ├── /guardduty     → Detector + findings (SDK)
              │     ├── /inspector     → CVE findings (SDK)
              │     ├── /securityhub   → Aggregated findings (SDK)
              │     ├── /artifacts     → S3 browser + presigned URLs
              │     ├── /logs          → CloudWatch log events
              │     ├── /threatintel   → VirusTotal lookup (Secrets Manager key)
              │     └── /scans         → Scan result metadata
              │
              └── Agent Routes (/agent/sessions/*)
                    │
                    ├── POST /run → SSE stream (autonomous loop)
                    └── POST /message → SSE stream (interactive)
                          │
                          └── Agentic Loop (up to 20 iterations)
                                │
                                ├── Claude Sonnet 4.6 (Anthropic SDK)
                                │     extended thinking: 10k budget tokens
                                │     max_tokens: 16k
                                │
                                ├── Scope Validator (lib/scope.ts)
                                │     checks every tool_use block before execution
                                │     blocks and logs violations
                                │
                                └── Tool Executor (lib/agent-tools.ts)
                                      guardduty_list_findings
                                      inspector_list_findings
                                      securityhub_list_findings
                                      s3_list_files / s3_get_file
                                      cloudwatch_list_groups / cloudwatch_get_logs
                                      virustotal_lookup
                                      dashboard_summary
```

## Data Flow — Autonomous Agent Run

```
Client                 API Server              Claude              AWS
  │                       │                      │                  │
  │ POST /run             │                      │                  │
  │──────────────────────►│                      │                  │
  │                       │ create conversation  │                  │
  │                       │ build system prompt  │                  │
  │◄──── SSE: "started" ──│                      │                  │
  │                       │ messages.create() ───►│                  │
  │                       │                      │ (thinks...)      │
  │◄── SSE: thinking_block│◄─────────────────────│                  │
  │                       │                      │ tool_use:        │
  │                       │                      │ guardduty_list   │
  │                       │◄─────────────────────│                  │
  │◄── SSE: tool_call ────│                      │                  │
  │                       │ checkScope()         │                  │
  │                       │──if allowed──────────────────────────► │
  │                       │◄─────────────────────────── findings ──│
  │◄── SSE: tool_result ──│                      │                  │
  │                       │ tool_result ─────────►│                  │
  │                       │   (loop continues)   │                  │
  │                       │ ...                  │                  │
  │                       │                      │ stop_reason:     │
  │                       │                      │ end_turn         │
  │◄── SSE: text ─────────│◄─────────────────────│                  │
  │◄── SSE: "done" ───────│                      │                  │
```

## Scope Gating

Every tool call the agent makes is validated before execution:

```typescript
checkScope(toolName, input, { inTargets, outTargets, conditions })
  → { allowed: boolean, reason: string }
```

Validation rules (in priority order):
1. If the target matches anything in `outTargets` → **BLOCK**
2. If the target matches anything in `inTargets` → **ALLOW**
3. If `inTargets` is non-empty and no match → **BLOCK**
4. If no targets extracted from input (read-only AWS tool) → check if AWS account is in scope

Blocked calls are saved to the `tool_invocations` table with `scope_allowed = false` and streamed to the browser as `tool_blocked` SSE events.

## Database Schema

```sql
conversations     id, title, created_at
messages          id, conversation_id (FK), role, content, created_at
agent_sessions    id, name, status, conversation_id (FK),
                  scope_in_targets (JSON), scope_out_targets (JSON),
                  conditions, objectives, created_at, updated_at
tool_invocations  id, session_id (FK), tool_name, tool_input (JSON),
                  tool_output (JSON), scope_allowed, scope_reason, created_at
```

## AWS Infrastructure (Terraform)

```
VPC (10.0.0.0/16)
  ├── Public Subnets (×2, multi-AZ)
  │     └── ALB → HTTPS 443 → ECS tasks
  ├── Private Subnets (×2, multi-AZ)
  │     └── ECS Fargate tasks (api-server)
  └── NAT Gateway (outbound for VirusTotal, Anthropic)

ECR       → arnievulnai-api image repository
ECS       → arnievulnai cluster → arnievulnai-api service (Fargate)
S3        → arnievulnai-artifacts (reports, scans, audit, samples, threat-intel)
S3        → arnievulnai-frontend (CloudFront OAC)
CloudFront → SPA distribution with S3 OAC
GuardDuty → detector with S3 + malware protection
Inspector → EC2 + ECR + Lambda scanning
SecurityHub → AWS Foundational + CIS 1.2 standards
CloudWatch → 5 log groups (/arnievulnai/*)
Secrets Manager → virustotal key, db url, anthropic key
IAM → ecs-task role (read AWS security services), ecs-execution role, github-actions OIDC role
```

## Technology Choices

| Layer | Technology | Reason |
|---|---|---|
| Frontend | React 19 + Vite 7 + Tailwind 4 | Fast, type-safe, excellent DX |
| UI Components | Radix UI + shadcn/ui | Accessible, unstyled, composable |
| API | Express 5 + TypeScript | Familiar, flexible, pnpm monorepo |
| Build | esbuild (single-file bundle) | Fast, tree-shakes AWS SDK effectively |
| DB ORM | Drizzle + PostgreSQL | Type-safe, lightweight, great migrations |
| AI | Anthropic Claude Sonnet 4.6 | Extended thinking, strong code+security reasoning |
| Codegen | Orval (OpenAPI → React Query + Zod) | Single source of truth for all API types |
| Infra | Terraform | Declarative, reproducible AWS provisioning |
| CI/CD | GitHub Actions | Native, OIDC, generous free tier |
| Container | Docker (esbuild output) | Self-contained, small runtime stage |
