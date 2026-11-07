# DiveLog — Design handoff (React)

Spec de référence pour implémenter le **dashboard DiveLog** en **Vite + React + TypeScript + SCSS**.
Produit : carnet de plongée numérique pour plongeurs loisir FFESSM/CMAS (N1–N4). FR uniquement pour l'instant.

> Direction : *« Bleu nuit lisible, turquoise rare, typo Geist — un carnet sérieux, pas un cockpit. »*

---

## 1. Ce que contient ce dossier

| Chemin | Rôle | Statut |
|---|---|---|
| `screenshots/*.png` | **Rendu de référence** de chaque artboard (@2x) | Source de vérité visuelle |
| `mockups/*.jsx` | Code des maquettes (React + styles inline + `window` globals) | **Lecture seule.** Spec : mesures, textes, couleurs. Ne pas copier tel quel. |
| `mockups/tokens.jsx` | Tokens d'origine | Remplacé par `src/design/tokens.ts` |
| `README.md` | Ce document | — |

### Écrans

| Capture | Composant maquette | Taille | Contenu |
|---|---|---|---|
| `00-visual-direction.png` | `VisualDirection` (visual-direction.jsx) | 1280 × 1820 | Palette, type scale, espacements, rayons, composants, Laws of UX |
| `01-desktop-nominal.png` | `DashboardDesktop` (dashboard-desktop.jsx) | 1440 | État nominal, utilisatrice N2, 127 plongées |
| `02-desktop-empty.png` | `EmptyDesktop` (dashboard-states.jsx) | 1440 | Débutant, 0 plongée — un seul CTA |
| `03-desktop-loading.png` | `LoadingDesktop` (dashboard-states.jsx) | 1440 | Skeletons |
| `04-mobile-nominal.png` | `MobileNominal` (dashboard-mobile.jsx) | 375 | Top bar + FAB |
| `05-mobile-drawer.png` | `MobileDrawer` (dashboard-mobile.jsx) | 375 × 812 | Drawer de navigation ouvert |

---

## 2. Design tokens

**Source unique : `src/design/tokens.ts`.** Le script `pnpm --filter web run tokens` génère :

| Fichier généré | Usage |
|---|---|
| `src/styles/tokens/_tokens.scss` | Variables SCSS (`$color-accent`, `$space-4`, `$type-kpi`…) |
| `src/styles/tokens/_vars.scss` | Custom properties `:root` (`var(--dl-color-accent)`) |

Mixins écrits à la main : `src/styles/tokens/_mixins.scss` → `type()`, `overline()`, `card()`, `focus-ring`, `hit-target()`, `skeleton()`, `from()/until()`, `visually-hidden`.

Dans un composant : `@use '@/styles/tokens' as *;` donne accès à tout.

**Quand utiliser quoi**
- SCSS (`$token`) : par défaut, dans tous les `*.module.scss`.
- TS (`import { color } from '@/design/tokens'`) : valeurs calculées en JS (graphes, SVG dynamique, styles inline inévitables).
- CSS vars (`var(--dl-…)`) : attributs SVG, styles inline ponctuels, theming futur.

### Palette

| Token | Hex | Usage |
|---|---|---|
| `abyss` | `#060C18` | fond de page |
| `surface0` | `#0B1A2E` | sidebar, surfaces en retrait |
| `surface1` | `#122544` | carte principale |
| `surface2` | `#1B3156` | popover, surface survolée |
| `surface3` | `#24406D` | anneaux de markers, chips |
| `textHigh` | `#EAF2FB` | titres + KPI (AAA) |
| `textMed` | `#AFC1D6` | texte courant (AA) |
| `textLow` | `#6E819A` | méta, légendes — jamais pour un texte essentiel < 18px |
| `textMuted` | `#43556F` | désactivé / décoratif uniquement |
| `accent` | `#4FD6C9` | CTA, état actif, point culminant d'un graphe — **avec parcimonie** |
| `success / warning / danger` | `#5BD391 / #E7B24A / #E06A70` | badges sémantiques (fond = couleur à 12 %) |

Aucune autre teinte d'accent. Le turquoise évoque l'eau **par le contexte**, jamais par la quantité.

