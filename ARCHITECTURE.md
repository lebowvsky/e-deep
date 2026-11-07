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

Phase actuelle : **socle technique uniquement**, sans logique métier. La seule route est
`GET /api/health`, affichée par les deux fronts.

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
│   │   │   ├── database/         options DataSource partagées, data-source.ts (CLI), migrations/
│   │   │   ├── common/           transverse : filtres, logging
│   │   │   └── modules/<domaine>/ un module Nest par domaine métier (health)
│   │   └── test/                 tests e2e (supertest)
│   ├── web/                      React 19 + Vite 8 + SCSS modules (design system DiveLog)
│   │   ├── CLAUDE.md             règles du design system pour les agents
│   │   ├── design/               handoff : README (spec), screenshots/, mockups/ (lecture seule)
│   │   ├── scripts/              generate-tokens.ts, screenshot.mjs (Playwright)
│   │   └── src/
│   │       ├── app/              App, providers, router + routes.tsx, routes/ (pages), layout/ (AppShell…)
│   │       ├── design/tokens.ts  source unique des design tokens
│   │       ├── features/<domaine>/{api,hooks,components} (+ types.ts, mocks/ si besoin)
│   │       ├── shared/{ui,hooks,lib,config}  config/app.ts : APP_NAME
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

| Zone         | Stack                                                                                                                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Racine       | TypeScript ~6.0.3, ESLint 10 + typescript-eslint 8 (type-checked), Prettier 3                                                                                                                    |
| `apps/api`   | NestJS 12.4 (**CommonJS**), @nestjs/config, TypeORM 1.1 + pg, class-validator / class-transformer, Jest 30 + ts-jest + supertest                                                                 |
| `apps/web`   | React 19.3, Vite 8 (Rolldown), @vitejs/plugin-react 6, sass-embedded, Geist via fontsource, React Router 8 (data mode), Vitest 5 + Testing Library (+ user-event) + jsdom, Playwright (captures) |
| `apps/admin` | Pareil que web pour React/Vite/tests, plus Tailwind 4.3 (`@tailwindcss/vite`) et shadcn/ui (CLI 4.23, base Radix, preset Nova)                                                                   |
| Infra dev    | PostgreSQL 18 (`postgres:18-alpine`) via docker compose                                                                                                                                          |

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
  Prettier. Les valeurs calculées en JS (graphes, SVG) importent `@/design/tokens`.
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

## 8. Tests

| App   | Outil                              | Commande                                                           | Contenu actuel                                                                             |
| ----- | ---------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| api   | Jest 30 + ts-jest, supertest       | `pnpm --filter api run test` (unit + e2e), `test:unit`, `test:e2e` | `HealthService` (DB up/down), filtre d'exceptions, e2e `/api/health`                       |
| web   | Vitest 5 + Testing Library (jsdom) | `pnpm --filter web run test`                                       | client API, guard `HealthResponse`, `HealthPanel` (chargement, ok, dégradé, erreur, retry) |
| admin | Vitest 5 + Testing Library (jsdom) | `pnpm --filter admin run test`                                     | client API, guard, `HealthCard`, `AdminLayout`                                             |

- **`pnpm test` n'a besoin d'aucune base** : l'e2e de l'API monte `HealthModule` avec une
  `DataSource` simulée, via le même `configureApp` que `main.ts`.
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
6. **Secrets** : aucun secret dans le code ni dans le dépôt. Seuls les `.env.example` sont
   versionnés (`.gitignore` : `.env*` sauf `*.example`). La DB de dev n'écoute que sur localhost.
7. **Limites connues** : au démarrage, en cas d'échec de connexion, `@nestjs/typeorm` logge la
   stack de l'erreur (qui peut contenir hôte et port), et la CLI TypeORM force le log des requêtes
   pendant `migration:*`. Aucune donnée de requête n'est concernée. À traiter avant la production,
   par un logger personnalisé au boot.

## 10. Décisions

Décisions prises lors de l'initialisation du **2026-11-06**.

