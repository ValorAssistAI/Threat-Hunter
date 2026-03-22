#!/usr/bin/env bash
# setup-dev.sh
# One-shot local development setup for ArnieAI Vulnerability Agent.
# Run this after cloning the repo.

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

step() { echo -e "\n${CYAN}==> $1${NC}"; }
ok()   { echo -e "${GREEN}    ✓ $1${NC}"; }
warn() { echo -e "${YELLOW}    ⚠ $1${NC}"; }

step "Checking prerequisites"

command -v node >/dev/null 2>&1 || { echo "node not found — install Node.js 22+"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "pnpm not found — run: npm i -g pnpm"; exit 1; }
NODE_VER=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
[ "$NODE_VER" -ge 20 ] || { warn "Node.js $NODE_VER detected — recommend 22+"; }
ok "Node.js $(node --version)"
ok "pnpm $(pnpm --version)"

step "Installing dependencies"
pnpm install --frozen-lockfile
ok "Dependencies installed"

step "Setting up environment"
if [ ! -f .env ]; then
  cp .env.example .env
  warn ".env created from .env.example — fill in your credentials"
else
  ok ".env already exists"
fi

step "Running OpenAPI codegen"
pnpm --filter @workspace/api-spec run codegen
ok "Codegen complete"

step "Pushing database schema"
if [ -n "${DATABASE_URL:-}" ]; then
  pnpm --filter @workspace/db run push
  ok "Schema pushed to database"
else
  warn "DATABASE_URL not set — skipping schema push. Set it in .env and re-run."
fi

step "Verifying build"
pnpm --filter @workspace/api-server run build
ok "API server builds successfully"

echo ""
echo -e "${GREEN}==> Setup complete!${NC}"
echo ""
echo "Start development:"
echo "  Terminal 1: pnpm --filter @workspace/api-server run dev"
echo "  Terminal 2: pnpm --filter @workspace/arnievulnai run dev"
echo ""
echo "Or with Docker Compose:"
echo "  pnpm --filter @workspace/arnievulnai run build"
echo "  docker compose up --build"
