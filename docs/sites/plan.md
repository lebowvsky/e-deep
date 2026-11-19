# Sites — plan (phase 0) et état de la phase 1

> **Mise à jour du 2026-11-19 — API des sites** (D31, D32 d'`ARCHITECTURE.md` ;
> `docs/data-model/evolution-sites.md`) : les sites sont lus et écrits par `/api/sites`. Les
> sections 2 et 6 ci-dessous décrivent l'état **front seul** d'origine ; l'état courant est au § 11.

Implémentation de `apps/web/design/prompts/sites-prompt.md`. La spec qui fait foi est
`apps/web/design/pages/sites.md`. Ce document consigne les choix de la phase 0 et ce que la phase 1
a livré.

## 1. Carte

### Bibliothèque : MapLibre GL (`maplibre-gl` 6.19, installé)

| Critère                  | MapLibre GL                                                | Leaflet                                            |
| ------------------------ | ---------------------------------------------------------- | -------------------------------------------------- |
| Rendu                    | vectoriel WebGL : style réglable couche par couche         | tuiles raster : couleurs figées par le fournisseur |
| Style sombre aux tokens  | oui (eau `surface0`, terre `surface1`, libellés `textLow`) | non, au mieux un filtre CSS sur les tuiles         |
| Regroupement des repères | natif : source GeoJSON `cluster: true`                     | plugin (`leaflet.markercluster`)                   |
| Poids                    | ~230 kB gzip, chargé avec la route Carte seulement         | ~40 kB gzip, plus le plugin de regroupement        |
| Accessibilité            | canvas : repères HTML focusables à fournir nous-mêmes      | repères DOM, mais même travail sur les libellés    |
| Tests (jsdom)            | pas de WebGL : `MapView` est isolé et remplacé en test     | idem pour les tuiles                               |

MapLibre est retenu (déjà recommandé par `design/README.md` § 5.3) : style sombre aux tokens et
regroupement natif. Son poids est acceptable parce que la carte n'est chargée que sur `/map` et
la fiche site (import dynamique de `MapView`).

### Tuiles : CARTO Dark Matter

- Style vectoriel `https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json`, **sans clé
  API**.