| #   | Décision                                                                                                                                                                                                                                                                                                                                                     | Raison                                                                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **NestJS en CommonJS + Jest**, alors que Nest 12 génère par défaut de l'ESM + Vitest. Le fichier est écrit à la main d'après le template CJS, car `nest new --type cjs` n'est plus un flag CLI.                                                                                                                                                              | Choix validé par le porteur du projet. La CLI TypeORM et ts-jest sont plus simples en CJS. Les paquets Nest 12 sont ESM-only et chargés via `require(esm)`.                                                                                                                                                                                  |
| D2  | **TypeScript épinglé en `~6.0.3`**, alors que TS 7 est sorti.                                                                                                                                                                                                                                                                                                | typescript-eslint demande `<6.1`, ts-jest `<7`, et Nest CLI embarque `~6.0`. On repassera en TS 7 quand l'outillage le supportera.                                                                                                                                                                                                           |
| D3  | **`verbatimModuleSyntax: false` dans `nest.json`.**                                                                                                                                                                                                                                                                                                          | Cette option est incompatible avec une sortie CommonJS (TS1286 sur les `import` ESM). Elle reste active dans `base.json` et `react.json`.                                                                                                                                                                                                    |
| D4  | **Node 26 LTS** (`.nvmrc`, `engines >=26`).                                                                                                                                                                                                                                                                                                                  | C'est la LTS active depuis octobre 2026.                                                                                                                                                                                                                                                                                                     |
| D5  | **pnpm 12.18**, avec ses protections supply-chain par défaut : `minimumReleaseAge` (des exclusions explicites pour les versions Nest toutes récentes et `minimatch@11.0.5`, dépendance de `@nestjs/cli`, sont dans `pnpm-workspace.yaml`) et `allowBuilds`. `@parcel/watcher` est refusé, car son script d'install est inutile et le binaire est précompilé. | Sécurité de la chaîne d'approvisionnement. Les exclusions sont à retirer une fois les versions assez anciennes.                                                                                                                                                                                                                              |
| D6  | **Scripts racine `migration:*`** (`pnpm migration:run`) au lieu de `pnpm migration:run --filter api`.                                                                                                                                                                                                                                                        | Avec pnpm 12, ce qui suit le nom du script lui est transmis. `--filter api` arriverait donc jusqu'à la CLI TypeORM, qui le rejette. Forme équivalente : `pnpm --filter api run migration:run`.                                                                                                                                               |
| D7  | **Migrations lancées depuis `dist`** après `nest build`.                                                                                                                                                                                                                                                                                                     | Pas de ts-node (fragile avec TS 6 + nodenext). Le stripping de types natif de Node ne gère pas les décorateurs.                                                                                                                                                                                                                              |
| D8  | **`GET /api/health` répond toujours 200**, avec `status: 'degraded'` / `database: 'down'` en cas d'échec DB. Le ping est borné à 3 s et la connexion à 5 s (`connectTimeoutMS`) : une base qui ne répond pas donne `down` et ne bloque pas l'endpoint. Pas de `@nestjs/terminus`.                                                                            | Contrat simple pour les fronts, et une dépendance de moins. Une sonde readiness en 503 pourra être ajoutée pour l'orchestration.                                                                                                                                                                                                             |
| D9  | **Pas de lib de data fetching** (TanStack Query) **ni de router** pour l'instant. `useHealth` s'appuie sur `use()`, Suspense, un `ErrorBoundary` maison et un petit `promiseCache`.                                                                                                                                                                          | Un seul endpoint en lecture : une lib serait superflue (éco-conception). **On adoptera TanStack Query** dès qu'il y aura plusieurs ressources serveur, des mutations avec invalidation ou des retries. **Router** : React Router (mode data) ou TanStack Router, à choisir à l'arrivée de la deuxième page ; seul `app/router.tsx` changera. |
| D10 | **`sass-embedded`** plutôt que `sass`.                                                                                                                                                                                                                                                                                                                       | Compilateur Dart natif, plus rapide, détecté automatiquement par Vite 8.                                                                                                                                                                                                                                                                     |
| D11 | **shadcn/ui** : `shadcn init -b radix -p nova`, avec les composants `card`, `badge` et `button`. La CLI ne propose plus de `--base-color`, la couleur vient d'un preset.                                                                                                                                                                                     | Suit la doc Vite officielle. Pas de `baseUrl`, `paths` suffit. `init` installe `cn` (remplaçant de clsx + tailwind-merge), `class-variance-authority`, `lucide-react`, `radix-ui`, `tw-animate-css` et `shadcn` (pour `shadcn/tailwind.css`). La webfont Geist a été retirée.                                                                |
| D12 | **Layout admin sémantique** (`aside` / `nav` / `main` en Tailwind) au lieu du bloc `sidebar` de shadcn.                                                                                                                                                                                                                                                      | Il ne demande pas de JS et beaucoup moins de composants (éco-conception), et il est responsive.                                                                                                                                                                                                                                              |
| D13 | **Code partagé entre fronts dupliqué** en phase 1 (client API, guards, `useHealth`…).                                                                                                                                                                                                                                                                        | Conséquence de D1 et de la règle « shared = types ». On factorisera au troisième consommateur (voir §6).                                                                                                                                                                                                                                     |
| D14 | **PostgreSQL 18** (`18-alpine`).                                                                                                                                                                                                                                                                                                                             | Dernière majeure stable (19 est encore en RC).                                                                                                                                                                                                                                                                                               |
| D15 | **Lint et format centralisés** à la racine. Le lint Nest 12 (oxlint) et celui du template Vite ne sont pas repris.                                                                                                                                                                                                                                           | Une seule config, imposée par le cadrage initial.                                                                                                                                                                                                                                                                                            |

