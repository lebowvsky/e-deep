# syntax=docker/dockerfile:1
# Caddy with both fronts built in: no Node container at runtime (D62). Build context: the repo
# root (see .dockerignore), through deploy/docker-compose.prod.yml.

# --- pnpm, without corepack (same stage as apps/api/Dockerfile) -----------------------------------
FROM node:26-alpine AS pnpm
WORKDIR /repo
COPY package.json ./
RUN npm install --global --no-fund --no-audit \
      "$(node -p "require('./package.json').packageManager")" \
  && npm cache clean --force

# --- build of web and admin ----------------------------------------------------------------------
FROM pnpm AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm fetch --store-dir /pnpm/store
COPY . .
# No VITE_* variable: the API base URL defaults to /api on the front's own origin.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --store-dir /pnpm/store \
      --filter "@e-deep/web..." --filter "@e-deep/admin..." \
  && pnpm --filter @e-deep/web run build \
  && pnpm --filter @e-deep/admin run build

# --- runtime -------------------------------------------------------------------------------------
FROM caddy:2.11-alpine
# Non-root: the official binary carries cap_net_bind_service, enough for ports 80 and 443.
RUN addgroup -S caddy && adduser -S -G caddy -H -s /sbin/nologin caddy \
  && chown -R caddy:caddy /data /config
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/web/dist /srv/web
COPY --from=build /repo/apps/admin/dist /srv/admin
USER caddy
