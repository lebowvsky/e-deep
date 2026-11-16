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

Phase actuelle : **schéma du carnet de plongée** (entités, migrations, services de synchronisation)
et **premiers écrans branchés sur l'API** en lecture seule, sans authentification réelle (stub de
dev, D23 et D28). Routes :

- `GET /api/health` : affichée par les deux fronts ;
- `GET /api/dashboard` : dashboard du plongeur courant (`apps/web`, `/dashboard`) ;
- `GET /api/dives` et `GET /api/dives/:id` : carnet complet et détail d'une plongée du plongeur
  courant (`apps/web`, `/dives`, D25).

Modèle de données : `docs/data-model/` (`schema.md`, `decisions.md`).

## 2. Arborescence

```
e-deep/
├── apps/
│   ├── api/                      NestJS 12 (CommonJS) + TypeORM 1 + PostgreSQL
│   │   ├── src/
│   │   │   ├── main.ts           bootstrap
│   │   │   ├── configure-app.ts  préfixe, ValidationPipe, CORS, filtre d'exceptions (partagé avec l'e2e)
│   │   │   ├── app.module.ts
│   │   │   ├── config/           validation de l'environnement (class-validator)
│   │   │   ├── database/         options DataSource partagées, data-source.ts (CLI), migrations/,
│   │   │   │                     seeds/ (dev-seed.ts + données statiques dev-seed.data.ts, dive-log.data.ts)
│   │   │   ├── common/           transverse : auth (plongeur courant), filtres, logging, database (transformer, upsert, pull),
│   │   │   │                     errors (erreurs métier), sync (règles et réglages de synchronisation)
│   │   │   └── modules/<domaine>/ un module Nest par domaine : health, dashboard, certification-levels, divers,
│   │   │                         dive-sites, buddies, dives (agrégat événement + participation + palanquée ;
│   │   │                         écriture synchronisée DivesService, lecture DivesController + DiveLogService
│   │   │                         + dive-contract.mapper.ts)
│   │   └── test/                 tests e2e (supertest), db/ (tests sur PostgreSQL réel)
│   ├── web/                      React 19 + Vite 8 + SCSS modules (design system DiveLog)
│   │   ├── CLAUDE.md             règles du design system pour les agents
│   │   ├── design/               handoff : README (spec), screenshots/, mockups/ (lecture seule)
│   │   ├── scripts/              generate-tokens.ts, screenshot.mjs (Playwright)
│   │   └── src/
│   │       ├── app/              App, providers, router + routes.tsx, routes/ (pages), layout/ (AppShell…)
│   │       ├── design/tokens.ts  source unique des design tokens
│   │       ├── features/<domaine>/{api,hooks,components,lib} (+ types.ts, mocks/ si besoin)
│   │       │                     api/ : appels, guards, mapping vers le modèle de vue, queryKeys.ts ;
│   │       │                     mocks/ : fixtures de test et forçage ?state= (jamais dans le bundle de dives)
│   │       ├── shared/{ui,hooks,lib,config,model}  config/app.ts : APP_NAME ; model/ : types de domaine
│   │       │                     partagés entre features (ex. DiveMember, palanquée) ; lib/ : apiClient,
│   │       │                     guards génériques, queryClient.ts (TanStack Query), hash.ts, format
│   │       ├── test/             setup.ts (Testing Library), TestProviders.tsx (QueryClient neuf par rendu)
│   │       └── styles/           global.scss, tokens/ (_index, _tokens & _vars générés, _mixins)
│   └── admin/                    React 19 + Vite 8 + Tailwind v4 + shadcn/ui
│       └── src/
│           ├── app/              App, providers, router, layout/, routes/, access-control/
│           ├── components/ui/    composants shadcn générés (ne pas modifier)
│           ├── features/<domaine>/
│           ├── shared/{ui,hooks,lib}
│           └── styles/index.css  entrée Tailwind + thème shadcn
├── packages/
│   ├── shared/                   @e-deep/shared : types des contrats d'API
│   └── tsconfig/                 @e-deep/tsconfig : base.json, react.json, nest.json
├── docker-compose.yml            PostgreSQL 18 de dev
├── eslint.config.js              ESLint flat config unique (toutes les apps)
├── .prettierrc.json              Prettier unique
└── pnpm-workspace.yaml
```

