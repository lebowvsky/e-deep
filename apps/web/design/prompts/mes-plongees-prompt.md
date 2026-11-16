# Mission : implémenter la page « Mes plongées »

Tu vas développer la page **« Mes plongées »** (`/dives`) à partir des maquettes. Le design system, le layout (sidebar, top bar, drawer, FAB) et les primitives `ui/` existent déjà depuis le tableau de bord : **réutilise-les, n'en recrée pas**. Le travail se fait **par phases** : à la fin de chacune, fais un compte rendu court (fichiers créés ou modifiés, écarts avec la maquette, questions) et **attends mon « OK »** avant de continuer.

## À lire d'abord (obligatoire)

1. `CLAUDE.md` et `design/README.md` (règles générales, tokens, accessibilité).
2. **`design/pages/mes-plongees.md`** : spec complète de la page. Elle fait foi.
3. Les captures `design/screenshots/10` à `14`. Ouvre chaque image avant de coder l'écran correspondant.
4. `design/mockups/dives-list.jsx` (lecture seule) pour les mesures exactes, textes et couleurs.
5. Le code existant : `src/components/**`, `src/types/domain.ts`, `src/mocks/`, `src/lib/format.ts`, les hooks et le routing.

Utilise le skill `/implement-screen` pour chaque bloc.

## Décisions déjà prises (ne pas les remettre en question)

