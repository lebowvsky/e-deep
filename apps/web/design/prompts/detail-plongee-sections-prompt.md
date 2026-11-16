# Mission : rendre les sections masquées du détail de plongée

Le travail porte sur la page **« Détail d'une plongée »** (`/dives/:diveId`, `apps/web`). La page
existe déjà : elle n'affiche que les anciens champs du contrat. L'API sert désormais tous les
champs du détail (migration `AddDiveDetailFields`, contrat `DiveDetail` dans
`packages/shared/src/dives.ts`). Ta mission : les **valider**, les **convertir** et les
**afficher**, carte par carte, au plus près des captures 20 et 21.

Le travail se fait **par phases**. À la fin de chacune, fais un compte rendu court (fichiers créés
ou modifiés, écarts avec la maquette, questions) et **attends mon « OK »** avant de continuer.

## À lire d'abord (obligatoire)

1. `CLAUDE.md` (racine) et `apps/web/CLAUDE.md` : design system, conventions, vérification
   visuelle.
2. `ARCHITECTURE.md` : §6 (contrats, guards), §9 (RGPD) et §11, section « Issus du détail de
   plongée » (ce qui reste à faire, et les écarts déjà acceptés).
3. `apps/web/design/pages/detail-plongee.md` : la spec de la page fait foi pour le rendu.
4. Les captures `apps/web/design/screenshots/20-dive-detail-desktop.png` et `21-dive-detail-mobile.png`,
   et `apps/web/design/mockups/dive-detail.jsx` (lecture seule) pour les textes et les mesures
   exactes. **La capture 22 (courbe de profil) est une cible V2 : ne l'implémente pas.**
5. Le contrat `DiveDetail` (`packages/shared/src/dives.ts`) et, pour le sens des champs,
   `docs/data-model/decisions.md` (D-13 à D-22) et `schema.md` (dictionnaire, RG-23 à RG-30).
6. Le code existant de la page :
   - `features/dives/api/divesApi.ts` : guards, `toDiveDetailView` ;
   - `features/dives/types.ts` (`DiveDetailView`) ;
   - `features/dives/hooks/useDive.ts` ;
   - `features/dives/lib/` (`labels.ts`, `diveTime.ts`, `diveInsights.ts`) ;
   - `features/dives/components/detail/*` : `DiveDetailReady`, `DiveDetailHeader`, `DiveKpis`,
     `DiveRunCard`, `DiveNotesCard`, `DiveSiteCard`, `DiveTeamCard`, `DetailSection`,
     `FactList`, `DiveDetailSkeleton` ;
   - `shared/lib/guards.ts` et `shared/lib/format.ts`.

Utilise le skill `implement-screen` pour chaque carte.

## Décisions déjà prises (ne pas les remettre en question)

**Contrat et données**

- **Aucune modification de l'API, du contrat partagé ni du modèle.** Si un champ manque, signale-le.
- **N'affiche que ce que l'API sert** : aucun mock dans le code de production, aucune valeur
  inventée. Un champ `null` s'affiche « — » en `textMuted`, avec « Non renseigné(e) », comme les
  KPI actuels.
- **Pas de lien « Compléter »**, puisqu'il n'y a ni formulaire d'édition ni endpoint d'écriture.
  Une carte ne disparaît jamais. Une carte entièrement vide garde son titre et affiche
  « Rien de renseigné », sans lien.

**Guards et types**

- **Guard strict** : `isDiveDetail` vérifie chaque nouveau champ. Il faut :
  - un ensemble de littéraux par union, comme `GAS_MIXES`, avec `satisfies readonly X[]` ;
  - les guards `isCertificationLevelRef` et `isDiveObservation` ;
  - un guard de binôme du détail qui vérifie `level` (celui de la liste ne le connaît pas).

  Une valeur inconnue rend la réponse hors contrat (`invalid-response`). C'est voulu : D-14 impose
  de déployer le front d'abord à chaque ajout de valeur.
- **Le modèle de vue est enrichi**, pas remplacé. `DiveDetailView` reçoit les nouveaux champs,
  groupés si cela simplifie les cartes (par exemple `conditions`, `equipment`). `LoggedDive` et la
  liste ne changent pas (D25). Le niveau d'un membre de palanquée passe par `DiveMember`
  (`shared/model/dive.ts`) seulement si le dashboard n'en souffre pas. Sinon, utilise une
  structure propre au détail : c'est à proposer en phase 0.