## 3. Stack par app

Versions vérifiées le 2026-11-06. Node **26 LTS** (`.nvmrc`), pnpm **12.18** (`packageManager`).

| Zone         | Stack                                                                                                                                                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Racine       | TypeScript ~6.0.3, ESLint 10 + typescript-eslint 8 (type-checked), Prettier 3                                                                                                                                                |
| `apps/api`   | NestJS 12.4 (**CommonJS**), @nestjs/config, TypeORM 1.1 + pg, class-validator / class-transformer, Jest 30 + ts-jest + supertest                                                                                             |
| `apps/web`   | React 19.3, Vite 8 (Rolldown), @vitejs/plugin-react 6, sass-embedded, Geist via fontsource, React Router 8 (data mode), TanStack Query 5.107 (D24), Vitest 5 + Testing Library (+ user-event) + jsdom, Playwright (captures) |
| `apps/admin` | Pareil que web pour React/Vite/tests, plus Tailwind 4.3 (`@tailwindcss/vite`) et shadcn/ui (CLI 4.23, base Radix, preset Nova)                                                                                               |
| Infra dev    | PostgreSQL 18 (`postgres:18-alpine`) via docker compose                                                                                                                                                                      |

Ports de dev : API `3000`, web `5173`, admin `5174` (`strictPort`).

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
- **Contrats actuels** : `health.ts`, `dashboard.ts` (`DashboardResponse`…) et `dives.ts`
  (`DiveSiteRef`, `DiveBuddyRef`, `DiveSummary`, `DiveDetail`, `DiveLogResponse`). Côté API, les
  modèles de lecture n'ont pas de dossier `dto/` : un `*-contract.mapper.ts` convertit les lignes SQL
  vers ces types partagés (pas de validation d'entrée à porter). Les `dto/` class-validator restent
  la règle dès qu'un endpoint reçoit un corps ou des paramètres.
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
- **Seed de développement** : `pnpm db:seed` (`src/database/seeds/`, lancé depuis `dist`). Il vide
  les tables du carnet (le référentiel des niveaux est conservé) puis crée 3 plongeurs fictifs :
  - **Marine Rousseau** (plongeur courant du stub) : le carnet des maquettes « Mes plongées », soit
    127 plongées aux **dates absolues** (juin 2019 → avril 2026), 23 sites avec localité et région,
    14 binômes dont 2 liés aux autres comptes, plus 1 plongée supprimée (tombstone) ;
  - **Lucas** et **Thao** : quelques plongées datées par rapport au jour du seed.

  Les données sont **fictives** et statiques (`dive-log.data.ts`, `dev-seed.data.ts`), les ids sont
  des UUIDv7 déterministes (les URL des plongées survivent à un re-seed) ; seuls les ids des
  plongeurs viennent de la base. Il passe par les services (mêmes invariants que la
  synchronisation) et il est rejouable (même état final). Il **refuse** `NODE_ENV=production`, toute
  base non locale et une base dont les migrations ne sont pas jouées. Il ne logge que des compteurs.
  Le chargement d'env hors Nest est partagé (`src/database/load-database-environment.ts`).

- Colonnes `numeric` lues via `common/database/numeric.transformer.ts` (`pg` les renvoie en
  `string`). `updated_at` n'est jamais écrit par TypeORM (`insert: false, update: false`) : seul le
  trigger le pose.

## 8. Tests

| App   | Outil                              | Commande                                                           | Contenu actuel                                                                                                                                                                                                                                                                                                                                  |
| ----- | ---------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| api   | Jest 30 + ts-jest, supertest       | `pnpm --filter api run test` (unit + e2e), `test:unit`, `test:e2e` | `HealthService`, filtre d'exceptions, transformer, règles de sync, mappings contrat front, `DiveLogService` (propriétaire, numérotation, 404), `CurrentDiverGuard` (401, `no-store`), validation d'env (stub refusé en prod) ; e2e `/api/health`, `/api/dives`, `/api/dives/:id` (200, 400, 401, 404, `Cache-Control`)                          |
| api   | Jest 30 + ts-jest, PostgreSQL 18   | `pnpm --filter api run test:db` (projet `db`, hors `test`)         | migrations (noms, revert de toutes), contraintes, triggers, cascades, services de synchronisation et purge, `DiveLogService` (isolation entre plongeurs, tombstones hors numérotation, `locality`)                                                                                                                                              |
| web   | Vitest 5 + Testing Library (jsdom) | `pnpm --filter web run test`                                       | client API, guards (`HealthResponse`, dashboard, dives), `shouldRetry` et politique réelle de retry, mapping et clés de région, `HealthPanel`, `useDashboard` et `useDives` sur `useQuery` (cache, refetch en échec), états de `DivesPage` (région live, vide, erreur et retry avec focus, pages, filtres sans refetch, focus de la pagination) |
| admin | Vitest 5 + Testing Library (jsdom) | `pnpm --filter admin run test`                                     | client API, guard, `HealthCard`, `AdminLayout`                                                                                                                                                                                                                                                                                                  |

- **`pnpm test` n'a besoin d'aucune base** : l'e2e de l'API monte les modules (`HealthModule`,
  `DivesController` avec le vrai service et le vrai garde) sur une `DataSource` et une config
  simulées, via le même `configureApp` que `main.ts`.
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
   classe** de l'erreur (`common/logging/error-class-name.ts`).
2. **Filtre d'exceptions `LogSafeExceptionFilter`.** Une erreur inattendue (ex. `QueryFailedError`,
   qui contient le SQL et ses paramètres) est loggée comme `Unhandled <Classe>` et renvoie une 500
   générique.
