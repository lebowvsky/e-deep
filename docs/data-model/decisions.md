# Décisions de modélisation — E-Deep (carnet de plongée)

> Complète `schema.md`. Version initiale : 2026-11-07. Révision : 2026-11-07
> (`correction-modele-e-deep.md`, validée par le porteur : D-08 à D-12), puis RG-22 (transfert à la
> suppression du compte créateur) et origine client du niveau de participation (D-09). Mode création.
> Décisions prises avec le porteur du projet : Q1 sites privés, Q2 binôme = contact avec lien
> optionnel vers un compte, Q3 LWW par enregistrement.
> **Révision du 2026-11-16** (mode évolution) : champs de la page « Détail d'une plongée »
> (D-13 à D-22, H-17, H-18), à partir de `evolution-champs-detail-plongee.md`. Réponses du
> porteur : niveau des autres membres sur le contact, détail des paliers de déco reporté, tous les
> champs obligatoires au push.
> **Révision du 2026-11-18** : API d'écriture des plongées (D-23 à D-26) ; le porteur garde LWW
> strict en ligne (D-25).
> **Numérotation** : les décisions du modèle s'écrivent `D-xx` (avec tiret) ; celles
> d'`ARCHITECTURE.md` §10 s'écrivent `Dxx` (sans tiret). D-13 à D-22 ici ne sont pas D13 à D22
> là-bas.

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

| Id   | Hypothèse                                                                                                                                                                                                                                                                                                                                                                                           | Impact si fausse                                                                 | À valider avec                                                                          |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| H-01 | Un compte = un plongeur ; pas d'organisation (club, structure) ni de multi-tenant                                                                                                                                                                                                                                                                                                                   | Ajout d'une table `clubs` (voir évolutions D-08)                                 | Produit                                                                                 |
| H-02 | Les comptes sont créés **en ligne** (inscription) ; seuls sites, plongées et binômes se créent hors ligne                                                                                                                                                                                                                                                                                           | Si création de compte hors ligne : `divers.id` généré client aussi               | Produit                                                                                 |
| H-03 | L'identité d'authentification (email, fournisseur OAuth…) sera ajoutée avec le module auth ; elle n'est pas modélisée ici faute de source                                                                                                                                                                                                                                                           | Ajout de colonnes / table `auth_identities` (migration additive)                 | Tech                                                                                    |
| H-04 | Un site peut exister sans événement (créé avant, ou dont les plongées ont été supprimées)                                                                                                                                                                                                                                                                                                           | Si interdit : nettoyage applicatif des sites orphelins                           | Produit                                                                                 |
| H-05 | Lier un binôme à un compte E-Deep **ne partage rien** : le compte lié ne voit pas les plongées du propriétaire. Un propriétaire ne lie un compte qu'à un seul de ses contacts. Le lien se fait **en ligne** (recherche du compte)                                                                                                                                                                   | Partage → participations partagées avec consentement (évolutions D-08)           | Produit + DPO                                                                           |
| H-06 | ~~Le niveau affiché sur « Dernière plongée » est le niveau courant~~                                                                                                                                                                                                                                                                                                                                | —                                                                                | **Résolue par D-09** : snapshot du niveau sur la participation                          |
| H-07 | Température et visibilité sont **facultatives** (souvent non relevées), alors que le type front les déclare obligatoires. Profondeur, durée, mélange, paliers, site et date restent obligatoires                                                                                                                                                                                                    | Passer les colonnes en `NOT NULL`                                                | Produit                                                                                 |
| H-08 | Une participation peut n'avoir aucun binôme saisi                                                                                                                                                                                                                                                                                                                                                   | Si au moins un binôme est obligatoire : invariant applicatif                     | Produit                                                                                 |
| H-09 | `Buddy.accentColor` est de la présentation, dérivée de l'id côté front ; elle n'est pas stockée                                                                                                                                                                                                                                                                                                     | Colonne `avatar_color` si l'utilisateur choisit la couleur                       | Design                                                                                  |
| H-10 | Bornes de saisie : prof. 0–350 m, durée 1–1440 min, temp. -5–45 °C, visibilité 0–100 m, noms 1–100/120 caractères, notes ≤ 5000                                                                                                                                                                                                                                                                     | Ajuster les `CHECK`                                                              | Produit                                                                                 |
| H-11 | Supprimer un site utilisé par un événement non supprimé est refusé (409) ; l'utilisateur doit d'abord changer le site des plongées                                                                                                                                                                                                                                                                  | Si cascade souhaitée : tombstoner les plongées en même temps                     | Produit                                                                                 |
| H-12 | Les tombstones sont purgées physiquement après **90 jours** (horizon de purge) ; un client dont le dernier pull est plus ancien refait une synchronisation complète avant tout push (D-12 d)                                                                                                                                                                                                        | Durée à ajuster ; sans purge, les tombstones s'accumulent (RGPD)                 | Tech + DPO                                                                              |
| H-13 | ~~Les dates sont affichées dans le fuseau de l'appareil qui consulte~~                                                                                                                                                                                                                                                                                                                              | —                                                                                | **Résolue par D-10** : `dive_events.utc_offset_minutes`                                 |
| H-14 | Volume par plongeur : quelques centaines à quelques milliers de plongées. Les statistiques se calculent à la volée                                                                                                                                                                                                                                                                                  | Au-delà : agrégats mensuels ou copie de `started_at` (D-08)                      | Tech                                                                                    |
| H-15 | ~~Le niveau snapshot d'une participation peut référencer un niveau désactivé ; seul le niveau courant doit être actif~~                                                                                                                                                                                                                                                                             | —                                                                                | **Résolue par D-09** (révision : niveau fixé à la saisie, désactivé ou supérieur admis) |
| H-16 | En MVP, supprimer une plongée tombstone à la fois l'événement et la participation (le créateur est l'unique participant)                                                                                                                                                                                                                                                                            | Avec le partage : retirer sa participation sans toucher à l'événement des autres | Produit                                                                                 |
| H-17 | Bornes des champs du détail : air -40–60 °C, eau en surface -5–45 °C, palier de sécurité 1–60 min et 0–20 m, bloc 0–30 L et 0–350 bar, combinaison 0–15 mm, lest 0–40 kg, O₂ 0–100 %, effectif 1–9999, étiquette 1–80 caractères, structure et zone 1–120 caractères                                                                                                                                | Ajuster les `CHECK` (migration)                                                  | Produit                                                                                 |
| H-18 | Valeurs des listes fermées, dont la maquette ne montre qu'un exemple : météo `SUNNY` (Ensoleillé), `CLOUDY` (Nuageux), `OVERCAST` (Couvert), `RAIN` (Pluie) ; mer `CALM` (Calme), `SLIGHT` (Peu agitée), `MODERATE` (Agitée), `ROUGH` (Forte) ; courant `NONE` (Nul), `WEAK` (Faible), `MODERATE` (Moyen), `STRONG` (Fort) ; combinaison `WET` (Humide), `SEMI_DRY` (Semi-étanche), `DRY` (Étanche) | Modifier les `CHECK` et les unions avant la première saisie réelle (D-14)        | **Validée** (2026-11-17) : valeurs et libellés retenus tels quels                       |

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

