# Architecture E-Deep

> **Source de vérité du projet.** En cas de conflit entre ce document et une autre source (skill,
> habitude, doc d'outil), ce document prime. Toute décision qui le contredit doit d'abord le
> modifier, dans la section [Décisions](#décisions).

## 1. Vue d'ensemble

E-Deep est un carnet de plongée numérique : saisie post-plongée, historique, carte. Le projet est
un monorepo pnpm de trois applications et deux paquets internes :

```
          ┌────────────┐      ┌──────────────┐
          │  apps/web  │      │  apps/admin  │     navigateur
          │ (plongeur) │      │ (backoffice) │
          └─────┬──────┘      └──────┬───────┘
                │  HTTP JSON /api/*  │
                └─────────┬──────────┘
                    ┌─────▼─────┐
                    │ apps/api  │  NestJS + TypeORM
                    └─────┬─────┘
                    ┌─────▼─────┐
                    │PostgreSQL │  docker compose (dev)
                    └───────────┘

   packages/shared   : contrats d'API (types seulement), importés par les 3 apps
   packages/tsconfig : configs TypeScript de base
```

Phase actuelle : **schéma du carnet de plongée** (entités, migrations, services de synchronisation),
**écrans branchés sur l'API**, en lecture et en écriture de plongée, et **authentification réelle**
(D33 à D45, plan `docs/plans/auth.md`, lots 0 à 8 livrés du 2026-11-20 au 2026-11-27) : session
serveur opaque en cookie, une audience web (plongeur) et une audience admin (staff, TOTP), refus par
défaut, consentement santé versionné, bêta fermée sans email. Routes (toutes sous `/api`, refusées
sans session sauf mention `public`) :

- `GET /api/health` (public) : affichée par les deux fronts ;
- `GET /api/certification-levels` (public) : niveaux actifs proposés à `/welcome` ;
- `POST /api/auth/register` (public, fermée par défaut : `REGISTRATION_ENABLED`),
  `POST /api/auth/login` et `POST /api/auth/logout` (publiques), `POST /api/auth/logout-all` :
  session web (`apps/web`, `/`, `/login`, `/signup`, `/logout`, `/settings`) ;
- `GET /api/me`, `POST /api/me/onboarding`, `POST /api/me/consents`, `PUT /api/me/password` et
  `DELETE /api/me` : identité, premier lancement, re-consentement, mot de passe et suppression du
  compte (`apps/web`, `/welcome`, `/consent`, `/settings`) ;
- `POST /api/admin/auth/login` (mot de passe + code TOTP) et `POST /api/admin/auth/logout`
  (publiques), `GET /api/admin/me` (staff `support` ou `admin`) : session admin (`apps/admin`,
  `/login`, `/`, `/forbidden`, action `/logout`, page introuvable `*`) ;
- `GET /api/dashboard` : dashboard du plongeur courant (`apps/web`, `/dashboard`) ;
- `GET /api/dives` et `GET /api/dives/:id` : carnet complet et détail d'une plongée du plongeur
  courant (`apps/web`, `/dives` et `/dives/:diveId`, D25) ;
- `POST /api/dives` et `PUT /api/dives/:id` : création et remplacement complet d'une plongée, avec
  son site et ses binômes créés par leur nom (`apps/web`, formulaire `/dives/new` et
  `/dives/:id/edit`, D29) ;
- `GET`, `POST /api/sites`, `GET`, `PUT`, `DELETE /api/sites/:id` et `POST /api/sites/:id/merge` :
  sites privés du plongeur courant (`apps/web`, `/map`, `/sites/:siteId`, création express du
  formulaire ; D31).

Les routes du carnet (`/dashboard`, `/dives…`, `/sites…`) exigent en plus un profil complet et le
consentement santé à la version courante (D37, D38). Côté web, `/` est l'accueil public (D45).

Modèle de données : `docs/data-model/` (`schema.md`, `decisions.md`).

## 2. Arborescence

```
e-deep/
├── apps/
│   ├── api/                      NestJS 12 (CommonJS) + TypeORM 1 + PostgreSQL
│   │   ├── src/
│   │   │   ├── main.ts           bootstrap
│   │   │   ├── configure-app.ts  x-powered-by désactivé, trust proxy, préfixe, ValidationPipe, filtre
│   │   │   │                     d'exceptions (partagé avec l'e2e ; pas de CORS, D34)
│   │   │   ├── app.module.ts     ConfigModule + DatabaseModule + application-modules.ts (liste des modules,
│   │   │   │                     réutilisée par le test d'inventaire des routes)
│   │   │   ├── config/           validation de l'environnement (class-validator)
│   │   │   ├── database/         options DataSource partagées, data-source.ts (CLI), migrations/,
│   │   │   │                     seeds/ (dev-seed.ts + données statiques dev-seed.data.ts, dive-log.data.ts)
│   │   │   ├── cli/              commandes d'exploitation account:create-staff, account:reset-password,
│   │   │   │                     account:reset-totp (mot de passe sur stdin sans écho)
│   │   │   ├── common/           transverse : auth (gardes globaux OriginGuard, JsonBodyGuard, SessionGuard,
│   │   │   │                     NoStoreGuard, AccessMetadataCheck, décorateurs @Public, @Roles,
│   │   │   │                     @AllowIncompleteProfile, @CurrentDiverId, AuthContext, DiverId, cookies,
│   │   │   │                     client-ip), filtres, logging, database (transformer,
│   │   │   │                     upsert, pull), errors (erreurs métier), sync (règles et réglages)
│   │   │   └── modules/<domaine>/ un module Nest par domaine : health, dashboard, certification-levels, divers,
│   │   │                         dive-sites, buddies, dives (agrégat événement + participation + palanquée
│   │   │                         + observations ;
│   │   │                         écriture synchronisée DivesService, lecture DivesController + DiveLogService
│   │   │                         + dive-contract.mapper.ts), accounts (compte, /me, onboarding, commandes),
│   │   │                         auth (sessions, login, inscription, mots de passe, limitation, TOTP,
│   │   │                         auth_events), consents (consentement santé)
│   │   ├── test/                 tests e2e (supertest), db/ (tests sur PostgreSQL réel)
│   │   └── Dockerfile            image de prod (multi-stage, pnpm deploy --prod, utilisateur node ; §12)
│   ├── web/                      React 19 + Vite 8 + SCSS modules (design system DiveLog)
│   │   ├── CLAUDE.md             règles du design system pour les agents
│   │   ├── design/               handoff : README (spec), screenshots/, mockups/ (lecture seule)
│   │   ├── scripts/              generate-tokens.ts, screenshot.mjs (Playwright), check-public-bundle.mjs
│   │   ├── public/marketing/     aperçu produit de l'accueil (WebP)
│   │   └── src/
│   │       ├── app/              App, providers, router + routes.tsx, routes/ (pages), layout/ (AppShell,
│   │       │                     PublicLayout…), logoutRoute.ts (action /logout)
│   │       ├── design/tokens.ts  source unique des design tokens
│   │       ├── features/<domaine>/{api,hooks,components,lib} (+ types.ts, mocks/ si besoin)
│   │       │                     api/ : appels, guards, mapping vers le modèle de vue, queryKeys.ts ;
│   │       │                     mocks/ : fixtures de test et forçage ?state= (jamais dans le bundle de dives)
│   │       │                     features/auth : formulaires de connexion, d'inscription, de premier
│   │       │                     lancement, de consentement et du compte ; features/home : accueil public
│   │       ├── shared/session/   port authClient (adaptateur HTTP ; faux client des tests et de ?state=),
│   │       │                     meApi, loaders requireSession / redirectIfAuthenticated, endSession,
│   │       │                     authBroadcast, hooks useMe / useCurrentDiver
│   │       ├── shared/{ui,hooks,lib,config,model}  config/app.ts : APP_NAME, drapeaux features / privacy ;
│   │       │                     config/consent.ts : texte du consentement par version ; model/ : types de domaine
│   │       │                     partagés entre features (ex. DiveMember, palanquée) ; lib/ : apiClient,
│   │       │                     guards génériques, queryClient.ts (TanStack Query), hash.ts, format
│   │       │                     diveLog/ : lecture du carnet (`GET /dives`) commune aux plongées et aux
│   │       │                     sites ; sites/ : données et règles des sites (dépôt, recherche, fusion)
│   │       ├── test/             setup.ts (Testing Library), TestProviders.tsx (QueryClient neuf par rendu)
│   │       └── styles/           global.scss, tokens/ (_index, _tokens & _vars générés, _mixins)
│   └── admin/                    React 19 + Vite 8 + Tailwind v4 + shadcn/ui
│       └── src/
│           ├── app/              App, providers, router + routes.tsx (/login, /, /forbidden, action /logout,
│           │                     * introuvable), layout/, routes/, access-control/ (garde par loader, canAccess, README)
│           ├── components/ui/    composants shadcn générés (ne pas modifier)
│           ├── features/<domaine>/
│           ├── shared/{ui,hooks,lib}
│           └── styles/index.css  entrée Tailwind + thème shadcn
├── packages/
│   ├── shared/                   @e-deep/shared : types des contrats d'API
│   └── tsconfig/                 @e-deep/tsconfig : base.json, react.json, nest.json
├── deploy/                       prod (§12) : docker-compose.prod.yml (caddy + api + db), Caddyfile,
│                                 caddy/Dockerfile (build de web et admin servis par Caddy), .env.prod.example
├── .github/                      workflows/ci.yml (CI), actions/setup, dependabot.yml
├── .dockerignore                 contexte des images de prod (ni node_modules, ni dist, ni .env, ni design/)
├── .gitattributes                *.txt text eol=lf (liste des mots de passe compromis, comparée par SHA-256)
├── docker-compose.yml            PostgreSQL 18 de dev
├── eslint.config.js              ESLint flat config unique (toutes les apps)
├── .prettierrc.json              Prettier unique
└── pnpm-workspace.yaml
```

## 3. Stack par app

Versions vérifiées le 2026-11-06. Node **26 LTS** (`.nvmrc`), pnpm **12.18** (`packageManager`).

| Zone         | Stack                                                                                                                                                                                                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Racine       | TypeScript ~6.0.3, ESLint 10 + typescript-eslint 8 (type-checked), Prettier 3                                                                                                                                                                                                      |
| `apps/api`   | NestJS 12.4 (**CommonJS**), @nestjs/config, TypeORM 1.1 + pg, class-validator / class-transformer, Jest 30 + ts-jest + supertest. Authentification **sans dépendance** : `node:crypto` (Argon2id, SHA-256, HMAC, AES-256-GCM, TOTP), en-tête `Cookie` lu à la main (D33, D35, D42) |
| `apps/web`   | React 19.3, Vite 8 (Rolldown), @vitejs/plugin-react 6, sass-embedded, Geist via fontsource, React Router 8 (data mode), TanStack Query 5.107 (D24), Vitest 5 + Testing Library (+ user-event) + jsdom, Playwright (captures)                                                       |
| `apps/admin` | Pareil que web pour React/Vite/tests, plus Tailwind 4.3 (`@tailwindcss/vite`) et shadcn/ui (CLI 4.23, base Radix, preset Nova), React Router 8 (data mode, D42), sans TanStack Query                                                                                               |
| Infra dev    | PostgreSQL 18 (`postgres:18-alpine`) via docker compose                                                                                                                                                                                                                            |
| Infra prod   | Docker Compose sur un VPS : Caddy 2.11 (TLS, proxy, statique), image de l'api sur `node:26-alpine`, PostgreSQL 18 (§12)                                                                                                                                                            |
| CI           | GitHub Actions (`.github/workflows/ci.yml`) : format, lint et typecheck ; tests ; build et `check:public-bundle` ; `test:db` sur un PostgreSQL 18 jetable. Actions épinglées par SHA, mises à jour par Dependabot                                                                  |

Ports de dev : API `3000`, web `5173`, admin `5174` (`strictPort`). Chaque front sert l'API sur sa
propre origine : le proxy Vite (`server.proxy` et `preview.proxy`) redirige `/api` vers `:3000`,
`VITE_API_BASE_URL=/api` (D34).

## 4. Conventions

### TypeScript

- `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`,
  `noUnused*` partout (`packages/tsconfig/base.json`).
- `verbatimModuleSyntax` est activé partout **sauf dans l'API** (voir Décisions D3). À la place,
  l'API s'appuie sur `isolatedModules` et sur les `import type` explicites.
- **Aucun `any`** : la règle `@typescript-eslint/no-explicit-any` est en `error`. On utilise
  `unknown` puis un type guard aux frontières (réponses HTTP, env).
- Pas de `baseUrl` (déprécié en TS 6) : les alias passent par `paths` seul.

### Structure des features

- **API** : un module Nest par domaine dans `src/modules/<domaine>/`, avec ses fichiers
  `<domaine>.module.ts`, `.controller.ts`, `.service.ts`, `.entity.ts` et `dto/`. Le transverse va
  dans `src/common`, la configuration dans `src/config`.
- **Fronts** : `src/features/<domaine>/` regroupe `api/` (appels et guards de réponse), `hooks/` et
  `components/`. Une feature n'importe jamais une autre feature : ce qui est partagé remonte dans
  `src/shared/`. `src/app/` assemble le tout (providers, router, pages, layout).

### Nommage

- Composants React et fichiers de composants en `PascalCase.tsx`, hooks en `useXxx.ts`, le reste en
  `camelCase.ts`. Côté Nest, convention kebab-case (`health.service.ts`).
- Entités TypeORM : fichiers `*.entity.ts` **obligatoirement**, car la CLI les découvre par ce glob.
- Exports nommés uniquement. Les seuls `export default` autorisés sont ceux imposés par un outil
  (configs Vite, DataSource de la CLI TypeORM).

### Imports

- Alias `@/` vers `src/` dans web et admin (tsconfig `paths` + `resolve.alias` de Vite). L'API
  utilise des chemins relatifs.
- `@e-deep/shared` s'importe **uniquement** avec `import type` (jamais `import { type X }`, qui
  laisserait un import à effet de bord et casserait Vite). Deux règles ESLint l'imposent :
  `@typescript-eslint/no-restricted-imports` (`allowTypeImports`) et
  `@typescript-eslint/no-import-type-side-effects`.

### Qualité

- Le lint et le format sont gérés à la racine, avec une seule config pour tout le monorepo. Chaque
  app lance `eslint .`, qui remonte jusqu'à la config racine.
- Pas de Turborepo ni de Nx. Les scripts racine délèguent via `pnpm -r run <script>` ; il faut
  toujours écrire `run`, car avec pnpm 12, `pnpm -r build` est traité comme un `exec`.
- Commits conventionnels (`feat(api): …`, `chore: …`).
- **CI** (`.github/workflows/ci.yml`, sur chaque PR vers `main` et chaque push sur `main`) : quatre
  jobs, `format:check` + `lint` + `typecheck`, `pnpm test`, `pnpm build` +
  `pnpm --filter web run check:public-bundle`, et `pnpm --filter api run test:db` sur un service
  `postgres:18-alpine` jetable (identifiants propres au job). Permissions minimales
  (`permissions: {}` puis `contents: read`), actions tierces épinglées par SHA, mises à jour par
  Dependabot (`.github/dependabot.yml`, délai de 7 jours). En local, les mêmes commandes restent à
  lancer avant chaque commit (`CLAUDE.md`).

### Configuration de l'API

Toutes les variables sont validées au démarrage (`src/config/environment.ts`, class-validator) et
documentées dans `apps/api/.env.example`. Une erreur ne cite que le **nom** de la variable (§9.4).

| Variable                  | Valeur                                                                                                                                                                                                                                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                | **Obligatoire** : `development`, `test` ou `production` (D44). Le boot échoue sans elle.                                                                                                                                                                                                                       |
| `PORT`                    | `3000` par défaut.                                                                                                                                                                                                                                                                                             |
| `DATABASE_*`              | Hôte, port, utilisateur, mot de passe et nom de la base (partagés avec la CLI TypeORM).                                                                                                                                                                                                                        |
| `ALLOWED_ORIGINS`         | **Obligatoire** : origines nues (sans chemin ni `/` final), séparées par des virgules, acceptées par l'`OriginGuard` quand une requête non sûre n'a pas d'en-tête `Sec-Fetch-Site` (D34). Remplace `CORS_ORIGINS` : il n'y a plus de CORS.                                                                     |
| `TRUST_PROXY`             | Nombre de proxys de confiance pour `trust proxy` (`req.ip`, `req.protocol`), `0` par défaut (dev), de 0 à 10.                                                                                                                                                                                                  |
| `SESSION_COOKIE_SECURE`   | `true` par défaut : attribut `Secure` et préfixe `__Host-` des cookies. Seule la valeur exacte `false` le désactive (dev en http, D34).                                                                                                                                                                        |
| `REGISTRATION_ENABLED`    | `false` par défaut (bêta fermée, D39) : `POST /api/auth/register` répond `403 registration-closed`. Seule la valeur exacte `true` l'ouvre.                                                                                                                                                                     |
| `TOTP_ENCRYPTION_KEY`     | Base64 canonique de 32 octets, clé AES-256-GCM des secrets TOTP du staff (D42). Facultative tant qu'aucun compte staff n'existe ; ensuite, le boot est refusé sans elle ou si elle ne déchiffre pas un secret stocké (`TotpKeyBootCheck`). Toujours exigée par `account:create-staff` et `account:reset-totp`. |
| `SYNC_PURGE_HORIZON_DAYS` | Horizon de purge des tombstones, 90 jours par défaut (D22, D-12).                                                                                                                                                                                                                                              |
| `SEED_PASSWORD`           | **Seed seulement** (`pnpm db:seed`), sans valeur par défaut : mot de passe des comptes `@example.test`, au moins 15 caractères et conforme à la politique (D35, D44). Ni l'API, ni les migrations, ni `test:db` ne la lisent.                                                                                  |

## 5. Stratégie de styles

### `apps/web` : SCSS modules uniquement, design system DiveLog

- Un fichier `Composant.module.scss` par composant. Pas de Tailwind, pas de CSS-in-JS, pas de
  classes utilitaires. Les noms de classes sont en camelCase (le scoping des modules remplace BEM).
  Les classes se combinent avec `cx` (`shared/lib/classNames.ts`).
- **Tokens** : source unique `src/design/tokens.ts` (couleurs, typo, espacements base 4px, rayons,
  ombres, motion, opacités, breakpoints, layout). `pnpm --filter web run tokens` génère
  `src/styles/tokens/_tokens.scss` (variables Sass `$color-…`) et `_vars.scss` (custom properties
  `--dl-…` sur `:root`). Les fichiers générés ne s'éditent jamais à la main et sont exclus de
  Prettier. Les valeurs calculées en JS (graphes, SVG) importent `@/design/tokens`. Les tokens
  « TS seulement » (tableaux comme `avatarPalette`) ne sont pas générés en SCSS : une couleur qui
  vient d'une donnée (avatar d'un binôme) passe en style inline, choisie dans la palette.