3. **Logging SQL TypeORM désactivé** (`logging: false`), parce que les paramètres de requête
   peuvent contenir des données de santé.
4. **La validation d'env ne logge que les noms** des variables en erreur, jamais leurs valeurs.
5. **Accès** : les données de santé ne seront exposées qu'aux rôles autorisés. L'autorisation est
   appliquée **par l'API**, à chaque requête ; le garde côté front n'est que de l'UX. L'emplacement
   du futur contrôle d'accès est documenté dans `apps/admin/src/app/access-control/README.md`.
   **Propriété** : le plongeur courant vient **toujours** de `CurrentDiverGuard` (`@CurrentDiverId()`),
   jamais d'un paramètre client, et chaque requête SQL filtre par lui (palanquées comprises). Une
   ressource absente, supprimée ou appartenant à un autre plongeur répond la même **404 générique**,
   sans distinction possible. **Provisoire** : le garde repose sur le stub `DEV_AUTH_STUB` (premier
   plongeur créé), que la validation d'env refuse si `NODE_ENV=production` ; l'authentification
   réelle doit le remplacer avant toute exposition hors du poste de dev.
   **Cache** : toute réponse d'une route protégée par ce garde (succès ou erreur) porte
   `Cache-Control: no-store`, posé par le garde lui-même.
6. **Secrets** : aucun secret dans le code ni dans le dépôt. Seuls les `.env.example` sont
   versionnés (`.gitignore` : `.env*` sauf `*.example`). La DB de dev n'écoute que sur localhost.
7. **Limites connues** : au démarrage, en cas d'échec de connexion, `@nestjs/typeorm` logge la
   stack de l'erreur (qui peut contenir hôte et port), et la CLI TypeORM force le log des requêtes
   pendant `migration:*`. Aucune donnée de requête n'est concernée. À traiter avant la production,
   par un logger personnalisé au boot.

## 10. Décisions

Décisions prises lors de l'initialisation du **2026-11-06**.

