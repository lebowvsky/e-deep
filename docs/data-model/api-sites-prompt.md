# Mission : API des sites + branchement du front

La PR #18 (sites de plongée, front seul) est mergée. La gestion des sites (création express,
page Carte, fiche site) écrit aujourd'hui dans un **dépôt en mémoire**
(`apps/web/src/shared/sites/repository/`, `createMemorySitesRepository`) derrière le port
`SitesRepository` : créations, placements, modifications, fusions et suppressions sont perdus au
rechargement, et une fusion n'est jamais répercutée côté API. Tu développes l'API des sites, tu
fais évoluer le schéma, puis tu remplaces le dépôt en mémoire par un adaptateur HTTP **sans toucher
aux écrans**, et tu soldes la dette listée dans `ARCHITECTURE.md` § 11, bloc « Issus des sites ».

## Organisation

- Branche `feature/dive-sites-api` créée depuis `main` à jour (`git switch main && git pull`).
  Vérifie d'abord que la PR #18 est mergée (`git log main --oneline | grep "dive-sites"`). Sinon,
  arrête-toi et signale-le.
- Le code de l'API est écrit par l'agent **Backend NestJS Expert**, qui suit le skill
  **`writing-clean-code`**. Le code du front est écrit par l'agent **react-developer** (même skill).
  Tu orchestres : un brief complet par phase, relecture du diff, gates, commit.
- Les phases s'enchaînent sans arrêt. Tu t'arrêtes seulement si `ARCHITECTURE.md` et ce prompt se
  contredisent, si une information manque, ou à la fin (revue). **`ARCHITECTURE.md` fait foi.**
- Commits conventionnels en anglais, un par phase, **sans aucune attribution Claude** (ni
  `Co-Authored-By`, ni « Generated with »). Avant chaque commit :
  `pnpm lint && pnpm typecheck && pnpm test && pnpm build` et `pnpm format:check` ; pour l'API,
  aussi `pnpm --filter api run test:db` (PostgreSQL via `docker compose up -d`).

## À lire d'abord (obligatoire)

1. `CLAUDE.md`, `ARCHITECTURE.md`, en particulier : §6 (`@e-deep/shared` = types seulement),
   §9 RGPD (propriétaire via `CurrentDiverGuard`, jamais un paramètre client ; sites **privés** ;
   aucune donnée personnelle dans les logs ; `Cache-Control: no-store`), §11 bloc « Issus des
   sites », décisions D22 (UUIDv7 client, tombstones), D-22, D-23 (site sans position), D-25 (LWW),
   D-26 (erreurs par champ et par code), D27, D29, D30.
2. `docs/data-model/schema.md`, `decisions.md`, `evolution-champs-detail-plongee.md` (modèle de
   document d'évolution), `docs/sites/plan.md`, `apps/web/design/pages/sites.md` (spec, § Modèle,
   § Recherche, doublons, fusion, suppression).