- Attribution obligatoire, affichée en permanence : « © OpenStreetMap contributors © CARTO »
  (contrôle d'attribution de MapLibre, en mode compact).
- Quota : usage gratuit autorisé pour un trafic modéré, sans engagement ni SLA. Au-delà (ou pour
  un usage commercial), passer par un compte CARTO ou un autre fournisseur ; seule l'URL du style
  change, dans `MapView`.
- Les couleurs du style sont surchargées au chargement à partir de `@/design/tokens` : eau
  `surface0`, terre `surface1`, côtes `coast`, libellés `textLow`. Aucune valeur en dur.

### API prévue de `MapView` (phase 3)

`MapView` est le seul fichier qui importe `maplibre-gl`. Il remplacera ensuite les placeholders du
dashboard et du détail (pas dans ce lot).

```ts
interface MapViewProps {
  /** Seuls les sites placés sont dessinés ; le nombre de plongées fixe la taille du repère. */
  sites: readonly { id: string; name: string; position: GeoPoint; diveCount: number }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Vue imposée (recadrage sur une zone, centrage sur un site) ; sinon, emprise des sites. */
  viewport?: { bounds: [GeoPoint, GeoPoint] } | { center: GeoPoint; zoom: number };
  /** `pick` : curseur en croix, clic = pose du repère, repère déplaçable (souris et flèches). */
  mode?:
    | { kind: 'browse' }
    | { kind: 'pick'; position: GeoPoint | null; onPick: (position: GeoPoint) => void };
  /** Libellé du canvas (« Carte de tes sites de plongée »). */
  label: string;
}
```

Les repères sont des éléments HTML (focusables, libellés « Pointe de la Revellata, 8 plongées »),
les grappes une couche de la source GeoJSON. Les contrôles (zoom, géolocalisation, fond) sont des
composants à nous (`MapControls`), pas ceux de MapLibre.

## 2. Modèle

### Type `Site` (`apps/web/src/shared/model/site.ts`)

Conforme à la spec, avec trois adaptations :

- **`position: GeoPoint | null`** au lieu de `latitude?` / `longitude?` : « les deux ou aucune »
  est garanti par le type (comme `DiveDetailView.site.position`) ;
- **pas d'`ownerId`** : le front ne voit que les sites du plongeur courant ;
- **`createdAt` / `updatedAt` nullables** : l'API ne les sert pas pour les sites lus du carnet.

Les champs facultatifs sont `null` (pas de `?`), comme les contrats (`exactOptionalPropertyTypes`).
`SiteStats` porte les valeurs calculées : nombre de plongées, première et dernière plongée,
profondeur max (n° et date), temps cumulé et moyen, température au fond (moyenne, min, max),
mise à l'eau et structure habituelles. `SiteEntry` = site + statistiques + plongées.

### Impact sur l'existant

- **Aucun contrat** (`@e-deep/shared`) ne change : pas d'endpoint sites (front seul).
- Lecture du carnet remontée dans **`src/shared/diveLog/diveLogApi.ts`** (`isDiveSummary`,
  `isDiveLogResponse`, `fetchDiveLog`, `diveLogQueryOptions`, clé `['dives', 'log']`, toujours sous
  `divesKeys.all`) : `features/dives` l'importe au lieu de le porter, et les quatre requêtes du
  carnet partagent maintenant le même `queryOptions`.
- `GAS_MIXES` passe dans `src/shared/model/gasMix.ts` (il était dupliqué dans le dashboard),
  `placeLabel` dans `src/shared/lib/format.ts`, le guard d'un site du dashboard dans
  `src/shared/sites/api/sitePositionsApi.ts` (réutilisé par `dashboardApi`).
- Mocks : `features/dives/mocks/sites.ts` est inchangé (le générateur des 127 plongées est
  calibré dessus). Les sites complets sont dans `src/shared/sites/mocks/sites.ts` ; un test vérifie
  que les deux listes concordent.

### Sources des données (front seul)

| Donnée                                          | Source                                                                  |
| ----------------------------------------------- | ----------------------------------------------------------------------- |
| sites, plongées, statistiques                   | `GET /dives` (même cache que « Mes plongées »)                          |
| positions                                       | `GET /dashboard` (`sites[].latitude/longitude`), clé `sites/positions`  |
| région                                          | `locality · region` du carnet (« Calvi · Corse »)                       |
| zone                                            | déduite (`deriveZone`) : position, sinon mots de la région              |
| type, profondeurs, accès                        | **inconnus de l'API** : `null` tant que l'utilisateur ne les saisit pas |
| créations, modifications, fusions, suppressions | `SitesRepository` en mémoire, superposé (`SitesOverlay`)                |

La fusion ne peut pas réécrire les plongées côté API : le dépôt garde un alias source → cible,
appliqué aux plongées lues du carnet (une fusion en chaîne est ramenée à un seul saut).

## 3. Composants

| Composant / module                                                                                                                             | Emplacement                                                        | Phase |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----- |
| `Site`, `SiteStats`, `SiteDraft`…                                                                                                              | `shared/model/site.ts`                                             | 1     |
| `SitesRepository`, mémoire, contexte                                                                                                           | `shared/sites/repository/`                                         | 1     |
| `useSites`, `useSite`, `useSiteCommands`                                                                                                       | `shared/sites/hooks/`                                              | 1     |
| `searchSites`, `suggestRegion`, `deriveZone`, `computeSiteStats`, `buildSiteCatalogue`, `createSite`, `updateSite`, `mergeSites`, `deleteSite` | `shared/sites/lib/`                                                | 1     |
| `QuickCreateSitePanel`                                                                                                                         | `features/dives/components/form/`                                  | 2     |
| `MapView`, `SiteMiniMap`                                                                                                                       | `shared/ui/` (utilisés par plusieurs features)                     | 3, 4  |
| `MapPage`, `ZoneChips`, `MapControls`, `SitePreviewPopover`, `SiteList`, `SiteListItem`, `SitePanel`, `CoordinatesInput`                       | `features/sites/components/`, page `app/routes/MapPage.tsx`        | 3     |
| `SiteDetailPage`, `SiteDivesList`, `MergeSiteDialog`, `DeleteSiteDialog`                                                                       | `features/sites/components/`, page `app/routes/SiteDetailPage.tsx` | 4     |

## 4. Valeurs des maquettes sans token

Ajoutées à `apps/web/src/design/tokens.ts` (puis `pnpm --filter web run tokens`) :

| Maquette (`sites.jsx`)                                   | Token proposé                                                                                        |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `rgba(11,26,46,0.85)` puces de zone                      | `color.mapOverlay`                                                                                   |
| `rgba(11,26,46,0.9)` coordonnées, aide de placement      | `color.mapOverlayStrong`                                                                             |
| `rgba(231,178,74,0.35)` liseré « À compléter »           | `color.warningLine`                                                                                  |
| `blur(8px)` des puces                                    | `layout.blurMap`                                                                                     |
| liste 380, panneau 420, hauteur min. 640                 | `layout.siteListWidth`, `sitePanelWidth`, `mapPageMinHeight`                                         |
| aperçu 250                                               | `layout.sitePopoverWidth`                                                                            |
| rayon du repère `min(9 + 1,1 × n, 20)`, halo `r + 9`     | `layout.siteMarkerMin` 18, `siteMarkerMax` 40, `siteMarkerStep` 2,2, `siteMarkerHalo` 18 (diamètres) |
| repère en cours de pose (r 12, anneau r 26)              | `layout.pickMarker` 24, `pickMarkerRing` 52                                                          |
| menu « … » 230                                           | `layout.menuWidth`                                                                                   |
| textarea 76                                              | `layout.textareaMinHeightSm`                                                                         |
| « Tes plongées ici » : lignes 56, colonnes 52 / 90 / 110 | `layout.rowHeightSm`, `colNumberSm`, `colMeasure`, `colTeamSm`                                       |
| compteur du repère mono 11/600                           | `type.markerCount`                                                                                   |
| compteur des petits repères mono 9                       | `type.markerCountSm` à **10** (9 px illisible)                                                       |
| nom dans l'aperçu 15/600                                 | `type.titleSm`                                                                                       |
| titre du panneau 18/600                                  | `type.panelTitle`                                                                                    |
| chiffres de l'aperçu mono 16/600                         | `type.metricXs`                                                                                      |

Réutilisées sans nouveau token : fond « À compléter » `rgba(231,178,74,0.10)` → `warningSoft`
(0,12) ; puces non choisies → `controlFill` ; survol du menu → `chipFill` ; rayon 7 des puces de
zone → `radius.segment` (8) ; `blur(4px)` du voile mobile → `layout.blurScrim` ; ombre de la bottom
sheet → `shadow.sheet` ; padding 11 des lignes d'infos → `space.3` ; colonne chevron 20 →
`colChevron` (24) ; halo de focus des champs (retiré dans tout le projet, outline `accent`).

## 5. Écarts avec la spec et la maquette

- **Puces de zone** : la maquette montre « Bretagne » ; la spec fixe les zones
  `mediterranee | atlantique | manche | autre` : la Bretagne se répartit entre Atlantique et Manche.
- **24 sites mockés** (et non 23) : les 23 du carnet plus « Revellata — Grotte aux Corbs », sans
  position et **sans plongée** dans le carnet mocké (en ajouter une décalerait les 127 plongées
  calibrées). La maquette lui donne 1 plongée.
- **Recherche** : sur le nom seulement ; « mot complet » est détaillé en « mot entier » puis
  « début de mot » (tri : nom qui commence par la requête > mots entiers > débuts de mot > approché
  > nombre de plongées > nom).
- **Mise à l'eau et structure habituelles** : calculées, mais `GET /dives` ne porte ni
  `entryType` ni `diveCenter` : elles restent « — » tant que le carnet ne les sert pas.
- **`createdVia`** des sites de l'API : déduit (`full` s'il est placé, `quick` sinon).