| #   | Décision                                                                                                                                                                                                                                                                                                                                                     | Raison                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **NestJS en CommonJS + Jest**, alors que Nest 12 génère par défaut de l'ESM + Vitest. Le fichier est écrit à la main d'après le template CJS, car `nest new --type cjs` n'est plus un flag CLI.                                                                                                                                                              | Choix validé par le porteur du projet. La CLI TypeORM et ts-jest sont plus simples en CJS. Les paquets Nest 12 sont ESM-only et chargés via `require(esm)`.                                                                                                                                                                                                                                 |
| D2  | **TypeScript épinglé en `~6.0.3`**, alors que TS 7 est sorti.                                                                                                                                                                                                                                                                                                | typescript-eslint demande `<6.1`, ts-jest `<7`, et Nest CLI embarque `~6.0`. On repassera en TS 7 quand l'outillage le supportera.                                                                                                                                                                                                                                                          |
| D3  | **`verbatimModuleSyntax: false` dans `nest.json`.**                                                                                                                                                                                                                                                                                                          | Cette option est incompatible avec une sortie CommonJS (TS1286 sur les `import` ESM). Elle reste active dans `base.json` et `react.json`.                                                                                                                                                                                                                                                   |
| D4  | **Node 26 LTS** (`.nvmrc`, `engines >=26`).                                                                                                                                                                                                                                                                                                                  | C'est la LTS active depuis octobre 2026.                                                                                                                                                                                                                                                                                                                                                    |
| D5  | **pnpm 12.18**, avec ses protections supply-chain par défaut : `minimumReleaseAge` (des exclusions explicites pour les versions Nest toutes récentes et `minimatch@11.0.5`, dépendance de `@nestjs/cli`, sont dans `pnpm-workspace.yaml`) et `allowBuilds`. `@parcel/watcher` est refusé, car son script d'install est inutile et le binaire est précompilé. | Sécurité de la chaîne d'approvisionnement. Les exclusions sont à retirer une fois les versions assez anciennes.                                                                                                                                                                                                                                                                             |
| D6  | **Scripts racine `migration:*`** (`pnpm migration:run`) au lieu de `pnpm migration:run --filter api`.                                                                                                                                                                                                                                                        | Avec pnpm 12, ce qui suit le nom du script lui est transmis. `--filter api` arriverait donc jusqu'à la CLI TypeORM, qui le rejette. Forme équivalente : `pnpm --filter api run migration:run`.                                                                                                                                                                                              |
| D7  | **Migrations lancées depuis `dist`** après `nest build`.                                                                                                                                                                                                                                                                                                     | Pas de ts-node (fragile avec TS 6 + nodenext). Le stripping de types natif de Node ne gère pas les décorateurs.                                                                                                                                                                                                                                                                             |
| D8  | **`GET /api/health` répond toujours 200**, avec `status: 'degraded'` / `database: 'down'` en cas d'échec DB. Le ping est borné à 3 s et la connexion à 5 s (`connectTimeoutMS`) : une base qui ne répond pas donne `down` et ne bloque pas l'endpoint. Pas de `@nestjs/terminus`.                                                                            | Contrat simple pour les fronts, et une dépendance de moins. Une sonde readiness en 503 pourra être ajoutée pour l'orchestration.                                                                                                                                                                                                                                                            |
| D9  | **Pas de lib de data fetching** (TanStack Query) **ni de router** pour l'instant. `useHealth` s'appuie sur `use()`, Suspense, un `ErrorBoundary` maison et un petit `promiseCache`.                                                                                                                                                                          | _Data fetching remplacé par D24 (2026-11-13)._ Un seul endpoint en lecture : une lib serait superflue (éco-conception). **On adoptera TanStack Query** dès qu'il y aura plusieurs ressources serveur, des mutations avec invalidation ou des retries. **Router** : React Router (mode data) ou TanStack Router, à choisir à l'arrivée de la deuxième page ; seul `app/router.tsx` changera. |
| D10 | **`sass-embedded`** plutôt que `sass`.                                                                                                                                                                                                                                                                                                                       | Compilateur Dart natif, plus rapide, détecté automatiquement par Vite 8.                                                                                                                                                                                                                                                                                                                    |
| D11 | **shadcn/ui** : `shadcn init -b radix -p nova`, avec les composants `card`, `badge` et `button`. La CLI ne propose plus de `--base-color`, la couleur vient d'un preset.                                                                                                                                                                                     | Suit la doc Vite officielle. Pas de `baseUrl`, `paths` suffit. `init` installe `cn` (remplaçant de clsx + tailwind-merge), `class-variance-authority`, `lucide-react`, `radix-ui`, `tw-animate-css` et `shadcn` (pour `shadcn/tailwind.css`). La webfont Geist a été retirée.                                                                                                               |
| D12 | **Layout admin sémantique** (`aside` / `nav` / `main` en Tailwind) au lieu du bloc `sidebar` de shadcn.                                                                                                                                                                                                                                                      | Il ne demande pas de JS et beaucoup moins de composants (éco-conception), et il est responsive.                                                                                                                                                                                                                                                                                             |
| D13 | **Code partagé entre fronts dupliqué** en phase 1 (client API, guards, `useHealth`…).                                                                                                                                                                                                                                                                        | Conséquence de D1 et de la règle « shared = types ». On factorisera au troisième consommateur (voir §6).                                                                                                                                                                                                                                                                                    |
| D14 | **PostgreSQL 18** (`18-alpine`).                                                                                                                                                                                                                                                                                                                             | Dernière majeure stable (19 est encore en RC).                                                                                                                                                                                                                                                                                                                                              |
| D15 | **Lint et format centralisés** à la racine. Le lint Nest 12 (oxlint) et celui du template Vite ne sont pas repris.                                                                                                                                                                                                                                           | Une seule config, imposée par le cadrage initial.                                                                                                                                                                                                                                                                                                                                           |