- **Pas de visa / signature de moniteur** : aucune colonne, aucun filtre, aucun badge.
- **Palanquée, pas binôme.** Une plongée réunit une palanquée de 2 plongeurs ou plus. La colonne « Palanquée » montre tous ses membres, l'utilisateur en premier (avatar neutre), puis « +N » au-delà de 5 avatars sur desktop et de 4 sur mobile. Le mot « binôme » ne doit pas apparaître dans cette page. S'il reste ailleurs dans l'app (bloc « Binômes fréquents » du dashboard), **signale-le sans le modifier**.
- **Modèle de données** : une plongée est un événement partagé (site, date, palanquée) avec une participation par plongeur (profondeur, durée, gaz… propres à chacun). Adapte `src/types/domain.ts` dans ce sens si ce n'est pas déjà le cas : un type `DiveMember` (id, prénom, nom, initiales, couleur, `isSelf`) et une liste `team: DiveMember[]` sur la plongée, à la place de `buddies`. **Fais-moi valider le diff des types en phase 0** avant de toucher au reste. Si le dashboard utilise `buddies`, mets-le à jour sans changer son rendu.
- **Nom affiché : `APP_NAME`** (E-Deep), pas « DiveLog » comme sur les maquettes.
- **Données** : mocks uniquement. Génère 127 plongées réalistes et déterministes (seed fixe) cohérentes avec la maquette : les 10 premières reprennent exactement les lignes de la capture 10 (#127 → #118), les autres sont réparties de juin 2019 à décembre 2025 sur des sites de Méditerranée et de Bretagne, avec des palanquées de 2 à 6 plongeurs (14 plongeurs différents en tout) et des profondeurs ≤ 40 m sauf exception. Un hook `useDives(query)` filtre, trie et pagine **côté client**, avec une signature prête pour une future API paginée : `{ status, items, total, summary }`, où `summary` est calculé sur toute la sélection filtrée. `?state=loading|empty|error` force un état en dev.
- **Actions placeholder** : `Exporter` et `Importer` ouvrent un toast « Bientôt disponible », `Nouvelle plongée` mène à `/dives/new`, une ligne mène à `/dives/:id` (pages placeholder).
- **Dépendances** : aucune nouvelle sans me demander. Le slider à deux poignées, les popovers de filtre et le bottom sheet sont faits maison, accessibles.

## Phase 0 — Plan (aucun code)

- Liste les composants existants que tu réutilises, ceux que tu crées et leurs props principales. Vise par exemple : `DivesPage`, `DivesToolbar`, `SearchField`, `FilterButton` + `FilterPopover`, `ActiveFilters`, `SelectionSummary`, `DivesTable`, `DiveRow`, `MonthGroupHeader`, `DepthBar`, `Palanquee`, `Pagination`, `DiveCard`, `FiltersSheet`, `RangeSlider`, `SegmentedControl`, `DivesEmpty`, `DivesNoResults`, `DivesSkeleton`.
- Propose le diff de `src/types/domain.ts` (palanquée) et la forme de `DivesQuery` (synchronisée avec l'URL, cf. spec).
- Liste les valeurs des maquettes qui n'ont pas de token, avec ta proposition (nouveau token ou token le plus proche).
- **Stop.**

## Phase 1 — Données et logique

- Types, générateur de mocks, `useDives(query)`, synchronisation de la requête avec les query params (`useSearchParams`), helpers de formatage dans `src/lib/format.ts` (durée cumulée « 84 h 23 », mois « Avril 2026 », jour abrégé).
- Tests Vitest : filtres combinés, tri, pagination, calcul de la synthèse sur la sélection, groupement par mois, reset en page 1 quand un filtre change, « 0 résultat ».
- **Stop.**

## Phase 2 — Desktop, état nominal

Dans cet ordre, en comparant chaque bloc à `10-dives-desktop.png` :
1. En-tête de page (factorise avec `DashboardHeader` si c'est pertinent, sans changer le rendu du dashboard).
2. Barre d'outils : recherche avec raccourci `/`, boutons de filtre et leurs popovers, tri.
3. Bandeau de synthèse.
4. Tableau sémantique groupé par mois, `DepthBar`, `Palanquee` (infobulle + libellé pour lecteur d'écran), états de survol et de focus de ligne.
5. Pagination et taille de page.

Puis `node scripts/screenshot.mjs "/dives" 1440` et comparaison. Corrige (3 passes max) et liste les écarts restants. **Stop.**

## Phase 3 — Mobile et tablette

- Liste en cartes groupées par mois, puces de filtres qui défilent horizontalement, tri, FAB (`13-dives-mobile.png`).
- `FiltersSheet` (`14-dives-mobile-filters.png`) : `role="dialog"`, `aria-modal`, focus trap, `Esc`, scrim, scroll du body bloqué, bouton « Afficher {n} plongées » recalculé en direct. Les filtres ne s'appliquent qu'à la validation, et « Réinitialiser » ne réinitialise que le brouillon.
- Tablette (768–1023) : colonnes Temp. et Gaz masquées.
- Tests : ouverture et fermeture du sheet, compteur live, validation.
- Captures à 375, 768 et 1440. **Stop.**

## Phase 4 — États

- `empty` (`12-dives-empty.png`), `no-results` (`11-dives-no-results.png`) avec le bouton qui retire le filtre le plus restrictif en annonçant son nombre de résultats, `loading` (skeleton, même grille que le tableau), `error` (message + « Réessayer »).
- Tests : chaque état s'affiche selon `useDives`.
- Captures avec `?state=…`. **Stop.**

## Phase 5 — Contrôle qualité

- Audit accessibilité selon la spec : clavier de bout en bout, `aria-sort`, `aria-live` du nombre de résultats, libellés des puces, ordre de focus, un seul h1.
- Grep des valeurs en dur dans les nouveaux composants.
- `npm run typecheck`, `npm run lint`, `npm run test` et `npm run build` doivent tous passer.
- Compte rendu final : composants livrés, écarts volontaires, dette, points ouverts (export, import, détail d'une plongée, rôles dans la palanquée).

## Règles de travail

- Ne modifie rien dans `design/` ni dans les fichiers de tokens générés.
- Si la maquette et la spec se contredisent, **la spec gagne**. Si l'information manque, demande-moi.
- Commits petits à la fin de chaque phase (Conventional Commits, en anglais). Ne push pas.