## 6. Dette

- **Écritures perdues au rechargement** : le dépôt des sites est en mémoire (`AppProviders`). Un
  endpoint `sites` (lecture, création, modification, fusion côté serveur, suppression) remplacera
  `createMemorySitesRepository` derrière le même port, et `GET /dashboard` comme source des
  positions.
- Une fusion locale ne change pas le site des plongées côté API : le détail d'une plongée et
  « Mes plongées » montrent encore l'ancien site.
- Les positions demandent tout `GET /dashboard` (même requête et même cache que le dashboard
  depuis la revue : `shared/dashboard/dashboardApi.ts`, `select: toSitePositions`).
- Les zones par mots de la région ne couvrent que les côtes françaises et quelques destinations.

## 7. Phase 2 — création express

- `QuickCreateSitePanel` (`features/dives/components/form/`) : dialogue non modal sous le champ
  Site à partir de 768 px, bottom sheet modale (`Sheet`, hauteur ajustée au contenu) en dessous.
  La combobox Site cherche avec `searchSites`.
- Un site créé ici n'existe pas encore dans l'API : `DiveFormSiteOption.isSaved` le distingue, et
  `toSaveDiveInput` l'envoie en `isNew: true` avec son propre id (le dépôt local garde ses détails
  sous le même id). Un `422 invalid-reference` ne le met donc pas en cause. Un site local perdu au
  rechargement (brouillon restauré) part aussi en `isNew`.
