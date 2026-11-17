# Mission : implémenter le formulaire « Nouvelle plongée » / « Modifier la plongée »

Tu vas développer le formulaire de saisie manuelle d'une plongée, accessible depuis trois routes : `/dives/new`, `/dives/new?from=:id` (dupliquer) et `/dives/:id/edit` (modifier). Ces routes existent peut-être déjà comme pages vides depuis le chantier « Détail ». Le design system, le layout, « Mes plongées » et « Détail d'une plongée » sont en place : **réutilise leurs composants et leurs types** (KpiCard, Avatar, Palanquee, Tag, Card, Button, mocks, `useDives`, `useDive`). Le travail se fait **par phases** : à la fin de chacune, fais un compte rendu court (fichiers créés ou modifiés, écarts avec la maquette, questions) et **attends mon « OK »**.

## À lire d'abord (obligatoire)

1. `CLAUDE.md` et `design/README.md`.
2. **`design/pages/formulaire-plongee.md`** : spec du formulaire, elle fait foi (champs, règles, modes, validation, brouillon, accessibilité).
3. `design/pages/detail-plongee.md` : chaque champ du détail doit être saisissable, et le tableau événement partagé / participation s'applique.
4. Les captures `design/screenshots/30`, `31` et `32`.
5. `design/mockups/dive-form.jsx` (lecture seule) pour les mesures, les textes et les états des champs.
6. Le code existant : types (`src/types/domain.ts`), mocks, hooks, composants `ui/`, routing.

Utilise le skill `/implement-screen` pour chaque bloc.

## Décisions déjà prises (ne pas les remettre en question)

- **V1 = saisie manuelle uniquement**, sans aucun import.
- **Une seule page**, sans assistant par étapes. Seule « L'essentiel » est obligatoire.
- **Bouton Enregistrer toujours actif** ; validation au blur, puis en direct, puis complète à l'enregistrement avec un résumé d'erreurs.
- **Avertissements non bloquants** : profondeur au-delà de la limite du niveau, n° de plongée en double.
- **Durée ↔ heures liées** dans les deux sens.
- **Dupliquer** ne reprend jamais les heures, la profondeur, la durée, les paliers ni les notes.
- **Palanquée**, jamais « binôme ». Pas de visa. **`APP_NAME`** (E-Deep) partout.
- **Enregistrement** : dans les mocks en mémoire, via une fonction `saveDive(input)` dont la signature est prête pour l'API (promesse, erreurs de validation par champ). Puis redirection vers le détail avec un toast.
- **Champs numériques** : `inputMode` adapté, jamais `type="number"` (molette et flèches piégeuses) ; normalisation de la virgule décimale française.
- **Date et heures** : champs natifs (`type="date"` et `type="time"`) habillés aux tokens.

## Phase 0 — Plan (aucun code)

- **Gestion du formulaire** : propose une approche et **demande-moi** avant toute dépendance. Par exemple `react-hook-form` + `zod` (schéma partagé avec le futur back) ou un état maison avec un `useReducer`. Pèse la taille, les tests et l'accessibilité des erreurs.
- **Stockage du brouillon** : IndexedDB (Dexie si déjà présent) ou `localStorage`, à me faire valider.
- Arborescence des composants, par exemple :
  - primitives : `FormField`, `TextInput` (suffixe d'unité, icône, états), `TimeInput`, `DateInput`, `NumberInput`, `SegmentedControl`, `Switch`, `Combobox`, `TagInput`, `Textarea` ;
  - structure : `FormSection` (fieldset + accordéon mobile), `ErrorSummary`, `FormAside` (aperçu, sommaire, actions), `PrefillBanner`, `DraftBanner`, `UnsavedChangesDialog` ;
  - pages et sections : `DiveFormPage`, `EssentialSection`, `RunSection`, `PalanqueeSection`, `EquipmentSection`, `ConditionsSection`, `NotesSection`.
- Le **type `DiveFormValues`** et sa correspondance avec le modèle événement / participation, avec les valeurs par défaut de chaque mode (nouvelle, dupliquer, modifier).
- Liste les valeurs des maquettes sans token, avec ta proposition.
- **Stop.**

## Phase 1 — Primitives de formulaire

- Les primitives listées en phase 0, avec tous leurs états : défaut, focus, rempli, désactivé ou verrouillé, avertissement, erreur.
- Les ajouter à la page `/_dev/ui`.
- Tests : `Combobox` (clavier, création à la volée), `TagInput`, `SegmentedControl` (flèches), `Switch`.
- Comparaison avec la capture 32 et avec les champs de la capture 30. **Stop.**

## Phase 2 — Logique

- Schéma de validation (règles de la spec, avertissements séparés des erreurs), liaison durée ↔ heures (passage de minuit autorisé si Moment = Nuit), valeurs dérivées (bar consommés, qualificatif de visibilité), préremplissage par mode, `saveDive`, brouillon (debounce, restauration, effacement).
- Tests Vitest : chaque règle de validation, la liaison durée ↔ heures dans les deux sens, les modes, la restauration du brouillon.
- **Stop.**

## Phase 3 — Desktop

Dans l'ordre, en comparant à `30-dive-form-desktop.png` :
1. En-tête, bandeau de préremplissage (et sa variante « suggestion » en mode nouvelle).
2. Les 6 sections, une par une.
3. La colonne collante : aperçu en direct, sommaire avec états et scroll-spy, actions, mention du brouillon.
4. Les boutons du bas, le `Ctrl/⌘ + Entrée`.

Puis `node scripts/screenshot.mjs "/dives/new?from=<id-127>" 1440` et comparaison (3 passes max). **Stop.**

## Phase 4 — Mobile, erreurs et sortie

- Mobile (`31-dive-form-mobile-errors.png`) : top bar ✕, accordéon des sections 2 à 6 avec résumé et état, barre collante.
- Parcours d'erreur complet : résumé `role="alert"`, liens vers les champs, défilement et focus sur le premier champ en erreur, ouverture automatique d'une section repliée qui contient une erreur.
- Bouton en chargement, toast de succès, redirection.
- Confirmation avant de quitter sans enregistrer.
- Tablette (768–1023) : une colonne, colonne de droite remplacée par la barre collante du mobile.
- Mode **Modifier** (`/dives/:id/edit`) avec le drapeau `canEditEvent` (vrai en V1, mais le rendu verrouillé doit exister et être testé).
- Tests : soumission avec erreurs, focus, accordéon, confirmation de sortie, mode Modifier.
- Captures à 375, 768 et 1440. **Stop.**

## Phase 5 — Contrôle qualité

- Audit accessibilité selon la spec : fieldset/legend, `aria-invalid` et `aria-describedby`, combobox ARIA 1.2, parcours clavier complet, ordre de tabulation, lecteur d'écran sur le résumé d'erreurs.
- Vérifie que **chaque champ du détail** a son équivalent dans le formulaire et que **chaque champ saisi** s'affiche sur le détail après enregistrement (test d'aller-retour).
- Grep des valeurs en dur dans les nouveaux composants.
- `npm run typecheck`, `npm run lint`, `npm run test` et `npm run build` doivent tous passer.
- Compte rendu final : composants livrés, écarts volontaires, dette, points ouverts (qualificatif de visibilité à confirmer, `canEditEvent` pour l'usage club, import V2).

## Règles de travail

- Ne modifie rien dans `design/` ni dans les tokens générés.
- Si la spec et la maquette se contredisent, la spec gagne. Si l'information manque, demande-moi.
- Commits petits à la fin de chaque phase (Conventional Commits, en anglais). Ne push pas.