> Révisée par D-09 : niveau et fédération ne sont plus des listes fermées. Confirmée et étendue par
> D-14 (listes du détail de plongée).

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
- **Évolution du détail de plongée** (D-13 à D-21) :
  - **données de santé** (`S`) : température de surface, palier de sécurité, successive, % O₂,
    pressions du bloc et lest (ce dernier renseigne sur la corpulence) ;
  - **localisation** (`L`) : `dive_events.dive_center` et `dive_sites.area` (habitudes de lieu) ;
  - **donnée personnelle d'un tiers** (`P`) : `buddies.certification_level_id`, le niveau d'un
    contact déclaré par le propriétaire, sans consentement du contact. Il suit le contact (effacé
    avec lui ou avec le compte du propriétaire) ;
  - **sans classification propre** (`—`) : conditions de l'événement, matériel (bloc,
    combinaison), observations d'espèces. Elles vivent dans des lignes déjà classées `S` ou `L` et
    suivent les mêmes règles (jamais dans les logs, accès par l'API seulement).
  - `dive_observations` est effacée par cascade avec sa participation (purge, compte).
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

### D-13 — Type de plongée et conditions sur l'événement

- **Contexte** : la page de détail affiche une étiquette « Bateau » et une carte « Conditions »
  (« Bateau · jour », « Ensoleillé · Air 19 °C », mer « Calme », courant « Faible »). Sa spec range
  ces données dans l'événement partagé. Règle de placement (D-08) : un champ va dans `dive_events`
  seulement s'il est commun à toute la palanquée et modifiable par le seul créateur.
- **Options étudiées** :
  - **sur l'événement** : une même mise à l'eau, une même météo et une même mer pour toute la
    palanquée ;
  - sur la participation : chacun pourrait noter « son » courant, mais la donnée serait dupliquée
    entre membres et divergerait au partage ;
  - **moment dérivé** de l'heure locale (`started_at + utc_offset_minutes`) : une plongée de nuit
    se **déclare** (elle commence au crépuscule, l'heure du coucher du soleil dépend du site et de
    la saison). La déduire demanderait un calcul solaire, faux aux heures limites.
- **Décision** : sur `dive_events`, toutes nullables et sans défaut :
  - `entry_type` (`BOAT`, `SHORE`) ;
  - `time_of_day` (`DAY`, `NIGHT`), saisi ; le formulaire pourra proposer une valeur selon l'heure,
    que le créateur confirme ;
  - `weather`, `sea_state`, `current_strength` (listes fermées, D-14, valeurs H-18). Le nom
    `current_strength` évite `current`, ambigu en SQL (`CURRENT_DATE`, `CURRENT_USER`…) ;
  - `air_temperature_c numeric(3,1)`.
- **Conséquences** :
  - seul le créateur modifie ces champs (RG-29) ; en MVP, le créateur est l'unique participant ;
  - « Dupliquer » une plongée copiera type et conditions (spec), c'est l'affaire du formulaire ;
  - la température de l'**eau** reste sur la participation (mesurée par l'ordinateur de chacun),
    la température de l'**air** est commune (relevé de surface).
- **Réversibilité** : élevée (colonnes nullables).

### D-14 — Listes fermées en `text + CHECK`, pas de tables de référence

Réponse à la question 1 de la note d'évolution. Confirme D-06.

