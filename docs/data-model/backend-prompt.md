# Mission : implémenter le modèle de données du carnet de plongée (NestJS + TypeORM + PostgreSQL)

> Destiné à l'agent **Backend NestJS Expert**. Prompt autonome : tout ce qu'il faut est ici.
>
> **Deux missions dans ce fichier.** La mission initiale (schéma de 7 tables, migration
> `InitDiveLogSchema`) est **livrée** : elle reste ici comme référence des conventions. La mission
> en cours est **« Mission 2 : champs du détail de plongée »**, en fin de fichier.

## Contexte

E-Deep est un carnet de plongée numérique : une PWA plongeur (`apps/web`) qui fonctionnera hors
ligne (IndexedDB) et se synchronisera avec l'API `apps/api` (NestJS 12 en CommonJS, TypeORM 1.1,
PostgreSQL 18). L'API ne contient aujourd'hui que `GET /api/health` : aucune entité, aucune
migration. Tu crées le **schéma initial** : 7 tables (`certification_levels`, `divers`, `dive_sites`,
`dive_events`, `dive_participations`, `buddies`, `dive_buddies`), leurs entités, leur migration, les
services qui portent les invariants et les tests. **Aucun endpoint métier** dans cette mission (ni
dashboard ni synchronisation HTTP).

Une **plongée**, pour le front, est un agrégat : un **événement** (`dive_events` : site, date, heure
locale, commun à la palanquée) + **la participation** du plongeur (`dive_participations` : ses
mesures, son niveau au moment de la plongée, ses notes) + ses **binômes** (`dive_buddies`). Ce
découpage prépare le partage futur d'une plongée entre membres d'un club ; en MVP, un événement a
exactement une participation, celle de son créateur.

Documents de référence : `docs/data-model/schema.md` et `docs/data-model/decisions.md` (décisions
D-01 à D-12). Ils font foi en cas d'ambiguïté. Lis aussi **`ARCHITECTURE.md`** (source de vérité du
projet) et `CLAUDE.md` à la racine avant de commencer ; en cas de conflit avec ce prompt,
arrête-toi et signale-le.

## Contraintes techniques (issues d'ARCHITECTURE.md)

- `synchronize: false` partout ; le schéma ne change **que** par migrations
  (`pnpm migration:generate src/database/migrations/<Nom>`, depuis la racine ; la CLI tourne sur
  `dist`, voir `apps/api/src/database/data-source.ts`, qui charge déjà `**/*.entity.js`).