- `/dives/new?site=:id` préremplit le champ Site si `id` est l'un de mes sites.
- Écarts : types proposés = ceux de la maquette (sans « Herbier », disponible sur la page Carte) ;
  titre de la bottom sheet en `h2` (20 px) comme les autres sheets, au lieu de 18 px.

## 8. Phase 3 — page Carte desktop

- `MapView` (`shared/ui/MapView/`) charge `maplibre-gl`, son worker (`setWorkerUrl`, requis
  avec Vite) et sa feuille de style à la première carte affichée ; la page `/map` est elle-même
  une route chargée à la demande. Les repères sont des `<button>` synchronisés avec la source
  GeoJSON regroupée à chaque rendu (`querySourceFeatures`). Les tests remplacent `MapView` par
  `vi.mock`.
- Fond de carte : bascule « noms de lieux » (styles CARTO avec et sans libellés), faute d'un
  second fond sans clé.
- Région du compteur et du filtre : la partie la plus large de la région (« Calvi · Corse » →
  « Corse »).
- `/sites/:id` est un placeholder jusqu'à la phase 4 (« Voir la fiche » n'est pas un lien mort).
- `?state=` n'est pas géré sur `/map` (pas de mocks dans le code applicatif).
- Saisie de coordonnées invalide : le repère garde la dernière position valide, l'erreur
  s'affiche à la sortie du champ ; l'enregistrement prend cette dernière position valide.

## 9. Phase 4 — fiche site et mobile

- `/sites/:siteId` (route lazy, `ownMobileBars` + `hideFab`) : fil d'Ariane, ou barre du haut
  « ‹ Carte » + « … » sur téléphone ; KPI (2 sur téléphone), mini-carte `MapView` centrée (ou
  encart « Position à préciser »), 5 dernières plongées (3 sur téléphone), infos en `<dl>`, accès,
  dialogues `MergeSiteDialog` et `DeleteSiteDialog`.
- « Mes plongées » accepte `?site=:id` (filtre « Site : nom », retirable) : cible de « Voir dans
  Mes plongées ».
- `/map` sur téléphone (handles `hideFab` + `fullBleed`) : carte plein écran, liste en bottom sheet
  à 3 crans (`SiteSheet`), ajout et édition avec la carte sur 40 % et le repère fixe au centre
  (`MapPick.mode = 'center'`).
- Nav : « Carte » reste active sur une fiche site (`NavEntry.section`).
- Dette : `?state=` n'est géré ni sur `/map` ni sur `/sites/:id` (pas de mocks dans le code
  applicatif) ; la mise à l'eau et la structure habituelles restent « — » (absentes du carnet).

## 10. Phase 5 — contrôle qualité et bilan

- **Accessibilité** (spec § Accessibilité) :
  - la carte n'est jamais seule : chaque ligne sélectionnée de la liste mène à la fiche (« Voir la
    fiche de … »), « Placer sur la carte » pour un site sans position, coordonnées saisissables ;
  - repères et grappes sont des `<button>` libellés (« Pointe de la Revellata, 7 plongées »,
    « 5 sites ici. Zoomer pour les voir »), `aria-pressed` sur la sélection ; le repère en cours de
    pose se déplace aux flèches (1 px, Maj 10 px), ou la carte sous le repère fixe sur téléphone ;
  - dialogues : panneau du site et création express (`role="dialog"`, titre lié, focus sur le
    premier champ, Échap, focus rendu à la ligne ou à « Ajouter un site ») ; fusion et suppression
    en `alertdialog` modal (focus piégé, rendu au déclencheur) ; menu « … » au clavier ;
  - fermeture de l'aperçu (Échap) : focus rendu à la ligne du site ;
  - `radiogroup` des zones (flèches), `aria-pressed` de « À compléter » et du fond de carte,
    nombre de sites listés annoncé (`aria-live`), « Position à préciser » avec icône et texte ;
  - « Carte » de la navigation porte `aria-current="location"` sur une fiche site.
