FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10 --activate

# --- Builder stage ---
FROM base AS builder
WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY lib/db/package.json ./lib/db/
COPY lib/api-spec/package.json ./lib/api-spec/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/integrations/package.json ./lib/integrations/ 2>/dev/null || true
COPY lib/integrations-anthropic-ai/package.json ./lib/integrations-anthropic-ai/ 2>/dev/null || true
COPY artifacts/api-server/package.json ./artifacts/api-server/

# Install all workspace deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Copy all source
COPY tsconfig.base.json tsconfig.json ./
COPY lib/ ./lib/
COPY artifacts/api-server/ ./artifacts/api-server/

# Build
RUN pnpm --filter @workspace/api-server run build

# --- Runtime stage ---
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Only copy the bundled dist (esbuild produces self-contained output)
COPY --from=builder /app/artifacts/api-server/dist ./dist

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
