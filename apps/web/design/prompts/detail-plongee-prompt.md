# Mission : implémenter la page « Détail d'une plongée »

Tu vas développer la page **« Détail d'une plongée »** (`/dives/:id`) à partir des maquettes. Le design system, le layout, les primitives `ui/`, le dashboard et la page « Mes plongées » existent déjà : **réutilise leurs composants** (KpiCard, Palanquee, Avatar, Tag/Badge, Card, Button, mini-carte placeholder…) au lieu d'en recréer. Le travail se fait **par phases** : à la fin de chacune, fais un compte rendu court (fichiers créés ou modifiés, écarts avec la maquette, questions) et **attends mon « OK »**.

## À lire d'abord (obligatoire)

1. `CLAUDE.md` et `design/README.md`.
2. **`design/pages/detail-plongee.md`** : spec de la page, elle fait foi.
3. `design/pages/mes-plongees.md` pour le contexte (palanquée, query de la liste).
4. Les captures `design/screenshots/20` et `21`. **La 22 est une référence V2, à ne pas implémenter.**
5. `design/mockups/dive-detail.jsx` (lecture seule) pour les mesures exactes et les textes.
6. Le code existant : composants, `src/types/domain.ts`, mocks, `useDives`, `src/lib/format.ts`, le routing.

Utilise le skill `/implement-screen` pour chaque bloc.

## Décisions déjà prises (ne pas les remettre en question)

- **V1 = saisie manuelle uniquement.** Pas de courbe de profil, pas d'import (ni fichier, ni ordinateur). La carte s'appelle « Déroulé de la plongée ».
- **Pas de consommation en L/min**, seulement « bar consommés » (début − fin).
- **Pas de visa.** **Palanquée**, jamais « binôme ».
- **Nom affiché : `APP_NAME`** (E-Deep).
- **Données** : les mocks existants de « Mes plongées », enrichis des champs de détail. La plongée #127 doit reproduire **exactement** la capture 20 : les valeurs sont dans `dive-detail.jsx`, et le lest est volontairement vide pour montrer l'état partiel. Les autres plongées ont des champs facultatifs vides de façon aléatoire mais reproductible (seed fixe). Un hook `useDive(id)` renvoie `{ status: 'loading' | 'ready' | 'not-found' | 'error', dive, prev, next }`, où précédente et suivante suivent l'ordre chronologique du carnet entier. En dev, `?state=` force un état.
- **Le lien « Toutes mes plongées ici »** mène à `/dives?site=<id>` : ajoute le paramètre `site` à la query de « Mes plongées » s'il n'existe pas, avec une puce de filtre « Site : … » supprimable.
- **Placeholders** : `/dives/:id/edit` et `/dives/new?from=:id` sont des pages vides avec un titre. « Exporter » ouvre un toast « Bientôt disponible ». « Supprimer » ouvre la vraie boîte de confirmation (texte dans la spec) ; la suppression agit sur les mocks en mémoire, puis renvoie à la liste avec un toast.
- **Dépendances** : aucune nouvelle sans me demander (menu, dialogue et toast faits maison et accessibles, sauf s'ils existent déjà).

## Phase 0 — Plan (aucun code)

- Composants réutilisés et composants à créer, avec leurs props principales. Vise par exemple : `DiveDetailPage`, `DiveNavBar` (fil d'Ariane + précédente/suivante), `DiveHeader`, `DiveActionsMenu`, `DiveRunCard`, `KeyValueList` (avec la gestion « — · Compléter »), `EquipmentCard`, `ConditionsCard`, `NotesCard`, `SiteCard`, `PalanqueeCard`, `ConfirmDialog`, `DiveDetailSkeleton`, `DiveNotFound`.
- **Proposition de types** : découpe événement partagé / participation selon le tableau « Modèle » de la spec (le n° de plongée est personnel). Montre-moi le diff de `src/types/domain.ts` et l'impact sur « Mes plongées » et le dashboard. **Attends ma validation.**
- Liste les valeurs des maquettes sans token, avec ta proposition.
- **Stop.**

## Phase 1 — Données et logique

- Types validés, enrichissement des mocks, `useDive(id)`, calculs dérivés dans `src/lib/` : heure de sortie, bar consommés, record personnel, plongées ensemble, plongées et profondeur max sur le site.
- Paramètre `site` dans la query de la liste.
- Tests Vitest : précédente/suivante en début et en fin de carnet, calculs dérivés, champs vides, `not-found`.
- **Stop.**

## Phase 2 — Desktop

Dans l'ordre, en comparant à `20-dive-detail-desktop.png` :
1. Barre de navigation : retour qui conserve la query de la liste, précédente / suivante, raccourcis `←` / `→` / `e`.
2. En-tête, étiquettes, bouton Modifier, menu « … » (clavier complet).
3. Rangée de KPI.
4. Déroulé de la plongée.
5. Équipement & gaz et Conditions (`<dl>`, état « — · Compléter »).
6. Notes & observations.
7. Colonne latérale : Site, Palanquée, mention de partage et dates.

Puis `node scripts/screenshot.mjs "/dives/<id-127>" 1440` et comparaison (3 passes max). **Stop.**

## Phase 3 — Mobile et tablette

- Top bar spécifique (retour, modifier, « … »), sans FAB ; ordre des cartes de la spec ; tuiles précédente / suivante (`21-dive-detail-mobile.png`).
- Tablette (768–1023) : colonne unique.
- Captures à 375, 768 et 1440. **Stop.**

## Phase 4 — Actions et états

- Dupliquer, Exporter (toast), Supprimer (dialogue : focus trap, `Esc`, focus initial sur « Annuler », bouton danger), puis retour à la liste avec un toast.
- États `loading`, `not-found` et `error` ; une plongée aux champs presque tous vides doit rester propre.
- Tests : dialogue de suppression, navigation clavier, chaque état.
- **Stop.**

## Phase 5 — Contrôle qualité

- Audit accessibilité selon la spec (h1 unique, sections titrées, `<dl>`, libellés précédente/suivante, menu, raccourcis).
- Grep des valeurs en dur dans les nouveaux composants.
- `npm run typecheck`, `npm run lint`, `npm run test` et `npm run build` doivent tous passer.
- Compte rendu final : composants livrés, écarts volontaires, dette, points ouverts (formulaire d'édition, profil V2, photos).

## Règles de travail

- Ne modifie rien dans `design/` ni dans les tokens générés.
- Si la spec et la maquette se contredisent, la spec gagne. Si l'information manque, demande-moi.
- Commits petits à la fin de chaque phase (Conventional Commits, en anglais). Ne push pas.
