# Évolution du modèle : champs de la page « Détail d'une plongée »

> **Statut : instruit le 2026-11-16** (décisions D-13 à D-22 de `decisions.md`, schéma dans
> `schema.md`, mission « Mission 2 » de `backend-prompt.md`). Note de cadrage rédigée le 2026-11-16
> pendant le front de `/dives/:diveId` ; l'inventaire ci-dessous est conservé tel quel, les réponses
> sont cochées plus bas.

## Contexte

La spec `apps/web/design/pages/detail-plongee.md` et la maquette `apps/web/design/mockups/dive-detail.jsx`
affichent des données que le contrat `DiveDetail` (`packages/shared/src/dives.ts`) ne fournit pas.
Le front V1 de la page **n'affiche que ce que l'API sert** (aucun champ inventé). Les sections
concernées ne sont donc pas rendues, ou n'affichent qu'une partie de leur contenu (dette notée dans
`ARCHITECTURE.md`, « Issus du détail de plongée »).

Le porteur du projet veut **ajouter ces données** au modèle. Cette note sert de point de départ.

Rappel du découpage (D-08, `docs/data-model/decisions.md`) : **événement partagé** (`dive_events`,
modifiable par le seul créateur) / **participation** (`dive_participations`, propre à chaque plongeur).
La spec de la page propose déjà une répartition, reprise ci-dessous.

## Inventaire

### Événement partagé (`dive_events`)

| Donnée (maquette)         | Section UI                      | Exemple maquette      | Piste de type                                                                 |
| ------------------------- | ------------------------------- | --------------------- | ----------------------------------------------------------------------------- |
| Type de mise à l'eau      | En-tête (étiquette), Conditions | « Bateau » / « Bord » | `text + CHECK` (`BOAT`, `SHORE`)                                              |
| Moment                    | Conditions                      | « jour » / « nuit »   | `text + CHECK` (`DAY`, `NIGHT`), ou dérivé de l'heure ? (à trancher)          |
| Structure / club          | Conditions                      | « Calvi Plongée »     | texte libre, ou entité `dive_centers` réutilisable (séjours, futur mode club) |
| Météo                     | Conditions                      | « Ensoleillé »        | liste fermée (`text + CHECK`)                                                 |
| Température de l'air (°C) | Conditions                      | « Air 19 °C »         | décimal, nullable                                                             |
| État de la mer            | Conditions                      | « Calme »             | liste fermée                                                                  |
| Courant                   | Conditions                      | « Faible »            | liste fermée                                                                  |

### Participation (`dive_participations`)