- Un module Nest par domaine dans `apps/api/src/modules/<domaine>/` ; entités dans des fichiers
  **`*.entity.ts`** (obligatoire pour la CLI) ; `TypeOrmModule.forFeature()` dans chaque module
  (l'app utilise `autoLoadEntities`). Nommage de fichiers kebab-case, exports nommés, chemins
  relatifs, **aucun `any`**.
- Modules :
  - `certification-levels` (`CertificationLevel`) ;
  - `divers` (`Diver`) ;
  - `dive-sites` (`DiveSite`) ;
  - `buddies` (`Buddy`) ;
  - `dives` (`DiveEvent`, `DiveParticipation`, `DiveBuddy`) : un seul module, car la plongée est un
    agrégat écrit d'un bloc.

  Enregistre-les dans `AppModule`.

- **Nommage SQL** : tables au pluriel snake_case, colonnes snake_case **via `name:` explicite** sur
  chaque `@Column` / `@JoinColumn` (pas de `SnakeNamingStrategy` : pas de dépendance ajoutée).
  Propriétés TypeScript en camelCase. **Nomme chaque contrainte et index** exactement comme indiqué
  ci-dessous.
- Dates en `timestamptz`. `numeric` revient en `string` avec `pg` : crée **un** `ValueTransformer`
  partagé (`src/common/database/numeric.transformer.ts`) `string | null ↔ number | null`, utilisé sur
  toutes les colonnes `numeric`.
- Aucune relation `eager`. `onDelete` explicite sur chaque `@ManyToOne`. Expose la colonne FK
  (`@Column({ name: 'owner_id', type: 'uuid' }) ownerId: string`) à côté de la relation.
- Liste fermée restante (`gas_mix`) : colonne `text` + `@Check`, union de littéraux TypeScript (pas
  d'`enum` TS). Si tu exposes des types dans `@e-deep/shared`, ce paquet ne contient que des types
  (`import type`).
- **RGPD** (`ARCHITECTURE.md` §9) : `dive_participations`, `dive_buddies`, `dive_events` et
  `notes` sont des **données de santé** ou en dépendent. Ne logge jamais de valeur, de paramètre SQL
  ni de corps de requête ; `logging: false` reste en place.
- **N'ajoute aucun champ métier** absent de cette spécification (ni email, ni gaz détaillés, ni
  paliers détaillés, ni matériel, ni statut d'invitation, ni club). S'il te semble en manquer un,
  signale-le en fin de tâche.
- **Contrat front** : le front consomme `User.level` (`'N1' | 'N2' | 'N3' | 'N4'`) et
  `User.federation` (`'FFESSM' | 'CMAS' | 'OTHER'`) et une plongée avec un seul champ `date`. Ces
  valeurs ne sont plus des colonnes : quand les endpoints arriveront, elles seront **dérivées** —
  `level` = `certification_levels.code`, `federation` = `agency` si `FFESSM` ou `CMAS`, sinon
  `OTHER` ; la date = `started_at` avec `utc_offset_minutes`. Prévois des fonctions de mapping pures
  et testées dans le module concerné (pas de contrôleur), et signale que `UserLevel` devra s'élargir
  dès qu'un niveau non FFESSM sera inséré, et que le contrat `Dive` devra exposer
  `utcOffsetMinutes`.

## Principes transverses à implémenter

1. **Identifiants** : `dive_sites`, `dive_events`, `dive_participations`, `buddies` ont une PK
   `uuid` **sans défaut en base**, fournie par le client (UUIDv7) →
   `@PrimaryColumn('uuid', { name: 'id' })`. `divers.id` et `certification_levels.id` ont `DEFAULT uuidv7()` (natif PostgreSQL 18)
   → `@PrimaryColumn` + `default: () => 'uuidv7()'` (vérifie que TypeORM 1.1 génère bien ce défaut ;
   sinon pose-le en SQL brut).
2. **Horodatages** : `created_at timestamptz NOT NULL DEFAULT now()` (`@CreateDateColumn`) et
   `updated_at timestamptz NOT NULL DEFAULT clock_timestamp()` sur toutes les tables sauf
   `dive_buddies`. **`updated_at` est posé par un trigger PostgreSQL** à chaque INSERT et UPDATE (SQL
   brut plus bas) : le serveur en est seul maître. Ne le déclare pas avec `@UpdateDateColumn`, mais
   ainsi :

   ```ts
   @Column({ type: 'timestamptz', name: 'updated_at', insert: false, update: false, default: () => 'clock_timestamp()' })
   ```

3. **Tombstones** : `deleted_at timestamptz NULL` sur `dive_sites`, `dive_events`,
   `dive_participations`, `buddies`, en `@Column` **simple** (pas `@DeleteDateColumn`) : la
   synchronisation doit lire les lignes supprimées. Toute lecture métier filtre explicitement
   `deleted_at IS NULL` (participation **et** événement pour une plongée). `divers` et
   `certification_levels` n'ont pas de `deleted_at`.
4. **FK composites par propriétaire** : un plongeur ne peut jamais référencer le site ou le binôme
   d'un autre. Les tables cibles ont `UNIQUE (owner_id, id)` (`dive_sites`, `buddies`) ou
   `UNIQUE (diver_id, id)` (`dive_participations`) et les FK sont composites. TypeORM l'exprime
   ainsi (exemple `dive_events` → `dive_sites`) :

   ```ts
   @JoinColumn([
     { name: 'creator_id', referencedColumnName: 'ownerId' },
     { name: 'site_id', referencedColumnName: 'id' },
   ])
   ```

   Si la migration générée ne produit pas exactement ces contraintes, écris-les en SQL brut.

## Ordre d'implémentation

1. Transformer `numeric` partagé.
2. `CertificationLevel` (`certification_levels`).
3. `Diver` (`divers`).
4. `DiveSite` (`dive_sites`) et `Buddy` (`buddies`).
5. `DiveEvent` (`dive_events`).
6. `DiveParticipation` (`dive_participations`).
7. `DiveBuddy` (`dive_buddies`) : entité explicite avec PK composite, **pas** `@ManyToMany`.
8. `pnpm migration:generate src/database/migrations/InitDiveLogSchema`, relecture, puis ajout du SQL
   brut (seed des niveaux, triggers, index partiels, FK composites manquantes). `down()` complet et
   symétrique.
9. Services et fonctions de mapping, puis tests.

## Spécification par entité

### `CertificationLevel` → table `certification_levels`

| Propriété             | Colonne                 | Type        | Contraintes                                                                                |
| --------------------- | ----------------------- | ----------- | ------------------------------------------------------------------------------------------ |
| id                    | id                      | uuid        | PK, `DEFAULT uuidv7()`                                                                     |
| agency                | agency                  | text        | NOT NULL, `ck_certification_levels__agency`: `char_length(btrim(agency)) BETWEEN 1 AND 40` |
| code                  | code                    | text        | NOT NULL, `ck_certification_levels__code`: `char_length(btrim(code)) BETWEEN 1 AND 40`     |
| label                 | label                   | text        | NOT NULL, `ck_certification_levels__label`: `char_length(btrim(label)) BETWEEN 1 AND 120`  |
| rank                  | rank                    | smallint    | NOT NULL, `ck_certification_levels__rank`: `rank > 0`                                      |
| isActive              | is_active               | boolean     | NOT NULL DEFAULT true                                                                      |
| createdAt / updatedAt | created_at / updated_at | timestamptz | voir principes                                                                             |

- `uq_certification_levels__agency_code` : `UNIQUE (agency, code)`.
- Référentiel en lecture seule pour les clients ; un niveau obsolète se **désactive**
  (`is_active = false`), il ne se supprime jamais. Pas d'écran d'administration dans cette mission.
- Seed (dans la migration, rien d'autre) : `('FFESSM','N1','Niveau 1',10)`,
  `('FFESSM','N2','Niveau 2',20)`, `('FFESSM','N3','Niveau 3',30)`, `('FFESSM','N4','Niveau 4',40)`.
  N'insère **pas** la liste complémentaire de `decisions.md` (D-09) : elle attend la validation du
  porteur. Le `down()` supprime ces lignes.

### `Diver` → table `divers`

| Propriété             | Colonne                | Type        | Contraintes                                                                                     |
| --------------------- | ---------------------- | ----------- | ----------------------------------------------------------------------------------------------- |
| id                    | id                     | uuid        | PK, `DEFAULT uuidv7()`                                                                          |
| firstName             | first_name             | text        | NOT NULL, `ck_divers__first_name`: `char_length(btrim(first_name)) BETWEEN 1 AND 100`           |
| lastName              | last_name              | text        | NOT NULL, `ck_divers__last_name`: idem                                                          |
| certificationLevelId  | certification_level_id | uuid        | NOT NULL, `fk_divers__certification_level_id` → certification_levels(id) **ON DELETE RESTRICT** |
| avatarUrl             | avatar_url             | text        | NULL, `ck_divers__avatar_url`: `avatar_url IS NULL OR char_length(avatar_url) <= 2048`          |
| createdAt / updatedAt |                        | timestamptz | voir principes                                                                                  |

- Plus de colonnes `level` ni `federation` : le niveau détermine l'organisme.
- FK `certification_level_id` **volontairement non indexée** (niveaux jamais supprimés).

### `DiveSite` → table `dive_sites`

| Propriété                         | Colonne   | Type         | Contraintes                                                                         |
| --------------------------------- | --------- | ------------ | ----------------------------------------------------------------------------------- |
| id                                | id        | uuid         | PK, fourni par le client                                                            |
| ownerId                           | owner_id  | uuid         | NOT NULL, `fk_dive_sites__owner_id` → divers(id) **ON DELETE CASCADE**              |
| name                              | name      | text         | NOT NULL, `ck_dive_sites__name`: `char_length(btrim(name)) BETWEEN 1 AND 120`       |
| region                            | region    | text         | NOT NULL, `ck_dive_sites__region`: idem                                             |
| latitude                          | latitude  | numeric(8,6) | NOT NULL, `ck_dive_sites__latitude`: `latitude BETWEEN -90 AND 90`, transformer     |
| longitude                         | longitude | numeric(9,6) | NOT NULL, `ck_dive_sites__longitude`: `longitude BETWEEN -180 AND 180`, transformer |
| createdAt / updatedAt / deletedAt |           | timestamptz  | voir principes                                                                      |

- `uq_dive_sites__owner_id_id` : `UNIQUE (owner_id, id)` (cible de FK composite ; couvre la FK `owner_id`).
- `idx_dive_sites__owner_id_updated_at_id` : `(owner_id, updated_at, id)` — pull.
- **Pas** d'unicité sur le nom (deux appareils hors ligne peuvent créer le même site).

### `Buddy` → table `buddies`

| Propriété                         | Colonne         | Type        | Contraintes                                                             |
| --------------------------------- | --------------- | ----------- | ----------------------------------------------------------------------- |
| id                                | id              | uuid        | PK, fourni par le client                                                |
| ownerId                           | owner_id        | uuid        | NOT NULL, `fk_buddies__owner_id` → divers(id) **ON DELETE CASCADE**     |
| firstName                         | first_name      | text        | NOT NULL, `ck_buddies__first_name`: 1..100 caractères non blancs        |
| lastName                          | last_name       | text        | NOT NULL, `ck_buddies__last_name`: idem                                 |
| linkedDiverId                     | linked_diver_id | uuid        | NULL, `fk_buddies__linked_diver_id` → divers(id) **ON DELETE SET NULL** |
| createdAt / updatedAt / deletedAt |                 | timestamptz | voir principes                                                          |

- `ck_buddies__not_self` : `linked_diver_id IS NULL OR linked_diver_id <> owner_id`.
- `uq_buddies__owner_id_linked_diver_id` : `UNIQUE (owner_id, linked_diver_id) WHERE linked_diver_id IS NOT NULL AND deleted_at IS NULL`.
- `uq_buddies__owner_id_id` : `UNIQUE (owner_id, id)`.
- `idx_buddies__owner_id_updated_at_id` : `(owner_id, updated_at, id)`.
- `idx_buddies__linked_diver_id` : `(linked_diver_id) WHERE linked_diver_id IS NOT NULL`.
- Deux `@ManyToOne(() => Diver)` : `owner` (CASCADE) et `linkedDiver` (SET NULL, nullable). Le lien
  ne donne aucun accès aux plongées du propriétaire.

### `DiveEvent` → table `dive_events`

| Propriété                         | Colonne            | Type        | Contraintes                                                                                                              |
| --------------------------------- | ------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| id                                | id                 | uuid        | PK, fourni par le client                                                                                                 |
| creatorId                         | creator_id         | uuid        | NOT NULL, `fk_dive_events__creator_id` → divers(id) **ON DELETE CASCADE**                                                |
| siteId                            | site_id            | uuid        | NOT NULL, `fk_dive_events__creator_id_site_id` : (creator_id, site_id) → dive_sites(owner_id, id) **ON DELETE RESTRICT** |
| startedAt                         | started_at         | timestamptz | NOT NULL                                                                                                                 |
| utcOffsetMinutes                  | utc_offset_minutes | smallint    | NOT NULL, `ck_dive_events__utc_offset_minutes`: `utc_offset_minutes BETWEEN -720 AND 840`                                |
| createdAt / updatedAt / deletedAt |                    | timestamptz | voir principes                                                                                                           |

- `idx_dive_events__creator_id_updated_at_id` : `(creator_id, updated_at, id)` — pull ; couvre la FK `creator_id`.
- `idx_dive_events__creator_id_site_id` : `(creator_id, site_id)` — FK composite, refus de suppression d'un site utilisé, purge des sites.
- Pas d'index sur `started_at` : les statistiques partent des participations et joignent l'événement
  par PK (D-08).
- `utc_offset_minutes` : décalage de l'heure locale de la plongée ; le client propose celui de
  l'appareil, le créateur peut le corriger. Heure affichée = `started_at + utc_offset_minutes`.
- Le `CASCADE` sur `creator_id` n'est correct qu'en MVP (un seul participant) : ne le généralise
  pas. Avec le partage, la contrainte passera en `RESTRICT` et le service d'effacement transférera
  d'abord les événements partagés à un autre participant (hors périmètre de cette mission).

### `DiveParticipation` → table `dive_participations`

| Propriété                         | Colonne                | Type         | Contraintes                                                                                                                              |
| --------------------------------- | ---------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| id                                | id                     | uuid         | PK, fourni par le client                                                                                                                 |
| diveEventId                       | dive_event_id          | uuid         | NOT NULL, `fk_dive_participations__dive_event_id` → dive_events(id) **ON DELETE CASCADE**                                                |
| diverId                           | diver_id               | uuid         | NOT NULL, `fk_dive_participations__diver_id` → divers(id) **ON DELETE CASCADE**                                                          |
| certificationLevelId              | certification_level_id | uuid         | NOT NULL, `fk_dive_participations__certification_level_id` → certification_levels(id) **ON DELETE RESTRICT** (snapshot, non indexée)     |
| maxDepthM                         | max_depth_m            | numeric(4,1) | NOT NULL, `ck_dive_participations__max_depth_m`: `max_depth_m > 0 AND max_depth_m <= 350`, transformer                                   |
| durationMin                       | duration_min           | smallint     | NOT NULL, `ck_dive_participations__duration_min`: `duration_min > 0 AND duration_min <= 1440`                                            |
| waterTemperatureC                 | water_temperature_c    | numeric(3,1) | NULL, `ck_dive_participations__water_temperature_c`: `water_temperature_c IS NULL OR water_temperature_c BETWEEN -5 AND 45`, transformer |
| visibilityM                       | visibility_m           | smallint     | NULL, `ck_dive_participations__visibility_m`: `visibility_m IS NULL OR visibility_m BETWEEN 0 AND 100`                                   |
| gasMix                            | gas_mix                | text         | NOT NULL, `ck_dive_participations__gas_mix`: `gas_mix IN ('AIR','NITROX32','NITROX36','OTHER')`                                          |
| hasDecompression                  | has_decompression      | boolean      | NOT NULL DEFAULT false                                                                                                                   |
| stopsOk                           | stops_ok               | boolean      | NOT NULL, **sans défaut** (ne déclare pas de `default` dans l'entité)                                                                    |
| notes                             | notes                  | text         | NULL, `ck_dive_participations__notes`: `notes IS NULL OR char_length(notes) <= 5000`                                                     |
| createdAt / updatedAt / deletedAt |                        | timestamptz  | voir principes                                                                                                                           |

- `uq_dive_participations__dive_event_id_diver_id` : `UNIQUE (dive_event_id, diver_id)` (**non**
  partiel : une participation retirée puis rajoutée est restaurée, pas recréée) ; couvre la FK
  `dive_event_id`.
- `uq_dive_participations__diver_id_id` : `UNIQUE (diver_id, id)` (cible de la FK composite de
  `dive_buddies` ; couvre la FK `diver_id`).
- `idx_dive_participations__diver_id_dive_event_id` : `(diver_id, dive_event_id) WHERE deleted_at IS NULL` — statistiques du dashboard.
- `idx_dive_participations__diver_id_updated_at_id` : `(diver_id, updated_at, id)` — pull.
- Type TS : `type GasMix = 'AIR' | 'NITROX32' | 'NITROX36' | 'OTHER'`.

### `DiveBuddy` → table `dive_buddies`

| Propriété       | Colonne          | Type | Contraintes                                                              |
| --------------- | ---------------- | ---- | ------------------------------------------------------------------------ |
| participationId | participation_id | uuid | PK (1/2)                                                                 |
| buddyId         | buddy_id         | uuid | PK (2/2)                                                                 |
| ownerId         | owner_id         | uuid | NOT NULL, `fk_dive_buddies__owner_id` → divers(id) **ON DELETE CASCADE** |

- PK `pk_dive_buddies (participation_id, buddy_id)`.
- `fk_dive_buddies__owner_id_participation_id` : (owner_id, participation_id) → dive_participations(diver_id, id) **ON DELETE CASCADE**.
- `fk_dive_buddies__owner_id_buddy_id` : (owner_id, buddy_id) → buddies(owner_id, id) **ON DELETE CASCADE**.
- `idx_dive_buddies__owner_id_buddy_id` : `(owner_id, buddy_id)`.
- Pas de `created_at` / `updated_at` / `deleted_at` : la palanquée est synchronisée avec sa
  participation.

## SQL brut à ajouter à la migration

```sql
-- updated_at maîtrisé par le serveur (curseur de synchronisation)
CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_certification_levels__set_updated_at BEFORE INSERT OR UPDATE ON certification_levels FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_divers__set_updated_at               BEFORE INSERT OR UPDATE ON divers               FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_dive_sites__set_updated_at           BEFORE INSERT OR UPDATE ON dive_sites           FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_buddies__set_updated_at              BEFORE INSERT OR UPDATE ON buddies              FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_dive_events__set_updated_at          BEFORE INSERT OR UPDATE ON dive_events          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_dive_participations__set_updated_at  BEFORE INSERT OR UPDATE ON dive_participations  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Un changement de palanquée fait remonter la participation dans le pull de synchronisation.
-- Pendant une cascade (suppression de compte, purge), la participation est déjà supprimée :
-- l'UPDATE ne touche aucune ligne (comportement vérifié, couvert par les tests).
CREATE FUNCTION touch_participation_on_buddies_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE dive_participations SET updated_at = clock_timestamp()
   WHERE id = COALESCE(NEW.participation_id, OLD.participation_id);
  RETURN NULL;
END $$;

CREATE TRIGGER trg_dive_buddies__touch_participation
  AFTER INSERT OR DELETE ON dive_buddies
  FOR EACH ROW EXECUTE FUNCTION touch_participation_on_buddies_change();

-- Référentiel : uniquement les niveaux attestés par les sources
INSERT INTO certification_levels (agency, code, label, rank) VALUES
  ('FFESSM', 'N1', 'Niveau 1', 10),
  ('FFESSM', 'N2', 'Niveau 2', 20),
  ('FFESSM', 'N3', 'Niveau 3', 30),
  ('FFESSM', 'N4', 'Niveau 4', 40);
```

Ajoute aussi en SQL brut tout ce que la génération n'a pas produit à l'identique : index partiels
(`WHERE …`), FK composites et leurs `ON DELETE`, défauts `uuidv7()`. Le `down()` supprime triggers
puis fonctions, puis tables dans l'ordre inverse.

## Invariants applicatifs (services)

Pas de contrôleur. Le propriétaire (`ownerId` / `creatorId` / `diverId`) est toujours un paramètre
fourni par l'appelant (la session, plus tard), jamais lu dans le payload.

1. **Upsert idempotent sans prise de contrôle** (sites, binômes, événements, participations) :
   `INSERT … ON CONFLICT (id) DO UPDATE SET … WHERE <table>.<propriétaire> = EXCLUDED.<propriétaire>` ;
   0 ligne affectée → erreur métier « conflit d'identifiant » (sans détail). Hors des cas ci-dessous,
   la dernière écriture reçue gagne (LWW par enregistrement).
2. **Suppression non annulable par un appareil en retard** (toutes les tables synchronisées) : chaque
   enregistrement écrit porte `baseUpdatedAt` (dernier `updated_at` serveur vu par le client, `null`
   pour une création). Si la ligne serveur est tombstonée, que son `updated_at > baseUpdatedAt` et
   que l'écriture envoie `deletedAt = null`, ne modifie rien et retourne
   `{ status: 'rejected', current: <état serveur> }`. Avec un `baseUpdatedAt` à jour, la restauration
   est acceptée.
3. **Horizon de purge** : toute écriture de synchronisation reçoit `lastPulledAt` (date du dernier
   pull réussi du client). Si `lastPulledAt` est antérieure à `now() - horizon` (90 jours par défaut,
   paramétrable), refuse l'écriture avec une erreur métier « synchronisation complète requise ».
4. **Plongée = agrégat** : `upsertDive(diverId, payload, lastPulledAt)`, où `payload` contient
   `event`, `participation`, `buddyIds` et les `baseUpdatedAt`, écrit l'événement, la participation
   et remplace l'ensemble des `dive_buddies` de la participation, **dans une seule transaction** (`DataSource.transaction`). Invariants MVP (en
   service, pas en SQL, car levés avec le partage) :
   - l'événement est créé par `diverId` (`creator_id = diverId`) et n'a qu'une participation, celle de
     `diverId` ; seul le créateur modifie l'événement, seul le plongeur concerné sa participation ;
   - **niveau de la participation** (snapshot, fixé à la saisie côté client) : le client envoie
     `certificationLevelId` avec la participation (le formulaire propose le niveau courant, le
     plongeur peut le modifier). Le service **conserve la valeur fournie telle quelle** : il ne la
     compare pas au niveau courant, accepte un niveau **désactivé** ou **supérieur** au niveau
     courant, et vérifie seulement qu'il existe (FK). Il ne copie `divers.certification_level_id`
     qu'**en l'absence** de valeur (`certificationLevelId` omis ou `null`). Le niveau n'est jamais
     resynchronisé quand le plongeur change de niveau ; une nouvelle écriture du plongeur peut le
     corriger. Motif : une plongée saisie hors ligne puis synchronisée après un changement de
     niveau, ou saisie a posteriori, recevrait sinon un niveau faux ;
   - si le site ou un binôme référencé est tombstoné, il est **restauré** (`deleted_at = null`) dans la
     même transaction (pas de référence vivante vers un parent supprimé) ;
   - une participation tombstonée pour le même `(dive_event_id, diver_id)` est restaurée, jamais
     recréée.
5. **Suppression d'une plongée** (MVP) : tombstone de l'événement **et** de la participation dans la
   même transaction.
6. **Suppression d'un binôme** : tombstone et retrait de ses lignes `dive_buddies` dans la même
   transaction. **Suppression d'un site** encore utilisé par un événement non supprimé : refusée
   (erreur métier).
7. **Niveau courant** : le niveau courant d'un plongeur (`divers.certification_level_id`) doit être
   actif (`is_active = true`) lorsqu'il est choisi. Ce contrôle ne s'applique **pas** au niveau d'une
   participation (invariant 4).
8. **Effacement du compte** : méthode `deleteAccount(diverId)` qui ouvre **une transaction** et y
   exécute `DELETE FROM divers WHERE id = …` (cascade physique, pas de tombstone). En MVP, rien
   d'autre : un événement n'a que la participation de son créateur, donc la règle « la suppression
   du compte du créateur n'efface jamais la participation des autres » est respectée d'office.
   **N'implémente pas** le transfert d'événement (conception cible de D-08, pour le partage) et ne
   change pas `fk_dive_events__creator_id` (reste `CASCADE`). Structure la méthode pour que le
   transfert puisse s'insérer **avant** le `DELETE`, dans la même transaction.
9. **Purge** (méthode de service, sans planificateur) : suppression physique des tombstones plus
   anciennes que l'horizon, dans l'ordre :
   1. `dive_participations` tombstonées ;
   2. `dive_events` tombstonés **sans participation restante** (`NOT EXISTS`) ;
   3. `buddies` tombstonés ;
   4. `dive_sites` tombstonés **sans aucun événement** (`NOT EXISTS`, tombstonés compris) ;
   5. jamais `certification_levels`.

   La purge ne doit jamais échouer sur un `RESTRICT`.

10. **Lecture pour la synchronisation** (méthodes de service, sans endpoint) : pull par table avec
    curseur `(updated_at, id)`, tombstones incluses ; événements dont le plongeur est créateur **ou**
    participant ; participations du plongeur avec leurs `buddyIds` ; `certification_levels` complet.
11. **Mapping contrat front** : `toUserLevel` / `toFederation` (voir Contraintes) et heure locale
    (`started_at` + `utc_offset_minutes`), en fonctions pures.

## Tests attendus

`pnpm test` doit continuer à tourner **sans base** (`ARCHITECTURE.md` §8) : les fonctions de mapping
y vont. Les tests de contraintes et de services ont besoin d'un vrai PostgreSQL 18 : ajoute un projet
Jest séparé `db` (script `test:db`, exclu de `test`) qui utilise la base du `docker compose` (une base
de test dédiée, migrations jouées en `beforeAll`). N'ajoute pas Testcontainers sans le signaler.

Contraintes :

- CHECK : bornes de profondeur / durée / température / visibilité / lat / lng /
  `utc_offset_minutes`, `gas_mix`, `rank`, `ck_buddies__not_self`.
- **`stops_ok` sans défaut** : un INSERT de participation sans `stops_ok` échoue (NOT NULL).
- Référentiel : le seed contient exactement les 4 niveaux FFESSM ; `UNIQUE (agency, code)` ;
  supprimer un niveau référencé par un plongeur ou une participation échoue (RESTRICT).
- FK composites : un événement ne peut pas référencer le site d'un autre plongeur ; une palanquée ne
  peut pas référencer le binôme ni la participation d'un autre plongeur.
- `UNIQUE (dive_event_id, diver_id)` : une seconde participation du même plongeur au même événement
  échoue, même si la première est tombstonée.
- Unicité partielle `uq_buddies__owner_id_linked_diver_id` (refus si vivant, accepté si l'autre est
  tombstoné).
- Triggers : `updated_at` avance à chaque UPDATE et ignore une valeur fournie ; ajouter ou retirer un
  binôme d'une participation avance `dive_participations.updated_at`.
- **Cascade + trigger, cas 1** : suppression d'un compte possédant sites, événements, participations,
  binômes et palanquées → tout est effacé sans erreur, et `linked_diver_id` des contacts des autres
  plongeurs passe à NULL.
- **Cascade + trigger, cas 2** : purge de participations ayant des palanquées, puis de leurs
  événements et sites → sans erreur, dans l'ordre prévu.

Services :

- upsert d'un id appartenant à un autre plongeur → refus ;
- `upsertDive` : transaction complète (échec d'une partie = rien d'écrit), remplacement de la
  palanquée ;
- niveau de participation **fourni** par le client → conservé tel quel, même s'il diffère du niveau
  courant du plongeur, y compris **supérieur** à celui-ci ;
- niveau de participation **désactivé** (`is_active = false`) fourni → accepté ;
- niveau de participation **absent** → copie de `divers.certification_level_id` ;
- changement ultérieur du niveau courant du plongeur → le niveau des participations existantes ne
  bouge pas ;
- choix d'un niveau **désactivé** comme niveau courant d'un plongeur → refusé ;
- `deleteAccount` : tout est effacé dans une transaction (même scénario que « cascade + trigger,
  cas 1 ») ;
- `upsertDive` référençant un site ou un binôme tombstoné → restaurés ;
- rejet d'une écriture `deletedAt = null` sur une tombstone plus récente que `baseUpdatedAt`, et
  acceptation avec un `baseUpdatedAt` à jour ;
- refus d'écriture si `lastPulledAt` est antérieure à l'horizon de purge ;
- refus de suppression d'un site utilisé ; suppression d'un binôme retire ses participations ;
- purge : ne supprime ni un événement ayant encore une participation, ni un site ayant encore un
  événement, ni un niveau.

## Définition de fini

- [ ] `pnpm migration:run` passe sur une base vide ; `pnpm migration:revert` aussi.
- [ ] Un nouveau `migration:generate` ne produit aucun diff.
- [ ] Toutes les contraintes, index, triggers et le seed ci-dessus existent en base, **noms compris**
      (vérifie via `pg_constraint`, `pg_indexes`, `pg_trigger`).
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` verts, plus
      `pnpm --filter api run test:db`.
- [ ] Aucun log ne contient de donnée de plongée ni de paramètre SQL.
- [ ] `ARCHITECTURE.md` : ajoute une décision (§10) résumant la stratégie offline (UUIDv7 client,
      `updated_at` serveur par trigger, tombstones et horizon de purge à 90 jours, LWW par
      enregistrement avec protection des suppressions, plongée = événement + participation) et mets à
      jour §7/§8 (migration initiale, `test:db`).
- [ ] En fin de tâche, liste les écarts à cette spécification et les questions (défaut `uuidv7()`, FK
      composites mal générées par TypeORM, contrat front `UserLevel` / `utcOffsetMinutes`).

---

# Mission 2 : champs du détail de plongée (évolution du schéma)

> Destiné à l'agent **Backend NestJS Expert**. Prompt autonome. Mode **évolution** : les 7 tables
> existent (migrations `InitDiveLogSchema`, `AddDiveSiteLocality`) ; ne recrée rien.

## Contexte

La page « Détail d'une plongée » du front (`/dives/:diveId`, `GET /api/dives/:id`) ne montre que ce
que sert le contrat `DiveDetail`. La maquette affiche bien plus : type de mise à l'eau, conditions,
équipement, palier de sécurité, successive, espèces observées, zone du site, niveau des binômes.
Ces données ont été modélisées le 2026-11-16 : décisions **D-13 à D-22**, règles **RG-23 à RG-30**,
hypothèses **H-17, H-18** dans `docs/data-model/decisions.md` et `schema.md`, qui font foi en cas
d'ambiguïté. Lis aussi `ARCHITECTURE.md` (source de vérité, §7 migrations, §9 RGPD) et `CLAUDE.md`
avant de commencer ; en cas de conflit avec ce prompt, arrête-toi et signale-le.

Rappel du découpage (D-08) : **événement** (`dive_events`, commun à la palanquée, modifiable par le
seul créateur) / **participation** (`dive_participations`, propre au plongeur) / **palanquée**
(`dive_buddies`, synchronisée avec la participation).

## Règles de la mission

- **Toutes les nouvelles colonnes sont nullables et sans défaut** (pas de `default` dans les
  entités) : `NULL` = non renseigné. Les plongées existantes n'ont pas ces données ; aucun backfill.
- Conventions de la mission initiale (voir plus haut) : `name:` explicite sur chaque colonne,
  contraintes et index **nommés** et déclarés dans les entités (`@Check`, `@Unique`, `@Index`,
  `foreignKeyConstraintName`, `primaryKeyConstraintName`) pour qu'un `migration:generate` ne
  produise **aucun diff** ; `numericTransformer` (`common/database/numeric.transformer.ts`) sur
  chaque colonne `numeric` ; listes fermées en `text` + `@Check` + union de littéraux (pas d'`enum`).
- **N'ajoute aucun champ** absent de cette spécification (ni hélium, ni plusieurs blocs, ni détail
  des paliers de déco, ni consommation en L/min, ni heure de sortie, ni bar consommés : les deux
  derniers sont **calculés**). S'il te semble en manquer un, signale-le en fin de tâche.
- **RGPD** (§9) : pressions, paliers, successive, températures, lest sont des données de santé ;
  structure et zone des données de localisation ; niveau d'un binôme une donnée de tiers. Aucune
  valeur dans les logs, `logging: false` reste en place.

## Ordre d'implémentation

1. Colonnes de `DiveSite`, `DiveEvent`, `DiveParticipation`, `Buddy`.
2. Entité `DiveObservation` (`dive-observation.entity.ts` dans le module `dives`), enregistrée dans
   `TypeOrmModule.forFeature`.
3. `pnpm --filter api run migration:generate src/database/migrations/AddDiveDetailFields`, relecture,
   puis SQL brut du trigger. **Une seule migration** (D-22). `down()` complet et symétrique.
4. Types d'écriture (`dive.types.ts`), `upsertDive`, pull, lecture du détail, mapper.
5. Seed de développement, puis tests.

## Spécification des colonnes

### `dive_sites`

| Propriété | Colonne | Type | Contrainte                                                                                |
| --------- | ------- | ---- | ----------------------------------------------------------------------------------------- |
| area      | area    | text | NULL, `ck_dive_sites__area`: `area IS NULL OR char_length(btrim(area)) BETWEEN 1 AND 120` |

Mer ou zone (« Méditerranée »), texte libre comme `region` (D-20).

### `dive_events`

| Propriété       | Colonne           | Type         | Contrainte (`x IS NULL OR …`)                                                      |
| --------------- | ----------------- | ------------ | ---------------------------------------------------------------------------------- |
| entryType       | entry_type        | text         | `ck_dive_events__entry_type`: `IN ('BOAT','SHORE')`                                |
| timeOfDay       | time_of_day       | text         | `ck_dive_events__time_of_day`: `IN ('DAY','NIGHT')`                                |
| weather         | weather           | text         | `ck_dive_events__weather`: `IN ('SUNNY','CLOUDY','OVERCAST','RAIN')`               |
| airTemperatureC | air_temperature_c | numeric(3,1) | `ck_dive_events__air_temperature_c`: `BETWEEN -40 AND 60`, transformer             |
| seaState        | sea_state         | text         | `ck_dive_events__sea_state`: `IN ('CALM','SLIGHT','MODERATE','ROUGH')`             |
| currentStrength | current_strength  | text         | `ck_dive_events__current_strength`: `IN ('NONE','WEAK','MODERATE','STRONG')`       |
| diveCenter      | dive_center       | text         | `ck_dive_events__dive_center`: `char_length(btrim(dive_center)) BETWEEN 1 AND 120` |

Écris chaque `CHECK` sous la forme complète `x IS NULL OR <condition>`.

### `dive_participations`

| Propriété                | Colonne                     | Type         | Contrainte (`x IS NULL OR …`)                                                                                                                |
| ------------------------ | --------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| surfaceWaterTemperatureC | surface_water_temperature_c | numeric(3,1) | `ck_dive_participations__surface_water_temperature_c`: `BETWEEN -5 AND 45`                                                                   |
| safetyStopDurationMin    | safety_stop_duration_min    | smallint     | `ck_dive_participations__safety_stop_duration_min`: `(> 0 AND <= 60 AND < duration_min)`                                                     |
| safetyStopDepthM         | safety_stop_depth_m         | numeric(3,1) | `ck_dive_participations__safety_stop_depth_m`: `(> 0 AND <= 20 AND <= max_depth_m)`                                                          |
| isRepetitive             | is_repetitive               | boolean      | aucune ; **sans défaut**                                                                                                                     |
| o2Percent                | o2_percent                  | numeric(4,1) | `ck_dive_participations__o2_percent`: `(gas_mix = 'OTHER' AND o2_percent > 0 AND o2_percent <= 100)`                                         |
| tankVolumeL              | tank_volume_l               | numeric(3,1) | `ck_dive_participations__tank_volume_l`: `(> 0 AND <= 30)`                                                                                   |
| tankMaterial             | tank_material               | text         | `ck_dive_participations__tank_material`: `IN ('STEEL','ALUMINIUM')`                                                                          |
| startPressureBar         | start_pressure_bar          | smallint     | `ck_dive_participations__start_pressure_bar`: `(> 0 AND <= 350)`                                                                             |
| endPressureBar           | end_pressure_bar            | smallint     | `ck_dive_participations__end_pressure_bar`: `(BETWEEN 0 AND 350 AND (start_pressure_bar IS NULL OR end_pressure_bar <= start_pressure_bar))` |
| suitType                 | suit_type                   | text         | `ck_dive_participations__suit_type`: `IN ('WET','SEMI_DRY','DRY')`                                                                           |
| suitThicknessMm          | suit_thickness_mm           | numeric(3,1) | `ck_dive_participations__suit_thickness_mm`: `(> 0 AND <= 15)`                                                                               |
| weightKg                 | weight_kg                   | numeric(3,1) | `ck_dive_participations__weight_kg`: `BETWEEN 0 AND 40`                                                                                      |

Plus une contrainte de table : `ck_dive_participations__safety_stop` :
`(safety_stop_duration_min IS NULL) = (safety_stop_depth_m IS NULL)` (palier complet ou absent).

`o2_percent` n'existe que pour `gas_mix = 'OTHER'` : pour Air et Nitrox, le pourcentage découle du
mélange (21, 32, 36) et n'est jamais stocké (3FN). La température au fond reste
`water_temperature_c`.

### `buddies`

| Propriété            | Colonne                | Type | Contrainte                                                                                   |
| -------------------- | ---------------------- | ---- | -------------------------------------------------------------------------------------------- |
| certificationLevelId | certification_level_id | uuid | NULL, `fk_buddies__certification_level_id` → certification_levels(id) **ON DELETE RESTRICT** |

Niveau **courant** du contact, déclaré par son propriétaire (D-21). Un niveau désactivé est admis.
FK **non indexée** (niveaux jamais supprimés, comme les deux autres FK de niveau). Ne lis
**jamais** le niveau du compte lié (`linked_diver_id`) : lier un contact ne partage rien (RG-10).

### Nouvelle table `dive_observations` → entité `DiveObservation`

| Propriété       | Colonne          | Type     | Contrainte                                                                                         |
| --------------- | ---------------- | -------- | -------------------------------------------------------------------------------------------------- |
| participationId | participation_id | uuid     | PK (1/2), `fk_dive_observations__participation_id` → dive_participations(id) **ON DELETE CASCADE** |
| position        | position         | smallint | PK (2/2), `ck_dive_observations__position`: `position BETWEEN 0 AND 49`                            |
| label           | label            | text     | NOT NULL, `ck_dive_observations__label`: `char_length(btrim(label)) BETWEEN 1 AND 80`              |
| count           | count            | smallint | NULL, `ck_dive_observations__count`: `count IS NULL OR count BETWEEN 1 AND 9999`                   |

- PK `pk_dive_observations (participation_id, position)` ; `uq_dive_observations__participation_id_label`
  : `UNIQUE (participation_id, label)`.
- Ni `created_at`, ni `updated_at`, ni `deleted_at` : la table est synchronisée **avec sa
  participation**, comme `dive_buddies`. Pas d'`owner_id` (une seule FK, la propriété est vérifiée
  sur la participation).
- Aucun index supplémentaire : la PK couvre la FK.

## SQL brut à ajouter à la migration

La fonction existante `touch_participation_on_buddies_change()` ne lit que `participation_id` : on
la **réutilise**.

```sql
-- Un changement d'observations fait remonter la participation dans le pull de synchronisation.
CREATE TRIGGER trg_dive_observations__touch_participation
  AFTER INSERT OR UPDATE OR DELETE ON dive_observations
  FOR EACH ROW EXECUTE FUNCTION touch_participation_on_buddies_change();
```

`down()` : `DROP TRIGGER` d'abord, puis la table, puis les colonnes et contraintes. **Ne supprime
pas** la fonction, qui appartient à `InitDiveLogSchema`.

## Invariants applicatifs (services)

1. **Agrégat** : `DiveWrite` gagne `observations: readonly { label: string; count: number | null }[]`.
   `upsertDive` écrit l'événement, la participation, **remplace l'ensemble** des `dive_buddies`
   **et** des `dive_observations` de la participation, dans **la même transaction**. La
   `position` est l'index dans le tableau reçu (0 à 49). Le libellé est normalisé par `btrim`
   avant écriture ; deux libellés identiques après normalisation → erreur métier (pas de 500 sur
   l'`UNIQUE`). Plus de 50 observations → erreur métier.
2. **Tous les champs sont requis à l'écriture** (D-22) : les types d'écriture
   (`DiveEventWrite`, `DiveParticipationWrite`, l'écriture d'un site et d'un binôme) déclarent
   chaque nouveau champ **obligatoire**, typé `T | null` (pas de propriété optionnelle `?`). Les
   futurs DTO de synchronisation refuseront (400) un champ absent ; un `null` explicite efface. La
   règle vaut aussi pour `locality` (site), qui ne doit plus être optionnelle.
3. **Champs de l'événement** (type, moment, conditions, structure) : seul le créateur les écrit
   (invariant MVP déjà en place, RG-17 / RG-29).
4. **Pull** : les nouvelles colonnes remontent avec leur table ; les participations remontent avec
   leurs `buddyIds` **et** leurs `observations` (triées par `position`) ; les binômes avec leur
   `certificationLevelId`.
5. **Rien à calculer ni stocker côté serveur** pour la successive (déclarée, D-17), le % O₂ d'Air
   ou de Nitrox, les bar consommés, l'heure de sortie.

## Lecture du détail (`GET /api/dives/:id`)

- La requête du détail (`DiveLogService.findOne`) lit les nouvelles colonnes de l'événement, de la
  participation et du site, plus le niveau de la participation (`certification_levels` par
  `p.certification_level_id`), `p.created_at` et `GREATEST(e.updated_at, p.updated_at)`.
- La requête de la palanquée joint en plus `certification_levels` en **LEFT JOIN** par
  `buddies.certification_level_id`.
- Une requête de plus pour les observations de la participation, `ORDER BY position`.
- **La liste (`GET /api/dives`, `DiveSummary`) ne change pas** (D-25 : poids de la liste).
- Contrat front `DiveDetail` : voir la section « Contrat » ci-dessous (ajoutée après validation de
  la phase 2 de la modélisation). Le mapper (`dive-contract.mapper.ts`, `DiveDetailRow`) convertit
  les `numeric` en `number`, et les dates en ISO.

## Seed de développement

Remplis les nouveaux champs pour une partie des plongées du carnet fictif (dont la plongée la plus
récente, sur le modèle de la maquette : bateau, jour, ensoleillé, air 19 °C, mer calme, courant
faible, « Calvi Plongée », surface 16 °C, palier 3 min à 5 m, non successive, bloc 12 L acier,
200 → 60 bar, combinaison 7 mm semi-étanche, espèces « Mérou brun » × 2, « Barracudas »,
« Gorgones rouges », « Corb », « Murène »), donne une zone aux sites et un niveau à quelques
binômes. **Laisse au moins une plongée sans aucun nouveau champ**, pour tester le rendu partiel.
Données fictives uniquement ; le seed ne logge que des compteurs.

## Tests attendus

`test:db` (PostgreSQL 18) :

- chaque nouveau `CHECK` : une valeur hors bornes échoue, `NULL` passe ; en particulier :
  - `o2_percent` refusé avec `gas_mix = 'AIR'`, accepté avec `OTHER` ;
  - `end_pressure_bar > start_pressure_bar` refusé, `end` seul accepté ;
  - palier incomplet (durée sans profondeur) refusé ; profondeur de palier > `max_depth_m`
    refusée ; durée de palier ≥ `duration_min` refusée ;
- `dive_observations` : `UNIQUE (participation_id, label)`, `position` 50 refusée, cascade à la
  suppression physique de la participation (purge et effacement du compte) ;
- trigger : ajouter, modifier ou retirer une observation fait avancer
  `dive_participations.updated_at` ; pas d'erreur pendant une cascade ;
- `fk_buddies__certification_level_id` : supprimer un niveau référencé par un binôme échoue ;
- migration : noms des contraintes (`pg_constraint`), trigger (`pg_trigger`), `revert` propre ;
- services : `upsertDive` remplace les observations (ordre conservé), refuse un doublon et plus de
  50 observations, sans rien écrire (transaction) ; le pull renvoie les observations ; le détail
  renvoie les nouveaux champs, le niveau des binômes et `null` partout sur une plongée ancienne.

`test` (sans base) : mapper (numeric → number, `null` conservés, observations triées, `updatedAt`
= le plus récent des deux), e2e `GET /api/dives/:id` avec le nouveau contrat.

## Définition de fini

- [ ] `pnpm migration:run` puis `pnpm migration:revert` passent ; un nouveau `migration:generate`
      ne produit aucun diff.
- [ ] Contraintes, trigger et table présents en base, **noms compris**.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` verts, plus
      `pnpm --filter api run test:db`.
- [ ] Aucun log ne contient de donnée de plongée ni de paramètre SQL.
- [ ] `ARCHITECTURE.md` : §7 (migration `AddDiveDetailFields`), §8 (tests), §6 (contrat
      `DiveDetail`) et §11 (« Issus du détail de plongée » : retirer ce qui est servi par l'API).
- [ ] En fin de tâche, liste les écarts à cette spécification et les questions (valeurs des listes
      fermées H-18, normalisation de la casse des espèces).
