# Mission : API d'écriture des plongées (création et édition) + branchement du front

Le formulaire « Nouvelle plongée / Dupliquer / Modifier » d'`apps/web` (PR #15, mergée) enregistre
aujourd'hui dans un **dépôt en mémoire** (`apps/web/src/features/dives/api/inMemoryDiveRepository.ts`)
derrière le port `saveDive` (`apps/web/src/features/dives/api/saveDive.ts`) : la plongée est perdue
au rechargement. Tu développes les endpoints d'écriture de l'API, puis un adaptateur HTTP qui
remplace ce dépôt **sans toucher au formulaire**.

## Organisation
- Branche `feature/dive-write-api` créée depuis `main` à jour. Vérifie d'abord que la PR #15 est
  mergée (`git log main --oneline | grep "dive form"`). Sinon, arrête-toi et signale-le.
- Le code de l'API est écrit par l'agent **Backend NestJS Expert**, qui suit le skill
  **`writing-clean-code`**. Le code du front est écrit par l'agent **react-developer**. Tu
  orchestres : un brief complet par phase, puis relecture du diff, gates et commit.
- Les phases s'enchaînent sans arrêt. Tu t'arrêtes seulement si `ARCHITECTURE.md` et ce prompt se
  contredisent, ou si une information manque. **`ARCHITECTURE.md` fait foi.**