Décisions prises à l'installation du design system (**2026-11-07**).

| #   | Décision                                                                                                                                                                                                                                                                                                                         | Raison                                                                                                                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D16 | **Polices Geist / Geist Mono auto-hébergées** (`@fontsource-variable/geist`, `-mono`), à la place de la pile système.                                                                                                                                                                                                            | Rendu fidèle aux maquettes. Les fichiers sont servis par l'app (aucun CDN tiers, donc pas de transfert d'IP, RGPD), et le `unicode-range` limite le téléchargement au sous-ensemble latin. |
| D17 | **Design system DiveLog** (kit de handoff) : `tokens.ts` → tokens SCSS/CSS générés, thème sombre uniquement, mixins dédiés. Il remplace les anciens `_tokens`/`_mixins`/`_reset`/`main.scss`. Le kit est adapté à l'arborescence existante (`shared/ui`, `app/layout`, `features/dashboard`).                                    | Une seule source de vérité pour les tokens, partagée par SCSS et TS ; pas deux systèmes en parallèle.                                                                                      |
| D18 | **Génération des tokens par Node natif** (`node scripts/generate-tokens.ts`, type stripping de Node 26), sans `tsx`. **Playwright** (Chromium) en devDependency pour les captures de comparaison aux maquettes.                                                                                                                  | Une dépendance de moins ; le script est typé par `tsconfig.node.json` (`allowImportingTsExtensions`). La vérification visuelle demande un vrai navigateur.                                 |
| D20 | **React Router (mode data)** : `createBrowserRouter` dans `app/router.tsx`, table des routes dans `app/routes.tsx` (réutilisée par les tests via `createMemoryRouter`). `/` redirige vers `/dashboard` ; les actions sans écran pointent vers des routes placeholder ; `/_dev/ui` (catalogue des primitives) n'existe qu'en dev. | Tranche D9 à l'arrivée de la deuxième page. Choix dicté par le brief du dashboard (`apps/web/design/prompts/`).                                                                            |
| D19 | **`cx` maison** (`shared/lib/classNames.ts`) au lieu de `clsx` recommandé par le kit.                                                                                                                                                                                                                                            | Fonction de 3 lignes déjà présente : pas de dépendance supplémentaire (éco-conception).                                                                                                    |

## 11. Points ouverts

Issus de la revue de l'initialisation (2026-11-06). Ils ne sont pas bloquants.

- **Client API (web + admin)** : un timeout ou une annulation survenant pendant `response.json()`
  est classé `invalid-response` au lieu de `timeout` / propagé.
- **Accessibilité** : le `role="status"` du fallback Suspense est remplacé par une nouvelle région
  live, donc le premier résultat peut ne pas être annoncé. Il faut garder une région live
  persistante autour de la limite Suspense.
- **API avant la prod** :
  - désactiver `X-Powered-By` ;
  - option `ssl` pour PostgreSQL ;
  - neutraliser le message de `BadRequestException` sur JSON malformé (il cite un fragment du
    corps) ;
  - logger de boot sans stack (voir §9.7).
- **Tests à ajouter** : `validateEnvironment` (noms seulement dans le message), timeout
  d'`apiClient`, rejet CORS d'une origine non autorisée.
