# Mission : implémenter le tableau de bord à partir des maquettes

Tu vas développer le **tableau de bord** de l'application (états *ready*, *empty* et *loading*, desktop et mobile) à partir des maquettes du dossier `design/`. Le travail se fait **par phases**. **Arrête-toi à la fin de chaque phase** : fais un compte rendu court (fichiers créés, écarts avec la maquette, questions) et attends mon « OK » avant de passer à la suivante.

## Contexte à lire d'abord (obligatoire)

1. `CLAUDE.md` : conventions du projet et règles du design system.
2. `design/README.md` en entier, en particulier le § 3 (architecture et correspondance maquette → composants), le § 5 (écarts connus) et le § 6 (accessibilité).
3. Les captures `design/screenshots/00` à `05` : ouvre chaque image avant de coder l'écran correspondant.
4. Les fichiers déjà en place : `src/design/tokens.ts`, `src/styles/**`, `src/types/domain.ts`, `src/mocks/dashboard.ts`, `src/lib/format.ts`.

Utilise le skill `/implement-screen` pour chaque écran ou groupe de composants.

## Décisions déjà prises (ne pas les remettre en question)

- **Nom du produit : E-Deep.** Les maquettes affichent encore « DiveLog ». Affiche « E-Deep » partout dans l'interface (logo texte, titre du document) via une constante `APP_NAME` dans `src/config/app.ts`.
- **Stack** : Vite + React + TypeScript strict + SCSS Modules. Pas de Tailwind, pas de CSS-in-JS, pas de lib de composants.
- **Dépendances autorisées** : `react-router` (si absent), `clsx`, les polices `@fontsource-variable/*`, `vitest` + `@testing-library/react` + `@testing-library/user-event` + `jsdom` pour les tests. **Pour toute autre dépendance, demande-moi d'abord.**
- **Histogramme** : la version desktop de la maquette est buguée (barres écrasées). Implémente le comportement du mobile : barres proportionnelles, pic en `accent` avec sa valeur au-dessus, autres barres en `chartBar`.
- **FAB mobile** : présent, 56px, action « Nouvelle plongée », `aria-label` explicite.
- **Carte** : pas de MapLibre en V1. Fais un placeholder SVG fidèle à la maquette (grille, courbes, markers avec compteur, marker actif en accent, popover du site actif, échelle « 50 km »). Projette les markers à partir de `latitude`/`longitude` des mocks sur une bounding box fixe. Isole cette projection dans une fonction pour pouvoir passer à MapLibre plus tard sans toucher au reste.
- **Filtres de période de la carte** : `1M · 3M · 1A · Tout`, 3M actif par défaut. Ils sont purement visuels en V1 (état local, pas de filtrage des données).
- **Tablette (768–1023px)** : sidebar 240px et grilles adaptées. Pas de rail d'icônes.
- **Données** : uniquement les mocks. `useDashboard()` renvoie un `DashboardState` et lit `?state=loading|empty|ready` dans l'URL (par défaut : `ready`, après un faux délai de 400 ms en dev). Sa signature doit rester la même quand on branchera l'API.
- **Actions sans destination** (Nouvelle plongée, Voir le détail, Voir tous, recherche, notifications) : liens ou boutons vers des routes placeholder (`/dives/new`, `/dives/:id`, `/buddies`). Rien ne doit être cassé ni mort.

## Phase 0 — Plan (sans écrire de code)

- Vérifie que le kit est bien installé : alias `@/` dans Vite et dans tsconfig, `npm run tokens` fonctionne, `global.scss` et les polices sont importés dans `main.tsx`, Playwright est disponible. Liste ce qui manque.
- Propose l'arborescence finale des composants, leurs props principales et l'ordre de réalisation.
- Liste chaque valeur des maquettes qui n'a pas de token équivalent, avec ta proposition : nouveau token dans `tokens.ts`, ou arrondi au token le plus proche.
- **Stop. Attends ma validation.**

## Phase 1 — Fondations et primitives `ui/`

- Corrige ce qui manque pour le setup (phase 0), configure Vitest et ajoute un script `npm run test`.
- Routing : `/` redirige vers `/dashboard`, plus les routes placeholder.
- Composants `ui/` : `Icon` (toutes les icônes de `atoms.jsx`, typées par un union `IconName`), `Button` (primary / secondary / ghost, avec icône optionnelle, rendu en `<button>` ou en lien), `Card` (elev 0/1/2, padding configurable), `Overline`, `Badge` (accent / success / warning / neutral), `Avatar` (initiales + couleur), `Skeleton`.
- Ajoute une route dev `/_dev/ui` (absente du build de prod) qui affiche toutes les primitives et leurs variantes. Compare-la à `00-visual-direction.png` (sections Composants et Chips & badges).
- **Stop. Compte rendu + capture.**

