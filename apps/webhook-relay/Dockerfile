# ─────────────────────────────────────────────────
# Webhook Relay — Multi-stage Docker build
# Works with Railway, Fly.io, Render, and any
# container platform that supports Dockerfiles.
# ─────────────────────────────────────────────────

# --- Stage 1: Build ---
FROM node:24-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace root files needed for pnpm install
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy the relay app and its workspace dependencies
COPY apps/webhook-relay/ apps/webhook-relay/
COPY packages/integrations/ packages/integrations/
COPY packages/integration-sdk/ packages/integration-sdk/
COPY packages/types/ packages/types/
COPY packages/utils/ packages/utils/
COPY packages/tsconfig/ packages/tsconfig/

# Install all dependencies (workspace-aware)
RUN pnpm install --frozen-lockfile

# Build the standalone bundle
RUN pnpm --filter @radarboard/apphook-relay run build:standalone

# --- Stage 2: Runtime ---
FROM node:24-alpine AS runtime

WORKDIR /app

# Copy only the built artifact — no node_modules needed at runtime
COPY --from=builder /app/apps/webhook-relay/dist/server.js ./server.js

ENV NODE_ENV=production
ENV PORT=8787

EXPOSE 8787

CMD ["node", "server.js"]