- **Contexte** : météo, état de la mer, courant, type de mise à l'eau, moment, matière du bloc et
  type de combinaison sont des listes courtes, sans attribut, qu'aucun backoffice n'administre.
- **Options étudiées** :
  - **table de référence** (comme les niveaux, D-09) : administrable et traduisible en base, mais
    elle ajoute une table au pull, un cache hors ligne et des FK. Or ces valeurs ne portent aucune
    donnée (pas de rang, d'organisme ni de désactivation) ;
  - enum PostgreSQL : retirer une valeur est pénible (D-06) ;
  - **`text + CHECK`** avec des codes neutres en anglais.
- **Décision** : `text + CHECK (x IS NULL OR x IN (...))` ; union de littéraux dans
  `@e-deep/shared` (pas d'`enum` TS) ; **libellés français côté front**, comme `gas_mix`
  (`labels.ts`). La traduction est donc une affaire de présentation, et une seconde langue ne
  touche pas la base.
- **Conséquences** :
  - ajouter une valeur = migration (`DROP`/`ADD CONSTRAINT`) + union du contrat + guard du front.
    **Ordre de déploiement : le front d'abord**, car un guard qui ne connaît pas une valeur rejette
    la réponse (hors contrat) ;
  - retirer une valeur demande de reprendre les données existantes : à éviter, d'où la validation
    des valeurs (H-18) avant la première saisie réelle.
- **Réversibilité** : élevée. Passage à une table de référence le jour où une liste devient
  administrable (backoffice) ou porte des attributs.

### D-15 — Équipement et gaz à plat sur la participation

Réponse à la question 2 de la note d'évolution.

- **Contexte** : la carte « Équipement & gaz » affiche gaz et % O₂ (« Air · 21 % O₂ »), bloc
  (« 12 L · acier »), pressions (« 200 → 60 bar · 140 bar consommés »), combinaison (« 7 mm ·
  semi-étanche ») et lest. « Dupliquer » doit préremplir l'équipement (séjour de plusieurs
  plongées).
- **Options étudiées** :
  - **colonnes plates** sur `dive_participations` : une plongée = un équipement ;
  - entité réutilisable (« mon bloc 12 L acier », « ma combi 7 mm ») : aucun écran ne gère un
    inventaire, et elle ajoute une table synchronisée, des FK et la question de l'historique (une
    combinaison modifiée réécrirait les anciennes plongées, ou demanderait un snapshot) ;
  - table `dive_tanks` (plusieurs blocs) : aucune source ne montre plus d'un bloc ;
  - consommation en L/min : refusée par la spec (fausse sans profondeur moyenne).
- **Décision** :
  - `tank_volume_l numeric(3,1)`, `tank_material` (`STEEL`, `ALUMINIUM`) ;
  - `start_pressure_bar`, `end_pressure_bar smallint`, avec `end <= start` quand les deux sont
    saisies (RG-24). Les bar consommés sont **calculés**, jamais stockés ;
  - `suit_type` (`WET`, `SEMI_DRY`, `DRY`), `suit_thickness_mm numeric(3,1)` ;
  - `weight_kg numeric(3,1)` ;
  - `o2_percent numeric(4,1)` **réservé au mélange `OTHER`** (RG-23). Pour Air et Nitrox, le
    pourcentage découle de `gas_mix` : le stocker violerait la 3FN et permettrait « Nitrox 32 à
    28 % ». Le front affiche 21, 32 ou 36. L'hélium n'apparaît dans aucune source : il n'est pas
    ajouté.
- **Conséquences** :
  - préremplissage par « Dupliquer » (copie de la plongée source) ou par la dernière plongée du
    carnet local : aucune donnée de plus ;
  - passer de `OTHER` à un autre mélange impose de remettre `o2_percent` à `NULL` (le `CHECK` le
    refuse sinon) : c'est au formulaire de le faire ;
  - pressions et lest sont des données de santé (D-07).
- **Réversibilité** : élevée. Blocs multiples → `dive_tanks`, avec reprise des colonnes plates en
  première ligne (évolutions prévisibles).

### D-16 — Palier de sécurité sur deux colonnes, détail de la déco reporté

Réponse à la question 3 de la note d'évolution.

- **Contexte** : le Déroulé affiche « Palier de sécurité · 3 min à 5 m », « Paliers de déco. ·
  Aucun » et un segment « palier » en fin de barre de temps. Seuls existent `has_decompression` et
  `stops_ok`.
- **Options étudiées** :
  - **deux colonnes** `safety_stop_duration_min` / `safety_stop_depth_m` : un palier de sécurité
    par plongée ;
  - liste de paliers (`jsonb` ou table `dive_stops`) : nécessaire pour la décompression, mais aucune
    source ne montre de palier de déco détaillé (la maquette affiche « Aucun »).
- **Décision** : les deux colonnes, **renseignées ensemble ou pas du tout**
  (`ck_dive_participations__safety_stop`), avec une profondeur au plus égale à la profondeur max et
  une durée inférieure à la durée de la plongée (RG-25). Détail des paliers de déco **reporté**
  (décision du porteur) : `has_decompression` continue d'afficher « Aucun » / « Oui ».
- **Conséquences** : le segment de la barre de temps est calculé (`durée du palier / durée`).
  `stops_ok` (paliers respectés, D-11) reste indépendant.
