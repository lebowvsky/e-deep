# E-Deep

Carnet de plongée numérique : saisie post-plongée, historique, carte.
Monorepo pnpm : API NestJS, front plongeur React (`apps/web`), backoffice React + shadcn/ui
(`apps/admin`).

Architecture, conventions et décisions : voir [ARCHITECTURE.md](./ARCHITECTURE.md).

## Prérequis

- **Node.js 26** (LTS, voir `.nvmrc`)
- **pnpm 12.18** (version épinglée dans `packageManager`)
- **Docker** avec Docker Compose v2

## Installation

```bash
pnpm install

# Variables d'environnement : copier les exemples, puis changer le mot de passe DB
cp .env.example .env                       # docker compose (POSTGRES_*)
cp apps/api/.env.example apps/api/.env     # API : DATABASE_PASSWORD = POSTGRES_PASSWORD
cp apps/web/.env.example apps/web/.env
cp apps/admin/.env.example apps/admin/.env

docker compose up -d --wait                # PostgreSQL 18
pnpm migration:run                         # ou : pnpm --filter api run migration:run
```

## Lancement

```bash
pnpm dev          # API http://localhost:3000/api, web http://localhost:5173, admin http://localhost:5174
```

Chaque app peut aussi être lancée seule : `pnpm dev:api`, `pnpm dev:web` ou `pnpm dev:admin`.
Les deux fronts affichent le statut renvoyé par `GET /api/health`.

## Qualité

```bash
pnpm lint
pnpm typecheck
pnpm test         # ne nécessite pas la base de données
pnpm build
pnpm format       # ou format:check
```