Décisions prises à l'installation du design system (**2026-11-07**).

| #   | Décision                                                                                                                                                                                                                                                                                                                         | Raison                                                                                                                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D16 | **Polices Geist / Geist Mono auto-hébergées** (`@fontsource-variable/geist`, `-mono`), à la place de la pile système.                                                                                                                                                                                                            | Rendu fidèle aux maquettes. Les fichiers sont servis par l'app (aucun CDN tiers, donc pas de transfert d'IP, RGPD), et le `unicode-range` limite le téléchargement au sous-ensemble latin. |
| D17 | **Design system DiveLog** (kit de handoff) : `tokens.ts` → tokens SCSS/CSS générés, thème sombre uniquement, mixins dédiés. Il remplace les anciens `_tokens`/`_mixins`/`_reset`/`main.scss`. Le kit est adapté à l'arborescence existante (`shared/ui`, `app/layout`, `features/dashboard`).                                    | Une seule source de vérité pour les tokens, partagée par SCSS et TS ; pas deux systèmes en parallèle.                                                                                      |
| D18 | **Génération des tokens par Node natif** (`node scripts/generate-tokens.ts`, type stripping de Node 26), sans `tsx`. **Playwright** (Chromium) en devDependency pour les captures de comparaison aux maquettes.                                                                                                                  | Une dépendance de moins ; le script est typé par `tsconfig.node.json` (`allowImportingTsExtensions`). La vérification visuelle demande un vrai navigateur.                                 |
| D20 | **React Router (mode data)** : `createBrowserRouter` dans `app/router.tsx`, table des routes dans `app/routes.tsx` (réutilisée par les tests via `createMemoryRouter`). `/` redirige vers `/dashboard` ; les actions sans écran pointent vers des routes placeholder ; `/_dev/ui` (catalogue des primitives) n'existe qu'en dev. | Tranche D9 à l'arrivée de la deuxième page. Choix dicté par le brief du dashboard (`apps/web/design/prompts/`).                                                                            |
| D19 | **`cx` maison** (`shared/lib/classNames.ts`) au lieu de `clsx` recommandé par le kit.                                                                                                                                                                                                                                            | Fonction de 3 lignes déjà présente : pas de dépendance supplémentaire (éco-conception).                                                                                                    |