3. API : `modules/dive-sites/` (entité, service), `modules/dives/` (`dives.service.ts`, contrôleur,
   DTO d'écriture, `dive-write.db-spec.ts`), `modules/dashboard/`, `common/errors/`, `common/sync/`,
   `common/database/owned-upsert.ts`, les migrations existantes et les seeds (`pnpm db:seed`).
4. Front : `shared/sites/` (port `SitesRepository`, `createMemorySitesRepository`,
   `buildSiteCatalogue`, `siteAliases.ts`, `useSites`, `useSiteCommands`, `sitesKeys`),
   `shared/dashboard/dashboardApi.ts` (`select: toSitePositions`), `shared/diveLog/`,
   `features/dives/api/httpDiveRepository.ts` (modèle d'adaptateur HTTP), `shared/lib/apiClient.ts`,
   `shared/ui/MapView/`, `features/dashboard/components/SiteMap/`,
   `features/dives/components/detail/SiteMiniMap/`, `MapBackdrop`, `mapProjection.ts`.

## Décisions déjà prises (ne pas les remettre en question)

- **REST** : `GET /api/sites` (mes sites vivants avec position, type, profondeurs, accès,
  `createdVia`, horodatages ; les statistiques restent calculées côté front depuis le carnet),
  `GET /api/sites/:id`, `POST /api/sites`, `PUT /api/sites/:id` (remplacement complet, D-22),
  `POST /api/sites/:id/merge` (corps : `targetId`), `DELETE /api/sites/:id`.
- **Ids générés par le client** (D22) ; POST idempotent si contenu identique, sinon
  `409 identifier-conflict` ; LWW strict (D-25).
- **Fusion côté serveur, une transaction** : plongées de la source rattachées à la cible, champs
  vides de la cible complétés par la source, source en tombstone. Source = cible, site d'un autre
  ou supprimé → erreur métier (D-26).
- **Suppression refusée** s'il reste des plongées vivantes : code métier exploitable par le front
  (le dialogue propose alors la fusion).
- **Zone** calculée, jamais stockée. **Pas de géocodage** (V2).
- Le front garde le port `SitesRepository` : l'adaptateur HTTP le remplace dans `AppProviders`,
  le dépôt en mémoire reste pour les tests. `GET /dashboard` cesse d'être la source des positions.

## Phase 0 — Évolution du modèle (aucun code)

- Avec le skill **`modeling-databases`**, rédige `docs/data-model/evolution-sites.md` : delta du
  MCD/MLD (Mermaid), nouvelles colonnes de `dive_sites` (`type` enum fermé
  'tombant'|'epave'|'sec'|'grotte'|'herbier'|'autre', `depth_min_m`, `depth_max_m` avec CHECK de
  bornes et min ≤ max, `access_notes` borné, `created_via` 'quick'|'full'), stratégie de fusion
  (réaffectation de `dive_events.site_id` via la FK composite `(creator_id, site_id)`, tombstone,
  **`merged_into_id`** ou non : justifie au regard de la sync hors ligne — un client qui référence
  encore la source doit pouvoir être redirigé), règles de suppression, index, impact sur
  `GET /dives`, `GET /dashboard` et la sync.
- Ajoute les décisions (D31…, D-27…) dans `ARCHITECTURE.md` et `decisions.md`.
- Commit `docs: model the dive sites API`.

## Phase 1 — Schéma et API (Backend NestJS Expert)

- Migration(s) générée(s) (`synchronize: false`), entité mise à jour, seeds cohérents (types,
  profondeurs, accès, 1 site sans position).
- Contrats dans `packages/shared/src/sites.ts` (types seulement, `import type`).
- Module `dive-sites` : contrôleur, DTO class-validator couvrant tous les `CHECK`, service
  (lecture, upsert, fusion transactionnelle, suppression refusée), erreurs D-26.
- `GET /dives` : servir `entryType` et `diveCenter` dans le résumé si absents (mise à l'eau et
  structure habituelles de la fiche site) ; vérifier que le nom du site suit une fusion.
- Tests : unitaires, e2e, et `*.db-spec.ts` (contraintes, isolation entre plongeurs, fusion et
  rollback, plongées réaffectées, tombstone, suppression refusée/acceptée, idempotence).
- Commit `feat(api): add the dive sites endpoints`.

## Phase 2 — Branchement du front (react-developer)

- `createHttpSitesRepository` derrière `SitesRepository`, branché dans `AppProviders` ; erreurs
  métier mappées (suppression refusée → dialogue de fusion) ; invalidations (`sitesKeys`,
  `divesKeys`, dashboard) après écriture, fusion, suppression.
- Suppression de l'overlay local devenu inutile (alias de fusion, positions via `GET /dashboard`),
  sans casser les écrans. Le site créé en express est créé par `POST /api/sites` (plus de
  `isNew` implicite, sauf si la phase 0 décide de le garder pour le hors ligne).
- `?state=` sur `/map` et `/sites/:id` comme sur les autres pages, sans importer de mocks dans le
  code applicatif.
- Tests adaptés (dépôt injecté), round trip de bout en bout comme `DiveFormRoundTrip.test.tsx`.
- Commit `feat(web): persist dive sites through the API`.

## Phase 3 — Cartes placeholder (react-developer)

- Remplacer le décor SVG du dashboard (`SiteMap`) et du détail d'une plongée (`SiteMiniMap` de
  `features/dives`) par `MapView` en lecture seule ; supprimer `projectToMap`, `MapBackdrop` et leurs
  tests s'ils ne servent plus. Captures 375 / 1440 contre les références du dashboard et du détail.
- Commit `feat(web): use the real map on the dashboard and dive detail`.

## Phase 4 — Clôture, PR et revue

- Mettre à jour `ARCHITECTURE.md` (§ 11 : retirer la dette soldée, garder géocodage V2, trait de
  côte, sync en lot) et `docs/sites/plan.md`. Commit `docs: record the dive sites API`.
- Push, puis `gh pr create` (titre et corps en français, contexte, décisions, dette, vérification,
  sans attribution Claude).
- **Arrête-toi** et demande-moi de lancer `/revue-pr <url-de-la-PR> -archi` (ce skill ne peut être
  lancé que par moi). Ensuite, traite chaque retour avec le skill
  `superpowers:receiving-code-review` (vérifier avant de corriger, justifier ce qui est écarté) via
  l'agent concerné, gates, commit `fix(api|web): address the review feedback`, push, et réponds
  aux commentaires de la review sur GitHub.

## Hors périmètre

Géocodage (V2), trait de côte pour la zone, endpoint de synchronisation en lot, sites partagés.
