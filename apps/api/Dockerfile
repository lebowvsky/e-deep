# syntax=docker/dockerfile:1
# Production image of the API. Build context: the repo root (see .dockerignore), e.g.
#   docker build -f apps/api/Dockerfile -t e-deep-api .
# or through deploy/docker-compose.prod.yml (ARCHITECTURE.md §12).

# --- pnpm, without corepack (no longer shipped with Node >= 25) ---------------------------------
FROM node:26-alpine AS pnpm
WORKDIR /repo
COPY package.json ./
# The exact version of the root `packageManager` field, installed with the npm shipped by Node.
RUN npm install --global --no-fund --no-audit \
      "$(node -p "require('./package.json').packageManager")" \
  && npm cache clean --force

# --- build ---------------------------------------------------------------------------------------
FROM pnpm AS build
# Dependencies first: this layer only changes with the lockfile.
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm fetch --store-dir /pnpm/store
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --store-dir /pnpm/store --filter "@e-deep/api..." \
  && pnpm --filter @e-deep/api run build \
  # Not --offline: deploy re-checks the lockfile against the supply-chain policy
  # (minimumReleaseAge), which reads registry metadata. Packages still come from the store.
  && pnpm --filter @e-deep/api deploy --prod --store-dir /pnpm/store /out

# --- runtime -------------------------------------------------------------------------------------
FROM node:26-alpine AS runtime
ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false
WORKDIR /app
# `dist` (compiled code, migrations, password list), production node_modules, package.json.
# No pnpm, no sources, no devDependencies: @e-deep/shared is types only, erased at build (§6).
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "dist/main.js"]
