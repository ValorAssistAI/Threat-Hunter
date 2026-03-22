# Deployment Guide

## Overview

ArnieAI deploys to AWS using GitHub Actions + Terraform:

- **API Server** → Docker image on ECR, Fargate on ECS, behind an ALB
- **Frontend** → Vite static build, S3 + CloudFront
- **Database** → PostgreSQL (managed — RDS, Neon, Supabase, or your own)
- **Infrastructure** → Terraform with S3 remote state + DynamoDB locking

---

## Prerequisites

1. AWS account with appropriate permissions
2. GitHub repository with Actions enabled
3. Terraform state S3 bucket and DynamoDB lock table (bootstrap once):

```bash
# Run once to bootstrap Terraform remote state
./scripts/bootstrap-terraform-state.sh
```

---

## First-Time Setup

### 1. Bootstrap Terraform State

```bash
cd infra
./scripts/bootstrap-terraform-state.sh
```

This creates:
- S3 bucket: `arnievulnai-terraform-state` (versioned, encrypted)
- DynamoDB table: `arnievulnai-terraform-locks`

### 2. Set Up GitHub OIDC Trust

```bash
# Create the GitHub OIDC provider in your AWS account (once per account)
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1

# Then run Terraform — it will create the GitHub Actions IAM role
```

### 3. Provision Infrastructure

```bash
cd infra

# Copy and fill in your values
cp terraform.tfvars.example terraform.tfvars

# Initialize and apply
terraform init
terraform plan -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars
```

### 4. Configure GitHub Secrets

In your GitHub repository → Settings → Secrets and variables → Actions:

**Secrets:**

| Name | Where to get it |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | `terraform output github_actions_role_arn` |
| `AWS_TERRAFORM_ROLE_ARN` | Same role (or a separate one with broader Terraform permissions) |
| `AWS_ACCOUNT_ID` | `aws sts get-caller-identity --query Account` |
| `DATABASE_URL` | Your PostgreSQL connection string |
| `API_BASE_URL` | `https://api.arnievulnai.example.com` |
| `FRONTEND_S3_BUCKET` | `terraform output` → frontend bucket name |
| `CLOUDFRONT_DISTRIBUTION_ID` | `terraform output` → CloudFront distribution ID |

**Variables (non-secret):**

| Name | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://api.arnievulnai.example.com` |

### 5. Store Secrets in AWS Secrets Manager

```bash
# VirusTotal API key
aws secretsmanager put-secret-value \
  --secret-id arnievulnai/virustotal-api-key \
  --secret-string "YOUR_VIRUSTOTAL_KEY"

# Anthropic key (via Replit AI Integrations proxy)
aws secretsmanager put-secret-value \
  --secret-id arnievulnai/anthropic-api-key \
  --secret-string "YOUR_ANTHROPIC_KEY"
```

### 6. Push Database Schema

```bash
DATABASE_URL="..." pnpm --filter @workspace/db run push
```

### 7. Deploy

Push to `main` — all GitHub Actions workflows trigger automatically.

---

## Updating ACM Certificate

The Terraform config uses a placeholder domain (`api.arnievulnai.example.com`). Before first apply:

1. Update `aws_acm_certificate.api` in `infra/networking.tf` with your real domain
2. Add DNS validation records from the certificate to your DNS provider
3. Re-run `terraform apply`

Or use `cloudfront_default_certificate = true` for testing (HTTP only).

---

## Manual Deployment (without GitHub Actions)

### API Server

```bash
# Build
pnpm install --frozen-lockfile
pnpm --filter @workspace/api-server run build

# Docker
docker build -f artifacts/api-server/Dockerfile -t arnievulnai-api:latest .

# Push to ECR
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

docker tag arnievulnai-api:latest \
  $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/arnievulnai-api:latest
docker push \
  $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/arnievulnai-api:latest

# Force new ECS deployment
aws ecs update-service \
  --cluster arnievulnai \
  --service arnievulnai-api \
  --force-new-deployment
```

### Frontend

```bash
pnpm --filter @workspace/arnievulnai run build

aws s3 sync artifacts/arnievulnai/dist/ \
  s3://YOUR_FRONTEND_BUCKET \
  --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "index.html"

aws s3 cp artifacts/arnievulnai/dist/index.html \
  s3://YOUR_FRONTEND_BUCKET/index.html \
  --cache-control "no-cache, no-store, must-revalidate"

aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

---

## Rollback

### API Server

ECS has automatic rollback enabled via the deployment circuit breaker. To manually rollback:

```bash
# List recent task definitions
aws ecs list-task-definitions --family-prefix arnievulnai-api

# Roll back to a specific revision
aws ecs update-service \
  --cluster arnievulnai \
  --service arnievulnai-api \
  --task-definition arnievulnai-api:PREVIOUS_REVISION
```

### Database

Database migrations use `drizzle-kit push` which is additive-only (no destructive changes by default). To revert a schema change, write a migration that undoes it and push again.

---

## Monitoring

- **CloudWatch Dashboard**: `ArnieVulnAI-Security` (provisioned by Terraform)
- **ECS Service Events**: AWS Console → ECS → arnievulnai cluster → arnievulnai-api service
- **ALB Access Logs**: Disabled by default; enable in `infra/networking.tf`
- **GuardDuty/Inspector/SecurityHub findings**: Streamed to CloudWatch via EventBridge rules