- **Réversibilité** : élevée. Table `dive_stops(participation_id, position, depth_m,
duration_min)` synchronisée avec la participation (comme D-04) quand la déco détaillée sera
  demandée.

### D-17 — Plongée successive saisie, proposée par le client

Réponse à la question 4 de la note d'évolution.

- **Contexte** : « Successive · Non » dans le Déroulé. Une plongée est successive si elle suit une
  autre plongée de près (intervalle de surface court, seuil selon la procédure : MN90, ordinateur).
- **Options étudiées** :
  - **dérivée** de l'intervalle avec la plongée précédente du carnet : le carnet peut être
    incomplet (plongée non saisie, carnet papier non rattrapé), l'ordre change avec les saisies
    hors ligne sur plusieurs appareils, et le seuil dépend de la procédure. Le résultat serait
    faux sans que le plongeur le sache ;
  - **saisie** : c'est ce que le plongeur a déclaré à sa table ou son ordinateur.
- **Décision** : `is_repetitive boolean NULL`, **sans défaut** (`NULL` = non renseigné, D-11). Le
  formulaire **propose** une valeur à partir du carnet local (intervalle de moins de 12 h avec la
  plongée précédente), que le plongeur confirme, sur le modèle du niveau à la plongée (D-09).
  L'intervalle de surface n'est pas stocké.
- **Réversibilité** : élevée.

### D-18 — Structure en texte libre sur l'événement

Réponse à la question 5 de la note d'évolution.

- **Contexte** : « Structure · Calvi Plongée » dans les Conditions ; la spec la range dans
  l'événement partagé, et « Dupliquer » la préremplit.
- **Options étudiées** :
  - **texte libre** `dive_events.dive_center` ;
  - entité `dive_centers` privée (comme les sites) : réutilisable, mais elle ajoute une table
    synchronisée pour un simple libellé ;
  - entité partagée : prématurée. Le **club** de D-08 (organisation avec membres et rôles, H-01)
    n'est pas la **structure** commerciale qui loue le bateau ; les confondre figerait le futur
    mode club.
- **Décision** : `dive_center text NULL`, 1 à 120 caractères. L'autocomplétion du formulaire se
  fait sur les valeurs déjà saisies du carnet, comme les régions (D27 d'`ARCHITECTURE.md`).
- **Conséquences** : donnée de localisation (`L`, D-07) ; les variantes d'écriture (« Calvi
  Plongée » / « calvi plongee ») ne sont pas dédupliquées.
- **Réversibilité** : élevée. Entité `dive_centers` + `dive_center_id` nullable ajoutée à côté,
  puis reprise des libellés.

### D-19 — Observations d'espèces : étiquettes libres dans `dive_observations`

Réponse à la question 6 de la note d'évolution.

- **Contexte** : la carte « Notes & observations » affiche des étiquettes ordonnées, dont certaines
  ont un effectif (« Mérou brun · 2 », « Barracudas », « Gorgones rouges », « Corb », « Murène »).
  Elles appartiennent à la participation (ce que **j'**ai vu).
- **Options étudiées** :
  - **référentiel** : DORIS (FFESSM, en français, Méditerranée et Atlantique) ou WoRMS (mondial,
    identifiant AphiaID, licence CC-BY). L'un comme l'autre demanderait un import, une recherche,
    un cache hors ligne de milliers d'espèces et un choix de langue : hors périmètre ;
  - `jsonb` sur la participation (`[{label, count}]`) : simple, mais pas de contrainte d'unicité,
    validation en service seulement, et un futur lien vers un catalogue ne pourrait pas être une
    FK ;
  - `text[]` : perd l'effectif ;
  - **table `dive_observations`**, entité faible de la participation.
- **Décision** :
  - `dive_observations(participation_id, position, label, count)` ;
  - PK `(participation_id, position)` (ordre de saisie conservé) ;
  - `UNIQUE (participation_id, label)` (une étiquette une fois) ;
  - `position BETWEEN 0 AND 49` (plafond de 50, garanti par la base) ;
  - `count` facultatif ;
  - FK vers `dive_participations(id)` **CASCADE**.

  Pas de `owner_id` : contrairement à `dive_buddies`, il n'y a pas de seconde FK à contrôler
  par propriétaire. La propriété est vérifiée sur la participation, dans la transaction de
  `upsertDive`.
  - **Synchronisation avec la participation** (comme D-04) : le client envoie le tableau
    `observations`, le serveur **remplace l'ensemble** dans la transaction de l'agrégat. Le trigger
    `trg_dive_observations__touch_participation` (même fonction que la palanquée) fait avancer
    `dive_participations.updated_at`.

- **Conséquences** :
  - pour le client, la forme ne change pas : un tableau sur la participation (IndexedDB, push) ;
  - le serveur normalise le libellé (`btrim`) ; la casse n'est pas unifiée (« Murène » et
    « murène » coexisteraient) ;
  - classification `—`, dans le périmètre `S` de la participation (D-07).
- **Réversibilité** : élevée. Catalogue d'espèces (WoRMS conseillé) + `species_id` nullable ajouté
  à `dive_observations` : changement **additif**, sans migration des données client.

### D-20 — Zone maritime sur le site : `dive_sites.area`

- **Contexte** : l'en-tête du détail affiche « Calvi · Corse · Méditerranée », et le dashboard
  « Méditerranée occidentale » (`stats.mainArea`, question ouverte n° 8). Les sites ont un nom,
  une localité (D27) et une région, mais pas de mer ni de zone.