### Échelles
- **Espacement** : base 4px, `$space-1` (4) → `$space-11` (80).
- **Rayons** : sm 6 · md 10 · lg 14 (cartes) · xl 20 · pill 999.
- **Typo** : Geist (UI) + Geist Mono (chiffres, overlines, timestamps, coordonnées).
  display 40/44 · h1 28/34 · h2 20/26 · h3 16/22 · body 14/20 · caption 12/16 · overline 11/14 (mono, uppercase) · kpi 44/48 (mono, tabular-nums).
- **Breakpoints** : mobile 375 · tablet 768 · desktop 1024 · wide 1440.
- **Motion** : 120 / 180 / 280 ms, `ease-out` par défaut. Respecter `prefers-reduced-motion`.

---

## 3. Architecture cible

Adaptée à l'arborescence d'`ARCHITECTURE.md` (racine du monorepo), qui prime.

```
apps/web/
├─ design/                              # ce dossier (README, captures, maquettes)
├─ scripts/ generate-tokens.ts · screenshot.mjs
└─ src/
   ├─ design/tokens.ts                  # SOURCE des tokens
   ├─ styles/
   │  ├─ global.scss                    # reset, body, focus, keyframes (importé 1× dans main.tsx)
   │  └─ tokens/ _index · _tokens (gen) · _vars (gen) · _mixins
   ├─ shared/
   │  ├─ ui/                            # Button, Card, Overline, Icon, Badge, Avatar, Skeleton
   │  ├─ hooks/                         # useMediaQuery
   │  └─ lib/format.ts                  # formatage FR (durées, dates) · classNames.ts (cx)
   ├─ app/
   │  ├─ layout/                        # AppShell, Sidebar, NavItem, TopBar, Drawer, UserCard, Fab
   │  └─ routes/DashboardPage.tsx
   └─ features/dashboard/
      ├─ types.ts                       # User, Dive, DiveSite, Buddy, DashboardPayload, DashboardState
      ├─ mocks/dashboard.ts             # données des maquettes (loading / empty / ready)
      ├─ hooks/useDashboard.ts          # renvoie DashboardState (mock → API plus tard)
      └─ components/                    # DashboardHeader, KpiRow, KpiCard, Sparkline, SiteMap,
                                        # LastDiveCard, Metric, DivesPerMonthChart, BuddyList,
                                        # DashboardEmpty, DashboardSkeleton
```

Un composant = un dossier : `KpiCard/KpiCard.tsx` + `KpiCard.module.scss` (+ `index.ts`).
Dans le tableau ci-dessous, `ui/` = `src/shared/ui/`, `layout/` = `src/app/layout/`,
`dashboard/` = `src/features/dashboard/components/`.

### Correspondance maquette → composants

| Maquette (fichier · fonction) | Composant(s) React |
|---|---|
| atoms.jsx · `Icon`, `Icons` | `ui/Icon` (SVG stroke 1.5, viewBox 24, `aria-hidden` par défaut) |
| atoms.jsx · `Btn` (primary / secondary / ghost) | `ui/Button` — h 40px, radius md |
| atoms.jsx · `Card` (elev 0/1/2) | `ui/Card` (mixin `card()`) |
| atoms.jsx · `Overline` | `ui/Overline` |
| desktop · `Sidebar`, `SidebarItem` | `layout/Sidebar`, `layout/NavItem`, `layout/UserCard` |
| desktop · `DashHeader` | `dashboard/DashboardHeader` |
| desktop · `KPI`, `Spark`, `KPIs` | `dashboard/KpiCard`, `dashboard/Sparkline`, `dashboard/KpiRow` |
| desktop · `MapBlock` | `dashboard/SiteMap` (+ popover, filtres de période) |
| desktop · `LastDive` | `dashboard/LastDiveCard` + `dashboard/Metric` |
| desktop · `BarChart` | `dashboard/DivesPerMonthChart` |
| desktop · `Buddies` | `dashboard/BuddyList` + `ui/Avatar` |
| mobile · `MobileTopBar`, `Drawer`, `FAB` | `layout/TopBar`, `layout/Drawer`, `layout/Fab` |
| mobile · `MKPI`, `MiniMap`, `MBars` | **mêmes composants** que desktop, variantes responsive (pas de composants « Mobile* ») |
| states · `EmptyDesktop` | `dashboard/DashboardEmpty` |
| states · `LoadingDesktop` | `dashboard/DashboardSkeleton` + `ui/Skeleton` |