**Calculs côté front** (jamais servis par l'API)

- heure de sortie : existe déjà ;
- bar consommés = pression de début − pression de fin, seulement si les deux sont saisies ;
- % O₂ : 21, 32 ou 36 selon le mélange, et `o2Percent` pour `OTHER`. S'il vaut `null`, pas de
  sous-ligne ;
- segment « palier » de la barre de temps = durée du palier / durée de la plongée, sans segment si
  le palier n'est pas saisi ;
- **pas de consommation en L/min.**

**Répartition des données par carte** (spec et maquette)

- **En-tête** :
  - la zone complète le lieu : « Calvi · Corse · Méditerranée » ;
  - une étiquette « Bateau » ou « Bord » s'ajoute après le gaz.

  Avec l'aperçu tiré du carnet (état `loading`), ces deux champs sont inconnus : rien n'est
  affiché, rien n'est deviné (même logique que `stopsOk`).
- **KPI** : « Temp. fond » prend la légende « Surface xx °C » quand la température de surface est
  saisie.
- **Déroulé** : les trois valeurs de la spec sont le palier de sécurité (« 3 min à 5 m »), les
  paliers de déco. (« Aucun » / « Oui ») et la successive (« Oui » / « Non »), plus le segment
  « palier » en `success` en fin de barre.
  - **Le gaz quitte le Déroulé** pour la carte Équipement & gaz.
  - L'étiquette « Palier OK » de l'en-tête porte toujours `stopsOk`.
- **Équipement & gaz** (`FactList` en lignes) :
  - Gaz, avec la sous-ligne « 21 % O₂ » ;
  - Bloc (« 12 L · acier ») ;
  - Pression (« 200 → 60 bar », sous-ligne « 140 bar consommés ») ;
  - Combinaison (« 7 mm · semi-étanche ») ;
  - Lest.
- **Conditions** :
  - Type (« Bateau · jour ») ;
  - Météo, avec la sous-ligne « Air 19 °C » ;
  - Mer ;
  - Courant ;
  - Eau (« 16 → 14 °C », sous-ligne « surface → fond ») ;
  - Structure.

  Une valeur partielle s'affiche avec ce qui existe : seulement la surface, seulement le fond,
  seulement « Bateau »… Fais-en une proposition en phase 0.
- **Notes & observations** :
  - le texte libre, puis les étiquettes d'espèces dans l'ordre reçu (« Mérou brun · 2 ») ;
  - la carte est vide seulement si les notes **et** les espèces le sont.
- **Palanquée** (`PalanqueeCard` de la maquette) : chaque membre a une étiquette de niveau à
  droite (`Tag`, « N2 »). Sous le nom :
  - pour le plongeur : « N2 · FFESSM », son niveau à la plongée (`diverLevel`, via
    `formatDiverLevel`) ;
  - pour un binôme : « N plongées ensemble », comme aujourd'hui.

  Le niveau d'un binôme est son niveau déclaré (`level`). S'il vaut `null`, il n'y a pas
  d'étiquette.
- **Mention des dates** sous la colonne latérale : « Créée le 08 avr. 2026 · modifiée le 09 avr. ».
  - Ce sont des instants techniques : affiche-les dans le fuseau de l'appareil (pas dans
    `utcOffsetMinutes`, qui est l'heure de la plongée).
  - « modifiée le … » n'apparaît que si le jour diffère de la création.
  - Le texte de la mention de partage ne change pas (spec).

**Libellés**

- Tous les libellés (unions → français, accords « Non renseigné / Non renseignée ») vivent dans
  `features/dives/lib/labels.ts`. Les formats (températures, pressions, dates) vivent dans
  `shared/lib/format.ts` ou `features/dives/lib/`. Aucun formatage dans le JSX.
- Valeurs des unions, avec leurs libellés provisoires (hypothèse H-18 du modèle) :
  - type de mise à l'eau : `BOAT` Bateau, `SHORE` Bord ;
  - moment : `DAY` jour, `NIGHT` nuit ;
  - météo : `SUNNY` Ensoleillé, `CLOUDY` Nuageux, `OVERCAST` Couvert, `RAIN` Pluie ;
  - mer : `CALM` Calme, `SLIGHT` Peu agitée, `MODERATE` Agitée, `ROUGH` Forte ;
  - courant : `NONE` Nul, `WEAK` Faible, `MODERATE` Moyen, `STRONG` Fort ;
  - matière du bloc : `STEEL` acier, `ALUMINIUM` alu ;
  - combinaison : `WET` humide, `SEMI_DRY` semi-étanche, `DRY` étanche.

**Hors périmètre**

- les actions Modifier, Dupliquer, Exporter et Supprimer ;
- le lien « Toutes mes plongées ici » ;
- les raccourcis clavier ;
- la barre du haut dédiée sur mobile ;
- la courbe de profil, MapLibre, et le détail des paliers de déco (non modélisé).

**Contraintes du projet**

- **Aucune nouvelle dépendance.**
- SCSS modules, tokens uniquement : édite `src/design/tokens.ts` puis
  `pnpm --filter web run tokens` si une valeur manque.
- Pas de `any`, `import type` pour `@e-deep/shared`.
- Aucune donnée de santé dans les logs ni dans la console.

## Phase 0 : plan (aucun code)

Pour chaque élément ci-dessous, donne une proposition :

- **Composants** : les composants réutilisés, modifiés et créés, avec leurs props principales.
  Pistes : `DiveEquipmentCard`, `DiveConditionsCard`, `ObservationTags`, la mention des dates.
  Dis aussi comment `FactList` gère la valeur manquante et la sous-ligne.
- **Types** : le diff proposé de `DiveDetailView`, et éventuellement de `DiveMember`, avec son
  impact sur le dashboard et la liste.
- **Guards** : la liste des guards et des ensembles de littéraux.
- **Rendu des valeurs partielles** : un tableau pour chaque ligne composée (Type, Météo + air,
  Eau, Bloc, Pression, Combinaison, palier).
- **Qualificatif de visibilité** (« Bonne ») : aucun barème n'existe. Propose-en un ou recommande
  de ne rien afficher. **Ne l'implémente pas sans ma validation.**
- **Valeurs de maquette sans token** : liste-les, avec ta proposition.
- **Écarts prévisibles** avec les captures.
- **Stop.**

## Phase 1 : contrat, guards et modèle de vue

- Guards stricts, conversion `toDiveDetailView`, libellés et formats, calculs dérivés.
- Tests Vitest :
  - chaque union refuse une valeur inconnue et accepte `null` ;
  - `observations` et `level` sont mal formés : réponse rejetée ;
  - la conversion d'une réponse complète et d'une réponse vide (tout à `null`) ;
  - bar consommés, % O₂, segment de palier, rendu des valeurs partielles, dates de création et de
    modification.
- Complète les fixtures `mockDiveDetail` et `detail()` de `divesApi.test.ts` (déjà à `null`) avec
  une variante remplie aux valeurs de la maquette.
- **Stop.**

## Phase 2 : desktop

Dans l'ordre, en comparant à `20-dive-detail-desktop.png` :

1. en-tête (zone, étiquette Bateau / Bord) ;
2. KPI (légende de surface) ;
3. Déroulé (palier de sécurité, déco., successive, segment de la barre) ;
4. Équipement & gaz et Conditions, côte à côte ;
5. Notes & observations (étiquettes) ;
6. Palanquée (niveaux) et mention des dates.

**Données de vérification** (base locale) :

```bash
docker compose up -d
pnpm db:seed
pnpm dev
```

- La **plongée la plus récente** de Marine Rousseau reprend les valeurs de la maquette (lest
  vide).
- La plongée sur **l'épave du Kléber (10 sept. 2024)** n'a aucun nouveau champ : elle sert à
  vérifier le rendu partiel.

Lis leurs ids dans `GET /api/dives`. Ensuite, lance `pnpm --filter web run screenshot "/dives/<id>" 1440`
pour chacune et compare à la capture (3 passes au plus).

Tests de rendu (Testing Library) :

- plongée complète et plongée vide ;
- chaque carte (`<section aria-labelledby>`, `<dl>`, unités lues avec leur valeur) ;
- aperçu en chargement sans type ni zone.

**Stop.**

## Phase 3 : mobile, tablette et accessibilité

- Ordre des cartes de la spec sur mobile et tablette : Déroulé → Palanquée → Équipement & gaz →
  Conditions → Notes → Site. Le mécanisme `display: contents` + `order` déjà en place est un écart
  accepté (§11) : n'oublie pas d'y placer les deux nouvelles cartes.
- Captures à 375, 768 et 1440 pour les deux plongées, comparées à `21-dive-detail-mobile.png`.
- Contrôle d'accessibilité :
  - un seul h1 ;
  - les titres de carte en h2 ;
  - les listes clé / valeur en `<dl>` ;
  - la barre de temps en `aria-hidden` ;
  - des étiquettes d'espèces lisibles par un lecteur d'écran (« Mérou brun, 2 individus ») ;
  - un contraste AA pour « — ».
- Skeleton : vérifie qu'il reste cohérent. La spec ne demande pas les nouvelles cartes dans
  l'état `loading`.
- **Stop.**

## Phase 4 : finitions et documentation

- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` et `pnpm format:check` passent.
- Mesure l'impact sur le bundle (JS et CSS gzip de la route).
- `ARCHITECTURE.md` §11, « Issus du détail de plongée » : retire ce qui est rendu, garde ce qui
  reste (actions, visibilité si elle est reportée, écarts acceptés), et ajoute les nouveaux écarts.
- Compte rendu final : écarts avec la maquette, questions (valeurs H-18, barème de visibilité),
  dette ajoutée.
- **Stop.**

## Règles de travail

- Ne modifie rien dans `apps/web/design/` (maquettes, captures, spec : lecture seule), ni dans
  `apps/api`, `packages/shared` ou `docs/data-model/`.
- En cas de conflit entre ce prompt, la spec et `ARCHITECTURE.md` : arrête-toi et signale-le.
  `ARCHITECTURE.md` est la source de vérité.
- Commits conventionnels en anglais à la fin de chaque phase (`feat(web): …`, `test(web): …`). Ne
  pousse pas.
