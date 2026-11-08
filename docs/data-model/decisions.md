# Décisions de modélisation — E-Deep (carnet de plongée)

> Complète `schema.md`. Version initiale : 2026-11-07. Révision : 2026-11-07
> (`correction-modele-e-deep.md`, validée par le porteur : D-08 à D-12), puis RG-22 (transfert à la
> suppression du compte créateur) et origine client du niveau de participation (D-09). Mode création.
> Décisions prises avec le porteur du projet : Q1 sites privés, Q2 binôme = contact avec lien
> optionnel vers un compte, Q3 LWW par enregistrement.

## Constats préalables

- **Écrans disponibles** : le dashboard seulement (nominal, vide, chargement, mobile, drawer). Les
  autres routes (`/dives`, `/dives/new`, `/dives/:diveId`, `/map`, `/stats`, `/buddies`, `/search`,
  `/notifications`, `/settings`) sont des placeholders. Le modèle couvre donc le contrat
  `DashboardPayload` (`apps/web/src/features/dashboard/types.ts`), pas encore le formulaire de
  saisie : il faudra le rejouer quand « Nouvelle plongée » sera maquetté.
- **Backoffice** (`apps/admin`) : seule la page santé existe. Il ne révèle aucune donnée
  administrable. Les listes fermées restent des `CHECK` (D-06), sauf les niveaux de certification,
  devenus un référentiel (D-09) dont l'administration viendra plus tard.
- **Offline-first** : ni Dexie, ni IndexedDB, ni service worker dans le code ; la doc dit seulement
  « PWA à terme ». Les choix de synchronisation (D-02, D-03, D-04, D-08, D-12) sont donc des
  décisions nouvelles. **Ils devront être reportés dans `ARCHITECTURE.md` §10** (source de vérité)
  avant l'implémentation.
- **Carte** : la demande mentionne Leaflet, la doc projet prévoit MapLibre GL
  (`apps/web/design/README.md` §5.3, `ARCHITECTURE.md` §11). Le choix n'a **aucun impact** sur le
  schéma (lat/lng dans les deux cas), mais il est à trancher et à aligner dans la doc.

## Hypothèses

| Id   | Hypothèse                                                                                                                                                                                                                         | Impact si fausse                                                                 | À valider avec                                                                          |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| H-01 | Un compte = un plongeur ; pas d'organisation (club, structure) ni de multi-tenant                                                                                                                                                 | Ajout d'une table `clubs` (voir évolutions D-08)                                 | Produit                                                                                 |
| H-02 | Les comptes sont créés **en ligne** (inscription) ; seuls sites, plongées et binômes se créent hors ligne                                                                                                                         | Si création de compte hors ligne : `divers.id` généré client aussi               | Produit                                                                                 |
| H-03 | L'identité d'authentification (email, fournisseur OAuth…) sera ajoutée avec le module auth ; elle n'est pas modélisée ici faute de source                                                                                         | Ajout de colonnes / table `auth_identities` (migration additive)                 | Tech                                                                                    |
| H-04 | Un site peut exister sans événement (créé avant, ou dont les plongées ont été supprimées)                                                                                                                                         | Si interdit : nettoyage applicatif des sites orphelins                           | Produit                                                                                 |
| H-05 | Lier un binôme à un compte E-Deep **ne partage rien** : le compte lié ne voit pas les plongées du propriétaire. Un propriétaire ne lie un compte qu'à un seul de ses contacts. Le lien se fait **en ligne** (recherche du compte) | Partage → participations partagées avec consentement (évolutions D-08)           | Produit + DPO                                                                           |
| H-06 | ~~Le niveau affiché sur « Dernière plongée » est le niveau courant~~                                                                                                                                                              | —                                                                                | **Résolue par D-09** : snapshot du niveau sur la participation                          |
| H-07 | Température et visibilité sont **facultatives** (souvent non relevées), alors que le type front les déclare obligatoires. Profondeur, durée, mélange, paliers, site et date restent obligatoires                                  | Passer les colonnes en `NOT NULL`                                                | Produit                                                                                 |
| H-08 | Une participation peut n'avoir aucun binôme saisi                                                                                                                                                                                 | Si au moins un binôme est obligatoire : invariant applicatif                     | Produit                                                                                 |
| H-09 | `Buddy.accentColor` est de la présentation, dérivée de l'id côté front ; elle n'est pas stockée                                                                                                                                   | Colonne `avatar_color` si l'utilisateur choisit la couleur                       | Design                                                                                  |
| H-10 | Bornes de saisie : prof. 0–350 m, durée 1–1440 min, temp. -5–45 °C, visibilité 0–100 m, noms 1–100/120 caractères, notes ≤ 5000                                                                                                   | Ajuster les `CHECK`                                                              | Produit                                                                                 |
| H-11 | Supprimer un site utilisé par un événement non supprimé est refusé (409) ; l'utilisateur doit d'abord changer le site des plongées                                                                                                | Si cascade souhaitée : tombstoner les plongées en même temps                     | Produit                                                                                 |
| H-12 | Les tombstones sont purgées physiquement après **90 jours** (horizon de purge) ; un client dont le dernier pull est plus ancien refait une synchronisation complète avant tout push (D-12 d)                                      | Durée à ajuster ; sans purge, les tombstones s'accumulent (RGPD)                 | Tech + DPO                                                                              |
| H-13 | ~~Les dates sont affichées dans le fuseau de l'appareil qui consulte~~                                                                                                                                                            | —                                                                                | **Résolue par D-10** : `dive_events.utc_offset_minutes`                                 |
| H-14 | Volume par plongeur : quelques centaines à quelques milliers de plongées. Les statistiques se calculent à la volée                                                                                                                | Au-delà : agrégats mensuels ou copie de `started_at` (D-08)                      | Tech                                                                                    |
| H-15 | ~~Le niveau snapshot d'une participation peut référencer un niveau désactivé ; seul le niveau courant doit être actif~~                                                                                                           | —                                                                                | **Résolue par D-09** (révision : niveau fixé à la saisie, désactivé ou supérieur admis) |
| H-16 | En MVP, supprimer une plongée tombstone à la fois l'événement et la participation (le créateur est l'unique participant)                                                                                                          | Avec le partage : retirer sa participation sans toucher à l'événement des autres | Produit                                                                                 |