## Phase 2 — Layout (AppShell)

- `AppShell`, `Sidebar` (logo, nav de 4 entrées avec `aria-current`, `UserCard` en bas), `NavItem`, `TopBar` (mobile), `Drawer`, `Fab`, et un hook `useMediaQuery` pour basculer entre sidebar et drawer à 768px.
- Drawer : `role="dialog"` + `aria-modal`, scrim cliquable, fermeture avec `Esc`, focus trap, focus rendu au bouton menu à la fermeture, scroll du body bloqué pendant l'ouverture.
- Fond de page : `abyss` + les radial-gradients de la maquette.
- Tests : le drawer s'ouvre, se ferme avec `Esc` et rend le focus.
- Comparaison avec `05-mobile-drawer.png` et la sidebar de `01-desktop-nominal.png`.
- **Stop.**

## Phase 3 — Dashboard, état *ready*

Implémente dans cet ordre, en vérifiant chaque bloc à 1440 puis à 375 :

1. `DashboardHeader` : surtitre date/heure/zone en mono accent, h1 « Tableau de bord », sous-titre « Bonjour {prénom}. {n} jours depuis ta dernière plongée. » calculé avec `daysSince`, actions recherche + notifications (pastille) + CTA. Sur mobile, le CTA disparaît au profit du FAB.
2. `KpiRow` + `KpiCard` (+ `Sparkline` pour les deux premiers) : 4 colonnes desktop, 2×2 mobile, valeurs en mono tabulaire avec unité plus petite, libellés mobiles raccourcis comme sur la maquette.
3. `SiteMap` : voir les décisions ci-dessus. Le popover desktop pointe le site actif ; sur mobile, version compacte avec bouton « Agrandir » et lien « Tous les sites ».
4. `LastDiveCard` + `Metric` : badges (Palier OK, gaz · niveau), 4 métriques, binômes, lien « Voir le détail → ».
5. `DivesPerMonthChart` : total sur 12 mois en haut à droite, alternative accessible (tableau `visually-hidden`), libellés de mois abrégés à une lettre sur mobile.
6. `BuddyList` : défilement horizontal sans scrollbar visible, cartes avatar + nom + nombre de plongées, lien « Voir tous ».
7. Pied de page discret comme sur la maquette.

Lance ensuite `node scripts/screenshot.mjs "/dashboard?state=ready"` et compare à `01` et `04`. Corrige jusqu'à ce que l'écart soit négligeable (3 passes max), puis liste les écarts restants.
**Stop.**

## Phase 4 — États *empty* et *loading*

- `DashboardEmpty` (`02-desktop-empty.png`) : surtitre « PREMIÈRE CONNEXION · BIENVENUE », « Bienvenue à bord, {prénom} », un seul CTA, KPI à « — » en `textMuted`, carte vide avec pin et message, deux cartes vides.
- `DashboardSkeleton` (`03-desktop-loading.png`) : même structure que l'état ready, `aria-busy="true"` et un texte « Chargement du tableau de bord » en `visually-hidden`, shimmer coupé avec `prefers-reduced-motion`.
- Fais aussi une version mobile cohérente de ces deux états (non maquettée : déduis-la de `04`).
- Tests : `DashboardPage` affiche le bon composant pour chacun des 3 états.
- Captures + comparaison. **Stop.**

## Phase 5 — Finitions et contrôle qualité

- Audit accessibilité selon `design/README.md` § 6 : navigation complète au clavier, ordre de focus, libellés lus par un lecteur d'écran (valeur et unité ensemble), un seul h1, contrastes.
- Vérifie les largeurs 375, 768, 1024 et 1440 : aucun débordement horizontal, aucun texte tronqué de façon non voulue.
- Fais un grep des valeurs en dur (`#`, `rgba(`, `px` hors tokens et mixins) dans `src/components` et corrige-les.
- `npm run typecheck`, `npm run lint`, `npm run test` et `npm run build` doivent tous passer.
- Compte rendu final : composants livrés, écarts volontaires avec la maquette et leur raison, dette et points ouverts (MapLibre, API, i18n, page Statistiques).

## Règles de travail

- Ne modifie jamais `design/` ni les fichiers générés `_tokens.scss` et `_vars.scss`.
- Si une info manque ou si la maquette se contredit, **pose la question** au lieu d'inventer, sauf pour les points déjà tranchés ci-dessus.
- Commits petits et atomiques à la fin de chaque phase (Conventional Commits, en anglais). Ne push pas.
