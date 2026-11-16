# Mission : réviser le modèle de données E-Deep

Utilise le skill `modeling-databases`. Les trois livrables de `docs/data-model/` (`schema.md`, `decisions.md`, `backend-prompt.md`) ont été relus. Le porteur du projet a validé les changements ci-dessous : **intègre-les dans les trois fichiers**, sans écrire de code applicatif ni de migration.

Règles de mise à jour :

- Garde la numérotation existante (RG, H, D). Ajoute de nouvelles décisions à partir de **D-08** ; marque les hypothèses résolues comme telles (`résolue par D-xx`) au lieu de les supprimer.
- Mets à jour **tout ce qui en découle** : dictionnaire, RG, MCD, MLD, `erDiagram`, tables de types, contraintes, index, triggers, validation par écran, questions ouvertes, évolutions prévisibles, et dans `backend-prompt.md` : modules, ordre d'implémentation, spécification par entité, SQL brut, invariants, tests, définition de fini.
- Tout ce qui n'est pas mentionné ici reste inchangé (sites privés, LWW par enregistrement, UUIDv7 client, `text + CHECK` pour les listes fermées, etc.).
- Si un changement entre en conflit avec `ARCHITECTURE.md` ou avec une autre décision, arrête-toi et signale-le.

---

## 1. Découper la plongée en événement partagé + participations (nouvelle décision)

**Objectif produit (évolution future, pas MVP)** : quand un club utilisera E-Deep, un plongeur pourra saisir une plongée, y ajouter les autres membres de la palanquée inscrits, et la plongée apparaîtra dans le carnet de chacun. Le site et la date ne seront modifiables que par le créateur ; chaque plongeur pourra corriger ses données personnelles (ex. 32 m au lieu de 30 m). E-Deep étant offline-first, découper la table centrale plus tard imposerait de migrer IndexedDB sur chaque appareil et de versionner le protocole de synchronisation. On découpe donc **dès la migration initiale**.

Remplace `dives` par :

**`dive_events`** — données communes à la palanquée

- `id` uuid fourni par le client (UUIDv7)
- `creator_id` → `divers(id)`
- `site_id`, avec FK composite `(creator_id, site_id)` → `dive_sites(owner_id, id)` ON DELETE RESTRICT (le site est celui du créateur)
- `started_at timestamptz NOT NULL`
- `utc_offset_minutes` (voir §3)
- `created_at`, `updated_at` (trigger), `deleted_at`

**`dive_participations`** — données propres à chaque plongeur

- `id` uuid fourni par le client
- `dive_event_id` → `dive_events(id)` ON DELETE CASCADE
- `diver_id` → `divers(id)` ON DELETE CASCADE
- `certification_level_id` (snapshot, voir §2)
- `max_depth_m`, `duration_min`, `water_temperature_c`, `visibility_m` (chaque ordinateur mesure sa propre valeur), `gas_mix`, `has_decompression`, `stops_ok` (voir §4), `notes`
- `created_at`, `updated_at` (trigger), `deleted_at`
- `UNIQUE (dive_event_id, diver_id)` : un plongeur participe une seule fois à un événement (une participation retirée puis rajoutée est restaurée, pas recréée)
- `UNIQUE (diver_id, id)` : cible de la FK composite de `dive_buddies`

**`dive_buddies`** se rattache désormais à la participation : PK `(participation_id, buddy_id)`, `owner_id` copié, FK composites `(owner_id, participation_id)` → `dive_participations(diver_id, id)` et `(owner_id, buddy_id)` → `buddies(owner_id, id)`. Le trigger `touch_dive_on_buddies_change` devient `touch_participation_on_buddies_change` et fait avancer `dive_participations.updated_at`.

**Invariants MVP** (dans les services, **pas** en contrainte SQL, car ils seront levés avec le partage) :

- un événement a exactement une participation, celle de son créateur (`diver_id = creator_id`) ;
- seul le créateur modifie l'événement ; seul le plongeur concerné modifie sa participation.

**Contrat d'API inchangé pour le front** : une « plongée » reste un agrégat = événement + ma participation + `buddyIds`. Elle s'écrit d'un bloc, dans une transaction (`upsertDive`). Mets à jour la description du pull : événements dont je suis créateur ou participant, plus mes participations.

**Requêtes et index** : les statistiques lisent la profondeur et la durée dans `dive_participations`, et le site et la date via `dive_events` (« sites explorés » = `COUNT(DISTINCT dive_events.site_id)` sur mes participations vivantes). `started_at` étant sur l'événement, le tri « dernière plongée » et l'histogramme mensuel passent par une jointure. Évalue cette jointure au volume supposé (H-14) et choisis entre :

- la jointure seule, avec index adaptés ;
- une copie de `started_at` dans la participation, maintenue par trigger.

Documente le choix dans la décision. Revois la table de validation par écran en conséquence.

**À consigner en évolutions prévisibles** (ne pas modéliser maintenant) :

- statut d'invitation sur la participation (`pending` / `accepted` / `declined`) : consentement obligatoire, données de santé d'un tiers ;
- pull élargi aux événements créés par d'autres ;
- clubs et rôles (directeur de plongée saisissant pour la palanquée) ;
- **point d'attention** : avec le partage, `ON DELETE CASCADE` sur `dive_events.creator_id` effacerait les participations des autres plongeurs lors de la suppression du compte du créateur. Il faudra alors transférer la propriété de l'événement ou détacher le site. Le CASCADE est correct pour le MVP seulement.

## 2. Référentiel de niveaux de certification (nouvelle décision)

