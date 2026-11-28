# E-Deep

Carnet de plongée numérique : saisie post-plongée, historique, carte.
Monorepo pnpm : API NestJS (`apps/api`), front plongeur React (`apps/web`), backoffice React +
shadcn/ui (`apps/admin`), contrats d'API partagés (`packages/shared`, types seulement).

Architecture, conventions et décisions : [ARCHITECTURE.md](./ARCHITECTURE.md) (source de vérité).
Déploiement détaillé : [ARCHITECTURE.md §12](./ARCHITECTURE.md#12-déploiement).

## Prérequis

- **Node.js 26** (LTS, voir `.nvmrc`)
- **pnpm 12.18** (version épinglée dans `packageManager` ; corepack n'est plus livré avec Node ≥ 25 :
  `npm install -g pnpm@12.18.0`)
- **Docker** avec Docker Compose v2

## Développement local

### 1. Installation

```bash
pnpm install

# Variables d'environnement : copier les exemples, puis changer le mot de passe de la base
cp .env.example .env                       # docker compose de dev (POSTGRES_*)
cp apps/api/.env.example apps/api/.env     # API : DATABASE_PASSWORD = POSTGRES_PASSWORD
```

Les fronts n'ont besoin d'aucun `.env` : ils appellent `/api` sur leur propre origine, relayé vers
l'API par le proxy Vite. `apps/web/.env.example` et `apps/admin/.env.example` ne servent qu'à viser
une autre API.

Dans `apps/api/.env`, renseigner aussi :

- `SEED_PASSWORD` pour le seed (au moins 15 caractères, conforme à la politique de mot de passe) ;
- `TOTP_ENCRYPTION_KEY` pour l'admin :
  `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`.

### 2. Base de données

```bash
docker compose up -d --wait   # PostgreSQL 18 sur 127.0.0.1:5432 (volume db-data)
pnpm migration:run            # build de l'API puis migrations TypeORM
pnpm db:seed                  # facultatif : carnet de démo (vide puis remplit ; base locale seulement)
```

Le seed crée les comptes plongeur `marine@example.test`, `lucas@example.test` et
`thao@example.test`, tous avec le mot de passe `SEED_PASSWORD`. Les comptes staff sont conservés.

### 3. Lancement

```bash
pnpm dev          # API http://localhost:3000/api, web http://localhost:5173, admin http://localhost:5174
```

Chaque app peut aussi être lancée seule : `pnpm dev:api`, `pnpm dev:web` ou `pnpm dev:admin`.
Pour tester un build des fronts : `pnpm --filter web run build && pnpm --filter web run preview`
(port 4173 ; 4174 pour l'admin).

### 4. Accès à l'admin (compte staff)

L'admin exige un compte staff, un mot de passe et un code TOTP :

```bash
pnpm account:create-staff admin moi@example.test   # ou support ; mot de passe saisi sans écho
```

La commande affiche une seule fois l'URI `otpauth://`, à ajouter dans une application TOTP. Elle
doit tourner dans un vrai terminal. Pour un compte existant : `pnpm account:reset-password <email>`
et `pnpm account:reset-totp <email>`.

L'inscription des plongeurs est fermée par défaut (`REGISTRATION_ENABLED=false`, bêta fermée) :
en local, utiliser les comptes du seed ou passer la variable à `true`.

## Qualité

À lancer avant chaque commit (la CI rejoue les mêmes commandes sur chaque PR) :

```bash
pnpm format:check   # ou pnpm format pour corriger
pnpm lint
pnpm typecheck
pnpm test           # unitaires et e2e : ne nécessite pas la base
pnpm build
pnpm --filter web run check:public-bundle   # l'accueil n'embarque pas l'app connectée

pnpm --filter api run test:db   # tests sur PostgreSQL réel : base de dev démarrée (base de test recréée)
```

## Production

Trois conteneurs sur un VPS : **Caddy** (HTTPS automatique, sert les deux fronts en statique et relaie
`/api/*`), **api** et **PostgreSQL**. Seul Caddy publie des ports. Tout se lance depuis la racine du
dépôt :

```bash
cp deploy/.env.prod.example deploy/.env.prod && chmod 600 deploy/.env.prod   # puis le remplir

DC="docker compose --env-file deploy/.env.prod -f deploy/docker-compose.prod.yml"
$DC build                                       # images api et caddy (fronts compris)
$DC up -d db
$DC run --rm api npm run migration:run:prod     # à chaque déploiement, avant up
$DC up -d
$DC run --rm -it api node dist/cli/create-staff-account.js admin moi@example.test
$DC ps                                          # seul caddy a des ports
```

**Test local du stack de prod** : mettre `WEB_DOMAIN=localhost` et `ADMIN_DOMAIN=admin.localhost`
dans `deploy/.env.prod`. Caddy émet alors des certificats de sa CA interne :
`curl -k https://localhost/api/health`, et l'admin sur `https://admin.localhost`, protégé par une
basic auth. `$DC down -v` supprime tout, données comprises.

Les variables, la barrière admin et les points restants (CI + GHCR, sauvegardes, durcissement du VPS)
sont décrits dans [ARCHITECTURE.md §12](./ARCHITECTURE.md#12-déploiement) et au §11.
