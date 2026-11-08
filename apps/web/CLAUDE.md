# apps/web — design system DiveLog

Front plongeur (carnet de plongée, PWA à terme). Interface en **français**.
`ARCHITECTURE.md` (racine) reste la **source de vérité** : en cas de conflit avec ce fichier, il
prime. Stack : Vite + React 19 + TypeScript strict + SCSS Modules. Pas de framework CSS utilitaire, pas de
CSS-in-JS, pas de lib de composants UI.

## Design : où regarder

- `design/README.md` — **à lire avant toute tâche UI** : tokens, architecture, mapping maquette →
  composants, écarts connus.
- `design/screenshots/*.png` — rendu de référence. **Ouvre la capture de l'écran concerné avant de
  coder.**
- `design/mockups/*.jsx` — code des maquettes : source exacte des mesures, textes et couleurs.
  **Lecture seule, à ne jamais importer ni copier tel quel** (styles inline, `window.*`).
- En cas de conflit : `design/README.md` § 5 > captures > code des maquettes.

## Règles du design system (non négociables)

- **Jamais de valeur en dur** (hex, rgba, px, ms) dans un composant : `$tokens` SCSS,
  `var(--dl-…)` ou `@/design/tokens`. Seules exceptions : `0`, `1px` des bordures fines, `100%`.
- Tokens : **éditer uniquement `src/design/tokens.ts`**, puis `pnpm --filter web run tokens`. Ne
  jamais modifier `src/styles/tokens/_tokens.scss` ou `_vars.scss` à la main (fichiers générés).
  Si une valeur n'a pas de token, ajouter le token dans `tokens.ts` (ou le signaler), ne pas
  l'inventer en dur.
- Dans chaque `*.module.scss` : `@use '@/styles/tokens' as *;` puis les mixins (`type()`,
  `overline()`, `card()`, `focus-ring`, `hit-target()`, `skeleton()`, `from()`, `visually-hidden`).
  `@use` uniquement, jamais `@import`.
- Thème **sombre uniquement** (`color-scheme: dark`).
- Accent turquoise **rare** : CTA principal, état actif, point culminant d'un graphe. Rien d'autre.
- Chiffres (KPI, mesures, dates, compteurs) en **Geist Mono + tabular-nums**.
- Mobile-first : styles de base pour 375px, puis `@include from($bp-tablet)` / `from($bp-desktop)`.

## Conventions React (adaptées à l'arborescence d'ARCHITECTURE.md)

- Un composant par dossier : `<Name>/<Name>.tsx` + `<Name>.module.scss` + `index.ts`, placé selon
  sa portée :
  - primitives UI (Button, Card, Overline, Icon, Badge, Avatar, Skeleton) → `src/shared/ui/<Name>/` ;
  - layout applicatif (AppShell, Sidebar, NavItem, UserCard, TopBar, Drawer, Fab) →
    `src/app/layout/<Name>/` ;
  - dashboard (KpiCard, SiteMap, LastDiveCard…) → `src/features/dashboard/components/<Name>/`,
    hook `src/features/dashboard/hooks/useDashboard.ts`, page `src/app/routes/DashboardPage.tsx`.
- Une feature n'importe jamais une autre feature ; ce qui est partagé remonte dans `src/shared/`.
- Composants fonctionnels, props typées par `interface <Name>Props`, exports nommés. Pas de
  `React.FC`, pas de `any`.
- Classes CSS Modules en camelCase (`styles.kpiValue`) ; variantes via `data-*` ou classes
  modificatrices (`styles.primary`), combinées avec `cx` (`@/shared/lib/classNames`, pas de clsx).
- Données : `GET /api/dashboard` (contrat `DashboardResponse` de `@e-deep/shared`, validé et converti
  dans `features/dashboard/api/dashboardApi.ts`) ; types de vue `@/features/dashboard/types` ; mock
  `@/features/dashboard/mocks/dashboard` pour `?state=` (dev) et les tests ; formatage via
  `@/shared/lib/format` (jamais de formatage inline).
- Un seul composant par écran pour desktop et mobile : le responsive passe par le SCSS, pas par
  des composants `Mobile*` ni par `window.innerWidth` (sauf pour le passage sidebar ↔ drawer, via
  un hook `useMediaQuery` dans `src/shared/hooks/`).
- Nom du produit : toujours `APP_NAME` (`@/shared/config/app`), jamais « DiveLog » en dur.
- Routing : table dans `src/app/routes.tsx` (React Router, mode data). Une action sans écran pointe
  vers une route placeholder : aucun lien ni bouton mort. Catalogue des primitives : `/_dev/ui` (dev).
- Actions qui naviguent : `ButtonLink` / `IconLink` ; actions locales : `Button` / `IconButton`.
- Alias `@/` → `src/`.

## Accessibilité (obligatoire)

Respecter la checklist de `design/README.md` § 6 : landmarks, `aria-current`, `aria-label` sur les
boutons icône, focus visible, cibles ≥ 44px, drawer avec focus trap + `Esc`, `aria-busy` sur les
skeletons, `prefers-reduced-motion`.

## Vérification visuelle

Après avoir implémenté ou modifié un écran :

1. `pnpm dev:web` (depuis la racine, en arrière-plan).
2. `pnpm --filter web run screenshot "/dashboard?state=ready"` (même chose avec `empty` et
   `loading` ; un 2e argument fixe une seule largeur : `1440` ou `375`).
3. Ouvre `apps/web/.screenshots/*.png` **et** la capture de référence dans `design/screenshots/`,
   liste les écarts (espacements, tailles, couleurs, alignements) et corrige-les avant de déclarer
   la tâche finie.

## Commandes (depuis la racine)

- `pnpm dev:web` — serveur Vite (5173)
- `pnpm --filter web run tokens` — régénère les tokens SCSS/CSS depuis `src/design/tokens.ts`
- `pnpm --filter web run screenshot <route> [largeur]` — capture Playwright (Chromium)
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` — avant chaque commit