- `src/styles/` contient :
  - `tokens/_index.scss` : point d'entrée des modules, `@use '@/styles/tokens' as *;` donne accès
    aux tokens et aux mixins ;
  - `tokens/_mixins.scss` (écrit à la main, sans sortie CSS) : `type()`, `overline()`, `card()`,
    `focus-ring`, `hit-target()`, `skeleton()`, `from()` / `until()` (breakpoints **mobile-first**,
    `@include from($bp-tablet)`), `visually-hidden` ;
  - `global.scss` : reset, body, focus visible, keyframes, `prefers-reduced-motion`. Importé une
    seule fois dans `main.tsx`, après les polices.
- **Thème sombre uniquement** (`color-scheme: dark`) : pas de thème clair pour l'instant.
- **Polices** : Geist et Geist Mono, auto-hébergées via `@fontsource-variable/*` (voir D16). Les
  chiffres (KPI, mesures, dates) sont en Geist Mono + `tabular-nums`.
- `@use` / `@forward` uniquement, **jamais `@import`**. Chaque module déclare explicitement son
  `@use` (pas d'`additionalData` global, pour garder les dépendances visibles).
- Flexbox par défaut. Grid seulement si c'est justifié par un commentaire.
- Un seul composant par écran pour desktop et mobile : le responsive passe par le SCSS. Deux
  exceptions, via `useMediaQuery` (`shared/hooks/`), là où le DOM diffère vraiment : sidebar ↔
  drawer, et l'entrée publique (carte d'authentification dans l'accueil à partir de 1024 px, écrans
  dédiés `/login` et `/signup` en dessous ; `apps/web/CLAUDE.md`).
- **Aucune valeur en dur hors tokens** (seules exceptions : `0`, `1px` des bordures fines, `100%`).
  Une valeur manquante s'ajoute dans `tokens.ts`.
- Maquettes de référence dans `apps/web/design/` ; vérification visuelle avec
  `pnpm --filter web run screenshot <route> [largeur]` (sortie `apps/web/.screenshots/`, ignorée).

### `apps/admin` : exception Tailwind

- **Tailwind est autorisé uniquement dans `apps/admin`**, parce que shadcn/ui en dépend.
- Il ne doit jamais être installé ni importé ailleurs. Un garde-fou ESLint refuse les imports
  Tailwind dans `apps/web` et `packages`. Vérification : `rg -i tailwind apps/web packages` ne doit
  rien renvoyer.
- Les composants shadcn de `src/components/ui/` sont générés par la CLI et **ne se modifient pas** :
  on les wrappe (ex. `StatusBadge` autour de `Badge`). Ils sont exclus de Prettier, et la règle
  `react-refresh/only-export-components` est désactivée pour eux seuls.
- Le thème généré a été adapté : pile de polices système au lieu de Geist, `prefers-color-scheme`
  au lieu de la classe `.dark`, et prise en compte de `prefers-reduced-motion`.

## 6. `packages/shared` : types seulement (phase 1)

- Le paquet `@e-deep/shared` ne contient **que** des `type`, des `interface` et des
  `export type`. Il n'a aucun code runtime, aucun `enum` TS (on utilise des unions de littéraux) et
  aucun build. Son `package.json` expose directement `src/index.ts` via la condition `types`.
- **Pourquoi** : l'API est en CommonJS (compilée par `tsc` via Nest), alors que les fronts sont en
  ESM bundlé par Vite. Un paquet partagé avec du code runtime demanderait un double build CJS/ESM
  ou un bundler. Avec des types seuls, `import type` est effacé à la compilation et le problème
  d'interop n'existe plus. Le paquet reste un simple contrat de compile-time.
- **Garde-fou** : une règle ESLint `no-restricted-syntax` sur `packages/shared` refuse toute
  instruction de niveau supérieur qui n'est pas un type.