## Décisions

### D-01 — Coordonnées : colonnes `latitude` / `longitude` en `numeric`, sans PostGIS

- **Contexte** : la carte du dashboard affiche des marqueurs (compteur, prof. max par site), un
  popover, une emprise fixe et des filtres de période (1M/3M/1A/Tout). La future page `/map` est un
  placeholder. Aucun écran ne montre de recherche par proximité, de rayon, de zone dessinée ni de
  calcul de distance. Sites privés : quelques dizaines à centaines par plongeur.
- **Options étudiées** :
  - **PostGIS `geography(Point, 4326)` + GiST** : utile pour `ST_DWithin` ou des polygones, mais
    l'extension est inutile pour de l'affichage et pèse sur l'image, les migrations et TypeORM.
  - `point` natif PG : sémantique cartésienne, ambiguïté lat/lng, mal supporté par TypeORM.
  - `double precision` : simple, mais précision non bornée et arrondis visibles à la saisie.
  - **`numeric(8,6)` / `numeric(9,6)`** : 6 décimales (≈ 11 cm), bornes vérifiées par `CHECK`.
- **Décision** : `numeric(8,6)` / `numeric(9,6)` + `CHECK` de bornes WGS84. Pas d'index spatial :
  tous les sites d'un plongeur sont chargés d'un coup, le front gère l'emprise et le regroupement.
- **Conséquences** : TypeORM renvoie `numeric` en `string` → `ValueTransformer` commun vers `number`.
- **Réversibilité** : élevée. Passage à PostGIS par colonne générée
  `geography(Point,4326) GENERATED ALWAYS AS (ST_MakePoint(longitude, latitude)::geography) STORED`
  - GiST, le jour où une recherche par proximité ou un catalogue partagé de sites apparaît.

### D-02 — Identifiants : UUIDv7 générés par le client pour les données saisies hors ligne

- **Contexte** : sites, événements, participations et binômes se créent hors ligne dans IndexedDB ;
  une plongée référence un site et des binômes créés dans la même session hors ligne. Les ids sont
  exposés dans les URL (`/dives/:diveId`).
- **Options étudiées** : `bigint identity` + id temporaire client (remapping des FK, fragile) ;
  UUIDv4 client (index dispersés) ; **UUIDv7 client** (générable hors ligne, ordonné dans le temps).
- **Décision** : `dive_sites.id`, `dive_events.id`, `dive_participations.id`, `buddies.id` = `uuid`
  **sans défaut en base**, fourni par le client (UUIDv7). `divers.id` et `certification_levels.id` =
  `uuid DEFAULT uuidv7()` (natif PostgreSQL 18), créés côté serveur.
