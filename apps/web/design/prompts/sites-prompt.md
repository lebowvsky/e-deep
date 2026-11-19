# Mission : implémenter les Sites (création express, page Carte, fiche site)

Tu vas développer la gestion des sites de plongée :
- la **création express** depuis le champ Site du formulaire de plongée ;
- la **page Carte** (`/map`, intitulée « Mes sites ») avec sa liste et le panneau d'ajout, de placement et de modification ;
- la **fiche site** (`/sites/:id`).

Le design system, le layout et les pages Dashboard, Mes plongées, Détail et Formulaire existent : **réutilise leurs composants** (Card, Button, Tag, KpiCard, Combobox, TextInput, SegmentedControl, FormField, ConfirmDialog, Toast, Avatar/Palanquee, `useDives`…). Le travail se fait **par phases** : à la fin de chacune, fais un compte rendu court (fichiers créés ou modifiés, écarts avec la maquette, questions) et **attends mon « OK »**.

## À lire d'abord (obligatoire)

1. `CLAUDE.md` et `design/README.md`.
2. **`design/pages/sites.md`** : spec des sites, elle fait foi.
3. `design/pages/formulaire-plongee.md` et `design/pages/detail-plongee.md` : versions **mises à jour** dans ce kit (lien vers la fiche site, création express depuis le formulaire).
4. Les captures `design/screenshots/40` à `46`.
5. `design/mockups/sites.jsx` (lecture seule). **La carte des maquettes est stylisée** : n'en reproduis ni la géographie ni le SVG, seulement l'habillage (repères, contrôles, puces, aperçu, panneau).
6. Le code existant : types, mocks (les sites existent déjà via les plongées), combobox Site du formulaire, mini-carte placeholder du dashboard et du détail.

Utilise le skill `/implement-screen` pour chaque bloc.

## Décisions déjà prises (ne pas les remettre en question)

- **Deux points d'entrée** : création express dans le formulaire (sans le quitter), gestion complète sur la page Carte. **Pas de nouvelle entrée de navigation.**
- **Sites privés.** Pas de géocodage externe en V1 : la région est suggérée depuis le site existant le plus proche.
- **Suppression** seulement si le site n'a aucune plongée ; sinon, proposer la fusion.
- **Liste et carte synchronisées.** La carte n'est jamais le seul moyen d'agir (accessibilité).
- **Lien vers la fiche** : depuis le détail d'une plongée, le nom du site mène à `/sites/:id`, et « Toutes mes plongées ici » reste `/dives?site=:id`. Depuis la fiche, « Nouvelle plongée ici » mène à `/dives/new?site=:id`.
- **`APP_NAME`** (E-Deep) à la place de « DiveLog ».

## Phase 0 — Plan (aucun code)

- **Bibliothèque de carte** : une vraie carte est nécessaire ici (poser un repère). Compare **MapLibre GL** (déjà recommandé dans `design/README.md`, rendu vectoriel, style sombre réglable aux tokens) et **Leaflet** (plus léger, tuiles raster), avec en plus le regroupement des repères. Propose aussi un **fournisseur de tuiles sombres** (clé API, quota, attribution obligatoire). **Demande-moi avant d'installer quoi que ce soit.**
- Prévois un composant `MapView` qui isole la bibliothèque (props : sites, selectedId, onSelect, mode `pick` avec `onPick(lat, lng)`, viewport). Il remplacera aussi les placeholders du dashboard et du détail **dans une phase ultérieure**, pas maintenant.
- Le type `Site` (cf. spec) et son impact sur les types et mocks existants. Montre-moi le diff.
- La liste des composants : `QuickCreateSitePanel`, `MapPage`, `MapView`, `ZoneChips`, `MapControls`, `SitePreviewPopover`, `SiteList`, `SiteListItem`, `SitePanel` (modes new / place / edit), `CoordinatesInput`, `SiteDetailPage`, `SiteMiniMap`, `SiteDivesList`, `MergeSiteDialog`, `DeleteSiteDialog`, `useSites`, `useSite`, `searchSites` (recherche tolérante).
- Liste les valeurs des maquettes sans token, avec ta proposition.
- **Stop.**

## Phase 1 — Données et logique

- Type `Site`, mocks (les 23 sites des maquettes, cohérents avec les plongées existantes, dont **1 site sans position** : « Revellata — Grotte aux Corbs »), `useSites` / `useSite` avec les statistiques calculées, `searchSites` (accents, articles, fautes légères, tri), suggestion de région par proximité (haversine < 15 km), déduction de la zone, `createSite`, `updateSite`, `mergeSites`, `deleteSite` (refus s'il y a des plongées).
- Tests Vitest : recherche tolérante (« revel », « la revellata », « revelata »), suggestion de région, fusion (plongées rattachées, champs complétés, source supprimée), refus de suppression, statistiques calculées.
- **Stop.**

## Phase 2 — Création express dans le formulaire

- `QuickCreateSitePanel` branché sur la combobox Site du formulaire (captures 40 et 41) : préremplissage, anti-doublon « Un site proche existe… », création, sélection, focus rendu au champ Date, Échap.
- `/dives/new?site=:id` préremplit le champ Site.
- Tests : création, anti-doublon, annulation, focus.
- **Stop.**

## Phase 3 — Page Carte desktop

- Bibliothèque validée en phase 0 installée, `MapView` stylé aux tokens (fond, côtes, libellés en `textLow`), repères maison (nombre de plongées, sélection en accent), regroupement, popover d'aperçu.
- En-tête, puces de zone, contrôles, échelle, liste (recherche, filtres, « À compléter », tri), synchronisation liste ↔ carte, état dans l'URL (`?site=`, `?zone=`).
- Panneau `SitePanel` en modes `new`, `place` et `edit` (capture 43) : clic pour poser le repère, glisser, `CoordinatesInput` synchronisé (collage de coordonnées), suggestion de région, confirmation avant de quitter.
- Captures à 1440 (états nominal et « placer ») et comparaison avec 42 et 43. **Stop.**

## Phase 4 — Fiche site + mobile

- Fiche site desktop (capture 45) : en-tête, actions, menu « … », KPI, mini-carte (ou encart « Position à préciser »), plongées ici, infos, accès. `MergeSiteDialog` et `DeleteSiteDialog`.
- Mise à jour du détail d'une plongée : nom du site cliquable vers la fiche, encart « Placer sur la carte » si le site n'a pas de position.
- Mobile : carte + bottom sheet à 3 crans (capture 44), ajout et édition en plein écran avec le repère fixe au centre, fiche mobile (capture 46).
- Tests : fusion, suppression refusée et acceptée, bottom sheet au clavier, repère au clavier.
- Captures à 375, 768 et 1440. **Stop.**

## Phase 5 — Contrôle qualité

- Audit accessibilité selon la spec (carte jamais seule, repères focusables, placement au clavier, dialogues, `aria-pressed` et `radiogroup`).
- Performance : la page Carte reste fluide avec 500 sites mockés (liste virtualisée, regroupement).
- Grep des valeurs en dur dans les nouveaux composants.
- `npm run typecheck`, `npm run lint`, `npm run test` et `npm run build` doivent tous passer.
- Compte rendu final : composants livrés, écarts, dette, points ouverts (remplacement des cartes placeholder du dashboard et du détail par `MapView`, géocodage V2).

## Règles de travail

- Ne modifie rien dans `design/` ni dans les tokens générés.
- Si la spec et la maquette se contredisent, la spec gagne. Si l'information manque, demande-moi.
- Commits petits à la fin de chaque phase (Conventional Commits, en anglais). Ne push pas.