- **Contrats actuels** : `auth.ts` (voir plus bas), `health.ts`, `dashboard.ts` (`DashboardResponse`…) et `dives.ts`
  (`DiveSiteRef`, `DiveBuddyRef`, `DiveSummary`, `DiveDetail`, `DiveLogResponse`) et
  `dive-write.ts` (écriture, D29 : `DiveWriteRequest`, `DiveWriteResponse`, erreurs
  `ApiValidationErrorResponse` / `ApiDomainErrorResponse` et `ApiDomainErrorCode`, que l'API
  réutilise pour `DomainError.code`) et `sites.ts` (D31 : `SiteResponse`, `SiteListResponse`,
  `SiteWriteRequest`, `SiteCreateRequest`, `SiteMergeRequest`, unions `SiteType` et `SiteOrigin` ;
  `locality`, `region` et `area` séparés, la zone n'est jamais servie). La région d'un site et sa position (latitude et longitude
  ensemble) sont `null` quand elles ne sont pas renseignées (D-23). `DiveDetail`
  porte à plat tous les champs de l'événement, de la participation et du site (D-13 à D-21 de
  `docs/data-model/decisions.md`) : chaque champ est **présent**, `null` s'il n'est pas renseigné
  (pas de `?`), sauf `observations` (tableau, vide par défaut) et `diverLevel` (toujours en base).
  Types associés : `CertificationLevelRef`, `DiveObservation`, `DiveDetailBuddy` (binôme + niveau
  de sa fiche) et les unions `EntryType`, `TimeOfDay`, `Weather`, `SeaState`, `CurrentStrength`,
  `TankMaterial`, `SuitType`. `DiveSiteRef` ne porte **aucun** de ces champs, `DiveSummary` seulement
  `entryType` et `diveCenter` (poids de la liste D25, mise à l'eau et structure habituelles d'un
  site, D32). Une valeur ajoutée à une union se déploie **front d'abord** (le guard
  rejette une valeur inconnue). Côté API, les
  modèles de lecture n'ont pas de dossier `dto/` : un `*-contract.mapper.ts` convertit les lignes SQL
  vers ces types partagés (pas de validation d'entrée à porter). Les `dto/` class-validator restent
  la règle dès qu'un endpoint reçoit un corps ou des paramètres.
- **Contrat de l'authentification** `auth.ts` (D33 à D45) : `AccountRole`, `StaffRole`,
  `ConsentPurpose`, `HealthPolicyVersion` (`'2026-11'`), `PasswordPolicyFailure`, `OnboardingStatus`
  (calculé par l'API seule), les corps `RegisterRequest`, `LoginRequest` (`rememberMe`),
  `AdminLoginRequest` (`totpCode`), `OnboardingRequest`, `ConsentGrantRequest`,
  `ChangePasswordRequest`, `DeleteAccountRequest`, et les réponses `MeResponse`, `AdminMeResponse`,
  `CertificationLevelListResponse` (`CertificationLevelOption[]`). Aucun token dans ces types : le
  cookie est opaque et jamais lu par le JS. Une nouvelle `HealthPolicyVersion` se déploie **front
  d'abord**, comme les unions D-14 : le texte du consentement (`shared/config/consent.ts`, indexé par
  version) ne compile pas tant qu'il manque.
- **Erreurs** : le corps garde la forme `{ statusCode, code, fieldErrors? }` (D-26), sans jamais
  reprendre une valeur reçue. Validation : `400 validation-failed` + `fieldErrors` (dont
  `fieldErrors.password` : `too-short`, `too-long`, `compromised`, `contains-identity`).
  `ApiDomainErrorCode` (`dive-write.ts`) compte, en plus des codes du carnet : `unauthenticated` et
  `invalid-credentials` (401), `registration-closed`, `onboarding-required`, `consent-required` et
  `forbidden` (403), `email-taken` et `onboarding-complete` (409), `payload-too-large` (413),
  `unsupported-media-type` (415) et `too-many-attempts` (429, avec `Retry-After` en secondes). La
  table `DOMAIN_ERROR_STATUS` (`common/errors/domain-error-http.ts`) est exhaustive par type.
- **Conséquence assumée** : la validation runtime des réponses est écrite dans chaque front (type
  guards). Le client API, les guards, `promiseCache`, `ErrorBoundary` et `useHealth` sont
  aujourd'hui **dupliqués** entre web et admin. On les factorisera dans un paquet runtime dédié
  (build ESM seulement, consommé par les fronts) à l'arrivée d'un troisième consommateur, ou dès
  que les copies divergent.

## 7. Base de données et migrations

- PostgreSQL 18 en dev via `docker-compose.yml`. Les identifiants viennent du `.env` racine, le
  port est lié à `127.0.0.1` uniquement et un healthcheck `pg_isready` est configuré. Le volume
  nommé `db-data` est monté sur `/var/lib/postgresql` (nouvelle convention de l'image 18).
- **`synchronize: false`, toujours, dans tous les environnements.** Le schéma ne change que par
  migrations, et `migrationsRun: false` : on les lance explicitement.
- `src/database/database.options.ts` est la **seule** source des options de connexion. L'app
  (`TypeOrmModule.forRootAsync`) et la CLI (`src/database/data-source.ts`) l'utilisent toutes les
  deux, ce qui évite toute dérive entre elles.
- La CLI TypeORM tourne sur le **code compilé** (`dist/database/data-source.js`) : les scripts
  `migration:*` font `nest build` d'abord. On évite ainsi ts-node, et les décorateurs sont
  correctement compilés. L'env est chargé avec `process.loadEnvFile()` (natif Node, pas de dotenv).
- Commandes (depuis la racine) :
  - `pnpm migration:run` / `pnpm migration:revert`
  - `pnpm migration:generate src/database/migrations/<Nom>` (diff entités ↔ base)
  - `pnpm migration:create src/database/migrations/<Nom>` (squelette vide)
- Les migrations générées sont exclues de Prettier, car elles gardent le format de la CLI. Elles
  restent lintées.
- **Migration initiale** `InitDiveLogSchema` : 7 tables (`certification_levels`, `divers`,
  `dive_sites`, `buddies`, `dive_events`, `dive_participations`, `dive_buddies`). Toutes les
  contraintes et tous les index sont **nommés** et déclarés dans les entités (`@Check`, `@Unique`,
  `@Index` avec `where`, `primaryKeyConstraintName`, `foreignKeyConstraintName`), pour qu'un
  `migration:generate` ne produise aucun diff. Le SQL brut ne contient que ce que TypeORM ne décrit
  pas : fonctions et triggers `set_updated_at()` / `touch_participation_on_buddies_change()`, seed
  des 4 niveaux FFESSM, et l'ordre `(propriétaire, id)` des 3 FK composites (TypeORM les génère
  inversées, sans incidence sur le diff).
- **Migration `AddDiveSiteLocality`** : `dive_sites.locality text NULL` (ville ou spot, « Calvi »),
  avec `ck_dive_sites__locality` (1 à 120 caractères après `btrim`). Le front affiche
  « localité · région », ou la région seule (D27).
- **Migration `AddDiveDetailFields`** (champs du détail de plongée, D-13 à D-22 de
  `docs/data-model/decisions.md`), **toutes les colonnes nullables et sans défaut** (`NULL` = non
  renseigné, aucun backfill) :
  - `dive_events` : `entry_type`, `time_of_day`, `weather`, `air_temperature_c`, `sea_state`,
    `current_strength`, `dive_center` (type et conditions, écrits par le seul créateur) ;
  - `dive_participations` : `surface_water_temperature_c`, palier de sécurité
    (`safety_stop_duration_min` + `safety_stop_depth_m`, ensemble ou pas du tout), `is_repetitive`,
    `o2_percent` (mélange `OTHER` seulement), bloc (`tank_volume_l`, `tank_material`,
    `start_pressure_bar`, `end_pressure_bar` ≤ début), combinaison (`suit_type`,
    `suit_thickness_mm`), `weight_kg` ;
  - `dive_sites.area` (mer ou zone, texte libre) ; `buddies.certification_level_id` (niveau courant
    du contact, FK `RESTRICT` non indexée ; jamais lu sur le compte lié) ;
  - table **`dive_observations`** (`participation_id`, `position` 0–49, `label`, `count`), PK
    `(participation_id, position)`, `UNIQUE (participation_id, label)`, FK `CASCADE` : synchronisée
    avec sa participation comme `dive_buddies`, sans horodatage. Le SQL brut ajoute le trigger
    `trg_dive_observations__touch_participation`, qui réutilise `touch_participation_on_buddies_change()` ;
    le `down()` ne supprime pas cette fonction (elle appartient à `InitDiveLogSchema`).

  Listes fermées en `text` + `CHECK` (`modules/dives/dive-detail-lists.ts`, valeurs H-18 validées le 2026-11-17).
  **Écriture** (D-22) : les types d'écriture des services (`DiveEventWrite`,
  `DiveParticipationWrite`, `DiveSiteWrite`, `BuddyWrite`) exigent chaque champ synchronisé, `null`
  compris (`locality` aussi) : un champ omis par un client périmé effacerait la donnée dans
  l'upsert LWW. `upsertDive` remplace les observations dans la transaction de l'agrégat (libellés
  `btrim`, casse conservée ; doublon → `DuplicateObservationError`, plus de 50 →
  `TooManyObservationsError`, rien n'est écrit). Un niveau de binôme inconnu →
  `InvalidReferenceError`. Chaque service d'écriture a une variante `…In(manager, …)` qui écrit
  dans la transaction de l'appelant ; sa méthode publique ouvre la sienne (D29).

- **Migration `AllowDiveSiteWithoutPosition`** (D-23) : `dive_sites.region`, `latitude` et
  `longitude` deviennent **nullables** (site créé par son nom seul), leurs `CHECK` acceptent `NULL`,
  et `ck_dive_sites__position` impose latitude et longitude ensemble ou aucune. Les `CHECK`
  réécrits le sont à la main (le générateur compare les `CHECK` par nom). Le `down()` échoue tant
  qu'un site n'a pas de région ou de position.

- **Migration `AddDiveSiteDetails`** (D31, D-27 à D-30 de `docs/data-model/decisions.md`) :
  `dive_sites.type` (liste fermée), `depth_min_m` / `depth_max_m` (`numeric(4,1)`, min ≤ max),
  `access_notes` (1 à 2 000 caractères), nullables sans défaut ; `created_via` (`quick` | `full`,
  ajoutée nullable, remplie selon la position, puis `NOT NULL`) ; `merged_into_id` (cible d'une
  fusion, tombstone seulement), FK composite réflexive `(owner_id, merged_into_id)` écrite en SQL
  brut dans l'ordre `(propriétaire, id)`, index partiel. Le `down()` perd les valeurs saisies.

- **Migrations de l'authentification** (D33 à D42, plan `docs/plans/auth.md` §2 ;
  `docs/data-model/schema.md`, D-34 à D-38 de `decisions.md`) :
  - **`CreateAuthSchema`** : tables `accounts`, `sessions`, `consents` et `auth_events`,
    **purement additive** (aucune table existante modifiée) ; toutes les contraintes et tous les
    index nommés dans les entités ; le SQL brut se limite au trigger
    `trg_accounts__set_updated_at` (fonction `set_updated_at()` d'`InitDiveLogSchema`). Le `down()`
    supprime les 4 tables (perte des comptes) ;
  - **`AllowIncompleteDiverProfile`** (D36) : `divers.last_name` et
    `divers.certification_level_id` nullables (inscription minimale, niveau saisi à `/welcome`),
    `ck_divers__last_name` réécrit à la main ; `dive_participations.certification_level_id` reste
    `NOT NULL`. Le `down()` échoue tant qu'un profil incomplet existe ;
  - **`AddAccountCreatedAuthEvent`** : type `account_created` ajouté à `ck_auth_events__type`
    (l'inscription était tracée en `login_succeeded`) ; `CHECK` réécrit à la main, `down()` refusé
    s'il reste un tel événement ;
  - **`AddStaffTotp`** (D42) : `accounts.totp_secret text NULL` (secret chiffré) et
    `accounts.totp_last_used_step bigint NULL` (anti-rejeu), `ck_accounts__totp_staff_only`
    (`role <> 'diver' OR (totp_secret IS NULL AND totp_last_used_step IS NULL)`) et type
    `totp_reset`. Un compte staff créé avant elle n'a pas de secret et ne peut se connecter qu'après
    `account:reset-totp`. Le `down()` perd les secrets et échoue s'il reste un `totp_reset`.

- **Commandes d'exploitation** (`src/cli/`, lancées depuis `dist` après `nest build` ; raccourcis à la
  racine : `pnpm account:create-staff`, `pnpm account:reset-password`, `pnpm account:reset-totp`) :
  - `pnpm --filter api run account:create-staff <support|admin> <email>` : crée un compte staff
    (sans plongeur), mot de passe saisi deux fois sur stdin sans écho, secret TOTP généré ;
  - `pnpm --filter api run account:reset-password <email>` : nouveau mot de passe choisi par le
    titulaire (D39, pas d'email en V1), toutes les sessions du compte révoquées ;
  - `pnpm --filter api run account:reset-totp <email>` : nouveau secret TOTP d'un compte staff
    (authentificateur perdu ou compromis), sessions révoquées, événement `totp_reset`.

  `account:create-staff` et `account:reset-totp` exigent `TOTP_ENCRYPTION_KEY` et affichent **une
  seule fois** l'URI `otpauth://` (secret et email), et seulement sur un terminal interactif : une
  sortie redirigée est refusée avant toute écriture. Aucune commande n'affiche ni ne logge le mot de
  passe. `account:reset-totp` répond la même erreur pour un email inconnu et pour un compte plongeur.

- **Seed de développement** : `pnpm db:seed` (`src/database/seeds/`, lancé depuis `dist`). Il vide
  les tables du carnet (le référentiel des niveaux est conservé) puis crée 3 plongeurs fictifs, chacun
  avec un **vrai compte** (`marine@example.test`, `lucas@example.test`, `thao@example.test`, D44),
  le mot de passe `SEED_PASSWORD` (obligatoire, sans défaut, vérifié par la politique D35 avant toute
  écriture) et le consentement santé à la version courante. Les comptes staff
  (`account:create-staff`), leurs sessions et leur trace survivent à un re-seed :
  - **Marine Rousseau** : le carnet des maquettes « Mes plongées », soit
    127 plongées aux **dates absolues** (juin 2019 → avril 2026), 23 sites avec localité, région et
    zone (type et profondeurs sur 22 d'entre eux, accès sur la Revellata, rien sur le Kléber), plus « Revellata — Grotte aux Corbs » sans
    position ni plongée (`quick`), 14 binômes dont 2 liés aux autres comptes et 5 avec un niveau, plus 1 plongée supprimée
    (tombstone). Les 6 plongées les plus récentes portent les champs du détail (la dernière avec les
    valeurs de la maquette du détail, espèces comprises) ; la plongée de l'épave du Kléber
    (2024-09-10) n'en a **aucun** (site sans zone, binôme sans niveau), pour le rendu partiel ;
  - **Lucas** et **Thao** : quelques plongées datées par rapport au jour du seed.

  Les données sont **fictives** et statiques (`dive-log.data.ts`, `dev-seed.data.ts`), les ids sont
  des UUIDv7 déterministes (les URL des plongées survivent à un re-seed) ; seuls les ids des
  plongeurs viennent de la base. Il passe par les services (mêmes invariants que la
  synchronisation) et il est rejouable (même état final). Il **refuse** `NODE_ENV=production`, toute
  base non locale et une base dont les migrations ne sont pas jouées. Il ne logge que des compteurs,
  jamais un email ni le mot de passe.
  Le chargement d'env hors Nest est partagé (`src/database/load-database-environment.ts`).

- Colonnes `numeric` lues via `common/database/numeric.transformer.ts` (`pg` les renvoie en
  `string`). `updated_at` n'est jamais écrit par TypeORM (`insert: false, update: false`) : seul le
  trigger le pose.

## 8. Tests

| App   | Outil                              | Commande                                                           | Contenu actuel                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----- | ---------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| api   | Jest 30 + ts-jest, supertest       | `pnpm --filter api run test` (unit + e2e), `test:unit`, `test:e2e` | `HealthService`, filtre d'exceptions, transformer, règles de sync, mappings contrat front (détail : numeric → number, `null` conservés, observations triées, niveaux des binômes), `DiveLogService` (propriétaire, numérotation, 404, liste sans champ du détail), validation d'env (`NODE_ENV` obligatoire, défauts de `SESSION_COOKIE_SECURE`, `TRUST_PROXY`, `REGISTRATION_ENABLED`, clé TOTP) ; e2e `/api/health`, `/api/dives`, `/api/dives/:id` (contrat complet, 200, 400, 401, 404, `Cache-Control`) ; écriture : DTO (bornes, null/absent, règles croisées), `fieldErrors`, mapping des erreurs métier, mapper et rejeu, `DiveWriteService` ; e2e `POST`/`PUT /api/dives` (201, 200, 400 par champ, 404, 409, 422) ; sites : DTO, mappers, complétion de fusion, e2e `/api/sites` (201, 200, 204, 400 par champ, 404, 409, 422, `no-store`) ; authentification : `PasswordHasher` (aller-retour, rehash, PHC malformé), `PasswordPolicy` (bornes, NFKC, compromis, identité), liste des mots de passe compromis, `LoginThrottle` (horloge simulée, IP et email indépendants), clé d'IP (`client-ip`), `SessionService`, `SessionGuard` (chaque branche), audience par chemin, cookies, `AuthenticationService`, `OnboardingService`, TOTP (vecteurs de la RFC 6238, chiffrement aller-retour, anti-rejeu), commandes d'exploitation ; e2e `auth`, `me`, `origin.guard`, `json-body.guard`, graphe des modules d'auth et **inventaire des routes** (`route-inventory.e2e-spec.ts` : liste figée des routes publiques, puis 401 `unauthenticated` + `no-store` sans cookie sur toutes les autres) |
| api   | Jest 30 + ts-jest, PostgreSQL 18   | `pnpm --filter api run test:db` (projet `db`, hors `test`)         | migrations (noms, colonnes du détail nullables sans défaut, revert de `AddDiveDetailFields` seule puis de toutes), contraintes (dont chaque `CHECK` du détail, `o2_percent`, pressions, palier), triggers (dont observations), cascades (observations à la purge et à l'effacement du compte), services de synchronisation (observations remplacées, doublon et plafond refusés sans écriture, pull, niveau de binôme) et purge, `DiveLogService` (isolation entre plongeurs, tombstones hors numérotation, `locality`, champs du détail, `null` sur une plongée ancienne, `updatedAt`) ; écriture (`dive-write.db-spec.ts`) : transaction unique et rollback, idempotence et POST concurrents, numéro D26, snapshot de niveau au PUT, propriété (404/409/422), interblocage, lien de binôme restauré, site sans position ; sites (`sites-api.db-spec.ts`) : `CHECK` et FK réflexive, isolation, fusion (plongées réaffectées, complétion, chaîne réduite, rollback), redirection d'une plongée vers la cible, sync rejetée sur un site fusionné, suppression refusée / acceptée, idempotence du `POST`, purge avec fusion ; authentification : schéma (`auth-schema.db-spec.ts` : chaque `CHECK`, unicités, cascades, reverts), services (inscription et onboarding atomiques, `revokeAll`, `deleteAccount`, purge des sessions et des `auth_events`), connexion admin (TOTP, rejeu), commandes d'exploitation, contrôle de la clé TOTP au boot, **matrice d'autorisation** (`authorization-matrix.db-spec.ts`, construite depuis l'inventaire des routes)                                              |
| web   | Vitest 5 + Testing Library (jsdom) | `pnpm --filter web run test`                                       | client API, guards (`HealthResponse`, dashboard, dives), `shouldRetry` et politique réelle de retry, mapping et clés de région, `HealthPanel`, `useDashboard` et `useDives` sur `useQuery` (cache, refetch en échec), états de `DivesPage` (région live, vide, erreur et retry avec focus, pages, filtres sans refetch, focus de la pagination) ; client API `post`/`put` et erreurs par champ, `httpDiveRepository` (POST/PUT, repli 409 → PUT, invalidation), `fieldErrorMapping`, bornes du formulaire, aller-retour formulaire → détail sur un faux serveur ; sites : client `delete`, guards et découpage du libellé de région (D-32), `httpSitesRepository`, `useSites`, aller-retour création express → fiche → modification → fusion → suppression (`SitesRoundTrip.test.tsx`) ; session : `meApi`, `httpAuthClient` (chaque code d'erreur, `Retry-After`) et faux client, loaders `requireSession`, `redirectIfAuthenticated` et `requireSignupOpen`, `safeNext`, `queryClient` (un 401 vide le cache), `authBroadcast`, `endSession`, `draftStore` (clé par plongeur, purge, époque) ; accueil, connexion, inscription, `/welcome`, `/consent`, `/settings` (formulaires, `fieldErrors` serveur, focus, redirections)                                                                                                                                                                                                                                                                                                                                                                          |
| admin | Vitest 5 + Testing Library (jsdom) | `pnpm --filter admin run test`                                     | client API, guard, `HealthCard`, `AdminLayout`, `canAccess`, `safeNext`, loaders de session (401 → `/login`, 403 → `/forbidden`), navigation après un 401 / 403, navigation filtrée par rôle, `LoginPage`, routes protégées                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

- **`pnpm test` n'a besoin d'aucune base** : l'e2e de l'API monte les modules (`HealthModule`,
  `DivesController` avec le vrai service, les vrais gardes globaux) sur une `DataSource` et une
  config simulées, via le même `configureApp` que `main.ts` ; `SessionService` y est remplacé par un
  faux (D44). Le test d'inventaire monte exactement `APPLICATION_MODULES` : une route ajoutée dans
  n'importe quel module est inventoriée, et une nouvelle route publique non déclarée le fait échouer.
- **Matrice d'autorisation** (`test:db`) : l'`AppModule` complet sur la base `_test`, des plongeurs
  inscrits pour de vrai (A, B, un C sans onboarding) et un compte staff ; chaque route de
  l'inventaire doit y avoir une entrée (404 générique sur la ressource d'autrui, 401 sans cookie ou
  avec la mauvaise audience, 403 `onboarding-required` / `consent-required`, `DELETE /me` sans effet
  sur B ; plan `docs/plans/auth.md` §7).
- **`check:public-bundle`** (`apps/web/scripts/check-public-bundle.mjs`, hors Vitest, en CI) :
  construit le web avec sourcemaps et vérifie que `/`, `/login` et `/signup` ne chargent que des
  modules d'une liste autorisée (rien de l'app connectée), qu'aucun module de dev (mocks, `?state=`,
  faux client) n'est dans le build et qu'aucune règle MapLibre n'est dans la feuille de style initiale.
- **Web** : chaque rendu de test passe par `TestProviders` (`src/test/`), qui crée un `QueryClient`
  neuf sans retry ; les tests de la politique de retry utilisent `createQueryClient()` et de faux
  timers. Les utilitaires asynchrones de Testing Library attendent jusqu'à 3 s (`setup.ts`) : le
  premier rendu d'une page lourde peut dépasser 1 s quand les trois apps testent en parallèle.
- **`test:db`** (`apps/api/test/db/*.db-spec.ts`) utilise la base du `docker compose`
  (`docker compose up -d`) : son `globalSetup` recrée une base dédiée `<DATABASE_NAME>_test` puis y
  joue les migrations **compilées** (le script fait `nest build` d'abord), en série
  (`--runInBand`). Chaque test vide les tables et remet le référentiel à son seed. Pas de
  Testcontainers.
- Côté fronts, `fetch` est simulé avec `vi.stubGlobal` et le client API est injecté par contexte.
  Aucun test ne fait d'appel réseau.
- Jest charge Nest 12 (ESM-only) via `--experimental-vm-modules`. L'avertissement
  `ExperimentalWarning` affiché est normal.

## 9. RGPD et données de santé

L'application manipulera des **données de santé** au sens de l'article 9 du RGPD (profondeurs,
paliers, incidents, éventuellement des données médicales). Les règles suivantes s'appliquent dès
maintenant :

1. **Aucune donnée personnelle dans les logs.** On utilise uniquement le `Logger` intégré de Nest.
   On ne logge jamais de corps de requête, d'en-têtes, de query string, de valeur d'env ni de
   message brut d'erreur de driver ou d'ORM : seulement un message générique plus le **nom de
   classe** de l'erreur (`common/logging/error-class-name.ts`). **Aucun identifiant non plus**
   (D40) : ni id de compte, de plongeur ou de session, ni email, IP, user-agent, token, mot de
   passe ou secret TOTP. Un événement d'authentification se logge par son seul nom
   (`login_succeeded`, `login_throttled`…) ; les gardes ne loggent rien (un refus est une réponse).
2. **Filtre d'exceptions `LogSafeExceptionFilter`.** Une erreur inattendue (ex. `QueryFailedError`,
   qui contient le SQL et ses paramètres) est loggée comme `Unhandled <Classe>` et renvoie une 500
   générique.
3. **Logging SQL TypeORM désactivé** (`logging: false`), parce que les paramètres de requête
   peuvent contenir des données de santé.
4. **La validation d'env ne logge que les noms** des variables en erreur, jamais leurs valeurs.
5. **Accès** : l'autorisation est appliquée **par l'API**, à chaque requête ; les gardes des fronts
   (loaders `requireSession` côté web, `requireStaffSession` et `canAccess` côté admin,
   `apps/admin/src/app/access-control/README.md`) ne sont que de l'UX.
   - **Session** (D33) : un cookie opaque (32 octets aléatoires), dont la base ne garde que le
     SHA-256 (`sessions`) ; le code métier ne lit que l'`AuthContext` construit par le garde, jamais
     le cookie.
   - **Refus par défaut** (D37) : trois gardes globaux, dans l'ordre, `OriginGuard` (méthodes non
     sûres : `Sec-Fetch-Site: same-origin`, ou à défaut de cet en-tête un `Origin` de
     `ALLOWED_ORIGINS`, sinon `403 forbidden`), `JsonBodyGuard` (un corps non JSON :
     `415 unsupported-media-type`) puis `SessionGuard` : sauf `@Public()`, `Cache-Control: no-store`
     sur la réponse (erreurs comprises), audience tirée du chemin de la route (`/api/admin/*` :
     cookie admin seul ; le reste : cookie web seul), `401 unauthenticated` sans session vivante,
     `403 forbidden` pour un rôle hors de l'audience ou de `@Roles(...)`, puis, sur les routes web
     sans `@AllowIncompleteProfile()`, `403 onboarding-required` ou `403 consent-required` tant que
     le profil ou le consentement manque. Un test d'inventaire fige la liste des routes publiques.
   - **Propriété** : le plongeur courant vient **toujours** de `@CurrentDiverId()`, un `DiverId`
     brandé que seul l'`AuthContext` fabrique (`asDiverId` est interdit ailleurs par ESLint, hors
     tests, seed et `src/cli`), jamais d'un paramètre client ; un compte staff y reçoit
     `403 forbidden`. Chaque requête SQL filtre par lui (palanquées comprises). Une ressource
     absente, supprimée ou appartenant à un autre plongeur répond la même **404 générique**, sans
     distinction possible ; le 403 est réservé au rôle, au profil incomplet et au consentement.
   - **Staff** (D42) : comptes distincts des plongeurs (aucun plongeur rattaché), mot de passe +
     TOTP obligatoire, sessions courtes. **Aucune route admin ne lit de données de santé.**
   - Les routes publiques d'authentification posent aussi `no-store` (`NoStoreGuard`).
6. **Consentement santé** (art. 9.2.a, D38) : recueilli à `/welcome` par une case dédiée, non
   pré-cochée et obligatoire, versionné (`consents.policy_version`, type `HealthPolicyVersion`) ;
   l'historique des versions est conservé. Retirer son consentement, c'est supprimer son compte
   (`DELETE /api/me`, mot de passe ressaisi) : effacement physique en cascade (art. 17).
7. **Cookies** (D34) : `__Host-edeep_sid` (web) et `__Host-edeep_admin_sid` (admin), `HttpOnly`,
   `Secure`, `SameSite=Strict`, `Path=/`, sans `Domain` (`edeep_sid` et `edeep_admin_sid` sans
   `Secure` quand `SESSION_COOKIE_SECURE=false`, en dev seulement). Persistant (`Max-Age`)
   seulement pour une session web « Rester connecté ». Aucun token n'est lisible par le JS.
8. **Traçabilité** (D40) : table `auth_events` (type et instant seulement, sans IP ni user-agent),
   purgée après 180 jours par `PurgeService` ; `account_deleted` est écrit sans compte.
9. **Secrets** : aucun secret dans le code ni dans le dépôt. Seuls les `.env.example` sont
   versionnés (`.gitignore` : `.env*` sauf `*.example`). La DB de dev n'écoute que sur localhost.
   Mots de passe en Argon2id (D35) ; secrets TOTP chiffrés en AES-256-GCM (`TOTP_ENCRYPTION_KEY`,
   une clé par environnement, D42) ; le seed lit son mot de passe dans `SEED_PASSWORD`.
10. **Logs sans stack hors dev** (D68) : `LogSafeLogger` (`common/logging/`), passé à
    `NestFactory.create`, retire toute stack des `error` et `fatal` hors `development` et `test` (un
    `NODE_ENV` absent compte comme la production) et remplace un `Error` par son nom de classe. Le
    log de `@nestjs/typeorm` à chaque échec de connexion (hôte et port dans la stack) et celui de
    l'`ExceptionHandler` de Nest n'en gardent que le message ; un `bootstrap()` rejeté aussi. Limite
    restante : la CLI TypeORM force le log des requêtes pendant `migration:*` (SQL des migrations
    seulement, aucune donnée de requête).

## 10. Décisions

> **Numérotation** : les décisions d'architecture s'écrivent `Dnn` (sans tiret, ce document) ; celles
> du modèle de données (`docs/data-model/decisions.md`) s'écrivent `D-nn` (avec tiret). Ce sont deux
> séries distinctes : D33 ici n'est pas D-33 là-bas.

Décisions prises lors de l'initialisation du **2026-11-06**.

| #   | Décision                                                                                                                                                                                                                                                                                                                                                     | Raison                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **NestJS en CommonJS + Jest**, alors que Nest 12 génère par défaut de l'ESM + Vitest. Le fichier est écrit à la main d'après le template CJS, car `nest new --type cjs` n'est plus un flag CLI.                                                                                                                                                              | Choix validé par le porteur du projet. La CLI TypeORM et ts-jest sont plus simples en CJS. Les paquets Nest 12 sont ESM-only et chargés via `require(esm)`.                                                                                                                                                                                                                                                                                                                                                                                                   |
| D2  | **TypeScript épinglé en `~6.0.3`**, alors que TS 7 est sorti.                                                                                                                                                                                                                                                                                                | typescript-eslint demande `<6.1`, ts-jest `<7`, et Nest CLI embarque `~6.0`. On repassera en TS 7 quand l'outillage le supportera.                                                                                                                                                                                                                                                                                                                                                                                                                            |
| D3  | **`verbatimModuleSyntax: false` dans `nest.json`.**                                                                                                                                                                                                                                                                                                          | Cette option est incompatible avec une sortie CommonJS (TS1286 sur les `import` ESM). Elle reste active dans `base.json` et `react.json`.                                                                                                                                                                                                                                                                                                                                                                                                                     |
| D4  | **Node 26 LTS** (`.nvmrc`, `engines >=26`).                                                                                                                                                                                                                                                                                                                  | C'est la LTS active depuis octobre 2026.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| D5  | **pnpm 12.18**, avec ses protections supply-chain par défaut : `minimumReleaseAge` (des exclusions explicites pour les versions Nest toutes récentes et `minimatch@11.0.5`, dépendance de `@nestjs/cli`, sont dans `pnpm-workspace.yaml`) et `allowBuilds`. `@parcel/watcher` est refusé, car son script d'install est inutile et le binaire est précompilé. | Sécurité de la chaîne d'approvisionnement. Les exclusions sont à retirer une fois les versions assez anciennes.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| D6  | **Scripts racine `migration:*`** (`pnpm migration:run`) au lieu de `pnpm migration:run --filter api`.                                                                                                                                                                                                                                                        | Avec pnpm 12, ce qui suit le nom du script lui est transmis. `--filter api` arriverait donc jusqu'à la CLI TypeORM, qui le rejette. Forme équivalente : `pnpm --filter api run migration:run`.                                                                                                                                                                                                                                                                                                                                                                |
| D7  | **Migrations lancées depuis `dist`** après `nest build`.                                                                                                                                                                                                                                                                                                     | Pas de ts-node (fragile avec TS 6 + nodenext). Le stripping de types natif de Node ne gère pas les décorateurs.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| D8  | **`GET /api/health` répond toujours 200**, avec `status: 'degraded'` / `database: 'down'` en cas d'échec DB. Le ping est borné à 3 s et la connexion à 5 s (`connectTimeoutMS`) : une base qui ne répond pas donne `down` et ne bloque pas l'endpoint. Pas de `@nestjs/terminus`.                                                                            | Contrat simple pour les fronts, et une dépendance de moins. Une sonde readiness en 503 pourra être ajoutée pour l'orchestration.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| D9  | **Pas de lib de data fetching** (TanStack Query) **ni de router** pour l'instant. `useHealth` s'appuie sur `use()`, Suspense, un `ErrorBoundary` maison et un petit `promiseCache`.                                                                                                                                                                          | _Data fetching remplacé par D24 (2026-11-13)._ Un seul endpoint en lecture : une lib serait superflue (éco-conception). **On adoptera TanStack Query** dès qu'il y aura plusieurs ressources serveur, des mutations avec invalidation ou des retries. **Router** : React Router (mode data) ou TanStack Router, à choisir à l'arrivée de la deuxième page ; seul `app/router.tsx` changera. _Router tranché par D20 (React Router en mode data, web, 2026-11-07) puis par D42 (même choix pour l'admin, décidé le 2026-11-20, livré au lot 7 le 2026-11-27)._ |
| D10 | **`sass-embedded`** plutôt que `sass`.                                                                                                                                                                                                                                                                                                                       | Compilateur Dart natif, plus rapide, détecté automatiquement par Vite 8.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| D11 | **shadcn/ui** : `shadcn init -b radix -p nova`, avec les composants `card`, `badge` et `button`. La CLI ne propose plus de `--base-color`, la couleur vient d'un preset.                                                                                                                                                                                     | Suit la doc Vite officielle. Pas de `baseUrl`, `paths` suffit. `init` installe `cn` (remplaçant de clsx + tailwind-merge), `class-variance-authority`, `lucide-react`, `radix-ui`, `tw-animate-css` et `shadcn` (pour `shadcn/tailwind.css`). La webfont Geist a été retirée.                                                                                                                                                                                                                                                                                 |
| D12 | **Layout admin sémantique** (`aside` / `nav` / `main` en Tailwind) au lieu du bloc `sidebar` de shadcn.                                                                                                                                                                                                                                                      | Il ne demande pas de JS et beaucoup moins de composants (éco-conception), et il est responsive.                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| D13 | **Code partagé entre fronts dupliqué** en phase 1 (client API, guards, `useHealth`…).                                                                                                                                                                                                                                                                        | Conséquence de D1 et de la règle « shared = types ». On factorisera au troisième consommateur (voir §6).                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| D14 | **PostgreSQL 18** (`18-alpine`).                                                                                                                                                                                                                                                                                                                             | Dernière majeure stable (19 est encore en RC).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| D15 | **Lint et format centralisés** à la racine. Le lint Nest 12 (oxlint) et celui du template Vite ne sont pas repris.                                                                                                                                                                                                                                           | Une seule config, imposée par le cadrage initial.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