- **Conséquences / sécurité** : le serveur valide le format et **n'accepte jamais** qu'un upsert
  modifie une ligne d'un autre propriétaire : `INSERT … ON CONFLICT (id) DO UPDATE … WHERE
  <table>.<propriétaire> = EXCLUDED.<propriétaire>` (`owner_id`, `creator_id` ou `diver_id`) ; 0 ligne
  affectée → refus sans détail. Le propriétaire vient toujours de la session.
- **Identifiant de la plongée côté front** : `/dives/:diveId` porte l'id de l'**événement** ; la
  participation est retrouvée par `(dive_event_id, diver_id = moi)`.
- **Réversibilité** : faible (les ids sont publics), mais aucune raison d'en changer.

### D-03 — Synchronisation : `updated_at` serveur, tombstones, LWW par enregistrement

- **Contexte** : offline-first ; plusieurs appareils par plongeur ; décision Q3 : LWW par
  enregistrement. Complétée par D-12.
- **Options étudiées** : verrou optimiste (`version` + 409, écarté par le porteur) ; LWW par champ
  (trop lourd) ; arbitrage par horloge client (horloges faussées) ; **LWW par enregistrement, ordre
  d'arrivée au serveur**.
- **Décision** :
  - `updated_at timestamptz NOT NULL`, posé par un **trigger** `clock_timestamp()` à chaque INSERT et
    UPDATE ; la valeur envoyée par le client est ignorée. C'est le curseur de synchronisation.
  - `deleted_at timestamptz NULL` (tombstone) sur `dive_sites`, `dive_events`,
    `dive_participations`, `buddies`. Une suppression est un UPDATE : elle avance `updated_at` et
    remonte dans le pull.
  - **Push** : le client envoie des enregistrements complets, chacun avec son `base_updated_at`
    (D-12 a) ; le serveur upserte (D-02) et écrase. Une plongée se pousse comme un agrégat (D-08).
  - **Pull** : par table, curseur `(updated_at, id) > (:cursorAt, :cursorId)` dans la portée du
    plongeur, tri `ORDER BY updated_at, id`, pagination `LIMIT n`, **tombstones incluses**, dans
    l'ordre :
    1. `certification_levels` : pull **complet** (petite table en lecture seule, mise en cache) ;
    2. `dive_sites` et `buddies` : `owner_id = :me` ;
    3. `dive_events` : événements dont je suis **créateur ou participant**
       (`creator_id = :me OR id IN (SELECT dive_event_id FROM dive_participations WHERE diver_id = :me)`) ;
       en MVP, les deux ensembles coïncident ;
    4. `dive_participations` : `diver_id = :me`, avec les lignes `dive_buddies` des participations
       remontées.
  - Fenêtre de sécurité : le client repart de `cursorAt - 5 s` et ses upserts locaux sont
    idempotents (une transaction peut être validée après une autre au `updated_at` plus récent).
  - **Purge** : voir D-12 c et d.
- **Conséquences** :
  - Limite assumée : une modification faite hors ligne **plus tôt** mais synchronisée **plus tard**
    écrase une modification plus récente d'un autre appareil — sauf pour les suppressions (D-12 a).
  - Pas de `@DeleteDateColumn` TypeORM : le pull lit les tombstones ; les lectures métier filtrent
    `deleted_at IS NULL` explicitement.
- **Réversibilité** : élevée (`version int` ou `client_updated_at` additifs).

### D-04 — Palanquée : jonction pure synchronisée avec la participation, FK composites par propriétaire

> Révisée par D-08 : la palanquée est rattachée à la **participation**, plus à la plongée.

- **Contexte** : `Dive.buddies` (« avec L. Bernard & T. Nguyen »), `Buddy.sharedDives` ; n:n sans
  attribut visible. Les binômes sont des contacts privés : ils appartiennent au plongeur participant,
  pas à l'événement (avec le partage, chaque participant aura ses propres contacts).
- **Options étudiées** : `uuid[]` sur la participation (pas de FK, 1FN) ; jonction avec ses propres
  `updated_at` / `deleted_at` (synchronisation ligne à ligne, plus de code client) ; **jonction pure,
  synchronisée avec la participation** (le client envoie `buddyIds[]`, le serveur remplace
  l'ensemble dans la même transaction).
- **Décision** : `dive_buddies(participation_id, buddy_id)` PK composite + `owner_id` copié pour deux
  FK composites `(owner_id, participation_id)` → `dive_participations(diver_id, id)` et
  `(owner_id, buddy_id)` → `buddies(owner_id, id)`. Trigger `touch_participation_on_buddies_change`
  pour que tout changement de palanquée fasse avancer `dive_participations.updated_at`.
- **Conséquences** : violation 2FN volontaire (`owner_id` dépend de `participation_id`), sans risque
  d'incohérence : toute valeur divergente viole une FK. La base garantit qu'une participation ne
  référence jamais le binôme d'un autre plongeur. `UNIQUE (diver_id, id)` et `UNIQUE (owner_id, id)`
  redondants avec les PK, nécessaires comme cibles de FK.
- **Réversibilité** : élevée.

### D-05 — Binôme : contact privé avec lien optionnel vers un compte (réflexive portée par le contact)

- **Contexte** : décision Q2. Saisir un binôme sans compte (hors ligne, sans son consentement) et,
  plus tard, lier ce contact à un compte E-Deep.
- **Options étudiées** : contacts seuls (trop limité) ; réflexive `diver_buddies` seule (impossible
  pour les non-inscrits) ; **contact + `linked_diver_id` nullable**.
- **Décision** : `buddies.linked_diver_id → divers.id ON DELETE SET NULL`, `CHECK <> owner_id`,
  unicité partielle `(owner_id, linked_diver_id)` sur les contacts vivants. Le contact garde ses
  propres prénom/nom.
- **Conséquences** :
  - Suppression d'un contact : tombstone **et** retrait de ses lignes `dive_buddies` dans la même
    transaction (statistiques cohérentes ; le trigger fait remonter les participations touchées).
  - RGPD : noms de **tiers** saisis par le plongeur. Si un compte lié est supprimé, le lien tombe
    (`SET NULL`), le contact reste dans le carnet du propriétaire.
  - Le lien `linked_diver_id` est le point d'entrée naturel de l'invitation future (D-08 évolutions).
- **Réversibilité** : élevée.

### D-06 — Listes fermées en `text + CHECK`, `region` en texte libre

> Révisée par D-09 : niveau et fédération ne sont plus des listes fermées.

- **Contexte** : le mélange vient d'une union TypeScript ; aucun backoffice ne l'administre. La
  région est affichée mais ne sert ni de filtre ni de référentiel.
- **Décision** : `gas_mix` en `text` + `CHECK (x IN (...))`, union de littéraux dans
  `@e-deep/shared` (pas d'`enum` TS, `ARCHITECTURE.md` §6). `region` reste un texte libre.
- **Options rejetées** : enum PG natif (retrait de valeur pénible) ; table de référence (aucune
  administration, aucune donnée portée).
- **Évolution** : mélanges personnalisés → table de référence ou gaz détaillés (évolutions).

### D-07 — Suppression et RGPD

- Suppression utilisateur d'un site, d'une plongée ou d'un binôme : tombstone (D-03), purgée après
  l'horizon de purge (D-12 c).
- Suppression du compte (droit à l'effacement, art. 17) : `DELETE FROM divers` → `CASCADE` sur
  sites, événements créés, participations, binômes et palanquées ; `SET NULL` sur les contacts
  d'autres plongeurs liés à ce compte. Effacement **physique** immédiat (`divers` n'a pas de
  `deleted_at`). **Correct en MVP seulement** (un événement n'a que la participation de son
  créateur). Avec le partage, RG-22 s'applique : les événements qui ont d'autres participations sont
  d'abord transférés (D-08 évolutions).
- **Copie du site lors d'un transfert** (RG-22) : le site copié dans les sites du nouveau
  propriétaire relève des données des **participants restants**, pas de celles du compte effacé. Le
  lieu d'une plongée qu'ils ont faite fait partie de leur propre carnet ; la copie ne conserve que
  nom, région et coordonnées, sans aucun lien vers le compte supprimé. L'effacement du compte reste
  complet : sa ligne `divers`, son site d'origine, sa participation et ses palanquées disparaissent.
- `dive_participations` et `dive_buddies` contiennent des **données de santé** ; `dive_events`
  (date, lieu) en dépend. Jamais dans les logs, accès restreint par l'API (`ARCHITECTURE.md` §9).
  `notes` est du texte libre susceptible de contenir des informations médicales.
- Sauvegardes : la purge doit être prise en compte dans la rétention des sauvegardes (hors schéma).

### D-08 — Plongée découpée en événement partagé + participations

- **Contexte** : objectif produit futur (clubs) : une plongée saisie par un plongeur apparaîtra dans
  le carnet de chaque membre inscrit de la palanquée ; site et date modifiables par le créateur
  seul, données personnelles (profondeur, durée…) corrigeables par chacun. E-Deep étant
  offline-first, découper la table centrale plus tard imposerait de migrer IndexedDB sur chaque
  appareil et de versionner le protocole de synchronisation. Décision du porteur : découper **dès la
  migration initiale**.
- **Options étudiées** :
  - Table `dives` unique, découpage plus tard : simple aujourd'hui, mais migration de données
    client + version de protocole demain.
  - **`dive_events` + `dive_participations`** : l'événement porte ce qui est commun (site, date,
    heure locale), la participation ce que chaque ordinateur mesure ou que chacun saisit.
- **Décision** :
  - `dive_events(id, creator_id, site_id, started_at, utc_offset_minutes, …)` ; le site est celui du
    créateur (FK composite `(creator_id, site_id)` → `dive_sites(owner_id, id)` RESTRICT).
  - `dive_participations` porte `dive_event_id`, `diver_id`, `certification_level_id` et les
    données propres au plongeur (`max_depth_m`, `duration_min`, `water_temperature_c`,
    `visibility_m`, `gas_mix`, `has_decompression`, `stops_ok`, `notes`) ;
    `UNIQUE (dive_event_id, diver_id)` (tombstones incluses : une participation retirée puis
    rajoutée est **restaurée**) ; `UNIQUE (diver_id, id)` comme cible de FK.
  - **Invariants MVP dans les services, pas en SQL** (ils seront levés avec le partage) : un
    événement a exactement une participation, celle de son créateur ; seul le créateur modifie
    l'événement, seul le plongeur concerné sa participation.
  - **Contrat d'API inchangé** pour le front : une « plongée » = événement + ma participation +
    `buddyIds`, écrite d'un bloc par `upsertDive` dans une transaction.
- **`started_at` : jointure, pas de copie.**
  - Besoin : « dernière plongée », « 14 jours depuis », histogramme mensuel, filtres de période et
    record de profondeur lisent la date (événement) et les mesures (participation).
  - Coût de la jointure au volume H-14 (≤ quelques milliers de participations par plongeur) : le
    plan part de `idx_dive_participations__diver_id_dive_event_id` (participations vivantes du
    plongeur), joint `dive_events` par clé primaire (nested loop ou hash join sur quelques milliers
    de lignes), puis trie ou agrège en mémoire. Ordre de grandeur : la milliseconde, sans index sur
    `started_at`.
  - Copie maintenue par trigger : dénormalisation (trigger sur `dive_events` qui réécrit toutes les
    participations), et surtout chaque changement de date ferait avancer le `updated_at` de **toutes**
    les participations — avec le partage, celles des autres plongeurs, d'où du trafic de
    synchronisation et des conflits LWW inutiles.
  - **Choix : jointure seule**, avec `idx_dive_participations__diver_id_dive_event_id` (partiel
    `deleted_at IS NULL`). Si un plongeur dépasse largement H-14 ou si une liste paginée par date
    devient lente, on ajoutera la copie `started_at` (trigger) ou un index couvrant ; décision
    réversible sans migration client (colonne serveur uniquement).
- **Conséquences** :
  - Une plongée vivante = participation **et** événement non supprimés ; toutes les requêtes
    joignent les deux.
  - Suppression d'une plongée en MVP : tombstone de l'événement et de la participation dans la même
    transaction (H-16).
  - Le pull lit les événements dont je suis créateur ou participant (D-03).
- **Réversibilité** : élevée côté serveur ; c'est justement l'irréversibilité côté client
  (IndexedDB, protocole) qui motive la décision.
- **Évolutions prévisibles (non modélisées)** :
  - **Statut d'invitation** sur la participation (`pending` / `accepted` / `declined`) :
    consentement obligatoire, puisqu'il s'agit de données de santé d'un tiers ; une participation
    créée par un autre ne devient visible dans le carnet qu'une fois acceptée.
  - **Pull élargi** aux événements créés par d'autres. Point à traiter : le site d'un événement est
    un site **privé** du créateur (Q1) ; les autres participants devront lire ce site (exposition en
    lecture seule) ou recevoir un snapshot (nom, région, coordonnées) sur l'événement.
  - **Clubs et rôles** (directeur de plongée saisissant pour la palanquée) : table `clubs`,
    appartenances, droit de création de participations pour autrui.
  - **Suppression du compte du créateur (RG-22)** : elle ne doit jamais effacer la participation
    des autres plongeurs, car c'est une plongée qu'ils ont faite et elle reste dans leur carnet.
    Conception cible, dans le service d'effacement, **avant** le `DELETE FROM divers` et dans la
    même transaction :
    1. pour chaque événement du créateur qui a au moins une **autre participation vivante**,
       désigner le nouveau propriétaire (règle ci-dessous) ;
    2. copier le site du créateur dans les sites du nouveau propriétaire, avec un **nouvel id**
       (UUIDv7 généré par le serveur) et les mêmes `name`, `region`, `latitude`, `longitude` ;
    3. repointer l'événement : `creator_id` = nouveau propriétaire, `site_id` = site copié (une
       seule mise à jour, pour respecter la FK composite) ; les triggers font avancer `updated_at`
       de l'événement et du site, qui remontent dans le pull du nouveau propriétaire ;
    4. les événements sans autre participation vivante sont supprimés normalement par la cascade.

    **Règle de désignation proposée** : le participant dont la participation vivante est la plus
    ancienne (`created_at` le plus petit, puis `id` pour départager), c'est-à-dire le premier à
    avoir rejoint la plongée après le créateur. Elle est déterministe, ne dépend d'aucun rôle (les
    clubs ne sont pas modélisés) et pourra être remplacée par « directeur de plongée, sinon le plus
    ancien » quand les rôles existeront. Un événement dont les autres participations sont toutes
    tombstonées est supprimé, avec ces tombstones.

    Si plusieurs événements du créateur partagent le même site et le même nouveau propriétaire, le
    site n'est copié qu'une fois. On ne cherche pas à fusionner avec un site existant du nouveau
    propriétaire : la déduplication des sites reste une affaire d'UX (pas d'unicité sur le nom).

    **Au passage au partage**, `fk_dive_events__creator_id` passera de `CASCADE` à `RESTRICT` :
    filet de sécurité, sans perte de données. Un événement non transféré par oubli fera échouer la
    suppression du compte au lieu d'effacer silencieusement les plongées des autres. Les événements
    sans autre participation seront alors supprimés explicitement par le service avant le
    `DELETE FROM divers`. **Le MVP garde `CASCADE`** : un événement n'y a que la participation de
    son créateur, donc RG-22 est trivialement respectée.

### D-09 — Référentiel des niveaux de certification

- **Contexte** : la version précédente avait `level IN ('N1'…'N4')` et
  `federation IN ('FFESSM','CMAS','OTHER')` indépendants, alors que le niveau détermine la fédération
  (« N2 » est forcément FFESSM). Dépendance transitive `level → federation` (violation 3FN) :
  « N2 · CMAS » était accepté, « 2 étoiles · CMAS » impossible. Par ailleurs le badge « Air · N2 » de
  la dernière plongée doit refléter le niveau **au moment de la plongée** : le carnet sert à justifier
  l'expérience pour passer un niveau (H-06).
- **Options étudiées** : deux `CHECK` indépendants (statu quo, faux) ; `CHECK` sur le couple
  (liste figée en migration, illisible) ; **table de référence**.
- **Décision** :
  - `certification_levels` : `id uuid DEFAULT uuidv7()`, `agency`, `code`, `label`,
    `rank smallint`, `is_active boolean DEFAULT true`, `created_at`, `updated_at` ;
    `UNIQUE (agency, code)`. `rank` permet de comparer des niveaux d'organismes différents.
  - `divers.certification_level_id NOT NULL` → RESTRICT (niveau courant). Un niveau obsolète se
    **désactive**, il ne se supprime pas ; seul un niveau actif peut être choisi comme niveau courant.
  - `dive_participations.certification_level_id NOT NULL` → RESTRICT : **snapshot** du niveau au
    moment de la plongée. Résout **H-06**.
  - **Origine du snapshot** _(révision du porteur)_ : le niveau est fixé **à la saisie, côté
    client**. Le formulaire propose le niveau courant du plongeur (profil et référentiel en cache),
    le plongeur peut le modifier, et le client l'envoie avec la participation. Le serveur conserve
    la valeur fournie telle quelle et ne copie `divers.certification_level_id` qu'**en l'absence**
    de valeur. Le niveau n'est jamais mis à jour quand le plongeur change de niveau ; il reste
    corrigeable par le plongeur.
    - **Pourquoi pas une copie serveur systématique** : une plongée saisie hors ligne puis
      synchronisée après un changement de niveau, ou saisie a posteriori (carnet papier rattrapé,
      plongée d'il y a deux ans), recevrait le niveau courant au moment de la synchronisation, donc
      un niveau faux.
    - **Valeurs admises** : une participation peut référencer un niveau **désactivé** (historique)
      ou **supérieur** au niveau courant (correction, déclaration a posteriori). Seul le niveau
      **courant** du plongeur (`divers.certification_level_id`) doit être actif lorsqu'il est
      choisi. Résout **H-15** et la question ouverte n° 16.
  - Lecture seule côté client, mise en cache pour le hors ligne, pull complet (D-03). Administration
    au backoffice plus tard.
  - Contrat front conservé : l'API continue de servir `User.level` (= `code`) et `User.federation`
    (= `agency` si `FFESSM` ou `CMAS`, sinon `OTHER`), dérivés du référentiel.
- **Données initiales** : la migration n'insère que ce que les sources attestent : FFESSM N1 à N4
  (`rank` 10, 20, 30, 40, espacés pour intercaler). **Liste complémentaire proposée, à valider par le
  porteur, non insérée** (rangs = équivalence approximative d'autonomie / profondeur) :

  | agency | code          | label                     | rank proposé | Équivalence indicative  |
  | ------ | ------------- | ------------------------- | ------------ | ----------------------- |
  | CMAS   | 1*            | Plongeur 1 étoile         | 10           | N1                      |
  | CMAS   | 2*            | Plongeur 2 étoiles        | 20           | N2                      |
  | CMAS   | 3*            | Plongeur 3 étoiles        | 30           | N3                      |
  | CMAS   | 4*            | Plongeur 4 étoiles        | 40           | N4                      |
  | PADI   | OWD           | Open Water Diver          | 10           | PE20                    |
  | PADI   | AOWD          | Advanced Open Water Diver | 15           | PE40 encadré            |
  | PADI   | RESCUE        | Rescue Diver              | 18           | —                       |
  | PADI   | DM            | Divemaster                | 40           | N4 / guide de palanquée |
  | SSI    | OWD           | Open Water Diver          | 10           | PE20                    |
  | SSI    | AA            | Advanced Adventurer       | 15           | PE40 encadré            |
  | SSI    | STRESS_RESCUE | Stress & Rescue           | 18           | —                       |
  | SSI    | DIVE_GUIDE    | Dive Guide                | 40           | N4 / guide de palanquée |

  Les niveaux FFESSM intermédiaires (PE20, PE40, PA20, PA40, PE60, PA60…) et les niveaux d'encadrement
  (E1–E4, MF1, MF2) ne sont pas dans les sources : à décider avec le porteur.

- **Conséquences** :
  - `UserLevel = 'N1' | 'N2' | 'N3' | 'N4'` côté front ne pourra pas représenter les niveaux non
    FFESSM : le type devra s'élargir dès qu'un niveau de la liste complémentaire est inséré.
  - Les FK vers `certification_levels` ne sont pas indexées (niveaux jamais supprimés, voir
    `schema.md` §6).
- **Réversibilité** : élevée.
- **Évolution** : plusieurs certifications par plongeur, table `diver_certifications` (`diver_id`,
  `certification_level_id`, `obtained_on`), le niveau courant devenant le plus haut `rank` ou un
  choix explicite.

### D-10 — Heure locale de la plongée : décalage UTC sur l'événement

- **Contexte** : une plongée de 21 h en mer Rouge consultée depuis Paris doit s'afficher 21 h, et le
  bon jour (le jour change pour une plongée de nuit à l'étranger). `started_at` en `timestamptz` ne
  garde que l'instant. Résout **H-13**.
- **Options étudiées** :
  - Rien de plus (affichage dans le fuseau de l'appareil) : faux dès qu'on plonge hors de son fuseau.
  - **Fuseau IANA** (`Africa/Cairo`) : indispensable pour des événements **récurrents** ou **futurs**
    (règles d'heure d'été appliquées plus tard), mais ici on ne note que des instants **passés**. Il
    faudrait aussi le déterminer (depuis les coordonnées du site ou l'appareil) et stocker des
    règles qui peuvent changer.
  - **Décalage en minutes** : suffit à reconstituer l'heure locale d'un instant passé, compact,
    validable par `CHECK`, et le client le connaît toujours (`-new Date().getTimezoneOffset()`).
- **Décision** : `dive_events.utc_offset_minutes smallint NOT NULL CHECK (BETWEEN -720 AND 840)`
  (UTC-12 à UTC+14). Le client propose le décalage de l'appareil au moment de la saisie ; le créateur
  peut le corriger (plongée saisie au retour de voyage). Affichage : `started_at + utc_offset_minutes`.
  L'histogramme mensuel regroupe par mois **local**.
- **Réversibilité** : le **schéma** est réversible (on peut ajouter un fuseau IANA plus tard), mais
  pas les **données** : une information jamais capturée est perdue pour toutes les plongées déjà
  saisies (on ne saura pas reconstituer l'heure locale d'une plongée enregistrée sans décalage).
  D'où une colonne obligatoire dès la migration initiale.

### D-11 — `stops_ok` sans valeur par défaut

- **Contexte** : la version précédente avait `stops_ok DEFAULT true`. Un défaut affirmerait
  « paliers respectés » (donnée de sécurité, données de santé) sans que l'information ait été saisie.
- **Décision** : `stops_ok boolean NOT NULL` **sans défaut** : la saisie est imposée par la base (un
  INSERT sans `stops_ok` échoue) et l'entité TypeORM ne déclare pas de `default`.
  `has_decompression` garde son défaut `false` (non mentionné par la révision).

### D-12 — Règles de synchronisation complémentaires

Complète D-03. Aucune colonne nouvelle : `base_updated_at` et la date du dernier pull sont des champs
du **protocole**. Les endpoints sont hors périmètre de la mission backend actuelle ; les services et
leurs tests en font partie.

- **a. Une suppression ne peut pas être annulée par un appareil en retard.** Chaque enregistrement
  poussé porte `base_updated_at` (le dernier `updated_at` serveur vu par le client). Si la ligne
  serveur est tombstonée, que son `updated_at > base_updated_at` et que le client envoie
  `deleted_at = null`, le serveur **conserve la tombstone**, renvoie l'état serveur et signale
  l'écriture comme rejetée. Une restauration volontaire reste possible : elle porte un
  `base_updated_at` à jour. S'applique à toutes les tables synchronisées (RG-20). Exception assumée à
  LWW.
- **b. Pas de référence vivante vers un parent supprimé.** Quand `upsertDive` référence un site ou
  des binômes tombstonés (supprimés sur un autre appareil pendant que celui-ci était hors ligne), il
  les **restaure** (`deleted_at = null`) dans la même transaction (RG-21). Cette restauration est une
  conséquence de l'écriture d'un enfant vivant : elle ne passe pas par la règle a.
- **c. La purge ne bute jamais sur un RESTRICT.** Purge physique des tombstones plus anciennes que
  l'horizon (90 jours, H-12), dans l'ordre :
  1. `dive_participations` tombstonées (cascade `dive_buddies`) ;
  2. `dive_events` tombstonés **sans participation restante** ;
  3. `buddies` tombstonés (cascade `dive_buddies`, déjà vidées par D-05) ;
  4. `dive_sites` tombstonés **sans aucun événement** (`NOT EXISTS`, tombstonés compris) ;
  5. `certification_levels` : jamais purgés.
- **d. Horizon de purge.** Le client transmet la date de son dernier pull réussi. Si elle est
  antérieure à l'horizon de purge, le serveur **refuse le push** et exige d'abord une synchronisation
  complète ; sinon il recréerait des enregistrements purgés (l'upsert d'un id inconnu est une
  création).
- **e. Triggers et cascades.** `touch_participation_on_buddies_change` se déclenche aussi pendant les
  cascades (suppression de compte, purge), après la suppression de la participation : son UPDATE ne
  touche alors aucune ligne. Vérifié sur PostgreSQL 18 (prototype en transaction annulée, deux ordres
  de création des contraintes) : la suppression d'un compte avec site, événement, participation,
  binôme et palanquée réussit, y compris avec la FK `RESTRICT` événement → site, et le trigger ne
  lève pas d'erreur. Aucune protection supplémentaire n'est donc ajoutée ; deux tests explicites
  (suppression de compte, purge) la garantissent dans le temps. Si un test échoue un jour, protéger
  le trigger en ignorant les participations absentes ou tombstonées, et documenter ici.

## Dénormalisations et snapshots

| Donnée copiée                    | Où                    | Type                             | Mécanisme                                                                                                                                                                         |
| -------------------------------- | --------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `owner_id`                       | `dive_buddies`        | dénormalisation de contrôle      | fourni par le service ; cohérence garantie par les FK composites                                                                                                                  |
| `certification_level_id`         | `dive_participations` | **snapshot** (donnée historique) | fixé à la saisie par le client (niveau courant proposé, modifiable) ; copie serveur du niveau courant seulement en l'absence de valeur ; corrigeable, jamais resynchronisé (D-09) |
| `updated_at` de la participation | `dive_participations` | propagation                      | trigger `touch_participation_on_buddies_change`                                                                                                                                   |

Aucun compteur stocké ; `started_at` n'est pas copié dans les participations (D-08).

## Validation par écran

« Vivant » = `p.deleted_at IS NULL AND e.deleted_at IS NULL` (`p` participation, `e` événement).

| Écran / bloc                                                   | Tables lues                                                                                                                                     | Requêtes                                                                                   | Verdict                                                                                                     |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| UserCard « Marine Rousseau · N2 · FFESSM », « Bonjour Marine » | divers ⋈ certification_levels                                                                                                                   | 1 (PK + PK)                                                                                | OK                                                                                                          |
| KPI « Plongées totales », « Temps sous l'eau »                 | dive_participations ⋈ dive_events                                                                                                               | 1 agrégat                                                                                  | OK, `idx_dive_participations__diver_id_dive_event_id` + PK événement                                        |
| KPI « Profondeur max » (+ site, date)                          | dive_participations ⋈ dive_events ⋈ dive_sites                                                                                                  | 1 (`ORDER BY max_depth_m DESC LIMIT 1`)                                                    | OK                                                                                                          |
| KPI « Sites explorés · 6 régions »                             | dive_participations ⋈ dive_events ⋈ dive_sites                                                                                                  | 1 (`COUNT(DISTINCT e.site_id)`, `COUNT(DISTINCT region)`)                                  | OK                                                                                                          |
| Carte (marqueurs, popover, filtres de période)                 | dive_sites ⟕ (dive_events ⋈ dive_participations)                                                                                                | 1 (`GROUP BY e.site_id`, `COUNT`, `MAX(p.max_depth_m)`, `e.started_at >= now() - période`) | OK, jointure ≤ 3 tables ; pas de PostGIS                                                                    |
| Dernière plongée (badges « Palier OK », « Air · N2 », binômes) | dive_participations ⋈ dive_events ⋈ dive_sites ⋈ certification_levels ; dive_buddies ⋈ buddies                                                  | 2 (`ORDER BY e.started_at DESC LIMIT 1`, puis binômes de la participation)                 | OK : tri en mémoire sur ≤ quelques milliers de lignes (D-08) ; 4 tables mais toutes par PK sauf la première |
| Plongées par mois (12 mois, mois local), « +3 ce mois »        | dive_participations ⋈ dive_events                                                                                                               | 1 (`date_trunc('month', e.started_at + e.utc_offset_minutes * interval '1 minute')`)       | OK                                                                                                          |
| « 14 jours depuis ta dernière plongée »                        | dive_participations ⋈ dive_events                                                                                                               | inclus dans la requête « Dernière plongée »                                                | OK                                                                                                          |
| Binômes fréquents                                              | dive_buddies ⋈ buddies ⋈ dive_participations ⋈ dive_events                                                                                      | 1 (`GROUP BY buddy_id ORDER BY count DESC`)                                                | OK, `idx_dive_buddies__owner_id_buddy_id`                                                                   |
| État vide                                                      | dive_participations                                                                                                                             | `EXISTS`                                                                                   | OK                                                                                                          |
| Synchronisation (pull)                                         | certification_levels, dive_sites, buddies, dive_events, dive_participations, dive_buddies                                                       | 1 par table                                                                                | OK, index `(…, updated_at, id)` ; `dive_events` via `creator_id` en MVP                                     |
| Synchronisation (push d'une plongée)                           | dive_events, dive_participations, dive_buddies (+ dive_sites, buddies si restauration D-12 b ; divers si le niveau de participation est absent) | 1 transaction                                                                              | OK                                                                                                          |
| Effacement du compte (MVP ; cible RG-22 avec le partage)       | divers (+ cascade) ; cible : dive_participations, dive_sites, dive_events avant le `DELETE`                                                     | 1 transaction                                                                              | OK en MVP ; cible : 1 requête par événement partagé (désignation, copie du site, repointage)                |

Le payload `GET /api/dashboard` se construit en ~7 requêtes indexées. Le découpage D-08 ajoute une
jointure par PK à chaque requête de statistiques, sans coût mesurable au volume H-14.

## Questions ouvertes

Données de plongée absentes des sources, **non ajoutées** :

1. **Gaz** : `OTHER` perd l'information. Pourcentage d'O₂/He, plusieurs blocs (volume, pression
   début/fin), plusieurs mélanges par plongée ?
2. **Paliers** : seuls deux booléens. Faut-il le détail (profondeur × durée), l'ordinateur ou les
   tables utilisées, le profil importé ?
3. **Matériel** (combinaison, lestage, ordinateur), **type de plongée** (exploration, formation,
   nuit, épave…), **rôle** dans la palanquée (guide, encadrant, élève), **conditions** (courant,
   météo).
4. **Incidents** et données médicales (`ARCHITECTURE.md` §9) : entité dédiée, accès renforcé ?
5. **Authentification** : email, fournisseur, rôles (admin du backoffice) ? (H-03)
6. **Notifications** (cloche avec pastille) : quel contenu ? (invitations à une plongée partagée ?)
7. **Recherche** : sur quoi (sites, notes, binômes) ? Déterminera `pg_trgm` ou plein texte.
8. **`stats.mainArea`** (« Méditerranée » / « Méditerranée occidentale ») : saisie, calculée ou
   constante ? Aucun champ « zone » n'existe sur les sites.
9. **Région** : le mock donne « Calvi, Corse » pour le site s1 dans `lastDive` et « Corse » dans
   `sites`. Texte libre unique, ou découpage localité / région ?
10. ~~**Fuseau**~~ : résolue par D-10.
11. **Lien binôme ↔ compte** : comment trouver un compte (pseudo, email, QR code), faut-il son
    consentement pour être lié ? Le même consentement servira à l'invitation (D-08). (H-05)
12. **Filtres de période de la carte** : portent-ils sur la date des plongées (hypothèse retenue) ?
13. **Avatar** : URL externe ou fichier uploadé (table `media`, stockage objet) ?
14. **Carte** : Leaflet ou MapLibre GL ? (sans impact sur le schéma)
15. **Niveaux de certification** : valider la liste complémentaire et les rangs (D-09) ; ajouter les
    niveaux FFESSM intermédiaires et d'encadrement ?
16. ~~**Niveau snapshot corrigé**~~ : résolue par D-09 (niveau désactivé ou supérieur au niveau
    courant accepté sur une participation).

## Évolutions prévisibles

- **Partage de plongées entre membres d'un club** (D-08) : statut d'invitation sur la participation
  avec consentement, pull élargi aux événements créés par d'autres (et exposition ou snapshot du site
  privé du créateur), clubs et rôles, transfert de propriété de l'événement et copie du site à la
  suppression du compte du créateur (RG-22), puis passage de `fk_dive_events__creator_id` en
  `RESTRICT`.
- **Plusieurs certifications par plongeur** : `diver_certifications` (D-09).
- **Catalogue partagé de sites** : `catalog_sites` (backoffice) + `dive_sites.catalog_site_id`
  nullable ; PostGIS devient pertinent (recherche de proximité, déduplication) (D-01).
- **Gaz détaillés** : table `dive_tanks` (`participation_id`, `position`, `volume_l`, `o2_pct`,
  `he_pct`, `start_bar`, `end_bar`) en remplacement de `gas_mix` (seulement si la question ouverte n° 1 le confirme).
- **Profil de plongée importé** (ordinateur) : séries temporelles par participation, en `jsonb` ou
  table dédiée ; volumétrie à évaluer.
- **Conflits** : `client_updated_at` ou `version` si la limite de D-03 gêne en pratique.
- **Statistiques lourdes** : copie de `started_at` dans la participation (trigger) ou agrégats
  mensuels si le volume dépasse H-14 (D-08).