| D21 | **Corrections d'accessibilité des tokens** (audit du 2026-11-07) : `textLow` passe de `#6E819A` à `#889BB2` et `danger` de `#E06A70` à `#E47C81`, afin que le petit texte atteigne 4,5:1 sur toutes les surfaces (SC 1.4.3). Mixin `hit-area()` : zone tactile invisible de 44px autour des petites cibles (32px pour les marqueurs de carte, qui peuvent se chevaucher). | Les maquettes utilisaient `textLow` pour des libellés essentiels de 10 à 12px (3,25:1 sur `surface2`). La teinte est la plus proche de l'originale qui passe AA, et la hiérarchie avec `textMed` est conservée. |

Décision prise à la création du schéma du carnet (**2026-11-08**). Détail : `docs/data-model/decisions.md`
(D-02, D-03, D-08 à D-12).

| #   | Décision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Raison                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D22 | **Stratégie offline-first du carnet** : identifiants **UUIDv7 générés par le client** (sauf `divers` et `certification_levels` : `DEFAULT uuidv7()`) ; `updated_at` **posé par trigger serveur** (curseur de pull `(updated_at, id)`, lu avec ses microsecondes) ; suppressions en **tombstones** (`deleted_at`), purgées physiquement après un **horizon de 90 jours** (`SYNC_PURGE_HORIZON_DAYS`), un client dont le dernier pull est plus ancien doit refaire une synchronisation complète ; **LWW par enregistrement** via un upsert sans prise de contrôle (`ON CONFLICT (id) … WHERE propriétaire = EXCLUDED.propriétaire`), sauf qu'un appareil en retard **ne peut pas annuler une suppression** (`baseUpdatedAt`) ; **plongée = événement + participation** (+ palanquée), écrite d'un bloc dans une transaction. | La PWA saisit hors ligne : les ids doivent exister avant la synchronisation, et seule l'horloge du serveur est fiable. Le découpage événement / participation est fait dès la migration initiale, car le changer plus tard imposerait de migrer IndexedDB sur chaque appareil. Les invariants MVP (un seul participant, le créateur) sont dans les services, pas en SQL, car ils seront levés avec le partage. |
| D23 | **`GET /api/dashboard`, premier endpoint métier** : statistiques calculées à la volée en SQL (une transaction `REPEATABLE READ`, plongées vivantes seulement, mois **locaux** de la plongée) ; contrat `DashboardResponse` dans `@e-deep/shared`, que le front valide (guard) puis convertit en son modèle de vue (`features/dashboard/api/dashboardApi.ts`). **Plongeur courant** résolu par `CurrentDiverGuard` : en attendant l'authentification, un **stub de développement** (`DEV_AUTH_STUB=true`) prend le premier plongeur créé ; sans lui, 401.                                                                                                                                                                                                                                                                   | Le volume (H-14) ne justifie aucun agrégat stocké. Le contrat partagé reste neutre (mois `YYYY-MM`, mesures `null` si non saisies) : libellés et initiales sont du ressort du front. Le garde est le point d'entrée unique de la future session, le reste ne changera pas.                                                                                                                                     |

Décisions prises avec le carnet « Mes plongées » branché sur l'API (**2026-11-13**).