Décisions prises à l'installation du design system (**2026-11-07**).

| #   | Décision                                                                                                                                                                                                                                                                                                                                                                                               | Raison                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D16 | **Polices Geist / Geist Mono auto-hébergées** (`@fontsource-variable/geist`, `-mono`), à la place de la pile système.                                                                                                                                                                                                                                                                                  | Rendu fidèle aux maquettes. Les fichiers sont servis par l'app (aucun CDN tiers, donc pas de transfert d'IP, RGPD), et le `unicode-range` limite le téléchargement au sous-ensemble latin.                      |
| D17 | **Design system DiveLog** (kit de handoff) : `tokens.ts` → tokens SCSS/CSS générés, thème sombre uniquement, mixins dédiés. Il remplace les anciens `_tokens`/`_mixins`/`_reset`/`main.scss`. Le kit est adapté à l'arborescence existante (`shared/ui`, `app/layout`, `features/dashboard`).                                                                                                          | Une seule source de vérité pour les tokens, partagée par SCSS et TS ; pas deux systèmes en parallèle.                                                                                                           |
| D18 | **Génération des tokens par Node natif** (`node scripts/generate-tokens.ts`, type stripping de Node 26), sans `tsx`. **Playwright** (Chromium) en devDependency pour les captures de comparaison aux maquettes.                                                                                                                                                                                        | Une dépendance de moins ; le script est typé par `tsconfig.node.json` (`allowImportingTsExtensions`). La vérification visuelle demande un vrai navigateur.                                                      |
| D19 | **`cx` maison** (`shared/lib/classNames.ts`) au lieu de `clsx` recommandé par le kit.                                                                                                                                                                                                                                                                                                                  | Fonction de 3 lignes déjà présente : pas de dépendance supplémentaire (éco-conception).                                                                                                                         |
| D20 | **React Router (mode data)** : `createBrowserRouter` dans `app/router.tsx`, table des routes dans `app/routes.tsx` (réutilisée par les tests via `createMemoryRouter`). `/` redirige vers `/dashboard` (_`/` est l'accueil public depuis D45_) ; les actions sans écran pointent vers des routes placeholder ; `/_dev/ui` (catalogue des primitives) n'existe qu'en dev.                               | Tranche D9 à l'arrivée de la deuxième page. Choix dicté par le brief du dashboard (`apps/web/design/prompts/`).                                                                                                 |
| D21 | **Corrections d'accessibilité des tokens** (audit du 2026-11-07) : `textLow` passe de `#6E819A` à `#889BB2` et `danger` de `#E06A70` à `#E47C81`, afin que le petit texte atteigne 4,5:1 sur toutes les surfaces (SC 1.4.3). Mixin `hit-area()` : zone tactile invisible de 44px autour des petites cibles (les repères de carte sont dimensionnés par `MapView`, regroupés quand ils se chevauchent). | Les maquettes utilisaient `textLow` pour des libellés essentiels de 10 à 12px (3,25:1 sur `surface2`). La teinte est la plus proche de l'originale qui passe AA, et la hiérarchie avec `textMed` est conservée. |

Décision prise à la création du schéma du carnet (**2026-11-08**). Détail : `docs/data-model/decisions.md`
(D-02, D-03, D-08 à D-12).

| #   | Décision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Raison                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D22 | **Stratégie offline-first du carnet** : identifiants **UUIDv7 générés par le client** (sauf `divers` et `certification_levels` : `DEFAULT uuidv7()`) ; `updated_at` **posé par trigger serveur** (curseur de pull `(updated_at, id)`, lu avec ses microsecondes) ; suppressions en **tombstones** (`deleted_at`), purgées physiquement après un **horizon de 90 jours** (`SYNC_PURGE_HORIZON_DAYS`), un client dont le dernier pull est plus ancien doit refaire une synchronisation complète ; **LWW par enregistrement** via un upsert sans prise de contrôle (`ON CONFLICT (id) … WHERE propriétaire = EXCLUDED.propriétaire`), sauf qu'un appareil en retard **ne peut pas annuler une suppression** (`baseUpdatedAt`) ; **plongée = événement + participation** (+ palanquée), écrite d'un bloc dans une transaction. | La PWA saisit hors ligne : les ids doivent exister avant la synchronisation, et seule l'horloge du serveur est fiable. Le découpage événement / participation est fait dès la migration initiale, car le changer plus tard imposerait de migrer IndexedDB sur chaque appareil. Les invariants MVP (un seul participant, le créateur) sont dans les services, pas en SQL, car ils seront levés avec le partage. |
| D23 | **`GET /api/dashboard`, premier endpoint métier** : statistiques calculées à la volée en SQL (une transaction `REPEATABLE READ`, plongées vivantes seulement, mois **locaux** de la plongée) ; contrat `DashboardResponse` dans `@e-deep/shared`, que le front valide (guard) puis convertit en son modèle de vue (`features/dashboard/api/dashboardApi.ts`). **Plongeur courant** résolu par `CurrentDiverGuard` : en attendant l'authentification, un **stub de développement** (`DEV_AUTH_STUB=true`) prend le premier plongeur créé ; sans lui, 401. _Historique : `CurrentDiverGuard` a disparu au lot 4 (2026-11-24, D37), remplacé par le `SessionGuard` global et `@CurrentDiverId()` ; le stub et son garde-fou au lot 6b (2026-11-26, D44)._                                                                     | Le volume (H-14) ne justifie aucun agrégat stocké. Le contrat partagé reste neutre (mois `YYYY-MM`, mesures `null` si non saisies) : libellés et initiales sont du ressort du front. Le garde est le point d'entrée unique de la future session, le reste ne changera pas.                                                                                                                                     |

Décisions prises avec le carnet « Mes plongées » branché sur l'API (**2026-11-13**).

| #   | Décision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Raison                                                                                                                                                                                                                                                                                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D24 | **TanStack Query** (`@tanstack/react-query` 5, sans devtools) dans `apps/web` : un `QueryClient` au niveau du module (`shared/lib/queryClient.ts`), **un seul retry** et seulement sur erreur transitoire (réseau, timeout, 5xx ; jamais sur 4xx ni réponse hors contrat), `staleTime` 60 s, pas de refetch au retour du focus, clés de requête par feature (`features/<domaine>/api/queryKeys.ts`). `useDashboard` et `useDives` passent dessus ; le forçage `?state=` désactive la requête. Remplace D9 pour le data fetching.                                                                                                         | Condition de D9 atteinte (health, dashboard, carnet, détail). Remplace deux chargements écrits à la main (useEffect + AbortController + compteur de tentatives) et apporte cache partagé, retry et déduplication, puis l'invalidation des futures mutations. Coût mesuré : 12,0 kB gzip seul, **+6,4 kB gzip net** sur le bundle (les mocks du carnet en sont sortis). |
| D25 | **`GET /api/dives` renvoie le carnet complet** (plongées vivantes, plus récente d'abord, plafond serveur 5 000) ; **filtres, tris, pagination numérotée, résumé et facettes restent calculés côté front** (`selectDives`). Pas de pagination keyset. `GET /api/dives/:id` donne le détail.                                                                                                                                                                                                                                                                                                                                               | La page (pagination numérotée, tris par profondeur et durée, résumé et facettes sur toute la sélection, compteur en direct) ne se prête pas à un curseur keyset. Le carnet pèse ~4 kB gzip pour 127 plongées, et la PWA offline-first (D22) aura de toute façon tout le carnet en local : une sélection serveur serait jetée.                                          |
| D26 | **Numéro de plongée calculé**, jamais stocké : `ROW_NUMBER() OVER (ORDER BY started_at, id)` sur les participations vivantes du plongeur, identique en liste et en détail.                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Avec des créations hors ligne sur plusieurs appareils, un numéro stocké avec contrainte unique entrerait en conflit à la synchronisation. Un décalage « carnet papier » pourra s'ajouter sur le plongeur.                                                                                                                                                              |
| D27 | **`dive_sites.locality`** (texte facultatif). La région reste un texte libre : côté front, les régions du filtre viennent des données (clé normalisée dans l'URL, `r-<hash>` quand le nom n'a pas de translittération latine).                                                                                                                                                                                                                                                                                                                                                                                                           | La maquette affiche « Calvi · Corse » ; une liste figée de régions ne survit pas à des sites saisis librement.                                                                                                                                                                                                                                                         |
| D28 | **Garde-fou du stub** : la validation d'env refuse `DEV_AUTH_STUB=true` avec `NODE_ENV=production` (le boot échoue), et `CurrentDiverGuard` pose `Cache-Control: no-store` sur toutes les réponses des routes qu'il protège. On garde `Diver` et `CurrentDiverGuard` plutôt qu'une entité `User` et un `CurrentUserProvider`. _Amendée par D36 et D44 : `Diver` reste le propriétaire des données et `Account` (table `accounts`) s'ajoute comme moyen de connexion ; `CurrentDiverGuard` a disparu au lot 4 (2026-11-24, D37), le stub et son garde-fou au lot 6b (2026-11-26, D44) ; `no-store` est posé par le `SessionGuard` (D37)._ | Le garde existait déjà (D23) : un échec au démarrage est plus sûr qu'une erreur à chaque requête. Les réponses portent des données de santé, aucun cache intermédiaire ne doit les garder.                                                                                                                                                                             |

Décision prise avec l'API d'écriture des plongées (**2026-11-18**). Détail : `docs/data-model/decisions.md` (D-23 à D-26).

| #   | Décision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Raison                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D29 | **`POST /api/dives` et `PUT /api/dives/:id`** (remplacement complet, D-22) : une transaction pour le site et les binômes créés par leur nom, le niveau D-21 des binômes et l'agrégat ; numéro D26 calculé dans la transaction ; `POST` idempotent (même contenu → 200, sérialisé par un verrou consultatif sur l'id), sinon `409 identifier-conflict` ; `PUT` d'une plongée absente, supprimée ou d'un autre → 404 ; site, binôme ou niveau inconnu ou d'un autre → même 422. **LWW strict** (D-25, choix du porteur) : pas de 409 « modifiée ailleurs ». DTO class-validator couvrant tous les `CHECK` ; erreurs `{ statusCode, code, fieldErrors? }` par chemin et par code, jamais la valeur reçue (D-26). | Le formulaire écrivait dans un dépôt en mémoire. Les services de synchronisation existants sont réutilisés sans duplication (variantes `…In(manager)`), ce qui laisse la synchronisation en lot à construire au-dessus. |

Décision prise avec les sites (**2026-11-19**). Détail : `docs/sites/plan.md`.

| #   | Décision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D30 | **Sites en front seul, carte MapLibre GL + CARTO Dark Matter.** _Données et écritures remplacées par D31 (2026-11-19) ; la carte reste._ Pas d'endpoint sites : les sites, leurs plongées et leurs statistiques viennent de `GET /dives`, les positions de `GET /dashboard` ; les écritures (création, modification, fusion, suppression) passent par le port `SitesRepository` (`shared/sites`), injecté par contexte (`SitesRepositoryContext`, `TestProviders`), implémenté **en mémoire** et superposé aux données de l'API. Un site créé localement part en `isNew: true` (avec son id) quand une plongée l'utilise : l'API le crée alors. Carte : `maplibre-gl` (6.19), chargé à la demande avec son worker (`setWorkerUrl`) et sa feuille de style, isolé dans `shared/ui/MapView` (repères HTML focusables, regroupement par source GeoJSON `cluster: true`, placement au clic ou repère fixe au centre sur téléphone), style vectoriel CARTO Dark Matter sans clé recoloré aux tokens (`transformStyle`), attribution « © OpenStreetMap contributors © CARTO » obligatoire. Pages : `/map` et `/sites/:siteId` (routes lazy) ; « Mes plongées » accepte `?site=:id`. Détail : `docs/sites/plan.md`. |

Décisions prises avec l'API des sites (**2026-11-19**). Détail : `docs/data-model/evolution-sites.md`,
`docs/data-model/decisions.md` (D-27 à D-33).

| #   | Décision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Raison                                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D31 | **API des sites** : `GET /api/sites` (sites vivants), `GET`, `PUT` (remplacement complet, D-22, LWW strict D-25), `POST` (ids client, idempotent si contenu identique, sinon `409 identifier-conflict`), `POST /api/sites/:id/merge` (`{ targetId }`) et `DELETE /api/sites/:id`. Migration `AddDiveSiteDetails` : `type`, `depth_min_m`, `depth_max_m`, `access_notes`, `created_via` (immuable) et `merged_into_id`. **Fusion côté serveur**, une transaction (plongées réaffectées, champs vides de la cible complétés, source tombstonée avec sa cible) ; une écriture qui référence un site fusionné est **redirigée** vers la cible. Suppression refusée s'il reste une plongée vivante (`409 site-in-use`). Zone calculée par le front, jamais stockée. Côté web, `createHttpSitesRepository` remplace le dépôt en mémoire derrière le port `SitesRepository` ; le libellé « Région » (« Calvi · Corse ») est découpé en `locality` / `region` par l'adaptateur (D-32). Remplace la partie « front seul » de D30 (dépôt en mémoire, positions par `GET /dashboard`, alias de fusion, `isNew` implicite à la création express). | Les écritures des sites étaient perdues au rechargement et une fusion ne changeait pas le site des plongées côté API. `merged_into_id` évite qu'un appareil hors ligne qui écrit sur la source la restaure (D-12 b) ou perde sa saisie. |
| D32 | **`DiveSummary` porte `entryType` et `diveCenter`** (`null` si non renseignés). Révise §6 (« `DiveSummary` ne porte aucun champ du détail ») pour ces deux champs seulement.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | La fiche site affiche la mise à l'eau et la structure **habituelles**, calculées sur le carnet : sans eux, « — ». Coût : deux champs courts par plongée (D25 reste tenu).                                                               |

Décisions prises avec l'authentification (**2026-11-20**, livrées par les lots 0 à 8 du
2026-11-20 au 2026-11-27, PR #22 à #31). Détail : `docs/plans/auth.md` ; modèle de données :
`docs/data-model/decisions.md` (D-34 à D-38).

| #   | Décision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Raison                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D33 | **Authentification maison par session serveur opaque.** Le token est fait de 32 octets aléatoires en base64url, dans un cookie `HttpOnly`. La base n'en garde que le `SHA-256`, dans la table `sessions`. Chaque requête lit la session par index unique et en tire un `AuthContext { accountId, diverId \| null, role, audience, sessionId }`. **Le code métier ne lit que ce contexte**, jamais le cookie. Le token est tourné au login ; un changement de mot de passe révoque les **autres** sessions du compte et tourne le cookie de la session courante, une réinitialisation par `account:reset-password` les révoque toutes. « Rester connecté » (`rememberMe`, coché par défaut) : coché, cookie persistant et session web de 30 jours d'inactivité et 180 jours au maximum ; décoché, cookie de session du navigateur (sans `Max-Age`) et expiration absolue à 24 h. `last_seen_at` est écrit au plus une fois par heure (web) ou par minute (admin). Il n'y a ni JWT, ni refresh token, ni librairie (Better Auth, passport) ni fournisseur d'identité (Keycloak, Auth0).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Une seule API et une seule base : le JWT n'apporterait aucune vérification sans état utile. La session donne une révocation immédiate (logout, suppression de compte, données de santé), rien à faire au rechargement, aucune course entre onglets et aucune dépendance. Une librairie imposerait ses propres migrations (conflit avec D7 et §7). Un IdP coûterait trop en exploitation (Keycloak) ou impliquerait un tiers US (Auth0). Isoler l'`AuthContext` limite une éventuelle bascule vers des tokens à un seul lot : garde, routes d'auth et `apiClient`. |
| D34 | **Même origine.** En prod, un reverse proxy sert `app.<domaine>` et `admin.<domaine>`, chacun avec son `/api`. En dev, le proxy Vite (`server.proxy`, `preview.proxy`) redirige `/api` vers `:3000` et `VITE_API_BASE_URL=/api`. Les cookies sont host-only : `__Host-edeep_sid` (web) et `__Host-edeep_admin_sid` (admin), en `Secure` et `SameSite=Strict`. En dev, ils s'appellent `edeep_sid` et `edeep_admin_sid`, sans `Secure`, selon `SESSION_COOKIE_SECURE`, qui vaut `true` par défaut. **Le CORS est retiré** (`ALLOWED_ORIGINS` remplace `CORS_ORIGINS`). Un `OriginGuard` global exige, sur les méthodes non sûres (routes publiques comprises), `Sec-Fetch-Site: same-origin`, ou, seulement quand cet en-tête est absent, un `Origin` présent dans `ALLOWED_ORIGINS` ; sinon `403 forbidden`. Un `JsonBodyGuard` global refuse un corps non JSON (`415 unsupported-media-type`). `trust proxy` est réglé par `TRUST_PROXY` et `x-powered-by` est désactivé (`configure-app.ts`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Il n'y a plus de preflight (éco-conception), plus de `credentials` cross-origin, et l'isolation entre web et admin est naturelle. `SameSite=Strict` plus le contrôle d'origine plus le JSON couvrent le CSRF sans token. En dev, localhost partage les cookies entre les ports : d'où deux noms distincts.                                                                                                                                                                                                                                                        |
| D35 | **Mots de passe** hachés en Argon2id via `node:crypto.argon2`, appel asynchrone (m = 19 456 KiB, t = 2, p = 1, sel de 16 octets, tag de 32 octets), stockés au format PHC et re-hachés au login si les paramètres changent ; mot de passe normalisé en NFKC avant hachage. Politique : 15 à 128 points de code après NFKC, aucune règle de composition, une liste locale de mots de passe compromis (extrait de SecLists `xato-net-10-million-passwords-1000000`, licence MIT, filtré aux entrées de 15 à 128 points de code : 10 898 entrées dans `compromised-passwords.txt`, livré avec sa `LICENSE` comme asset Nest ; `.gitattributes` : `*.txt text eol=lf`), refus s'il contient l'email ou le nom (fragments de 3 caractères au moins), pas d'appel à HIBP. **Elle remplace les critères de la maquette d'accueil** (10 caractères, une majuscule, un chiffre ; choix du porteur, 2026-11-20) : la jauge et les critères en direct mesurent la longueur (bloquant à 15) ; la liste de compromis et l'identité sont vérifiées par l'API à l'envoi (`fieldErrors.password`). **Limitation maison en mémoire** (`LoginThrottle`) : deux seaux à jetons, par IP (30 d'un coup, puis 1 toutes les 20 s ; une IPv6 compte par /64) et par email normalisé (5, puis 1 toutes les 2 min), clé `HMAC-SHA256` de l'email avec une clé aléatoire par processus, que le compte existe ou non ; horloge monotone, au plus 100 000 seaux (éviction LRU). Réponse 429 `too-many-attempts` avec `Retry-After`. Login : toujours `401 invalid-credentials`, avec un hash factice calculé si l'email est inconnu.                                                                                                                                                                                                                                                         | Disponible nativement sur Node 26.13 (vérifié), donc aucune dépendance et aucun `allowBuilds` (D5). Paramètres conformes à OWASP. Longueur conforme à NIST 800-63B rev. 4 (au moins 15 en facteur unique, au moins 64 acceptés) et à la CNIL. La limitation par email existe aussi pour un email inconnu : un 429 ne révèle donc pas l'existence d'un compte. Une instance unique suffit ; un redémarrage remet les compteurs à zéro, c'est accepté.                                                                                                              |
| D36 | **Table `accounts` séparée de `divers`** (`diver_id` UNIQUE nullable, `CASCADE`). Email en `text` normalisé (`lower` + `btrim`, `CHECK`, UNIQUE), sans `citext` ; ASCII seulement pendant la bêta. Rôle `diver \| support \| admin` en `text` + `CHECK`, avec la contrainte `(role = 'diver') = (diver_id IS NOT NULL)` : **un compte staff n'a pas de plongeur**. **Amende D28** : `Diver` reste le propriétaire des données, et `Account` n'est qu'un moyen de connexion. **Profil incomplet** : l'inscription minimale de la maquette (prénom, email, mot de passe) crée le plongeur sans nom ni niveau ; la migration `AllowIncompleteDiverProfile` rend `divers.last_name` et `divers.certification_level_id` nullables. Le niveau est obligatoire à `/welcome` (D38) avant tout accès au carnet ; les lectures du carnet passent par un type `CompleteDiver`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Sépare l'authentification du profil : le futur pull de `divers` ne portera jamais de hash. Le compte staff est distinct du compte plongeur (séparation des privilèges). L'effacement (art. 17) reste un `DELETE divers` qui descend en cascade. Une migration purement additive : impossible de remplir un email pour les plongeurs existants.                                                                                                                                                                                                                    |
| D37 | **Refus par défaut.** Trois gardes globaux (`APP_GUARD`, `AccessControlModule`), dans cet ordre : `OriginGuard` (D34), `JsonBodyGuard` (D34), puis `SessionGuard`, qui exige une session sur toute route. Exceptions explicites : `@Public()`, `@Roles(...)` (restreint les rôles de l'audience, ne les élargit jamais ; `@Public()` + `@Roles()` sur une même route refusé au boot par `AccessMetadataCheck`) et `@AllowIncompleteProfile()` (routes du compte accessibles avant `/welcome` ou sans consentement à jour). L'audience se déduit du chemin déclaré de la route, jamais de l'URL reçue : `/api/admin/*` n'accepte que le cookie admin, le reste que le cookie web. `Cache-Control: no-store` est posé sur toute route non publique (et par `NoStoreGuard` sur les routes publiques d'authentification). `@CurrentDiverId()` remplace `CurrentDiverGuard`, renvoie un `DiverId` typé (brandé, fabriqué par l'`AuthContext` seul ; `asDiverId` interdit par ESLint hors tests, seed et `src/cli`), et répond 403 pour un compte staff. Un **test d'inventaire** énumère toutes les routes et les compare à la liste figée des routes publiques. On garde la 404 générique. Le 403 est réservé à un rôle insuffisant, au profil incomplet (`onboarding-required`) et au consentement périmé (`consent-required`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Un oubli de décorateur ne peut plus exposer une route. Le type `DiverId` empêche de passer un id venu du client à un service (à étendre avec la synchronisation, §11). Le test casse dès qu'une route publique est ajoutée sans être déclarée. L'`OriginGuard` passe en premier : une requête forgée est refusée avant toute lecture de session.                                                                                                                                                                                                                  |
| D38 | **Consentement santé** (art. 9.2.a) : table `consents` (`purpose`, `policy_version`, `granted_at`, `withdrawn_at`). **Recueilli à `/welcome`** (premier lancement), avec le niveau et le nom facultatif, par une case dédiée, non pré-cochée et obligatoire ; l'inscription ne porte que la mention CGU et confidentialité de la maquette, car aucune donnée de santé n'existe avant `/welcome`. La version est un **type littéral** dans `@e-deep/shared` (`HealthPolicyVersion`) ; le texte affiché vit dans `apps/web/src/shared/config/consent.ts`, indexé par version. Sans niveau ou sans consentement, réponse `403 onboarding-required` (redirection vers `/welcome`) ; avec un consentement d'une version périmée, `403 consent-required` (re-consentement à `/consent`). **Retirer son consentement = supprimer son compte** (`DELETE /api/me`, après re-saisie du mot de passe : `AccountsService.deleteAccount` → `DiversService.deleteAccountIn(manager, …)`, où s'insérera le transfert RG-22).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Sans base légale, le carnet ne peut plus être conservé : un seul chemin, sans état intermédiaire ni planificateur. Une version typée oblige le texte du front et l'API à évoluer ensemble.                                                                                                                                                                                                                                                                                                                                                                        |
| D39 | **V1 sans email** : bêta fermée (`REGISTRATION_ENABLED=false` par défaut, sinon `403 registration-closed`). La réinitialisation passe par une commande d'exploitation (`account:reset-password`). `409 email-taken` à l'inscription (énumération acceptée en bêta fermée). **Le lot email** (vérification, réinitialisation, inscription non énumérante en 202, fournisseur UE appelé par `fetch`) **doit être livré avant d'ouvrir l'inscription au public**. Côté web, le drapeau `features.signup` (`shared/config/app.ts`), aligné à la main sur `REGISTRATION_ENABLED`, remplace l'onglet et les boutons d'inscription de l'accueil par « Inscriptions bientôt ouvertes », et `/signup` redirige vers `/login` ; l'API reste l'autorité. « Mot de passe oublié ? » mène à une page placeholder qui invite à contacter le support.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Évite en V1 un fournisseur, des DNS SPF/DKIM/DMARC et un lot. La dette est bornée par le flag.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| D40 | **Journalisation** : logs Nest réduits au nom de l'événement et à un code de raison, **sans** id, email, IP, user-agent ni token. Table `auth_events` (`account_id` nullable, `type`, `occurred_at`), sans IP, purgée après 180 jours par `PurgeService`. Types : `login_succeeded`, `login_failed`, `login_throttled`, `logout`, `sessions_revoked`, `password_changed`, `password_reset_by_operator`, `consent_granted`, `account_deleted` (sans compte), `account_created` (inscription d'un plongeur et création d'un compte staff par `account:create-staff`, migration `AddAccountCreatedAuthEvent`) et `totp_reset` (`AddStaffTotp`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Traçabilité recommandée par la CNIL (6 mois à 1 an) sans donnée réseau. Pseudonymiser l'id n'apporterait rien : il resterait une donnée personnelle.                                                                                                                                                                                                                                                                                                                                                                                                              |
| D41 | **Web** : `GET /api/me` est la source de l'identité. Un loader `requireSession` sur le layout protégé lit `/me` par `queryClient.fetchQuery(meQueryOptions)` (`loadSession`, `staleTime: Infinity`, relu après invalidation) et renvoie vers `/welcome` ou `/consent` selon `me.onboarding`. Un 401 renvoie vers `/login?next=` (`next` interne uniquement). Tout 401 attrapé globalement vide le cache puis renvoie au login. Le logout est une action de route (`/logout`) ; logout, « déconnecter tous les appareils » et suppression du compte passent par le même `endSession` : il vide le cache, purge les brouillons et prévient les autres onglets par `BroadcastChannel`. Brouillons rangés sous `e-deep:dive-draft:<diverId>:<mode>`, avec une époque avancée à chaque purge (un formulaire ouvert avant ne réécrit pas). `mockUser` disparaît du code de prod. Entrée publique `/`, `/login`, `/signup` avec un loader `redirectIfAuthenticated` : une session ouverte part vers `next` (interne, `safeNext`), sinon vers la page d'onboarding de son statut, sinon `/dashboard` ; `/forgot-password` et les pages légales se lisent avec ou sans session ; après inscription, `/welcome`. Les appels passent par le port **`authClient`** (`me`, `login`, `signup`, `logout`, `logoutAll`, `completeOnboarding`, `grantConsent`, `changePassword`, `deleteAccount`, `certificationLevels`, sans `refresh`) : adaptateur HTTP en prod, faux en mémoire pour les tests et le forçage `?state=` en dev, **jamais de session simulée dans le bundle** (vérifié par `check:public-bundle`). L'identité se lit par `useMe()` / `useCurrentDiver()` au-dessus de TanStack Query, sans état propre ; les actions par des hooks dédiés (`useLogin`, `useSignup`, `useCompleteOnboarding`…). _Le hook `useAuth()` prévu par le plan a été retiré au lot 6a._ | Ferme les points ouverts §11 « identité » et « brouillon RGPD (clé) ». Pas de token côté JS, donc pas de refresh ni de file de rejeu.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| D42 | **Admin** : React Router en mode data (fin de D9 côté admin), sans TanStack Query ; routes `/login`, `/`, `/forbidden`, l'action `/logout` et une page introuvable (`*`, `NotFoundPage`), garde par loader rejoué à chaque navigation (`GET /api/admin/me` : 401 → `/login?next=`, 403 → `/forbidden`) et `canAccess` (fonction pure) sur `handle.allowedRoles` (`apps/admin/src/app/access-control/README.md`). Sessions staff courtes (30 min d'inactivité, 8 h au maximum). **TOTP obligatoire pour le staff** (RFC 6238 natif, HMAC-SHA1, 6 chiffres, pas de 30 s, ±1 pas) : secret dans `accounts.totp_secret`, chiffré en AES-256-GCM avec `TOTP_ENCRYPTION_KEY` et l'id du compte en données authentifiées ; **anti-rejeu** par `accounts.totp_last_used_step`, accepté atomiquement seulement s'il est plus récent que le dernier pas et si le secret lu est toujours celui en base. Enrôlement par `account:create-staff`, ré-enrôlement par `account:reset-totp`, URI `otpauth://` affichée une seule fois sur le terminal. Boot refusé sans clé (ou avec une clé qui ne déchiffre pas) dès qu'un compte staff existe. **Aucune route admin ne lit de données de santé.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Deuxième page admin (login), condition de D9. Les sessions web sont longues (30 jours d'inactivité, 180 jours au maximum) parce que la PWA hors ligne (D22) en a besoin ; le staff n'a pas ce besoin. L'id du compte en données authentifiées empêche de recopier un secret sur un autre compte.                                                                                                                                                                                                                                                                  |
| D43 | **Partage hors périmètre** : la règle « un seul participant » est maintenue, et aucune route ne permet de chercher ou de lier un autre compte. Le modèle cible (§8 du plan) est consigné dans D-08.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Le partage demande son propre consentement (données de santé d'un tiers), RG-22 et le pull élargi : c'est une feature à part entière.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| D44 | **`DEV_AUTH_STUB` supprimé** (variable, validation, branche du garde) au lot 6b (2026-11-26). Les tests sans base remplacent `SessionService` par un faux. Le seed crée de vrais comptes (`@example.test`, mot de passe lu dans `SEED_PASSWORD`, sans valeur par défaut). Le staff est créé par la commande `account:create-staff`. **`NODE_ENV` devient obligatoire** (lot 0).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Supprime le risque d'un `NODE_ENV` oublié qui accepterait le stub (§11). Aucun secret dans le dépôt.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| D45 | **Accueil public** (spec `design/pages/accueil.md`, captures 50 à 53) : une page publique de présentation avec la carte d'authentification dans le hero (≥ 1024 px), des écrans dédiés `/login` et `/signup` en dessous. L'accueil **n'importe aucun code de l'app connectée** (routes de l'app chargées à la demande ; vérifié par `pnpm --filter web run check:public-bundle`, en CI) ; aperçu produit en images WebP dans `public/marketing/` ; promesses pilotées par `features.offline`, `features.signup` et `privacy.copy` ; méta SEO et Open Graph, sans pré-rendu.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Le premier écran vu par un visiteur doit rester léger (éco-conception) et ne rien promettre que le produit ne livre pas.                                                                                                                                                                                                                                                                                                                                                                                                                                          |

Décisions prises pour la mise en ligne de la bêta fermée (**2026-11-28**). Détail : §12. D46 à
D60 sont réservées au plan mobile (`docs/plans/mobile-foundations.md`).

| #   | Décision                                                                                                                                                                                                                                                                                                                        | Raison                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D61 | **Caddy** est le reverse proxy **et** le serveur des fichiers statiques de la prod (`deploy/Caddyfile`, image `caddy:2.11-alpine`).                                                                                                                                                                                             | HTTPS automatique (Let's Encrypt, renouvellement, HTTP/3) sans certbot ni cron, et une configuration de quelques dizaines de lignes. Un seul processus pour le TLS, le proxy, la compression et les en-têtes.                                                                                                                                                                           |
| D62 | **Fronts sans conteneur Node** : web et admin sont construits dans un stage de `deploy/caddy/Dockerfile`, et seuls leurs `dist/` sont copiés dans l'image Caddy (`/srv/web`, `/srv/admin`).                                                                                                                                     | Éco-conception : deux SPA statiques n'ont besoin d'aucun runtime. Une image de 69 Mo, aucun processus Node de plus à surveiller.                                                                                                                                                                                                                                                        |
| D63 | **Même origine en prod** : `/api/*` est proxifié vers `api:3000` sur le domaine web **et** sur le domaine admin, chemin inchangé (préfixe global `api` conservé). Aucun CORS ; `ALLOWED_ORIGINS` vaut `https://${WEB_DOMAIN},https://${ADMIN_DOMAIN}`. Les fronts utilisent `/api` par défaut, sans variable `VITE_*` au build. | Prolonge D34 : cookies `__Host-` propres à chaque domaine, `SameSite=Strict` sans exception, aucun en-tête CORS à maintenir. Pas de réécriture de chemin : dev (proxy Vite) et prod se comportent de la même façon.                                                                                                                                                                     |
| D64 | **Seul Caddy publie des ports** (80, 443, 443/udp). `api` et `db` n'ont pas de `ports:` et ne sont joignables que sur le réseau du compose.                                                                                                                                                                                     | Docker écrit ses propres règles iptables et contourne ufw : un port publié serait exposé à Internet quoi que dise le pare-feu.                                                                                                                                                                                                                                                          |
| D65 | **Migrations de prod sans build** : `migration:run:prod` lance la CLI TypeORM (dépendance de prod) sur `dist/database/data-source.js`, par `docker compose … run --rm api npm run migration:run:prod`. C'est une étape explicite du déploiement (`migrationsRun: false` reste la règle).                                        | L'image ne contient ni sources ni `nest build`. npm est livré avec l'image Node : pnpm reste absent du runtime, et le script de `package.json` reste la seule définition de la commande.                                                                                                                                                                                                |
| D66 | **pnpm sans corepack** dans les images : `npm install -g` de la valeur exacte de `packageManager` (lue par `node -p`), `pnpm fetch` puis `install --offline --frozen-lockfile` filtré, et `pnpm deploy --prod` pour l'api (`files: ["dist", "!dist/**/*.map"]`).                                                                | Corepack n'est plus livré avec Node ≥ 25. Une seule source de version. `fetch` met les paquets en cache sur le seul lockfile. L'api n'a aucune dépendance workspace de prod (`@e-deep/shared` = types effacés au build) : `deploy` fonctionne sans `injectWorkspacePackages`. Seul `deploy` reste en ligne, car il revérifie la politique supply-chain sur les métadonnées du registre. |
| D67 | **`trust proxy` = 1** en prod (`TRUST_PROXY=1`, Caddy étant le seul saut).                                                                                                                                                                                                                                                      | `req.ip` (limitation par IP, D35) et `req.protocol` viennent du `X-Forwarded-*` de Caddy, qui ignore celui du client ; un nombre de sauts exact empêche un client de choisir son IP.                                                                                                                                                                                                    |
| D68 | **`LogSafeLogger`** passé à `NestFactory.create` : aucune stack dans les logs hors `development` et `test` (§9.10).                                                                                                                                                                                                             | Le log de `@nestjs/typeorm` à l'échec de connexion contient l'hôte et le port de la base dans sa stack. Un `NODE_ENV` inconnu compte comme la production (fail-safe).                                                                                                                                                                                                                   |
| D69 | **Basic auth Caddy devant tout le domaine admin** pendant la bêta, API comprise (hash bcrypt fourni par l'environnement), en plus de la connexion staff et du TOTP. L'en-tête `Authorization` est retiré avant le proxy. L'allowlist `remote_ip` est l'alternative documentée.                                                  | Défense en profondeur : le back-office n'est même pas atteignable sans un premier secret, et aucune surface de l'API admin n'est exposée aux scanners. Les identifiants basic n'atteignent jamais l'API.                                                                                                                                                                                |
| D70 | **Compose de prod** : un seul `deploy/.env.prod` (interpolation par `--env-file`), un bloc `environment:` **par service** avec ses seules variables, et chaque service buildable a à la fois `build:` et `image: ghcr.io/…:${TAG:-latest}`.                                                                                     | Moindre privilège : Caddy ne voit pas le mot de passe de la base, l'API ne voit pas le hash basic. Les mêmes fichiers servent au build sur le VPS aujourd'hui et au pull depuis GHCR demain.                                                                                                                                                                                            |

## 11. Points ouverts

Issus de la revue de l'initialisation (2026-11-06). Ils ne sont pas bloquants.

- **Client API (web + admin)** : un timeout ou une annulation survenant pendant `response.json()`
  est classé `invalid-response` au lieu de `timeout` / propagé.
- **Accessibilité** : le `role="status"` du fallback Suspense est remplacé par une nouvelle région
  live, donc le premier résultat peut ne pas être annoncé. Il faut garder une région live
  persistante autour de la limite Suspense. _Résolu pour `/dives`_ (région persistante dans
  `DivesPage`) ; reste ouvert pour `HealthPanel`.
- ~~**API avant la prod**~~ : soldé à la mise en ligne (2026-11-28, §12). `X-Powered-By` désactivé
  (`configure-app.ts`, test `health.e2e-spec.ts`) et JSON malformé neutralisé
  (`400 validation-failed`, `_body: ['malformed']`, sans extrait du corps : `raw-middleware-errors.ts`,
  test `auth.e2e-spec.ts`) étaient déjà livrés ; logger sans stack : `LogSafeLogger` (D68, §9.10).
  L'option `ssl` de PostgreSQL est sans objet tant que la base reste sur le réseau Docker interne du
  même hôte (à rouvrir pour une base managée ou distante).
- **Tests à ajouter** : ~~rejet CORS d'une origine non autorisée~~ (plus de CORS depuis D34 ; le
  refus d'une origine est couvert par `origin.guard.e2e-spec.ts`) ; timeout d'`apiClient` côté admin
  (`validateEnvironment` et le timeout du client web sont couverts depuis le carnet).

Issus du schéma du carnet (2026-11-08) :

- **Contrat front** : `UserLevel` (`'N1'…'N4'`) devra s'élargir dès qu'un niveau non FFESSM sera
  inséré (`toUserLevel` refuse aujourd'hui ces niveaux). (`utcOffsetMinutes` et la date locale ISO
  sont exposés par `DashboardDive` et `DiveSummary`.)
- ~~**Endpoints** : erreurs métier en 500 générique~~ : traduites par `LogSafeExceptionFilter`
  (`common/errors/domain-error-http.ts`, D29).
- ~~**Authentification réelle à brancher avant toute exposition hors dev.**~~ : livrée (D33 à
  D45, lots 0 à 8, 2026-11-20 → 2026-11-27). `NODE_ENV` est obligatoire (lot 0) ; `CurrentDiverGuard`
  a disparu au lot 4 (2026-11-24, D37), le stub `DEV_AUTH_STUB` et son garde-fou au lot 6b
  (2026-11-26, D44) ; le plongeur courant vient du `SessionGuard` (D37).
- **Purge** : `PurgeService.purge()` existe sans planificateur (il purge aussi les sessions
  expirées et les `auth_events` de plus de 180 jours, D40).
- **Partage des plongées** (D-08) : transfert des événements partagés à insérer dans
  `DiversService.deleteAccount`, avant le `DELETE`, et passage de `fk_dive_events__creator_id` en
  `RESTRICT`.

Issus du dashboard (phases 1 à 5, 2026-11-07) :

- ~~**Carte** : placeholder SVG~~ : `MapView` en lecture seule (2026-11-19, D31), cadrée sur les sites placés, repères regroupés. Écarts acceptés : l'emprise réelle (Bretagne → Corse) montre toute la France au lieu de la Méditerranée serrée de la maquette ; les grappes sont inertes (« Tous les sites » mène à `/map`) ; le popover n'est plus recadré près des bords ; l'état vide garde un fond CSS (maplibre n'est pas chargé sans site).
- **Données** : le dashboard lit `GET /api/dashboard` (D23, via `useQuery` depuis D24) ; ses chiffres
  sont désormais ceux du carnet des maquettes « Mes plongées » (seed). Les mocks ne servent plus qu'au forçage
  `?state=loading|empty|ready` en dev et aux tests. ~~Le `UserCard` du shell affiche encore
  `mockUser`~~ : il lit `GET /api/me` (`useCurrentDiver()`, D41). La carte placeholder place hors cadre
  les sites éloignés (Lavezzi). Les captions sans donnée de la maquette (« pace stable », « +1h42 ce mois ») ne sont pas affichées. `stats.mainArea` a été ajouté aux types pour « Méditerranée occidentale ».
- **Filtres de période** de la carte : visuels uniquement (état local).
- **i18n** : textes en français écrits dans les composants. Une lib i18n sera à prévoir si une deuxième langue arrive.
- **Pages** : Statistiques, Binômes, Recherche et Notifications sont des placeholders (Carte : D31 ;
  Paramètres : `/settings`, lot 6b de l'authentification). La page Statistiques demandera une lib de graphiques (Visx ou ECharts, couleurs via `tokens.ts`).
- **Accessibilité** : audit fait à la main et par scripts Playwright (axe-core n'est pas installé : à ajouter en CI si on accepte la dépendance). Le menu du compte se ferme au clic extérieur via `focusout`, sans écouteur global.

Issus du carnet « Mes plongées » (revue et audits, 2026-11-13) :

- ~~**API avant la prod** (suite)~~ : soldé à la mise en ligne (§12) :
  - ~~compression HTTP absente~~ : `encode zstd gzip` de Caddy, API comprise (`GET /api/dives` :
    56 kB bruts pour 127 plongées, ~4 kB en gzip, ~2,2 MB bruts au plafond) ;
  - ~~régler `random_page_cost≈1.1` (SSD)~~ : `command: postgres -c random_page_cost=1.1` dans
    `deploy/docker-compose.prod.yml`. Mesure d'origine : avec la valeur par défaut, la liste fait un Seq Scan de
    `dive_events` + Hash Join (36–40 ms pour 4 900 plongées dans une table de 204 000 lignes,
    13 ms avec le réglage). L'index `(creator_id, started_at DESC, id DESC)` a été mesuré : il
    n'est **pas** utilisé, il n'est donc pas créé.
- **Carnet** :
  - le plafond de 5 000 plongées (D25) coupe la liste **sans le signaler** ; le front calculerait
    alors résumé et facettes sur une liste tronquée. Ajouter `total` ou `truncated` au contrat le
    jour où un carnet s'en approche ;
  - `findOne` calcule la numérotation sur tout le carnet pour une seule plongée (acceptable au
    volume prévu) ;
  - la jointure des sites se fait sur le créateur de l'événement, celle du dashboard sur le
    plongeur : même résultat dans le MVP, à aligner avec le partage des plongées (D-08) ;
  - ~~sync des sites : un `locality` omis devient `null` dans l'upsert LWW~~ : tranché par D-22
    (`decisions.md`), tous les champs sont obligatoires à l'écriture ; porté par les DTO de
    `POST` / `PUT /api/dives` (D29), reste à faire pour l'endpoint de synchronisation en lot ;
  - recherche : `normalize('NFD')` refait à chaque frappe sur tout le carnet (0,25 ms pour 127
    plongées, 8,4 ms pour 5 000) ; précalculer le texte normalisé si un gros carnet le justifie.
- **Seed** : pas de transaction globale (les services ouvrent leurs propres transactions) ; un
  échec en cours laisse un état partiel, et relancer le seed le répare. Ses refus (production,
  base non locale, migrations en attente) ne sont pas testés.
- **Tests API** : départage par `id` de deux plongées au même instant, cohérence du numéro
  liste/détail avec des tombstones intercalés, plafond vérifié en base ; l'assertion « 404 sans
  l'id » de l'e2e ne peut pas échouer (le vrai test est en base).
- ~~**Web, identité** : `mockUser` sert encore de propriétaire du carnet et au `UserCard` ;
  `queryClient.clear()` au logout~~ : soldé par D41 (lots 5 et 6) : `useCurrentDiver()` lit
  `GET /api/me`, `mockUser` ne reste que dans les mocks des tests et du forçage `?state=`, et
  `endSession` vide le cache de requêtes et de mutations à chaque fin de session (les clés de
  requête ne contiennent toujours pas l'utilisateur). Reste : le memo de `useDives` dépend de
  l'identité de l'objet `owner`.
- **Web, chargement** : `useHealth` reste sur `use()` + Suspense + `promiseCache` ; deux mécanismes
  coexistent (migration non triviale). Les guards web sont factorisés dans `shared/lib/guards.ts` et
  divergent de la copie admin : le seuil de factorisation de §6 est atteint.
- **Web, accessibilité** : un changement de page n'est pas annoncé (la région live garde « N
  plongées dans la sélection ») et, sur mobile, le focus reste en bas de page ; le conteneur focalisé
  après un retry n'a ni rôle ni nom ; les selects « Trier » et « Par page » font moins de 44 px sur
  mobile (AA respecté, pas la règle du projet).
- **Web, divers** : en mode forcé `?state=error` (dev), « Réessayer » appelle l'API ;
  `isDateString` accepte d'autres formats que celui du contrat ; les couleurs d'avatar sont
  dérivées de l'id dans `/dives` mais pas dans le dashboard ; commentaire « white initials » de
  `tokens.ts` inexact (les initiales sont en `textHigh`, ≥ 4,52:1) ; `docs/data-model/schema.md`
  ne mentionne pas encore `locality`.
- **Écarts visuels acceptés** par rapport aux maquettes : couleurs et ordre des avatars des
  binômes, « Agay · Esterel » et « Saint-Raphaël · Esterel » au lieu de « … · Var », initiales
  « ÉM » (le formateur garde les accents).
- **Tests web** : un échec isolé de `pnpm test`, non reproduit, a été attribué à l'attente de 1 s
  sous charge et corrigé (3 s) ; `useDashboard.test.tsx` utilise `vi.waitFor`, qui reste à 1 s.

Issus du détail de plongée (`/dives/:diveId`, front, 2026-11-16) :

- **Champs du détail** : modélisés (D-13 à D-22), servis par l'API (`AddDiveDetailFields`) et
  **rendus** par la page (2026-11-17). Le guard `isDiveDetail` vérifie chaque champ : un ensemble de
  littéraux par union (`satisfies readonly X[]`), `isCertificationLevelRef`, `isDiveObservation` et
  le niveau des binômes. Toute valeur ajoutée à une union se déploie donc **front d'abord** (D-14).
  `DiveDetailView` groupe les champs par carte (`conditions`, `equipment`, `safetyStop`). Le niveau
  passe par `DiveDetailMember` (propre au détail) : `DiveMember` ne change pas, le dashboard et la
  liste non plus. Dérivés calculés par le front, **jamais servis** : heure de sortie, bar consommés
  (rien si fin > début), % O₂ d'Air ou de Nitrox (21, 32, 36), segment « palier » de la barre de
  temps. Les lignes composées viennent de `features/dives/lib/diveFacts.ts`. Décisions et reste :
  - **qualificatif de visibilité** (« Bonne ») : **décidé, non affiché** (2026-11-17) ; aucun
    barème, la perception dépend du milieu ;
  - **libellés des unions** : valeurs et libellés H-18 **validés** (2026-11-17) ;
  - un palier saisi à moitié (contraire au contrat) est traité comme non saisi, et non rejeté ;
  - non modélisés : détail des paliers de déco. (reporté, D-16), hélium, plusieurs blocs.
- **Actions** : « Modifier ma plongée » (`/dives/:id/edit`) et « Dupliquer » (bouton icône à la
  place du menu « … », dont c'est la seule action avec un écran) sont rendus depuis le formulaire
  (2026-11-17). Restent non rendus : Exporter et Supprimer (pas d'endpoint), le lien « Compléter »
  des champs vides (« — · Non renseignée »), « Toutes mes plongées ici » (la query de `/dives` n'a
  pas de filtre par site) et les raccourcis `←` / `→` / `e`.
- ~~**Carte** : décor placeholder~~ : `MapView` en lecture seule centrée sur le site (2026-11-19),
  coordonnées en haut à gauche, pas de carte (ni maplibre) pour un site sans position.
- **`placeholderData` non retenu** : `useQuery` attend un `DiveDetail` complet, que le résumé du
  carnet ne fournit pas (coordonnées, visibilité, paliers) sans valeur inventée ni cast. À la place,
  l'état `loading` de `useDive` porte un `preview` lu dans le carnet en cache, qui affiche l'en-tête
  réel pendant le chargement.
- **Lecture du carnet** : `useDive` lit aussi `GET /dives` (même cache que la liste, non bloquant)
  pour précédente / suivante, record personnel, « Tes plongées ici », « Ta prof. max ici » et
  « N plongées ensemble ». Une API dédiée (voisins, compteurs) éviterait de charger tout le carnet
  sur un accès direct ; à revoir avec la PWA (D22), où le carnet sera local.
- **404 et 400** donnent le même état `not-found` (message neutre, sans l'id).
- **Date locale d'une plongée** : deux mécanismes coexistent. La liste lit le jour dans la chaîne
  ISO (`calendarDay`, `shared/lib/format.ts`), le détail décale l'instant de `utcOffsetMinutes`
  (`features/dives/lib/diveTime.ts`). Ils divergeraient si le décalage de `date` et
  `utcOffsetMinutes` ne concordaient plus : à unifier dans `shared/lib/format`. `teamSizeLabel`
  double en partie `formatDiverCount` (libellés différents).
- **Ordre de lecture sous 1280 px** (écart accepté) : la spec fait remonter la palanquée juste
  après le Déroulé sur mobile et tablette ; les colonnes passent en `display: contents` et `order`
  réordonne les cartes, donc l'ordre visuel (Déroulé, Palanquée, Équipement & gaz, Conditions,
  Notes, Site) diffère de l'ordre du DOM (Déroulé, Équipement & gaz, Conditions, Notes, Site,
  Palanquée). Les cartes n'ont aucun élément focalisable (ordre du focus intact) et sont des
  sections indépendantes ; une grille à aires couplerait les hauteurs des deux colonnes sur desktop.
- **FAB** : masqué dans `AppShell` par `useMatch('/dives/:diveId')` (qui couvre aussi
  `/dives/new`). Un `handle: { fab: false }` sur les routes, lu par `useMatches()`, éviterait un cas
  particulier par page.
- **Carnet converti deux fois** : `useDive` refait `toDiveLog` sur tout le carnet, déjà converti
  par `useDives` (memo distincts, `toSelfMember` recalculé). Négligeable à 127 plongées ; un
  `select` partagé sur `divesKeys.log()` mutualiserait la conversion entre la liste et le détail.
- **Mobile** : la barre du haut est celle de l'application, pas la barre dédiée de la spec (retour,
  modifier, « … »), qui demanderait un slot de page dans `AppShell` ; le FAB est masqué sur
  `/dives/:id`. La maquette met le h1 mobile en 26/30 et les KPI desktop en 40 : on garde `h1` et le
  `KpiCard` partagé (44).
- **Bundle** : +4,5 kB gzip de JS et +1,8 kB gzip de CSS (route non chargée à la demande, comme les
  autres pages) ; les sections du détail ajoutent +3,0 kB gzip de JS et +0,2 kB gzip de CSS.
- **Écarts visuels acceptés des sections du détail** :
  - « — » reste en `textMuted` (≈ 2:1) mais en `aria-hidden` : l'information passe par
    « Non renseigné(e) » en `textLow` (AA) ; la mention des dates est en `textLow`, pas en
    `textMuted` ;
  - la zone (« Méditerranée ») s'affiche aussi sur mobile, où la maquette l'omet ;
  - la carte Conditions est « vide » (« Rien de renseigné ») tant qu'aucune condition n'est
    saisie : la température de fond seule ne compte pas (c'est déjà un KPI). Une fois une
    condition saisie, la ligne « Eau » l'affiche (« 14 °C · fond ») ;
  - icônes du Déroulé et des Notes : `clock` et `book` (maquette : profil et note) ;
  - à 375 px, le titre « Déroulé de la plongée » passe sur deux lignes et « — Non renseigné(e) »
    se replie dans les cellules étroites du Déroulé.
- **Doc design** : `apps/web/design/README.md` (lecture seule) situe encore `KpiCard` dans
  `features/dashboard`.

Issus du formulaire de plongée (`/dives/new`, `?from=:id`, `/dives/:id/edit`, phases 1 à 5,
2026-11-17) :

- **Écriture** (2026-11-18, D29) : `saveDive` passe par `httpDiveRepository` (`POST /api/dives`,
  `PUT /api/dives/:id`, contrat `DiveWriteRequest`), qui remplace le dépôt en mémoire. Après
  l'enregistrement, le carnet et le détail sont invalidés (relus depuis l'API), et le dashboard par
  `DiveFormPage` (une feature n'importe pas l'autre) ; les détails d'autres plongées en cache gardent
  leur ancien n° jusqu'à leur `staleTime`. Erreurs : `400 validation-failed` → champs du formulaire
  (`fieldErrorMapping.ts`, chemin du corps → champ, messages du formulaire) ; `422
invalid-reference` → le site s'il vient du carnet, la palanquée si elle a des membres (l'API ne
  dit pas quelle référence manque) ; le reste (404, 409, réseau…) → « L'enregistrement n'a pas
  abouti ». Les bornes du formulaire sont égales ou plus strictes que les `CHECK` (une décimale,
  entiers, palanquée de 50 au plus). Les ids de la plongée et d'un site créé par son nom sont tirés
  une fois par formulaire et **gardés dans le brouillon** (`DRAFT_VERSION` 3) : un nouvel essai,
  même après rechargement, renvoie les mêmes (idempotence du `POST`) ; un `409
identifier-conflict` en création est rejoué en `PUT` (la plongée a été enregistrée par un essai
  précédent). Les ids restent en UUID v4 (`crypto.randomUUID()`) au lieu de v7 (D22). Un site créé
  par son nom n'a ni région ni position (D-23) : « Position non renseignée » sur le détail, pas de
  marqueur sur la carte du dashboard.
- **N° de plongée** (écart avec la spec, D26 prime) : la spec en fait un champ libre prérempli à
  max + 1, avec un avertissement « n° déjà pris ». Le n° étant calculé et jamais stocké, le champ est
  en lecture seule (« Calculé selon la date ») et montre le rang qu'aura la plongée (`diveNumberFor`,
  même règle que l'API : instant d'immersion puis id ; sans heure, fin de la journée). L'aperçu,
  l'overline et la barre du haut le suivent ; le toast annonce le n° renvoyé par `saveDive`.
  L'avertissement de doublon est supprimé. Un décalage « carnet papier » reste à prévoir (D26).
- **`canEditEvent`** : toujours vrai en V1 (`DiveFormPage`). L'usage en club devra le calculer
  (créateur de l'événement) ; le verrouillage des champs (É) est prêt et testé. La palanquée suit le
  modèle (participation), pas la spec (événement) : point ouvert 18 du modèle de données.
- **Champs hors modèle** (saisis, non enregistrés) : lignes de paliers de déco. (D-16), intervalle
  de surface d'une successive, niveau par membre de la palanquée (le repository le copie sur la
  fiche du binôme, D-21). Exclus du test d'aller-retour formulaire → détail. Un binôme choisi parmi
  les « Déjà rencontrés » arrive sans niveau (le résumé du carnet n'en porte pas) : `levelCode: null`
  veut dire « inchangé », le repository garde le niveau connu d'un détail en cache. Servir le niveau
  dans le carnet permettrait de le préremplir.
- **« Successive » inconnue** : une plongée dont `isRepetitive` vaut `null` le garde tant que
  l'interrupteur reste éteint (le formulaire n'a pas de troisième état).
- **Choix facultatifs** (mise à l'eau, moment, mer, courant, matériau, type de combinaison) : une
  fois choisis, ils ne reviennent plus à « non renseigné » (`radiogroup`, qu'un clic ne décoche pas).
  Une option « — » ou un bouton « Effacer » est à décider au design.
- **Suggestions vides** : structures et espèces déjà saisies ne sont pas servies par l'API (champs
  du détail, absents de `GET /dives`) ; la liste reste vide.
- ~~**Niveau du plongeur** (avertissement de profondeur, palanquée) : vient de `mockUser`~~ : vient
  de `useCurrentDiver()` (D41).
- **RGPD** : le brouillon contient des données de santé **en clair** dans `localStorage`. ~~Clé
  sans id de plongeur, pas de purge au logout~~ : soldé par D41, clé
  `e-deep:dive-draft:<diverId>:<mode>`, purge de tous les brouillons à chaque fin de session (avec
  une époque qui empêche un formulaire ouvert avant de réécrire) ; les anciennes clés sans plongeur
  ne sont jamais restaurées et disparaissent à la purge suivante. Reste à chiffrer ou à passer en IndexedDB (D22). Le
  brouillon est écrit 1 s après la dernière frappe, et tout de suite à la sortie confirmée, sur
  `pagehide` et au démontage (pas sur `beforeunload`, qui peut priver la page du back-forward
  cache). Les brouillons de plus de 30 jours, ou sans date lisible, sont supprimés à chaque
  ouverture du formulaire (tous modes et toutes plongées) ; un échec d'écriture n'affiche plus la
  mention « Brouillon enregistré ».
- **Saisie** : le clavier `decimal` d'iOS n'a pas de signe moins (températures négatives) ; il
  faudra un bouton ± ou `inputMode="text"` sur ces champs.
- **Mise en page** : deux colonnes (colonne collante à droite) à partir de 1280 px et non 1024
  comme la spec : entre les deux, la barre collante du bas est gardée (formulaire trop étroit).
- **Accessibilité** (audit phase 5) : une erreur de palanquée (nom incomplet) est portée par le
  champ « Ajouter un plongeur », pas par la ligne du membre ; un second enregistrement sans
  modification ne réannonce pas le résumé d'erreurs (même contenu, le focus va quand même au
  premier champ) ; un segmented verrouillé (`canEditEvent` faux) n'est plus focalisable et passe à
  45 % d'opacité. Vérification clavier faite avec Playwright (pas d'axe-core). Revue de la PR :
  liseré des champs en `lineField` (≥ 3:1, au lieu du `lineStrong` de la maquette, ≈ 1,3:1) ;
  focus d'un champ = outline 2px `accent` quel que soit son état (le halo de la maquette est
  retiré) ; les contrôles gardent une marge de défilement sous les barres collantes (SC 2.4.11) ;
  le résumé d'erreurs reste tant qu'un de ses champs est en erreur ; Entrée seule n'enregistre
  plus (seuls le bouton et `Ctrl/⌘ + Entrée`), et le raccourci est inactif sous la boîte « Quitter
  sans enregistrer ? ».
- **Import** de fichiers ou d'un ordinateur de plongée : V2.

Issus de l'API d'écriture des plongées (PR #17, 2026-11-18) :

- **Synchronisation en lot** hors ligne (D22, D-12) : pas d'endpoint ; à construire sur les
  variantes `…In(manager)` des services, avec leurs DTO (D-22) et le contrôle d'horizon de purge.
- **Suppression** d'une plongée (question ouverte #19) et **client périmé** (#20) : non traitées.
- **Ids** : le front tire des UUID v4, D22 demande des v7 ; l'API accepte tout UUID.
- **LWW strict** (D-25) : deux onglets qui modifient la même plongée s'écrasent sans
  avertissement ; un contrôle `updatedAt > baseUpdatedAt` → 409 s'ajouterait sans migration.
- **`422 invalid-reference`** ne nomme pas la référence manquante (site, binôme ou niveau) : le
  front met en cause le site et la palanquée. Un chemin dans la réponse permettrait de cibler.
- **Niveau des binômes** : `levelCode` est cherché dans l'agence FFESSM seule ; à faire porter
  l'agence au contrat dès qu'un autre référentiel partage un code.
- `GET /api/dives/abc` répond encore la 400 par défaut de `ParseUUIDPipe` (le `PUT` répond
  `validation-failed`), conservée parce que le front s'appuie sur elle.
- Le canal de synchronisation dédoublonne désormais les `buddyIds` sans tenir compte de la casse
  (`canonicalUuids`) : `['A', 'a']` donne un binôme au lieu d'une 422 (non testé).
- Test `test:db` d'interblocage : délai porté à 30 s après un dépassement isolé de 5 s, sans
  interblocage observé (cause non identifiée).

Issus des sites (création express, page Carte, fiche site, phases 0 à 5, 2026-11-19) :

- ~~Écritures non persistées, API sites à créer, fusion locale non répercutée, mise à l'eau et
  structure habituelles absentes, `?state=` non géré, placeholders carte~~ : soldés par l'API des
  sites (D31, D32, 2026-11-19).
- **Géocodage** : V2. La région est suggérée depuis le site placé le plus proche (< 15 km) ; la
  zone est déduite de la position (boîtes) ou des mots de la région (côtes françaises surtout).
  Les boîtes ne distinguent pas la terre de la mer : un site intérieur dans une boîte (lac près
  d'Avignon, carrière près de Rouen) prend la mer de la boîte ; il faudra un trait de côte.
- **Tuiles** : CARTO sans clé et sans SLA ; au-delà d'un usage modéré, compte CARTO ou autre
  fournisseur (seule l'URL du style change). Hors ligne, la carte affiche « La carte n'a pas pu
  se charger » et la liste reste utilisable.
- **Accessibilité** : vérifiée par tests et au clavier (pas d'axe-core). Proportions du téléphone
  (carte 40 % en édition, sheet à 50 %) écrites en pourcentages dans le SCSS, pas en tokens.

Issus de l'API des sites (2026-11-19) :

- **Synchronisation en lot** des sites : services prêts (`upsertIn` avec les nouveaux champs,
  `pull` avec `mergedIntoId`, écriture sur un site fusionné rejetée), pas d'endpoint (comme les
  plongées).
- **Interblocage rare** : une plongée existante réécrite pendant la fusion de son site peut
  provoquer un interblocage PostgreSQL (500, `40P01`, aucune donnée corrompue).
- **Lien vers un site fusionné** (`/sites/:sourceId` en favori) : 404 « Ce site n'existe pas ou a
  été supprimé » ; `mergedIntoId` n'est pas servi en REST.
- **Création de site rejouée** : l'id est tiré à chaque essai ; une création qui expire puis est
  relancée peut créer un doublon (il faudrait garder l'id dans le panneau, comme le brouillon de
  plongée).
- **Libellé de région** (D-32) : découpé au premier « · » ; une région qui contient elle-même « · »
  serait mal coupée. Un champ « Localité » dans les panneaux le remplacera.
- **Suppression refusée** : le dialogue garde le nombre de plongées connu au moment du refus.
- **`?state=ready`** de `/map` et `/sites/:id` lit l'API (pas de mocks) ; en `?state=error`
  forcé, « Réessayer » ne fait rien.
- **Création express** : `isNew: true` reste envoyé pour un nom tapé sans passer par le panneau et
  pour un brouillon restauré dont le site n'est plus dans mes sites (l'API le crée par son nom,
  `quick`).
- **Mini-cartes** : celle du détail de plongée et celle de la fiche site (lecture seule) restent
  deux composants (hauteurs, surimpressions et voisins différents).
- **Captures** : `pnpm --filter web run screenshot <route> <largeur>` fusionne les deux arguments ;
  lancer `node scripts/screenshot.mjs` depuis `apps/web`.

Issus de l'authentification (lots 0 à 8, PR #22 à #31, 2026-11-20 → 2026-11-27 ; plan
`docs/plans/auth.md` §8) :

- **Checklist de mise en production** (à écrire avec l'hébergement) : `TRUST_PROXY` égal au nombre
  réel de proxys devant l'API (sinon toutes les requêtes partagent l'IP du proxy, ou une IP se
  forge par `X-Forwarded-For`) ; le proxy doit transmettre `Origin` et `Sec-Fetch-*` ;
  `SESSION_COOKIE_SECURE` laissé à `true` ; `REGISTRATION_ENABLED=false` tant que le lot email
  n'est pas livré ; `TOTP_ENCRYPTION_KEY` propre à l'environnement ; `ALLOWED_ORIGINS` limité aux
  origines de prod.
- **Pas d'email** (D39) : récupération de compte par `account:reset-password`, adresse non
  vérifiée, `409 email-taken` qui permet l'énumération, « Mot de passe oublié ? » vers un
  placeholder. Borné par `REGISTRATION_ENABLED=false` ; le **lot email est obligatoire** avant
  l'ouverture publique. `features.signup` (web) est aligné **à la main** sur `REGISTRATION_ENABLED`
  (l'API reste l'autorité).
- **Limitation de débit en mémoire** (D35) : remise à zéro au redémarrage, une seule instance
  (stockage partagé à prévoir si l'API est répliquée). Les seaux par IP regroupent une IPv6 par
  /64 : des clients derrière un même NAT64 ou CGNAT partagent un seau, et un attaquant qui dispose
  de plusieurs /64 en a autant.
- **Hachage Argon2id sans borne de concurrence** : chaque vérification réserve ~19 MiB et occupe un
  fil du pool libuv ; seule la limitation par IP et par email borne le nombre de hachages
  simultanés.
- **TOTP** : avec le mot de passe connu, le code à 6 chiffres n'est protégé que par la limitation
  par email (environ 30 par heure, rafale de 5, en mémoire), sans verrouillage persistant du compte. Pas de
  `CHECK (totp_last_used_step >= 0)` en base.
- **Course login / `account:reset-password`** : un login qui a lu le compte avant la
  réinitialisation peut encore, après elle, réécrire l'ancien hash (re-hachage) et ouvrir une
  session. La même course a été fermée pour le TOTP (pas accepté seulement si le secret lu est
  toujours en base), pas pour le mot de passe.
- **Coût par requête** : environ 4 requêtes d'authentification par appel du carnet (session,
  `touch` borné, plongeur et consentement pour le statut d'onboarding). Aucun index
  `(audience, last_seen_at)` pour la purge des sessions inactives (`idx_sessions__expires_at`
  seulement).
- **`DiverId`** : seules les signatures des services du carnet (dashboard, lecture et écriture des
  plongées, sites) le portent ; à étendre aux services de synchronisation avec le lot de sync.
- **Liste de mots de passe compromis statique** : à rafraîchir à chaque version majeure, avec la
  procédure et les empreintes d'en-tête de `compromised-passwords.ts`.
- **`crypto.argon2`** est récent dans Node : en cas de régression, repli prévu sur `crypto.scrypt`
  (N = 2^17) en gardant le format PHC.
- **Connexion** : un mot de passe de plus de 128 caractères tapé à la connexion reçoit
  `400 validation-failed` (`too-long`), et le formulaire affiche le message de la politique du
  nouveau mot de passe (« 128 caractères maximum. ») au lieu d'un refus neutre.
- **Profil incomplet possible en base** (`divers` sans niveau) : borné par `onboarding-required` et
  le type `CompleteDiver` ; le `down()` d'`AllowIncompleteDiverProfile` échoue tant qu'il en existe.
- **Accueil** (D45) : pas de pré-rendu de `/` (SEO limité au `<title>` et aux méta) ; `og:image` et
  `og:url` à ajouter quand un domaine existera ; aperçu produit tiré des captures de maquette, à
  remplacer par de vraies captures. Rolldown découpe l'accueil en 6 chunks. La liste autorisée de
  `check:public-bundle` accepte encore tout `shared/session/(api|lib|hooks)` : à resserrer par nom
  de module.
- **Admin** : le shell (layout, titres) reste en partie en anglais. Code dupliqué entre web et admin
  (client API, guards, `safeNext`, réaction au 401) : factorisation dans un paquet ESM (§6, D13).
- **CI** : les jobs ne sont pas encore des contrôles **requis** sur `main` (protection de branche à
  activer dans GitHub).
- **Partage** (D43) : hors périmètre, modèle cible dans D-08 (`docs/data-model/decisions.md`).

Issus du cadrage de l'app mobile (2026-11-27) :

- **App mobile** : une app compagnon React Native (Expo), hors ligne, est prévue ; le web reste en
  ligne. Plan validé, non commencé : `docs/plans/mobile-foundations.md` (paquets runtime
  `@e-deep/client` et `@e-deep/design-tokens`, fin de D13 ; audience `mobile` en Bearer opaque ;
  push et pull de synchronisation avec détection de conflit ; suppression d'une plongée ; purge
  planifiée ; cadrage Expo, SQLCipher et périmètre V1). Ses décisions (D46 à D60, D-39 à D-45) seront
  reportées au §10 et dans `docs/data-model/decisions.md` au dernier lot. Il amende D13, D22, D25,
  D33, D34, D37, D42 et §6 ; il relève que les conditions CARTO (clé obligatoire, cache de 30 jours
  au plus) concernent déjà le web.

Issus de la mise en ligne (2026-11-28) :

- **CI + GHCR** : construire et publier `e-deep-api` et `e-deep-caddy` en CI (tag = SHA du commit),
  puis `docker compose pull` sur le VPS au lieu d'y builder. Le build des fronts consomme ~950 Mo de RAM
  (pic mesuré, l'api ~400 Mo) : sur un VPS de 1 Go, prévoir du swap ou builder en CI. Ajouter
  l'écosystème `docker` à Dependabot (`node:26-alpine`, `caddy:2.11-alpine`, `postgres:18-alpine`).
- **`TAG` à épingler** : le repli `latest` du compose n'est qu'un défaut ; chaque déploiement fixe
  `TAG` au commit déployé (retour arrière = `TAG` précédent).
- **Sauvegardes** : aucune. `pg_dump` planifié vers un stockage externe (chiffré, hors du VPS) et
  restauration testée, avant d'y mettre de vraies plongées.
- **Durcissement du VPS** : SSH par clé seulement, ufw (22, 80, 443), mises à jour automatiques,
  utilisateur non-root dans le groupe `docker` (équivalent root : à réserver à l'exploitant).
- **Limites mémoire** : pas de `mem_limit` par service ; à fixer une fois la taille du VPS choisie
  (au repos : api ~56 Mio, Caddy ~67 Mio, PostgreSQL ~33 Mio).
- **Plusieurs instances de l'API (scaling horizontal)** : l'API n'est pas prête à être répliquée.
  Deux adaptations sont nécessaires avant de lancer une deuxième instance :
  - la **limitation de débit** (D35) est en mémoire : chaque instance aurait ses propres compteurs,
    ce qui multiplie les essais permis par le nombre d'instances. Il faut un stockage partagé
    (PostgreSQL, ou Redis si la charge le justifie) ;
  - la **purge** (`PurgeService.purge()`, sessions expirées, `auth_events` de plus de 180 jours,
    tombstones) devra tourner sur **une seule** instance : tâche planifiée unique, ou verrou
    (`pg_try_advisory_lock`) si chaque instance la planifie.

  Les sessions sont déjà en base (D33) : elles fonctionnent avec plusieurs instances. Chemin de
  montée en charge envisagé, une étape seulement quand une mesure l'exige :
  1. supervision (CPU, RAM, latence p95, requêtes lentes) ;
  2. VPS plus gros (aucun changement de code) ;
  3. build en CI + GHCR ;
  4. PostgreSQL managé (restauration à un instant donné, réplica en lecture ; option `ssl` à
     rouvrir) ;
  5. plusieurs instances derrière Caddy, après les deux adaptations ci-dessus ;
  6. CDN pour les fichiers statiques.

  Kubernetes n'est pas envisagé tant qu'une seule personne exploite l'app.

- **Basic auth admin** : Caddy ne limite pas les essais ; seul le coût de bcrypt les ralentit. Mot de
  passe long et aléatoire obligatoire.
- **CSP** à élargir pour MapLibre : hôtes CARTO (style, tuiles, sprites, glyphes) dans `connect-src`
  et `img-src`, et `worker-src blob:`. Aujourd'hui, la carte ne fonctionne pas en prod.
  HSTS sans `includeSubDomains` ni `preload` tant que le domaine n'est pas choisi.
- **Auth mobile** : la session est un cookie `__Host-` (D33, D34), inutilisable par React Native. Il
  faudra une audience `mobile` en `Authorization: Bearer` (token opaque, `expo-secure-store`), exemptée
  de l'`OriginGuard` puisque sans cookie, comme prévu par le plan mobile. Le domaine admin retire
  `Authorization` : l'app mobile doit viser le domaine web.
- **Test local** : en `localhost`, Caddy (non-root) logge l'échec de l'installation de sa CA dans le
  magasin du conteneur, sans effet ; `curl -k` ou un navigateur qui ignore le certificat.

## 12. Déploiement

Bêta fermée sur un VPS, un seul hôte, Docker Compose (D61 à D70). Fichiers : `deploy/` et
`apps/api/Dockerfile` ; le `docker-compose.yml` racine reste l'infra de dev.

```
   Internet ──► :80 / :443 (tcp+udp) ──► caddy  (seul service qui publie des ports, D64)
                                         │  {$WEB_DOMAIN}    /srv/web    (SPA plongeur)
                                         │  {$ADMIN_DOMAIN}  /srv/admin  (SPA admin, basic auth, D69)
                                         │  /api/* sur les deux domaines (même origine, D63)
                                         ▼
                                     api:3000   NestJS (node dist/main.js, utilisateur node)
                                         │
                                         ▼
                                     db:5432    PostgreSQL 18 (volume db-data)
```

- **Même origine** : chaque front appelle `/api` sur son propre domaine. Caddy proxifie `/api/*` vers
  `api:3000` sans réécrire le chemin. Pas de CORS ; l'`OriginGuard` accepte les deux origines HTTPS.
- **Statique** : `try_files {path} /index.html` (rechargement direct de `/dashboard`), `/assets/*`
  en `immutable` (fichiers hachés, 404 s'ils manquent), le reste en `no-cache`, `encode zstd gzip`.
  En-têtes : HSTS, `nosniff`, `Referrer-Policy`, CSP `default-src 'self'` (à élargir pour MapLibre,
  §11), sans `Server` ni `X-Powered-By`.
- **Ports** : seul Caddy en publie. Docker contourne ufw, donc ni `api` ni `db` n'ont de `ports:`
  (`docker compose ps` le vérifie).
- **Images** : `apps/api/Dockerfile` (236 Mo) et `deploy/caddy/Dockerfile` (69 Mo), contexte = racine
  (`.dockerignore`). Chaque service a `build:` et `image: ghcr.io/${GHCR_OWNER}/e-deep-<service>:${TAG}`.

Commandes, depuis la racine du dépôt (`DC` = `docker compose --env-file deploy/.env.prod -f deploy/docker-compose.prod.yml`) :

```bash
cp deploy/.env.prod.example deploy/.env.prod && chmod 600 deploy/.env.prod   # puis le remplir
export TAG=$(git rev-parse --short HEAD)       # ou TAG= dans .env.prod
$DC build                                      # api + caddy (fronts compris)
$DC up -d db
$DC run --rm api npm run migration:run:prod    # à chaque déploiement, avant up (D65)
$DC up -d
$DC run --rm -it api node dist/cli/create-staff-account.js admin <email>   # premier compte staff (TOTP)
$DC run --rm -it api node dist/cli/reset-password.js <email>              # idem reset-totp.js
$DC ps                                          # seul caddy a des ports
$DC logs -f api
```

Variables (`deploy/.env.prod`, jamais versionné ; chaque service ne reçoit que les siennes, D70) :

| Variable                                            | Service    | Rôle                                                                                                 |
| --------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------- |
| `TAG`, `GHCR_OWNER`                                 | compose    | Tag et propriétaire des images (`latest` et `lebowvsky` par défaut).                                 |
| `WEB_DOMAIN`, `ADMIN_DOMAIN`                        | caddy, api | Domaines nus ; `localhost` et `admin.localhost` pour un test local. L'api en tire `ALLOWED_ORIGINS`. |
| `ADMIN_BASIC_AUTH_USER`, `ADMIN_BASIC_AUTH_HASH`    | caddy      | Barrière admin (D69) ; hash par `caddy hash-password`, entre apostrophes.                            |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | db, api    | Base, reprise par l'api en `DATABASE_*` (`DATABASE_HOST=db`).                                        |
| `TOTP_ENCRYPTION_KEY`                               | api        | Obligatoire en prod (comptes staff, D42).                                                            |
| `REGISTRATION_ENABLED`                              | api        | `false` pendant la bêta (D39).                                                                       |

Fixées par le compose pour l'api : `NODE_ENV=production`, `PORT=3000`, `TRUST_PROXY=1` (D67),
`SESSION_COOKIE_SECURE=true`.

**Barrière admin** : basic auth Caddy sur tout `{$ADMIN_DOMAIN}`, `/api/*` compris, avant la
connexion staff et le TOTP. L'en-tête `Authorization` est retiré avant l'API. L'alternative est une
allowlist `remote_ip` (commentée dans le `Caddyfile`).

**Vérifié en local le 2026-11-28** : migrations appliquées par `migration:run:prod` ;
`/api/health` → `ok` via Caddy ; `/dashboard` rechargé directement → `index.html` ; pas
d'`X-Powered-By` ; JSON malformé → `400` générique ; admin → `401` sans identifiants basic, `200`
avec ; HTTP → `308` vers HTTPS ; aucune violation de CSP dans la console (accueil, `/login`, admin) ;
seul caddy publie des ports.
