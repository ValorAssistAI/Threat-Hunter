# ArnieAI Vulnerability Agent

An autonomous AI-powered security operations dashboard that integrates with AWS infrastructure and uses Claude Sonnet with extended thinking to perform scope-gated vulnerability analysis, threat intelligence correlation, and autonomous security assessments.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ArnieAI Platform                             │
│                                                                     │
│  ┌──────────────┐    ┌──────────────────────────────────────────┐  │
│  │   Frontend   │    │              API Server                   │  │
│  │  React+Vite  │◄──►│         Express + TypeScript              │  │
│  │  Dark SOC UI │    │                                          │  │
│  └──────────────┘    │  ┌─────────────┐  ┌──────────────────┐  │  │
│                      │  │ Agent Loop  │  │  REST Endpoints   │  │  │
│                      │  │ Claude      │  │  GuardDuty        │  │  │
│                      │  │ Sonnet 4.6  │  │  Inspector v2     │  │  │
│                      │  │ Extended    │  │  Security Hub     │  │  │
│                      │  │ Thinking    │  │  S3 Artifacts     │  │  │
│                      │  │ SSE Stream  │  │  CloudWatch Logs  │  │  │
│                      │  │ Scope Gate  │  │  VirusTotal IOC   │  │  │
│                      │  └──────┬──────┘  └──────────────────┘  │  │
│                      └─────────│────────────────────────────────┘  │
└────────────────────────────────│────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────────────────┐
                    │            AWS (us-east-1)           │
                    │  GuardDuty · Inspector v2            │
                    │  Security Hub · S3 · CloudWatch      │
                    │  Secrets Manager · ECR · ECS         │
                    └─────────────────────────────────────┘
```

### Monorepo Structure

```
.
├── artifacts/
│   ├── api-server/          # Express API + agent loop (Node.js, esbuild)
│   └── arnievulnai/         # React + Vite security dashboard (SOC dark theme)
├── lib/
│   ├── api-spec/            # OpenAPI 3.1 spec + Orval codegen config
│   ├── api-client-react/    # Generated React Query hooks (from codegen)
│   ├── api-zod/             # Generated Zod validation schemas (from codegen)
│   ├── db/                  # Drizzle ORM schema + PostgreSQL client
│   └── integrations-anthropic-ai/  # Anthropic SDK client (Replit proxy)
├── infra/                   # Terraform — full AWS infrastructure
├── .github/
│   ├── workflows/           # CI, deploy-api, deploy-web, security-scan, infra
│   └── ISSUE_TEMPLATE/
└── scripts/                 # Bootstrap and utility scripts
```

---

## Features

| Feature | Details |
|---|---|
| **Autonomous Agent** | Claude Sonnet 4.6 with extended thinking, up to 20-iteration agentic loops |
| **Scope Gating** | Every tool call validated against in-scope/out-of-scope targets before execution |
| **GuardDuty** | Real-time threat detection findings (EC2, S3, IAM, network anomalies) |
| **Inspector v2** | CVE findings with CVSS scores across EC2, ECR, Lambda |
| **Security Hub** | Aggregated findings from all connected security services |
| **VirusTotal** | IOC enrichment — file hashes, IPs, domains |
| **S3 Artifacts** | Browse/download reports, scan results, samples, threat intel |
| **CloudWatch** | Audit and tool-invocation log streaming |
| **SSE Streaming** | Real-time agent thoughts, tool calls, and results in the browser |
| **PostgreSQL** | Persistent sessions, conversations, messages, and tool invocation audit log |

---

## Quick Start (Local Development)

### Prerequisites

- Node.js 22+
- pnpm 10+
- Docker + Docker Compose (for containerized dev)
- AWS credentials with read access to GuardDuty, Inspector, Security Hub, S3, CloudWatch

### 1. Clone and install

```bash
git clone https://github.com/your-org/arnievulnai.git
cd arnievulnai
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — fill in AWS credentials and Anthropic proxy keys
```

### 3. Push database schema

```bash
pnpm --filter @workspace/db run push
```

### 4. Start development servers

```bash
# Terminal 1 — API server (port 8080)
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Frontend (port determined by Vite / PORT env)
pnpm --filter @workspace/arnievulnai run dev
```

### 5. Or run with Docker Compose

```bash
# Build frontend first
pnpm --filter @workspace/arnievulnai run build

# Start everything
docker compose up --build
# API: http://localhost:8080
# Web: http://localhost:3000
```

---

## Development Workflow

### OpenAPI & Codegen

All API types flow from a single source of truth:

```
lib/api-spec/openapi.yaml
        │
        ▼ (pnpm --filter @workspace/api-spec run codegen)
        │
        ├── lib/api-client-react/  (React Query hooks, auto-generated)
        └── lib/api-zod/           (Zod validation schemas, auto-generated)
```

**Never edit generated files directly.** Update `openapi.yaml` and run codegen.

### Adding a New Agent Tool

1. Add the tool definition to `artifacts/api-server/src/lib/agent-tools.ts` — both the `AGENT_TOOLS` array (tool spec for Claude) and the `executeTool` switch case (execution logic)
2. Add scope validation logic to `artifacts/api-server/src/lib/scope.ts` if the tool touches a new resource type
3. The agent loop in `artifacts/api-server/src/routes/agent.ts` will automatically call your tool when Claude decides to use it

### Database Schema Changes

```bash
# Edit lib/db/src/schema/*.ts
# Then push:
pnpm --filter @workspace/db run push
```

---

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the full deployment guide.

### GitHub Secrets Required

| Secret | Description |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | IAM role ARN for GitHub Actions OIDC |
| `AWS_TERRAFORM_ROLE_ARN` | IAM role ARN for Terraform |
| `AWS_ACCOUNT_ID` | AWS account ID |
| `DATABASE_URL` | PostgreSQL connection string |
| `API_BASE_URL` | Public API URL (for smoke tests) |
| `FRONTEND_S3_BUCKET` | S3 bucket for frontend assets |
| `CLOUDFRONT_DISTRIBUTION_ID` | CloudFront distribution for cache invalidation |

### GitHub Variables (non-secret)

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Public API URL injected at frontend build time |

---

## CI/CD Pipeline

```
push to main
    │
    ├── ci.yml ─────────── typecheck + build-api + build-web + codegen-check
    │
    ├── deploy-api.yml ─── Docker build → ECR push → ECS deploy (with rollback)
    │        │
    │        └── db-migrate.yml (called before deploy)
    │
    ├── deploy-web.yml ─── Vite build → S3 sync → CloudFront invalidation
    │
    ├── infra.yml ─────── Terraform plan (on PR) / apply (on merge)
    │
    └── security-scan.yml ─ CodeQL + Trivy FS + Trivy image + pnpm audit
```

---

## Security

See [SECURITY.md](SECURITY.md) for the vulnerability disclosure policy.

Key security properties:
- **Scope enforcement** — agent tool calls are blocked before execution if the target is out of scope; every block is logged
- **Read-only AWS** — the ECS task role only has read permissions on GuardDuty, Inspector, Security Hub; write access is limited to its own S3 bucket and CloudWatch log groups
- **No hardcoded secrets** — all credentials via environment variables or AWS Secrets Manager
- **OIDC** — GitHub Actions authenticates to AWS via OIDC (no long-lived access keys in GitHub)
- **Least privilege** — IAM roles scoped to exactly what each component needs

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