| #   | Décision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Raison                                                                                                                                                                                                                                                                                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D24 | **TanStack Query** (`@tanstack/react-query` 5, sans devtools) dans `apps/web` : un `QueryClient` au niveau du module (`shared/lib/queryClient.ts`), **un seul retry** et seulement sur erreur transitoire (réseau, timeout, 5xx ; jamais sur 4xx ni réponse hors contrat), `staleTime` 60 s, pas de refetch au retour du focus, clés de requête par feature (`features/<domaine>/api/queryKeys.ts`). `useDashboard` et `useDives` passent dessus ; le forçage `?state=` désactive la requête. Remplace D9 pour le data fetching. | Condition de D9 atteinte (health, dashboard, carnet, détail). Remplace deux chargements écrits à la main (useEffect + AbortController + compteur de tentatives) et apporte cache partagé, retry et déduplication, puis l'invalidation des futures mutations. Coût mesuré : 12,0 kB gzip seul, **+6,4 kB gzip net** sur le bundle (les mocks du carnet en sont sortis). |
| D25 | **`GET /api/dives` renvoie le carnet complet** (plongées vivantes, plus récente d'abord, plafond serveur 5 000) ; **filtres, tris, pagination numérotée, résumé et facettes restent calculés côté front** (`selectDives`). Pas de pagination keyset. `GET /api/dives/:id` donne le détail.                                                                                                                                                                                                                                       | La page (pagination numérotée, tris par profondeur et durée, résumé et facettes sur toute la sélection, compteur en direct) ne se prête pas à un curseur keyset. Le carnet pèse ~4 kB gzip pour 127 plongées, et la PWA offline-first (D22) aura de toute façon tout le carnet en local : une sélection serveur serait jetée.                                          |
| D26 | **Numéro de plongée calculé**, jamais stocké : `ROW_NUMBER() OVER (ORDER BY started_at, id)` sur les participations vivantes du plongeur, identique en liste et en détail.                                                                                                                                                                                                                                                                                                                                                       | Avec des créations hors ligne sur plusieurs appareils, un numéro stocké avec contrainte unique entrerait en conflit à la synchronisation. Un décalage « carnet papier » pourra s'ajouter sur le plongeur.                                                                                                                                                              |
| D27 | **`dive_sites.locality`** (texte facultatif). La région reste un texte libre : côté front, les régions du filtre viennent des données (clé normalisée dans l'URL, `r-<hash>` quand le nom n'a pas de translittération latine).                                                                                                                                                                                                                                                                                                   | La maquette affiche « Calvi · Corse » ; une liste figée de régions ne survit pas à des sites saisis librement.                                                                                                                                                                                                                                                         |
| D28 | **Garde-fou du stub** : la validation d'env refuse `DEV_AUTH_STUB=true` avec `NODE_ENV=production` (le boot échoue), et `CurrentDiverGuard` pose `Cache-Control: no-store` sur toutes les réponses des routes qu'il protège. On garde `Diver` et `CurrentDiverGuard` plutôt qu'une entité `User` et un `CurrentUserProvider`.                                                                                                                                                                                                    | Le garde existait déjà (D23) : un échec au démarrage est plus sûr qu'une erreur à chaque requête. Les réponses portent des données de santé, aucun cache intermédiaire ne doit les garder.                                                                                                                                                                             |

## 11. Points ouverts

Issus de la revue de l'initialisation (2026-11-06). Ils ne sont pas bloquants.

- **Client API (web + admin)** : un timeout ou une annulation survenant pendant `response.json()`
  est classé `invalid-response` au lieu de `timeout` / propagé.
- **Accessibilité** : le `role="status"` du fallback Suspense est remplacé par une nouvelle région
  live, donc le premier résultat peut ne pas être annoncé. Il faut garder une région live
  persistante autour de la limite Suspense. _Résolu pour `/dives`_ (région persistante dans
  `DivesPage`) ; reste ouvert pour `HealthPanel`.
- **API avant la prod** :
  - désactiver `X-Powered-By` ;
  - option `ssl` pour PostgreSQL ;
  - neutraliser le message de `BadRequestException` sur JSON malformé (il cite un fragment du
    corps) ;
  - logger de boot sans stack (voir §9.7).
- **Tests à ajouter** : rejet CORS d'une origine non autorisée ; timeout d'`apiClient` côté admin
  (`validateEnvironment` et le timeout du client web sont couverts depuis le carnet).

Issus du schéma du carnet (2026-11-08) :

- **Contrat front** : `UserLevel` (`'N1'…'N4'`) devra s'élargir dès qu'un niveau non FFESSM sera
  inséré (`toUserLevel` refuse aujourd'hui ces niveaux). (`utcOffsetMinutes` et la date locale ISO
  sont exposés par `DashboardDive` et `DiveSummary`.)
- **Endpoints** : erreurs métier (`common/errors/domain-errors.ts`) à mapper en réponses HTTP ;
  pour l'instant elles finissent en 500 générique via `LogSafeExceptionFilter`.
- **Authentification réelle à brancher avant toute exposition hors dev.** `DEV_AUTH_STUB` est
  refusé si `NODE_ENV=production` (D28), mais un `NODE_ENV` absent vaut `development` : un
  déploiement qui l'oublie accepterait le stub. La session remplacera le stub dans
  `CurrentDiverGuard`.
- **Purge** : `PurgeService.purge()` existe sans planificateur.
- **Partage des plongées** (D-08) : transfert des événements partagés à insérer dans
  `DiversService.deleteAccount`, avant le `DELETE`, et passage de `fk_dive_events__creator_id` en
  `RESTRICT`.

Issus du dashboard (phases 1 à 5, 2026-11-07) :

- **Carte** : placeholder SVG. MapLibre GL viendra ensuite : seule `projectToMap` (`features/dashboard/lib/mapProjection.ts`) et le rendu des marqueurs changeront. Les marqueurs proches se chevauchent (sites du Var) : il faudra un regroupement (clustering).
- **Données** : le dashboard lit `GET /api/dashboard` (D23, via `useQuery` depuis D24) ; ses chiffres
  sont désormais ceux du carnet des maquettes « Mes plongées » (seed). Les mocks ne servent plus qu'au forçage
  `?state=loading|empty|ready` en dev et aux tests. Le `UserCard` du shell (`app/routes.tsx`) affiche
  encore `mockUser` : à brancher sur un futur `GET /api/me`. La carte placeholder place hors cadre
  les sites éloignés (Lavezzi). Les captions sans donnée de la maquette (« pace stable », « +1h42 ce mois ») ne sont pas affichées. `stats.mainArea` a été ajouté aux types pour « Méditerranée occidentale ».
- **Filtres de période** de la carte : visuels uniquement (état local).
- **i18n** : textes en français écrits dans les composants. Une lib i18n sera à prévoir si une deuxième langue arrive.
- **Pages** : Carte, Statistiques, Binômes, Recherche, Notifications et Paramètres sont des placeholders. La page Statistiques demandera une lib de graphiques (Visx ou ECharts, couleurs via `tokens.ts`).
- **Accessibilité** : audit fait à la main et par scripts Playwright (axe-core n'est pas installé : à ajouter en CI si on accepte la dépendance). Le menu du compte se ferme au clic extérieur via `focusout`, sans écouteur global.

Issus du carnet « Mes plongées » (revue et audits, 2026-11-13) :

- **API avant la prod** (suite) :
  - compression HTTP absente : `GET /api/dives` fait 56 kB bruts pour 127 plongées (~4 kB en
    gzip, ~2,2 MB bruts au plafond) ; à faire au reverse proxy, sinon `compression` ;
  - régler `random_page_cost≈1.1` (SSD) : avec la valeur par défaut, la liste fait un Seq Scan de
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
  - sync des sites : un `locality` omis devient `null` dans l'upsert LWW, donc un client ancien
    l'effacerait ; trancher « omis = conserver » ou champ obligatoire avant l'endpoint de sync ;
  - recherche : `normalize('NFD')` refait à chaque frappe sur tout le carnet (0,25 ms pour 127
    plongées, 8,4 ms pour 5 000) ; précalculer le texte normalisé si un gros carnet le justifie.
- **Seed** : pas de transaction globale (les services ouvrent leurs propres transactions) ; un
  échec en cours laisse un état partiel, et relancer le seed le répare. Ses refus (production,
  base non locale, migrations en attente) ne sont pas testés.
- **Tests API** : départage par `id` de deux plongées au même instant, cohérence du numéro
  liste/détail avec des tombstones intercalés, plafond vérifié en base ; l'assertion « 404 sans
  l'id » de l'e2e ne peut pas échouer (le vrai test est en base).
- **Web, identité** : `mockUser` (mocks du dashboard) sert encore de propriétaire du carnet
  (`DivesPage`) et au `UserCard` ; ~600 o de mocks du dashboard restent dans le bundle. À remplacer
  par la session ou `GET /api/me`. Les clés de requête ne contiennent pas l'utilisateur :
  `queryClient.clear()` au logout. Le memo de `useDives` dépend de l'identité de l'objet `owner`.
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