| Donnée (maquette)                       | Section UI                                       | Exemple maquette            | Piste de type                                                                 |
| --------------------------------------- | ------------------------------------------------ | --------------------------- | ----------------------------------------------------------------------------- |
| Température de surface (°C)             | KPI « Temp. fond » (légende), Conditions « Eau » | « Surface 16 °C »           | décimal, nullable (l'actuel `water_temperature_c` = fond)                     |
| Palier de sécurité (durée, profondeur)  | Déroulé                                          | « 3 min à 5 m »             | 2 colonnes nullables, ou `stops` en JSONB si plusieurs paliers                |
| Paliers de déco. (détail)               | Déroulé                                          | —                           | aujourd'hui booléen `has_decompression` ; détail des paliers ?                |
| Successive                              | Déroulé                                          | « Non »                     | booléen, ou dérivé (intervalle de surface avec la plongée précédente) ?       |
| Segment « palier » de la barre de temps | Déroulé                                          | barre verte en fin de durée | dérivé de la durée du palier ci-dessus                                        |
| % O₂ pour `OTHER`                       | Équipement & gaz                                 | « 21 % O₂ »                 | `o2_percent` nullable ? (aujourd'hui déduit de `gas_mix` sauf `OTHER`)        |
| Bloc : volume, matière                  | Équipement & gaz                                 | « 12 L · acier »            | décimal + liste fermée ; ou entité « équipement » réutilisable                |
| Pression début / fin (bar)              | Équipement & gaz                                 | « 200 → 60 bar »            | 2 entiers nullables, `CHECK (end <= start)` ; « bar consommés » reste calculé |
| Combinaison : épaisseur, type           | Équipement & gaz                                 | « 7 mm · semi-étanche »     | décimal + liste fermée                                                        |
| Lest (kg)                               | Équipement & gaz                                 | vide dans la maquette       | décimal nullable                                                              |
| Espèces observées                       | Notes & observations (étiquettes)                | étiquettes                  | table `observations` (participation ↔ espèce), référentiel d'espèces ?        |
| Heure de sortie                         | KPI Durée, Déroulé                               | « Sortie à 14:58 »          | **déjà calculable** (`started_at` + `duration_min`) : rien à stocker          |

### Site, palanquée, métadonnées

| Donnée (maquette)                        | Section UI       | Situation actuelle                                                                       | Piste                                                                   |
| ---------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Mer / zone (« Méditerranée »)            | En-tête (région) | absent ; rejoint la question ouverte n° 8 (« zone », `decisions.md`)                     | colonne `area` sur `dive_sites` ou dérivation géographique              |
| Niveau du plongeur **à cette plongée**   | Palanquée (toi)  | **déjà en base** (`dive_participations.certification_level_id`, D-09), absent du contrat | l'exposer dans `DiveDetail` : changement de contrat seulement           |
| Niveau des autres membres                | Palanquée        | `buddies` n'a pas de niveau                                                              | colonne sur `buddies`, ou niveau du compte lié (`linked_diver_id`)      |
| Dates de création / modification         | Colonne latérale | **déjà en base** (`created_at`, `updated_at` de la participation), absentes du contrat   | les exposer : changement de contrat seulement                           |
| Lien « Toutes mes plongées ici »         | Site             | données OK ; manque un filtre `site` dans la query de `/dives`                           | front uniquement (pas de modèle)                                        |
| Actions Modifier / Dupliquer / Supprimer | En-tête          | pas de formulaire d'édition ni d'endpoint d'écriture                                     | `PATCH`/`DELETE /api/dives/:id` + sync offline (D-12) : chantier à part |

## Questions à trancher en session de modélisation

- [x] **1. Listes fermées** (`text + CHECK`, convention actuelle) ou tables de référence (météo, mer, courant,
      matière du bloc, type de combinaison) ? Quid de la traduction et de l'évolutivité ?
      → `text + CHECK`, codes neutres, libellés côté front : [D-14](decisions.md#d-14--listes-fermées-en-text--check-pas-de-tables-de-référence).
- [x] **2. Équipement** : colonnes plates sur la participation (simple, une plongée = un équipement) ou entité
      réutilisable (« mon bloc 12 L acier ») pour préremplir la duplication ?
      → colonnes plates, `o2_percent` réservé à `OTHER` : [D-15](decisions.md#d-15--équipement-et-gaz-à-plat-sur-la-participation).
- [x] **3. Paliers** : un palier de sécurité (2 colonnes) ou une liste de paliers (JSONB / table) pour les
      plongées à décompression ?
      → palier de sécurité sur 2 colonnes, détail de la déco reporté : [D-16](decisions.md#d-16--palier-de-sécurité-sur-deux-colonnes-détail-de-la-déco-reporté).
- [x] **4. Successive** : saisie ou dérivée (intervalle de surface) ? Le calcul dépend de l'ordre du carnet.
      → saisie, proposée par le client : [D-17](decisions.md#d-17--plongée-successive-saisie-proposée-par-le-client).
- [x] **5. Structure / club** : texte libre ou entité partagée (prépare le futur mode club de D-08) ?
      → texte libre sur l'événement : [D-18](decisions.md#d-18--structure-en-texte-libre-sur-lévénement).
- [x] **6. Espèces** : référentiel (lequel ? DORIS, WoRMS…) ou étiquettes libres ?
      → étiquettes libres avec effectif, table `dive_observations` : [D-19](decisions.md#d-19--observations-despèces--étiquettes-libres-dans-dive_observations).
- [x] **7. RGPD** (`ARCHITECTURE.md` §9) : classer chaque nouvelle colonne (S / L / P). Pressions, paliers et
      successive sont des données de santé.
      → colonne PII du dictionnaire (`schema.md` §1) et [D-07](decisions.md#d-07--suppression-et-rgpd).
- [x] **8. Offline-first** : chaque colonne ajoutée entre dans le protocole de synchronisation (D-12) et dans le
      schéma IndexedDB de la PWA (D22 d'`ARCHITECTURE.md`). Mieux vaut les ajouter **en une fois**.
      → une seule migration, tous les champs requis au push : [D-22](decisions.md#d-22--une-seule-migration-tous-les-champs-obligatoires-au-push).

Tranchés en plus de ces questions : zone du site ([D-20](decisions.md#d-20--zone-maritime-sur-le-site--dive_sitesarea)),
niveau des autres membres sur le contact ([D-21](decisions.md#d-21--niveau-dun-binôme-sur-le-contact)),
type et conditions sur l'événement ([D-13](decisions.md#d-13--type-de-plongée-et-conditions-sur-lévénement)).

## Livrables attendus de la prochaine session

> Les documents de modèle sont faits (2026-11-16). Le contrat `DiveDetail` sera proposé dans
> `backend-prompt.md` (Mission 2, phase 2) et écrit par la session backend.

- Mise à jour de `schema.md`, `decisions.md` et `backend-prompt.md` (numérotation D-xx continue).
- Évolution du contrat `DiveDetail` dans `packages/shared` (champs nullables : les plongées déjà
  saisies n'ont pas ces données).
- Ensuite seulement : migration TypeORM, endpoint, puis rendu front des sections aujourd'hui masquées.
