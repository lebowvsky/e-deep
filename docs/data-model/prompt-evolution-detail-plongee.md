# Mission : faire évoluer le modèle de données pour les champs du détail de plongée

Utilise le skill `modeling-databases`.

## Contexte

La page « Détail d'une plongée » (`/dives/:diveId`, PR #14) n'affiche que ce que sert le contrat
`DiveDetail`. La maquette (`apps/web/design/mockups/dive-detail.jsx`, captures 20 et 21) et la spec
(`apps/web/design/pages/detail-plongee.md`) montrent bien plus de données. Elles sont inventoriées
dans **`docs/data-model/evolution-champs-detail-plongee.md`**, le point de départ de cette mission.
On veut maintenant les ajouter au modèle.

Le travail se fait **par phases**. À la fin de chacune, fais un compte rendu court (fichiers
modifiés, décisions prises, questions ouvertes) et **attends mon « OK »** avant de continuer.

## À lire d'abord (obligatoire)

1. `ARCHITECTURE.md` : source de vérité. Relis en particulier §7 (migrations), §9 (RGPD, données de
   santé), D22 (PWA offline-first), D25, D26 et la section « Issus du détail de plongée » de §11.
2. `docs/data-model/evolution-champs-detail-plongee.md` : l'inventaire et les 8 questions à trancher.
3. `docs/data-model/schema.md`, `decisions.md` et `backend-prompt.md` : le modèle actuel (D-01 à
   D-12, H-01 à H-16, RG-01 à RG-22).
4. `apps/web/design/pages/detail-plongee.md`, en particulier son tableau « Modèle » (événement
   partagé / participation), et `dive-detail.jsx` pour les valeurs d'exemple.
5. `packages/shared/src/dives.ts` (contrat `DiveDetail`) et `apps/api/src/modules/dives/`
   (mapper du contrat, service).

## Décisions déjà prises (ne pas les remettre en question)

- Le découpage **événement partagé / participation** (D-08) est conservé. Un champ va dans
  `dive_events` seulement s'il est commun à toute la palanquée et modifiable par le seul créateur.
- **Tous les nouveaux champs sont facultatifs** (`NULL`) : les plongées déjà saisies n'en ont
  pas. Aucune valeur par défaut qui affirmerait une information non saisie (même logique que D-11).
- **Pas de consommation en L/min** : les « bar consommés » restent calculés (début − fin), jamais
  stockés.
- **L'heure de sortie n'est pas stockée** : elle se calcule avec `started_at + duration_min`.
- Les conventions du modèle restent en place :
  - `text + CHECK` pour les listes fermées, sauf si tu justifies une table de référence ;
  - UUIDv7 générés par le client ;
  - LWW par enregistrement, tombstones, sites privés.
- **Hors périmètre :** courbe de profil et import de fichiers (V2), photos, visa, rôles dans la
  palanquée.

## Phase 0 : analyse (aucune écriture)

- Pour chaque donnée de l'inventaire, propose sa place (événement, participation, site, binôme,
  nouvelle entité), son type, sa contrainte et sa classification RGPD (`P`, `S`, `L` ou `—`).
- Réponds à chacune des 8 questions de la note avec une recommandation argumentée : listes fermées
  ou référentiels, équipement à plat ou réutilisable, paliers, successive, structure / club,
  espèces, RGPD, impact offline.
- Liste les données **déjà en base mais absentes du contrat** (niveau à la plongée, dates de
  création et de modification) : elles ne demandent qu'un changement de contrat.
- Signale tout conflit avec `ARCHITECTURE.md` ou une décision existante, et **arrête-toi** si tu en
  trouves un.
- **Stop.**

## Phase 1 : documents de modélisation

- Après validation, mets à jour `schema.md`, `decisions.md` et `backend-prompt.md` en gardant la
  numérotation :
  - nouvelles décisions à partir de **D-13** ;
  - les hypothèses levées sont marquées « résolue par D-xx » au lieu d'être supprimées.
- Mets à jour tout ce qui en découle :
  - dans les documents de modèle : dictionnaire, RG, MCD, MLD, `erDiagram`, contraintes, index,
    validation par écran, questions ouvertes, évolutions prévisibles ;
  - dans `backend-prompt.md` : modules, ordre d'implémentation, invariants, tests, définition de
    fini.
- Coche dans `evolution-champs-detail-plongee.md` les questions tranchées, avec un lien vers la
  décision.
- **Stop.**

## Phase 2 : contrat front

- Propose l'évolution de `DiveDetail` dans `packages/shared/src/dives.ts` : champs nullables,
  unités dans les noms (`airTemperatureC`, `startPressureBar`…), unions fermées pour les listes.
- Indique l'impact sur `DiveSummary` (ce qui doit rester hors de la liste, pour son poids : D25) et
  sur le guard `isDiveDetail` du front.
- **Aucun code applicatif dans cette mission** : le prompt backend de la phase 1 servira à une
  session suivante. Le rendu front des sections aujourd'hui masquées fera l'objet d'un autre prompt.
- **Stop.**

## Règles de travail

- Ne modifie rien dans `apps/web/design/`, ni aucun code applicatif, ni aucune migration.
- Aucune donnée personnelle ni de santé dans les exemples de logs (§9).
- En cas de doute sur la place d'un champ (événement ou participation), demande-moi.
- Commits conventionnels (`docs(data-model): …`), en anglais, à la fin de chaque phase. Ne pousse
  pas.