- **Performance** : liste virtualisée au-delà de 100 sites (test à 500 : moins de 20 lignes
  montées), recherche et tri mémoïsés, GeoJSON envoyé à la carte seulement quand les sites changent
  (test : survol et sélection ne recréent pas le tableau), regroupement des repères par MapLibre.
- **Valeurs en dur** : aucune dans les nouveaux SCSS et TSX (hors commentaires, `1px` des bordures
  et proportions 40 % / 50 % du téléphone) ; contours de focus des repères par `focus-ring`.

### Livré

Création express depuis le formulaire, page Carte desktop et mobile (carte, liste, sheet, panneau
new / place / edit), fiche site desktop et mobile, fusion et suppression, lien du détail de plongée
vers la fiche, filtre `?site=` de « Mes plongées ».

### Écarts, dette, points ouverts

Voir `ARCHITECTURE.md` § 11, « Issus des sites » : écritures en mémoire, API sites à créer, fusion
non répercutée côté API, `?state=` non géré sur `/map` et `/sites/:id`, placeholders carte du
dashboard et du détail à remplacer par `MapView`, géocodage en V2, tuiles sans SLA.

## 11. API des sites (2026-11-19)

Mission `docs/data-model/api-sites-prompt.md`. Modèle : `docs/data-model/evolution-sites.md`.

### Sources des données

| Donnée                                      | Source                                                                           |
| ------------------------------------------- | -------------------------------------------------------------------------------- |
| sites (position, type, profondeurs, accès…) | `GET /api/sites` (clé `sitesKeys`)                                               |
| plongées et statistiques                    | `GET /dives` (même cache que « Mes plongées ») ; `entryType`, `diveCenter` (D32) |
| région                                      | `placeLabel(locality, region)` ; valeurs brutes gardées dans `Site.storedPlace`  |
| zone                                        | déduite (`deriveZone`), jamais stockée                                           |
| écritures                                   | `createHttpSitesRepository` (`POST`, `PUT`, `merge`, `DELETE /api/sites`)        |

- **Port `SitesRepository`** : `list`, `create(NewSite)`, `update(site, changes)`, `merge(sourceId,
targetId)`, `remove(id)` → `'deleted' | 'in-use'`. Le dépôt mémoire et le faux serveur
  (`shared/sites/mocks/`) ne servent qu'aux tests.
- **Fusion** : faite par le serveur (plongées réaffectées, cible complétée) ; le front relit sites,
  carnet et dashboard. L'overlay local (`SitesOverlay`, alias de fusion, positions par
  `GET /dashboard`) est supprimé.
- **Suppression** : `409 site-in-use` → `{ status: 'refused' }`, le dialogue propose la fusion.
- **Création express** : `POST /api/sites` (`createdVia: 'quick'`) avant de sélectionner le site.
- **Libellé de région** (D-32) : inchangé → valeurs brutes renvoyées ; modifié → découpé au premier
  « · » ; `area` renvoyée telle quelle.
- **Un site du carnet absent de `GET /api/sites`** (instant entre deux relectures après une
  fusion) : ses plongées ne comptent pour aucun site, elles restent dans « Mes plongées ».
- **`?state=loading|empty|error`** sur `/map` et `/sites/:id` (sans mocks ; `ready` lit l'API).
- **Cartes** : le dashboard (`SiteMap`) et le détail d'une plongée (`SiteMiniMap` de
  `features/dives`) utilisent `MapView` en lecture seule (`readOnly`, `viewport`, `topCover`) ;
  `projectToMap` et `MapBackdrop` sont supprimés. La mini-carte de la fiche site passe aussi en
  lecture seule (« Ouvrir sur la carte » mène à la carte interactive).

Dette : `ARCHITECTURE.md` § 11, « Issus de l'API des sites ».