Problème actuel : `level IN ('N1'…'N4')` et `federation IN ('FFESSM','CMAS','OTHER')` sont indépendants, alors que le niveau détermine la fédération (« N2 » est forcément FFESSM). C'est une dépendance transitive (violation 3FN) qui autorise « N2 · CMAS » et interdit « 2 étoiles · CMAS ».

- Nouvelle table **`certification_levels`** : `id uuid DEFAULT uuidv7()`, `agency text NOT NULL`, `code text NOT NULL`, `label text NOT NULL`, `rank smallint NOT NULL` (comparaison entre fédérations), `is_active boolean NOT NULL DEFAULT true`, `created_at`, `updated_at`. `UNIQUE (agency, code)`.
- `divers` : remplace `level` et `federation` par `certification_level_id NOT NULL` → `certification_levels(id)` ON DELETE RESTRICT. Un niveau obsolète se désactive (`is_active = false`), il ne se supprime pas.
- `dive_participations.certification_level_id NOT NULL` → même table, RESTRICT. C'est un **snapshot** : copié depuis le plongeur à la création de la participation, jamais mis à jour quand le plongeur change de niveau, mais corrigeable par lui. Le carnet sert à justifier l'expérience pour passer un niveau. Résout **H-06**.
- Référentiel en lecture seule côté client : mis en cache pour le hors ligne, synchronisé en pull complet (petite table). L'administration au backoffice viendra plus tard.
- **Données initiales** : le seed de la migration ne contient que ce que les sources attestent (FFESSM N1 à N4). Propose dans `decisions.md` une liste complémentaire **à valider par le porteur** (étoiles CMAS, principaux niveaux PADI/SSI) avec une proposition de `rank`. Ne l'insère pas.
- Côté API, le contrat `User.level` / `User.federation` du front reste servi (dérivé du référentiel). Signale-le dans le prompt backend.
- La gestion de plusieurs certifications par plongeur (`diver_certifications`) va dans les évolutions prévisibles.

## 3. Heure locale de la plongée (résout H-13)

- `dive_events.utc_offset_minutes smallint NOT NULL`, `CHECK (utc_offset_minutes BETWEEN -720 AND 840)`.
- Le client propose par défaut le décalage de l'appareil au moment de la saisie ; le créateur peut le corriger.
- Affichage : `started_at` décalé de `utc_offset_minutes`. Une plongée de 21 h en mer Rouge s'affiche 21 h, quel que soit le fuseau de l'appareil qui consulte.
- Dans la décision, compare avec un fuseau IANA et justifie le choix de l'offset (seul l'instant passé compte, pas de récurrence).
- Ajoute à la décision la distinction **réversibilité du schéma / réversibilité des données** : une information jamais capturée est perdue, d'où la décision prise dès la migration initiale.

## 4. `stops_ok` sans défaut

- `stops_ok boolean NOT NULL` **sans valeur par défaut** : la saisie est imposée. Un défaut à `true` affirmerait « paliers respectés » sans que l'information ait été saisie.
- Mets à jour le dictionnaire, la table des types et le prompt backend (pas de `default` dans l'entité). Ajoute un test : un INSERT sans `stops_ok` échoue.

## 5. Règles de synchronisation complémentaires (nouvelle décision)

À documenter dans `decisions.md` (complément de D-03) et à reporter dans les invariants et les tests du prompt backend. Les endpoints restent hors périmètre de la mission backend, mais les services et leurs tests en font partie.

**a. Une suppression ne peut pas être annulée par un appareil en retard.**
Chaque enregistrement poussé porte un `base_updated_at` : le `updated_at` serveur que le client a vu en dernier. Si la ligne serveur est tombstonée, que son `updated_at` est postérieur à `base_updated_at` et que le client envoie `deleted_at = null`, alors :

- le serveur conserve la tombstone ;
- il renvoie l'état serveur ;
- l'écriture est signalée comme rejetée au client.

Une restauration volontaire reste possible : elle porte un `base_updated_at` à jour. S'applique à toutes les tables synchronisées. Pas de colonne nouvelle : c'est un champ du protocole.

**b. Pas de référence vivante vers un parent supprimé.**
Quand `upsertDive` référence un site ou des binômes tombstonés (supprimés sur un autre appareil pendant que celui-ci était hors ligne), il les **restaure** (`deleted_at = null`) dans la même transaction. Ajoute la RG correspondante.

**c. La purge ne bute jamais sur un RESTRICT.**
La purge physique des tombstones de plus de 90 jours exclut les parents encore référencés par un enfant :

- sites : `NOT EXISTS` sur les événements ;
- niveaux : jamais purgés.

Ordre de purge : participations → événements (sans participation restante) → binômes → sites.

**d. Horizon de purge.**
Le client transmet la date de son dernier pull réussi. Si elle est antérieure à l'horizon de purge, le serveur refuse le push et exige d'abord une synchronisation complète. Sinon, il recréerait des enregistrements purgés.

**e. Triggers et cascades.**
Le trigger sur `dive_buddies` se déclenche aussi pendant les cascades (suppression de compte, purge) et met à jour des participations en cours de suppression. Ajoute un test explicite pour chacun des deux cas :

- suppression d'un compte avec événements, participations et palanquées ;
- purge.

Si un problème apparaît, protège le trigger (par exemple en ignorant les participations déjà supprimées) et documente-le.

---

## Restitution attendue

En fin de tâche, donne dans le chat :

- la liste des tables après révision ;
- les nouvelles décisions et hypothèses résolues ;
- ton choix sur `started_at` (jointure ou copie) et pourquoi ;
- la liste complémentaire de niveaux proposée à la validation ;
- toute incohérence rencontrée.

Ne recopie pas les fichiers.
