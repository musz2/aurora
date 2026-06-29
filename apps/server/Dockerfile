# Aurora.ai API — production server image.
# Build from the repo root:  docker build -f apps/server/Dockerfile -t aurora-server .
# Runs fully in mock/demo mode without any external provider credentials.

# syntax=docker/dockerfile:1

FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH"
# Prisma engines need OpenSSL at build and run time.
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

# ---------- build stage ----------
FROM base AS build
# Copy only the manifests first for better layer caching.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
# Install only the server + shared dependency graph (excludes web/desktop, so no
# Electron/Vite downloads in the API image).
RUN pnpm install --frozen-lockfile --filter @aurora/server... --filter @aurora/shared...

# Copy sources and build. The shared base tsconfig is needed by both packages'
# `extends`, otherwise tsc falls back to ES5 libs and fails.
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/server apps/server
RUN pnpm --filter @aurora/server exec prisma generate \
    && pnpm --filter @aurora/shared build \
    && pnpm --filter @aurora/server build

# ---------- runtime stage ----------
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=4000
WORKDIR /app

# Copy installed dependencies (incl. generated Prisma client) and build output.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=build /app/apps/server/package.json ./apps/server/package.json
COPY --from=build /app/apps/server/dist ./apps/server/dist
# Schema + migrations are needed for `prisma migrate deploy`.
COPY --from=build /app/apps/server/prisma ./apps/server/prisma

# The local upload dir must be writable by the non-root user (used only when S3
# is not configured). Created + owned ahead of dropping privileges.
RUN mkdir -p /app/apps/uploads && chown -R node:node /app/apps/uploads

# Run as the built-in non-root user.
USER node

EXPOSE 4000
# The server binds 0.0.0.0:$PORT and serves /api/health for health checks.
CMD ["node", "apps/server/dist/index.js"]