- Commits conventionnels en anglais, un par phase, sans aucune attribution Claude (ni
  `Co-Authored-By`, ni « Generated with »). `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
  et `pnpm format:check` passent avant chaque commit. Pour les tests d'intégration :
  `pnpm --filter api run test:db` (PostgreSQL via `docker compose up -d`).

## À lire d'abord (obligatoire)
1. `CLAUDE.md`, `ARCHITECTURE.md`, en particulier :
   - §6 : `@e-deep/shared` ne contient que des types ;
   - §9 RGPD : propriétaire via `CurrentDiverGuard`, jamais un paramètre client ; aucune donnée de
     santé dans les logs ; `Cache-Control: no-store` ;
   - §11 : points ouverts, dont le bloc « Issus du formulaire de plongée » ;
   - les décisions D22 (UUIDv7 client, LWW `baseUpdatedAt`, tombstones), D-22 (tous les champs
     requis, `null` = non saisi), D24 (TanStack Query) et D26 (n° calculé).
2. `docs/data-model/decisions.md` : bornes H-10/H-17, RG-23 (`o2Percent` seulement si `OTHER`),
   RG-25 (palier de sécurité : 2 champs ou aucun), D-21 (niveau sur le contact), et les questions
   ouvertes #19 et #20.
3. API :
   - `apps/api/src/modules/dives/` : `dive.types.ts`, `dives.service.ts` (`upsertDive`),
     `dives.controller.ts`, `dive-detail-lists.ts`, `gas-mix.ts` ;
   - `modules/dive-sites/dive-sites.service.ts` et `modules/buddies/buddies.service.ts`
     (`upsert`) ;
   - `common/errors/domain-errors.ts`, `common/sync/`, `common/auth/current-diver.guard.ts`,
     `common/database/owned-upsert.ts` ;
   - le `ValidationPipe` global (`configure-app.ts`) et les tests existants (unit, e2e, db).
4. Front : `apps/web/src/features/dives/api/saveDive.ts` (contrat `SaveDiveInput` /
   `SaveDiveResult`, qui reflète `DiveWrite`), `inMemoryDiveRepository.ts`,
   `hooks/useSaveDive.ts`, `shared/lib/apiClient.ts` (qui n'a que `get`), `api/queryKeys.ts`,
   `shared/lib/queryClient.ts`.

## Décisions déjà prises (ne pas les remettre en question)
- **REST** : `POST /api/dives` (création) et `PUT /api/dives/:id` (remplacement complet : D-22
  impose de tout envoyer, d'où PUT et non PATCH). L'endpoint de synchronisation hors ligne en lot
  viendra plus tard. Ne le crée pas, mais n'empêche pas de le construire au-dessus des mêmes
  services.
- **Ids générés par le client** (D22). L'id de l'URL du PUT doit être égal à `event.id`, sinon
  400. Le POST d'un id déjà existant renvoie 409 (`IdentifierConflictError`). La création est
  idempotente si le contenu est identique : un nouvel essai après un timeout ne crée pas de
  doublon.
- **LWW** : le PUT porte `baseUpdatedAt`. Un conflit renvoie 409 avec un code d'erreur
  exploitable par le front.
- **Une seule transaction** pour créer le site et les plongeurs nouveaux (`contacts` de
  `SaveDiveInput`), puis écrire l'événement, la participation, la palanquée et les observations.
  Un site créé par son nom seul doit être accepté. Aujourd'hui `DiveSiteWrite` exige région,
  latitude et longitude : propose la solution (colonnes nullables, migration) en respectant
  `ARCHITECTURE.md`, et note-la dans `decisions.md`.
- **Propriété** : le plongeur vient toujours de `CurrentDiverGuard`. Un site, un plongeur ou une
  plongée d'un autre propriétaire est rejeté sans révéler son existence.
- **Contrat partagé** : ajoute dans `@e-deep/shared` les types de requête et de réponse
  (`DiveWriteRequest`, `DiveWriteResponse` avec `id` et le `number` calculé selon D26, et le format
  d'erreur par champ). Types seulement. Le front les importe avec `import type` et aligne
  `SaveDiveInput` dessus.
- **Validation** : DTO `class-validator` (règle d'`ARCHITECTURE.md`), avec les bornes H-10/H-17,
  RG-23 et RG-25, les listes fermées et les observations (0–50, sans doublon). Une erreur de
  validation renvoie 400 avec des **erreurs par champ** que le front mappe sur ses champs
  (`fieldErrors`).
- **Erreurs métier** : un filtre ou un mapping traduit chaque `DomainError` en réponse HTTP
  (400, 404, 409, 422). Plus aucun 500 pour une erreur métier. Ce point ouvert §11 est à
  fermer.
- **Pas de suppression** dans ce chantier : la question ouverte #19 reste ouverte.

## Phase 0 — Conception (dans ton compte rendu, sans t'arrêter)
Écris le contrat exact :
- les routes ;
- le corps de la requête et de la réponse ;
- le format d'erreur par champ ;
- la table des codes HTTP par erreur métier ;
- la stratégie d'idempotence ;
- le site sans position.

Liste les migrations nécessaires et les fichiers à créer ou modifier. Mets à jour
`docs/data-model/decisions.md` (nouvelles décisions) **avant** de coder.

## Phase 1 — API (agent Backend NestJS Expert + `writing-clean-code`)
- Contrat dans `packages/shared`, DTO, controller (`POST` et `PUT`), mapping des erreurs métier,
  et service d'orchestration transactionnel qui réutilise `upsertDive`, `DiveSitesService.upsert`
  et `BuddiesService.upsert` sans les dupliquer. Migrations TypeORM si besoin
  (`synchronize: false`).
- Tests :
  - unitaires : DTO, mapping des erreurs, orchestration ;
  - e2e : 201, 200, 400 avec erreurs par champ, 404, 409 sur conflit d'id et de LWW, propriété ;
  - `test:db` : transaction, rollback si le site est invalide, idempotence du POST, n° renvoyé
    selon D26.
- Commit `feat(api): …`.

## Phase 2 — Front (agent react-developer)
- `apiClient` : ajoute `post` et `put` (même gestion d'erreurs et de timeout que `get`, et
  `ApiError` qui expose les erreurs par champ d'un 400).
- `httpDiveRepository` : implémente le port `SaveDive` sur ces endpoints. Les `fieldErrors` sont
  mappés sur `DiveFormField`, le conflit LWW et le 404 passent par une erreur exploitable, et
  `{ ok: true, id, number }` est renvoyé.
- Invalidation TanStack Query (`divesKeys.log()` et `divesKeys.detail(id)`) au lieu de l'écriture
  directe dans le cache.
- Le dépôt en mémoire n'est plus utilisé hors tests : supprime-le, ou garde-le comme double de
  test.
- Le formulaire ne change pas, à l'exception de l'affichage d'un conflit LWW (« La plongée a été
  modifiée ailleurs… ») si c'est nécessaire.
- Tests Vitest de l'adaptateur et du mapping des erreurs. Le test d'aller-retour du formulaire
  continue de passer.
- Vérification de bout en bout avec `pnpm dev`, la base locale et `pnpm db:seed` :
  1. créer une plongée, recharger la page, la retrouver sur le détail ;
  2. la modifier, recharger, constater la modification ;
  3. créer avec un site neuf et un plongeur neuf.
- Commit `feat(web): …`.

## Phase 3 — Revue de code, puis traitement immédiat des retours
1. Pousse la branche et ouvre la PR vers `main` (`gh pr create`). La description contient le
   résumé, le contrat, les migrations et les points ouverts, sans attribution.
2. Lance **en parallèle** :
   - le skill **`code-review`** au niveau `high` sur la PR, sans `--comment` ;
   - l'agent **`code-reviewer`**, avec la base `main` et le SHA de tête, sur tout le diff (API et
     front), en lui demandant sécurité (propriété, injection, données de santé dans les logs),
     transactions, validation et contrat.

   (Le skill `/reviewing-code` ne peut être lancé que par l'utilisateur ; ne le simule pas.)
3. Consolide les retours, dédoublonnés et triés de P0 à P3. Applique le skill
   `superpowers:receiving-code-review` : **vérifie chaque retour dans le code** avant d'agir, et
   écarte un retour faux avec une raison technique.
4. **Traite immédiatement** les retours retenus :
   - API : agent Backend NestJS Expert + `writing-clean-code` ;
   - front : react-developer.

   Chaque correction de comportement reçoit un test (d'abord en échec, puis vert). Relance les
   gates et `test:db`, committe (`fix(api|web): address the review feedback`), puis pousse.
5. Ne publie rien sur GitHub (ni review ni commentaire) sans demander à l'utilisateur.

## Phase 4 — Clôture
- Mets à jour `ARCHITECTURE.md` §11 : retire « endpoints d'écriture » et « erreurs métier en
  500 », mets à jour le bloc « Issus du formulaire de plongée » (dépôt en mémoire remplacé), et
  ajoute ce qui reste ouvert (synchro en lot, suppression #19, version du client #20, UUIDv7 si
  toujours en v4).
- Compte rendu final :
  - endpoints livrés ;
  - migrations ;
  - tableau des retours de revue (corrigé ou écarté, avec la raison) ;
  - résultats des gates ;
  - points ouverts.