### Layout
- **≥ 768px** : sidebar fixe 240px (`surface0`) + `<main>` padding 32/48/48.
- **< 768px** : top bar + drawer overlay (`aria-modal`, fermeture `Esc` + clic scrim, focus trap, retour du focus au bouton menu) + FAB 56px pour « Nouvelle plongée ».
- **≥ 1024px** : rangée « Dernière plongée / Plongées par mois » en 2 colonnes, sinon 1.
- KPI : 4 colonnes desktop, 2×2 mobile.
- Fond de page : `abyss` + 2 radial-gradients discrets (voir maquettes).

---

## 4. États du dashboard

```ts
type DashboardState =
  | { status: 'loading' }                    // → <DashboardSkeleton />
  | { status: 'empty'; user: User }          // → <DashboardEmpty />
  | { status: 'ready'; data: DashboardPayload };
```

- `useDashboard()` renvoie ce type. Dev : lit `src/features/dashboard/mocks/dashboard.ts`, avec `?state=loading|empty|ready` dans l'URL pour forcer un état (pratique pour comparer aux captures).
- L'état vide est **volontairement minimal** : un seul CTA « Enregistrer ma première plongée », KPI à « — », pas d'onboarding animé.
- Skeletons : `aria-busy="true"` sur le conteneur, shimmer coupé si `prefers-reduced-motion`.

---

## 5. Écarts et points ouverts (à connaître avant d'implémenter)

1. **Bug de maquette — histogramme desktop.** Dans `01-desktop-nominal.png`, les barres de « Plongées par mois » sont écrasées : les hauteurs en % n'ont pas de parent de hauteur définie. **Le comportement voulu est celui du mobile** (`04-mobile-nominal.png`) : barres proportionnelles, pic en `accent` avec sa valeur au-dessus, autres barres en `chartBar`.
2. **FAB mobile.** L'ancien handoff Vue disait « pas de FAB » ; la maquette et les Laws of UX en prévoient un (56px). **On suit la maquette : FAB présent.**
3. **Carte.** Placeholder dans les maquettes. Cible prod : **MapLibre GL** (`maplibre-gl`, sans clé API) avec tuiles sombres (CartoDB Dark Matter ou Stadia Alidade Smooth Dark), eau → `surface0`, terre → `surface1`, labels → `textLow` mono. Markers HTML : pastille + anneau `accentLine` + compteur mono ; site actif en `accent`. Popover = `card(2)`. En V1, un placeholder stylé fidèle à la maquette suffit.
4. **Tablette (768–1023).** Non maquetté. Sidebar 240px par défaut ; option : rail d'icônes 72px.
5. **Filtres de période de la carte** (1A / 1M / 3M / 1Y / Tout) : libellés incohérents dans la maquette (« 1A » et « 1Y »). À trancher (proposition : 1M / 3M / 1A / Tout).
6. **Graphiques.** Histogramme fait main (flex/SVG) en V1. Si une page Statistiques arrive : Visx ou ECharts, couleurs toujours via `tokens.ts`.
7. **Auth / API** : hors scope. `useDashboard()` garde la même signature quand on branche l'API.

---

## 6. Accessibilité (WCAG AA minimum)

- Contraste AA partout, AAA pour `textHigh` sur surface0/1.
- `:focus-visible` = outline 2px `accent` ; jamais `outline: none` sans remplacement.
- Cibles tactiles ≥ 44×44 (`@include hit-target`).
- Landmarks : `<aside>` + `<nav aria-label="Navigation principale">`, `<main>`, `<header>`, titres hiérarchisés (un seul `h1`).
- Lien actif : `aria-current="page"`.
- Boutons icône (recherche, notifications, menu) : `aria-label` explicite ; icônes décoratives en `aria-hidden`.
- Histogramme : alternative textuelle (`<table>` en `visually-hidden` ou `aria-label` résumant les valeurs).
- Valeurs + unités lisibles ensemble par un lecteur d'écran (« 42 mètres », pas « 42 » puis « m »).

## 7. Laws of UX appliquées

| Loi | Application |
|---|---|
| Fitts | Nav items 44px, CTA 40px + marge, FAB 56px |
| Hick | 4 entrées de navigation max ; menu utilisateur replié en bas de sidebar |
| Miller | 4 KPI max sur la rangée du haut |
| Proximité | KPI groupés · carte isolée · « dernière plongée + activité » appariées · binômes en pied |
| Esthétique-utilisabilité | Surfaces stratifiées, aucun ornement gratuit |
| Divulgation progressive | « Voir le détail → » mène au carnet ; le dashboard résume, il ne rejoue pas la plongée |