- **Options étudiées** :
  - **texte libre** sur le site ;
  - dérivation géographique depuis les coordonnées : il faudrait des polygones de mers (IHO) et
    PostGIS, écarté par D-01 ;
  - liste fermée : les zones (« Méditerranée », « mer Rouge », « lac d'Annecy ») ne se figent pas.
- **Décision** : `dive_sites.area text NULL`, 1 à 120 caractères, en texte libre comme la région
  (D27). `stats.mainArea` = la zone la plus fréquente sur les plongées vivantes, calculée.
- **Conséquences** : donnée de localisation (`L`). Le site étant privé (Q1), la zone l'est aussi.
  Résout la question ouverte n° 8.
- **Réversibilité** : élevée (catalogue de sites, D-01, pourra la fournir).

### D-21 — Niveau d'un binôme sur le contact

- **Contexte** : la carte « Palanquée » affiche le niveau de chaque membre (« Lucas Bernard ·
  N3 »). Celui du plongeur à la plongée existe déjà (snapshot, D-09).
- **Options étudiées** :
  - **niveau courant du contact** (`buddies.certification_level_id`) : saisi une fois, affiché sur
    toutes les plongées ;
  - snapshot par plongée (`dive_buddies.certification_level_id`) : historiquement exact, mais à
    saisir pour chaque plongée et chaque membre ;
  - niveau du compte lié (`linked_diver_id → divers.certification_level_id`) : **interdit** par
    RG-10 / H-05, car lier un contact ne doit rien partager du compte.
- **Décision (porteur)** : `buddies.certification_level_id uuid NULL` →
  `certification_levels(id)` **ON DELETE RESTRICT**, non indexée (niveaux jamais supprimés). Un
  niveau désactivé est admis (on n'impose rien sur les niveaux d'un tiers).
- **Conséquences** :
  - une plongée ancienne affiche le niveau **actuel** du binôme (limite assumée) ;
  - donnée personnelle d'un tiers (`P`, D-07) ;
  - le niveau entre dans le pull et le push des binômes (D-22).
- **Réversibilité** : élevée. Le snapshot par plongée pourra s'ajouter sur `dive_buddies`, prérempli
  par le niveau du contact.

### D-22 — Une seule migration, tous les champs obligatoires au push

Réponse à la question 8 de la note d'évolution (impact offline).

- **Contexte** : chaque colonne ajoutée entre dans le protocole de synchronisation (D-12) et dans
  le schéma IndexedDB de la PWA (D22 d'`ARCHITECTURE.md`). Une montée de version IndexedDB se joue
  sur chaque appareil. Par ailleurs, l'upsert LWW écrit l'enregistrement **entier** (D-03) : un
  champ omis par un client ancien deviendrait `NULL` et effacerait la donnée (point ouvert de
  `ARCHITECTURE.md` §11 sur `locality`).
- **Options étudiées** :
  - migrations au fil de l'eau : plusieurs versions IndexedDB et autant de clients en retard ;
  - **« omis = conservé »** : l'upsert ne réécrit que les champs présents. Plus tolérant, mais on
    ne distingue plus « effacé » de « inconnu », et LWW n'est plus « par enregistrement » ;
  - **tous les champs obligatoires** dans le corps du push, `null` explicite compris.
- **Décision (porteur)** :
  - **une seule migration** `AddDiveDetailFields`, avant l'existence de l'endpoint de
    synchronisation et de la PWA (aucun client déployé : rien à migrer côté appareil) ;
  - **au push, chaque champ synchronisé est obligatoire** (DTO class-validator : propriété requise,
    `null` permis si la colonne est nullable). Un client périmé reçoit un **400** au lieu d'effacer
    des données. La règle vaut pour **toutes** les tables synchronisées, `locality` compris, ce qui
    tranche le point de §11.
- **Conséquences** : un client doit être mis à jour avant de pousser après une évolution de
  schéma ; à prévoir avec la PWA (version de protocole ou message « mise à jour requise »).
- **Réversibilité** : moyenne. Assouplir la règle plus tard est facile ; la durcir après des
  clients déployés le serait moins.

### D-23 — Site créé par son nom seul : région et position facultatives

Révision du **2026-11-18** (API d'écriture des plongées, `api-ecriture-plongee-prompt.md`).

- **Contexte** : le formulaire de plongée crée un site par son seul nom (« Tombant des
  Américains ») ; région, latitude et longitude sont inconnues à la saisie. Le schéma les exigeait
  (`NOT NULL`), d'où des valeurs inventées (`0, 0`, région vide) dans le dépôt en mémoire du front.
- **Options étudiées** : valeurs sentinelles (`0,0` est un vrai point du golfe de Guinée, une région
  vide viole `ck_dive_sites__region`) ; table des sites « brouillons » (deux modèles pour une même
  chose) ; **colonnes nullables**.
- **Décision** : migration `AllowDiveSiteWithoutPosition` : `dive_sites.region`, `latitude` et
  `longitude` deviennent **NULL** (`NULL` = non renseigné, comme D-13 à D-22). Les `CHECK` existants
  acceptent `NULL` ; nouveau `ck_dive_sites__position` : latitude et longitude **ensemble ou aucune**.
  `DiveSiteWrite` porte `region: string | null`, `latitude` / `longitude: number | null`, toujours
  **requis** au push (D-22).
- **Conséquences** : le contrat de lecture suit (`DiveSiteRef.region`, position du site dans
  `DiveDetail` et `DashboardSite` nullables), déployé **front d'abord** : la carte du dashboard ignore
  un site sans position, le détail affiche « Position non renseignée », les facettes de région
  ignorent `null`. Le `down()` échoue tant qu'un site sans région ou sans position existe.
- **Réversibilité** : moyenne (il faudrait compléter les sites concernés avant de revenir en
  `NOT NULL`).

### D-24 — Endpoints REST d'écriture d'une plongée

Révision du **2026-11-18**.

- **Contexte** : le formulaire enregistrait dans un dépôt en mémoire. La synchronisation en lot
  hors ligne (D-03, D-12) viendra plus tard, au-dessus des mêmes services.
- **Décision** :
  - `POST /api/dives` (création, **201**) et `PUT /api/dives/:id` (remplacement complet, **200** ;
    D-22 impose d'envoyer tous les champs, d'où `PUT`). L'`id` de l'URL doit être égal à
    `event.id` (sinon 400). Réponse `DiveWriteResponse` : `id`, `number` (calculé, D26
    d'`ARCHITECTURE.md`) et `updatedAt`.
  - **Une transaction** par requête : site créé par son nom, binômes créés par leur nom (et niveau
    d'un binôme existant mis à jour, D-21), puis l'agrégat de `upsertDive` (événement,
    participation, palanquée, observations). Les services exposent une variante qui reçoit
    l'`EntityManager` ; leur méthode publique l'enveloppe dans sa propre transaction.
  - L'id de la **participation** n'est pas envoyé : le serveur réutilise celle du plongeur pour
    l'événement, sinon en tire une. Au `PUT`, le **snapshot de niveau** de la participation (D-09)
    est conservé.
  - **Propriété** : le plongeur vient de `CurrentDiverGuard`. Un `PUT` sur une plongée absente,
    supprimée ou d'un autre plongeur → **404** générique (pas de création ni de restauration par
    `PUT`). Un site, un binôme ou un niveau inconnu **ou** d'un autre plongeur → même **422**
    `invalid-reference`.
  - **Idempotence du POST** : si l'id existe déjà chez le plongeur, vivant, avec un contenu
    identique (comparaison de l'agrégat normalisé), la réponse est **200** avec le même corps, sans
    écriture ; un contenu différent, une plongée supprimée ou un id d'un autre plongeur → **409**
    `identifier-conflict`, au corps identique dans les trois cas.
  - L'API accepte tout UUID (le front tire encore des v4) ; UUIDv7 (D-02) reste à faire côté front.
- **Réversibilité** : élevée (routes additives).

### D-25 — Canal en ligne : LWW strict, sans contrôle optimiste

Révision du **2026-11-18**. **Décision du porteur**.

- **Contexte** : le brief de l'API proposait un 409 « la plongée a été modifiée ailleurs » sur le
  `PUT`, ce qui contredit D-03 (LWW par enregistrement, verrou optimiste écarté).
- **Décision** : D-03 s'applique **tel quel** au `PUT` : la dernière écriture arrivée gagne.
  `baseUpdatedAt` (requis, `updatedAt` du détail lu) ne sert qu'à la règle de la tombstone (D-12 a) ;
  une plongée supprimée entre-temps répond 404 (§9 d'`ARCHITECTURE.md`). Le contrôle de l'horizon
  de purge (D-12 d) est propre à la synchronisation en lot : en ligne, le client vient de lire l'état
  serveur (`lastPulledAt` = maintenant).
- **Conséquences** : deux onglets qui modifient la même plongée : le dernier enregistrement écrase
  l'autre, sans avertissement (limite assumée de D-03).
- **Réversibilité** : élevée (un contrôle `updatedAt > baseUpdatedAt` → 409 s'ajoute sans migration).

### D-26 — Erreurs de l'API : par champ et par code métier

Révision du **2026-11-18**.

- **Décision** :
  - **Validation** (DTO `class-validator`) → **400**
    `{ statusCode, code: 'validation-failed', fieldErrors }`, où `fieldErrors` associe le **chemin**
    du champ dans le corps (`participation.maxDepthM`, `observations.3.label`, `buddies.0.lastName`)
    à une liste de **codes** de contrainte (`required`, `type`, `min`, `max`, `in`, `length`,
    `pair`, `o2-other-only`, `before-duration`, `above-max-depth`, `above-start-pressure`,
    `duplicate`, `too-many`, `matches-route`…). **Jamais la valeur reçue** (données de santé). Les
    messages sont écrits par le front.
  - Les DTO couvrent toutes les bornes des `CHECK` (H-10, H-17, RG-23, RG-25, pressions) : une
    violation de contrainte en base reste une 500 (bug).
  - **Erreurs métier** : table exhaustive `DomainErrorCode → statut`, appliquée par le filtre
    d'exceptions, corps `{ statusCode, code }` :

    | Code                                                                              | Statut |
    | --------------------------------------------------------------------------------- | ------ |
    | `duplicate-observation`, `too-many-observations`                                  | 400    |
    | `identifier-conflict`, `buddy-link-conflict`, `site-in-use`, `full-sync-required` | 409    |
    | `invalid-reference`, `inactive-certification-level`                               | 422    |
    | `unsupported-contract-value` (bug de mapping du serveur)                          | 500    |

- **Réversibilité** : élevée.

## Dénormalisations et snapshots

| Donnée copiée                    | Où                    | Type                             | Mécanisme                                                                                                                                                                         |
| -------------------------------- | --------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `owner_id`                       | `dive_buddies`        | dénormalisation de contrôle      | fourni par le service ; cohérence garantie par les FK composites                                                                                                                  |
| `certification_level_id`         | `dive_participations` | **snapshot** (donnée historique) | fixé à la saisie par le client (niveau courant proposé, modifiable) ; copie serveur du niveau courant seulement en l'absence de valeur ; corrigeable, jamais resynchronisé (D-09) |
| `updated_at` de la participation | `dive_participations` | propagation                      | trigger `touch_participation_on_buddies_change`, sur `dive_buddies` et `dive_observations` (D-19)                                                                                 |

Aucun compteur stocké ; `started_at` n'est pas copié dans les participations (D-08). Ni les bar
consommés, ni l'heure de sortie, ni le % O₂ d'Air ou de Nitrox ne sont stockés (D-15).

## Validation par écran

« Vivant » = `p.deleted_at IS NULL AND e.deleted_at IS NULL` (`p` participation, `e` événement).

| Écran / bloc                                                                                  | Tables lues                                                                                                                                                        | Requêtes                                                                                   | Verdict                                                                                                     |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| UserCard « Marine Rousseau · N2 · FFESSM », « Bonjour Marine »                                | divers ⋈ certification_levels                                                                                                                                      | 1 (PK + PK)                                                                                | OK                                                                                                          |
| KPI « Plongées totales », « Temps sous l'eau »                                                | dive_participations ⋈ dive_events                                                                                                                                  | 1 agrégat                                                                                  | OK, `idx_dive_participations__diver_id_dive_event_id` + PK événement                                        |
| KPI « Profondeur max » (+ site, date)                                                         | dive_participations ⋈ dive_events ⋈ dive_sites                                                                                                                     | 1 (`ORDER BY max_depth_m DESC LIMIT 1`)                                                    | OK                                                                                                          |
| KPI « Sites explorés · 6 régions »                                                            | dive_participations ⋈ dive_events ⋈ dive_sites                                                                                                                     | 1 (`COUNT(DISTINCT e.site_id)`, `COUNT(DISTINCT region)`)                                  | OK                                                                                                          |
| Carte (marqueurs, popover, filtres de période)                                                | dive_sites ⟕ (dive_events ⋈ dive_participations)                                                                                                                   | 1 (`GROUP BY e.site_id`, `COUNT`, `MAX(p.max_depth_m)`, `e.started_at >= now() - période`) | OK, jointure ≤ 3 tables ; pas de PostGIS                                                                    |
| Dernière plongée (badges « Palier OK », « Air · N2 », binômes)                                | dive_participations ⋈ dive_events ⋈ dive_sites ⋈ certification_levels ; dive_buddies ⋈ buddies                                                                     | 2 (`ORDER BY e.started_at DESC LIMIT 1`, puis binômes de la participation)                 | OK : tri en mémoire sur ≤ quelques milliers de lignes (D-08) ; 4 tables mais toutes par PK sauf la première |
| Plongées par mois (12 mois, mois local), « +3 ce mois »                                       | dive_participations ⋈ dive_events                                                                                                                                  | 1 (`date_trunc('month', e.started_at + e.utc_offset_minutes * interval '1 minute')`)       | OK                                                                                                          |
| « 14 jours depuis ta dernière plongée »                                                       | dive_participations ⋈ dive_events                                                                                                                                  | inclus dans la requête « Dernière plongée »                                                | OK                                                                                                          |
| Binômes fréquents                                                                             | dive_buddies ⋈ buddies ⋈ dive_participations ⋈ dive_events                                                                                                         | 1 (`GROUP BY buddy_id ORDER BY count DESC`)                                                | OK, `idx_dive_buddies__owner_id_buddy_id`                                                                   |
| État vide                                                                                     | dive_participations                                                                                                                                                | `EXISTS`                                                                                   | OK                                                                                                          |
| Synchronisation (pull)                                                                        | certification_levels, dive_sites, buddies, dive_events, dive_participations, dive_buddies, dive_observations                                                       | 1 par table (jonctions avec leur participation)                                            | OK, index `(…, updated_at, id)` ; `dive_events` via `creator_id` en MVP                                     |
| Synchronisation (push d'une plongée)                                                          | dive_events, dive_participations, dive_buddies, dive_observations (+ dive_sites, buddies si restauration D-12 b ; divers si le niveau de participation est absent) | 1 transaction                                                                              | OK ; tous les champs requis (D-22)                                                                          |
| Effacement du compte (MVP ; cible RG-22 avec le partage)                                      | divers (+ cascade) ; cible : dive_participations, dive_sites, dive_events avant le `DELETE`                                                                        | 1 transaction                                                                              | OK en MVP ; cible : 1 requête par événement partagé (désignation, copie du site, repointage)                |
| Détail de plongée `/dives/:id` (en-tête, KPI, Déroulé, Équipement, Conditions, Site, mention) | dive_events ⋈ dive_participations ⋈ dive_sites ⋈ certification_levels                                                                                              | 1 (PK de l'événement + `diver_id`)                                                         | OK : toutes les nouvelles colonnes sont sur les tables déjà jointes                                         |
| Détail : Palanquée (niveau des membres) et Notes (espèces)                                    | dive_buddies ⋈ buddies ⟕ certification_levels ; dive_observations                                                                                                  | 2 (par `participation_id`)                                                                 | OK, PK `dive_buddies` et `dive_observations` (colonne `participation_id` en tête)                           |
| Liste « Mes plongées » (`DiveSummary`)                                                        | inchangées                                                                                                                                                         | inchangées                                                                                 | OK : aucune nouvelle colonne lue (D-25, poids de la liste)                                                  |

Le payload `GET /api/dashboard` se construit en ~7 requêtes indexées. Le découpage D-08 ajoute une
jointure par PK à chaque requête de statistiques, sans coût mesurable au volume H-14.

## Questions ouvertes

Données de plongée absentes des sources, **non ajoutées** :

1. **Gaz** : `OTHER` perd l'information. Pourcentage d'O₂/He, plusieurs blocs (volume, pression
   début/fin), plusieurs mélanges par plongée ? _En partie résolue par D-15_ : % O₂ pour `OTHER`,
   un bloc (volume, matière, pressions). Restent ouverts : hélium, plusieurs blocs ou mélanges.
2. **Paliers** : seuls deux booléens. Faut-il le détail (profondeur × durée), l'ordinateur ou les
   tables utilisées, le profil importé ? _En partie résolue par D-16_ : palier de sécurité (durée,
   profondeur). Restent ouverts : détail des paliers de déco (reporté par le porteur), ordinateur
   ou tables, profil (V2).
3. **Matériel** (combinaison, lestage, ordinateur), **type de plongée** (exploration, formation,
   nuit, épave…), **rôle** dans la palanquée (guide, encadrant, élève), **conditions** (courant,
   météo). _En partie résolue par D-13 et D-15_ : combinaison, lest, bateau / bord, jour / nuit,
   météo, mer, courant. Restent ouverts : ordinateur, type (exploration, formation, épave), rôle
   (hors périmètre de la spec du détail).
4. **Incidents** et données médicales (`ARCHITECTURE.md` §9) : entité dédiée, accès renforcé ?
5. **Authentification** : email, fournisseur, rôles (admin du backoffice) ? (H-03)
6. **Notifications** (cloche avec pastille) : quel contenu ? (invitations à une plongée partagée ?)
7. **Recherche** : sur quoi (sites, notes, binômes) ? Déterminera `pg_trgm` ou plein texte.
8. ~~**`stats.mainArea`**~~ : résolue par D-20 (`dive_sites.area`, zone la plus fréquente
   calculée).
9. ~~**Région**~~ : résolue par D27 d'`ARCHITECTURE.md` (`dive_sites.locality` à côté de la
   région).
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
17. ~~**Valeurs des listes fermées** du détail (météo, mer, courant, combinaison)~~ : validées le
    2026-11-17, valeurs et libellés H-18 retenus tels quels.
18. **Écarts entre la spec du détail et le modèle** (spec en lecture seule) : son tableau « Modèle »
    range la palanquée dans l'événement partagé et les heures d'immersion et de sortie dans la
    participation, alors que D-04 / D-08 font l'inverse ; la mention « Site, date et palanquée sont
    partagés entre les plongeurs » est donc inexacte pour la palanquée. Le modèle est conservé ; la
    copie de la page est à revoir avec le partage.
19. **Suppression depuis le détail** : la spec ne retire que « ta participation », H-16 tombstone en
    MVP l'événement et la participation. Toujours ouverte : les endpoints d'écriture (D-24) ne
    couvrent pas la suppression.
20. **Mise à jour d'un client périmé** (D-22) : comment la PWA signale-t-elle qu'elle doit se mettre
    à jour avant de pousser (version de protocole, code d'erreur dédié) ?

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
  `he_pct`, `start_bar`, `end_bar`) en remplacement de `gas_mix` et des colonnes plates de D-15
  (reprises en première ligne), seulement si la question ouverte n° 1 le confirme.
- **Paliers de décompression détaillés** : table `dive_stops` (`participation_id`, `position`,
  `depth_m`, `duration_min`), synchronisée avec la participation (D-16).
- **Équipement réutilisable** : table `equipment` privée (bloc, combinaison) pour préremplir la
  saisie, avec snapshot sur la participation (D-15).
- **Structures** : entité `dive_centers` + `dive_events.dive_center_id` nullable, à distinguer des
  clubs de D-08 (D-18).
- **Catalogue d'espèces** (WoRMS conseillé, ou DORIS) : `species` + `dive_observations.species_id`
  nullable, additif (D-19).
- **Niveau d'un binôme à la plongée** : snapshot `dive_buddies.certification_level_id`, prérempli
  par le niveau du contact (D-21).
- **Profil de plongée importé** (ordinateur) : séries temporelles par participation, en `jsonb` ou
  table dédiée ; volumétrie à évaluer.
- **Conflits** : `client_updated_at` ou `version` si la limite de D-03 gêne en pratique.
- **Statistiques lourdes** : copie de `started_at` dans la participation (trigger) ou agrégats
  mensuels si le volume dépasse H-14 (D-08).
