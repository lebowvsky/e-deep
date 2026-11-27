# Modèle de données — E-Deep (carnet de plongée)

> Sources : maquettes `apps/web/design/screenshots/00…05.png` et `mockups/*.jsx` (dashboard
> uniquement), `apps/web/src/features/dashboard/types.ts`, `mocks/dashboard.ts`, `lib/labels.ts`,
> `apps/web/src/app/routes.tsx`, `ARCHITECTURE.md` (§7 migrations, §9 RGPD), révision validée par le
> porteur (`correction-modele-e-deep.md`).
> Mode : **création** (aucune entité ni migration dans `apps/api`).
> **Évolution du 2026-11-16** (mode évolution, D-13 à D-22) : champs du détail de plongée
> (`apps/web/design/pages/detail-plongee.md`, `mockups/dive-detail.jsx`, captures 20 et 21 ;
> inventaire `evolution-champs-detail-plongee.md`). Elle ajoute des colonnes facultatives à
> `dive_events`, `dive_participations`, `dive_sites` et `buddies`, et une table `dive_observations`.
> **Évolution du 2026-11-19** (mode évolution, D-27 à D-33) : API des sites
> (`apps/web/design/pages/sites.md` ; delta et justification dans `evolution-sites.md`). Elle ajoute
> à `dive_sites` le type, les profondeurs, l'accès, l'origine (`created_via`) et la cible d'une
> fusion (`merged_into_id`).
> **Évolution du 2026-11-20** (mode évolution, D-34 à D-38) : authentification
> (`docs/plans/auth.md` §2, D33 à D45 d'`ARCHITECTURE.md`). Elle ajoute les tables `accounts`,
> `sessions`, `consents` et `auth_events` (migrations `CreateAuthSchema`, `AddAccountCreatedAuthEvent`,
> `AddStaffTotp`) et rend `divers.last_name` et `divers.certification_level_id` facultatifs
> (`AllowIncompleteDiverProfile`).
> Décisions, hypothèses (`H-xx`) et questions ouvertes : voir `decisions.md`.

Périmètre : ce que les écrans et le code montrent aujourd'hui (dashboard + contrat
`DashboardPayload`), plus le découpage événement / participation (D-08) et le référentiel de
niveaux (D-09) décidés pour ne pas avoir à migrer IndexedDB plus tard. Les écrans « Mes plongées »,
« Nouvelle plongée », « Carte », « Statistiques », « Binômes » sont des placeholders : leurs besoins
seront à rejouer contre ce schéma quand ils seront maquettés.

Vocabulaire : une **plongée**, côté front et API, est un agrégat = **événement** (`dive_events` :
site, date, heure locale) + **ma participation** (`dive_participations` : mes mesures, mon niveau,
mes notes) + mes **binômes** (`dive_buddies`).

## 1. Dictionnaire de données

Colonne **PII** : `P` = donnée personnelle, `S` = donnée de santé (RGPD art. 9, cf. `ARCHITECTURE.md`
§9), `L` = localisation (habitudes de lieu), `—` = aucune.

| Entité                  | Attribut                    | Signification                                                   | Type logique                         | Oblig.       | Unique                  | PII        | Source                                                      |
| ----------------------- | --------------------------- | --------------------------------------------------------------- | ------------------------------------ | ------------ | ----------------------- | ---------- | ----------------------------------------------------------- |
| Niveau de certification | id                          | Identifiant                                                     | uuid (serveur)                       | oui          | oui                     | —          | D-09                                                        |
| Niveau de certification | agency                      | Organisme certificateur                                         | texte                                | oui          | avec `code`             | —          | `User.federation` ; « N2 · FFESSM »                         |
| Niveau de certification | code                        | Code court du niveau                                            | texte                                | oui          | avec `agency`           | —          | `User.level` ; « N2 »                                       |
| Niveau de certification | label                       | Libellé complet                                                 | texte                                | oui          | non                     | —          | D-09 (« Niveau 2 »)                                         |
| Niveau de certification | rank                        | Rang de comparaison entre organismes                            | entier                               | oui          | non                     | —          | D-09                                                        |
| Niveau de certification | is_active                   | Niveau proposable à la saisie                                   | booléen                              | oui          | non                     | —          | D-09 (désactivation au lieu de suppression)                 |
| Plongeur                | id                          | Identifiant du compte                                           | uuid                                 | oui          | oui                     | —          | `types.ts > User.id`                                        |
| Plongeur                | first_name                  | Prénom                                                          | texte                                | oui          | non                     | P          | `User.firstName` ; « Bonjour Marine », UserCard             |
| Plongeur                | last_name                   | Nom                                                             | texte                                | non _(D-38)_ | non                     | P          | `User.lastName` ; UserCard « Marine Rousseau »              |
| Plongeur                | certification_level_id      | Niveau **courant**                                              | réf. Niveau                          | non _(D-38)_ | non                     | P          | `User.level` + `User.federation` ; UserCard « N2 · FFESSM » |
| Plongeur                | avatar_url                  | Photo de profil                                                 | texte (URL)                          | non          | non                     | P          | `User.avatarUrl?` (avatar à initiales sinon)                |
| Site                    | id                          | Identifiant du site                                             | uuid (généré client)                 | oui          | oui                     | —          | `DiveSite.id`                                               |
| Site                    | owner_id                    | Plongeur propriétaire                                           | réf. Plongeur                        | oui          | non                     | —          | Réponse Q1 (sites privés)                                   |
| Site                    | name                        | Nom du site                                                     | texte                                | oui          | non                     | L          | `DiveSite.name` ; popover carte, « Dernière plongée »       |
| Site                    | region                      | Région                                                          | texte libre                          | oui          | non                     | L          | `DiveSite.region` ; « Corse », « Var »                      |
| Site                    | locality                    | Ville ou spot                                                   | texte libre                          | non          | non                     | L          | « Calvi · Corse » ; D27 (`ARCHITECTURE.md`)                 |
| Site                    | area                        | Mer ou zone                                                     | texte libre                          | non          | non                     | L          | détail, en-tête « Calvi · Corse · Méditerranée » ; D-20     |
| Site                    | latitude                    | Latitude WGS84                                                  | décimal (°)                          | oui          | non                     | L          | `DiveSite.latitude` ; marqueurs de carte                    |
| Site                    | longitude                   | Longitude WGS84                                                 | décimal (°)                          | oui          | non                     | L          | `DiveSite.longitude`                                        |
| Événement de plongée    | id                          | Identifiant                                                     | uuid (généré client)                 | oui          | oui                     | —          | `Dive.id`, route `/dives/:diveId` ; D-08                    |
| Événement de plongée    | creator_id                  | Plongeur qui a saisi l'événement                                | réf. Plongeur                        | oui          | non                     | —          | D-08                                                        |
| Événement de plongée    | site_id                     | Site (du créateur)                                              | réf. Site                            | oui          | non                     | L          | `Dive.site`                                                 |
| Événement de plongée    | started_at                  | Instant de début                                                | date-heure avec fuseau               | oui          | non                     | S          | `Dive.date` (ISO) ; « 08 sept. 2025 », « 14 jours depuis »  |
| Événement de plongée    | utc_offset_minutes          | Décalage UTC de l'heure locale de la plongée                    | entier (min)                         | oui          | non                     | L          | D-10 (résout H-13)                                          |
| Événement de plongée    | entry_type                  | Type de mise à l'eau                                            | BOAT \| SHORE                        | non          | non                     | —          | détail, étiquette « Bateau », Conditions « Type » ; D-13    |
| Événement de plongée    | time_of_day                 | Plongée de jour ou de nuit                                      | DAY \| NIGHT                         | non          | non                     | —          | détail, Conditions « Bateau · jour » ; D-13                 |
| Événement de plongée    | weather                     | Météo                                                           | liste fermée (H-18)                  | non          | non                     | —          | détail, Conditions « Ensoleillé » ; D-13                    |
| Événement de plongée    | air_temperature_c           | Température de l'air (°C)                                       | décimal                              | non          | non                     | —          | détail, Conditions « Air 19 °C » ; D-13                     |
| Événement de plongée    | sea_state                   | État de la mer                                                  | liste fermée (H-18)                  | non          | non                     | —          | détail, Conditions « Mer · Calme » ; D-13                   |
| Événement de plongée    | current_strength            | Force du courant                                                | liste fermée (H-18)                  | non          | non                     | —          | détail, Conditions « Courant · Faible » ; D-13              |
| Événement de plongée    | dive_center                 | Structure ou club qui organise la plongée                       | texte libre                          | non          | non                     | L          | détail, Conditions « Calvi Plongée » ; D-18                 |
| Participation           | id                          | Identifiant                                                     | uuid (généré client)                 | oui          | oui                     | —          | D-08                                                        |
| Participation           | dive_event_id               | Événement                                                       | réf. Événement                       | oui          | avec `diver_id`         | —          | D-08                                                        |
| Participation           | diver_id                    | Plongeur participant                                            | réf. Plongeur                        | oui          | avec `dive_event_id`    | —          | D-08 ; carnet personnel                                     |
| Participation           | certification_level_id      | Niveau **au moment de la plongée** (snapshot, fixé à la saisie) | réf. Niveau                          | oui          | non                     | P          | badge « Air · N2 » ; D-09 (résout H-06)                     |
| Participation           | max_depth_m                 | Profondeur maximale (m)                                         | décimal                              | oui          | non                     | S          | `Dive.depthMaxM` ; « PROF. MAX 42 m »                       |
| Participation           | duration_min                | Durée (min)                                                     | entier                               | oui          | non                     | S          | `Dive.durationMin` ; « DURÉE 38 min »                       |
| Participation           | water_temperature_c         | Température au fond (°C)                                        | décimal                              | non _(H-07)_ | non                     | S          | `Dive.temperatureC` ; « TEMP. FOND 14 °C »                  |
| Participation           | visibility_m                | Visibilité (m)                                                  | entier                               | non _(H-07)_ | non                     | —          | `Dive.visibilityM` ; « VISIBILITÉ 25 m »                    |
| Participation           | gas_mix                     | Mélange respiré                                                 | AIR \| NITROX32 \| NITROX36 \| OTHER | oui          | non                     | S          | `Dive.gasMix`, `labels.ts` ; badge « Air »                  |
| Participation           | has_decompression           | Plongée avec paliers de décompression                           | booléen                              | oui          | non                     | S          | `Dive.hadDecompression`                                     |
| Participation           | stops_ok                    | Paliers respectés (saisie imposée, sans défaut)                 | booléen                              | oui          | non                     | S          | `Dive.stopsOk` ; badge « Palier OK » ; D-11                 |
| Participation           | notes                       | Notes libres                                                    | texte                                | non          | non                     | S          | `Dive.notes?`                                               |
| Participation           | surface_water_temperature_c | Température de l'eau en surface (°C)                            | décimal                              | non          | non                     | S          | détail, KPI « Surface 16 °C », Conditions « Eau 16 → 14 »   |
| Participation           | safety_stop_duration_min    | Durée du palier de sécurité (min)                               | entier                               | non          | non                     | S          | détail, Déroulé « 3 min à 5 m » ; D-16                      |
| Participation           | safety_stop_depth_m         | Profondeur du palier de sécurité (m)                            | décimal                              | non          | non                     | S          | détail, Déroulé « 3 min à 5 m » ; D-16                      |
| Participation           | is_repetitive               | Plongée successive                                              | booléen                              | non          | non                     | S          | détail, Déroulé « Successive · Non » ; D-17                 |
| Participation           | o2_percent                  | % d'O₂ d'un mélange « Autre »                                   | décimal                              | non          | non                     | S          | détail, Équipement « 21 % O₂ » ; D-15                       |
| Participation           | tank_volume_l               | Volume du bloc (L)                                              | décimal                              | non          | non                     | —          | détail, Équipement « 12 L · acier » ; D-15                  |
| Participation           | tank_material               | Matière du bloc                                                 | STEEL \| ALUMINIUM                   | non          | non                     | —          | détail, Équipement « 12 L · acier » ; D-15                  |
| Participation           | start_pressure_bar          | Pression du bloc à l'immersion (bar)                            | entier                               | non          | non                     | S          | détail, Équipement « 200 → 60 bar » ; D-15                  |
| Participation           | end_pressure_bar            | Pression du bloc à la sortie (bar)                              | entier                               | non          | non                     | S          | détail, Équipement « 200 → 60 bar » ; D-15                  |
| Participation           | suit_type                   | Type de combinaison                                             | WET \| SEMI_DRY \| DRY (H-18)        | non          | non                     | —          | détail, Équipement « semi-étanche » ; D-15                  |
| Participation           | suit_thickness_mm           | Épaisseur de la combinaison (mm)                                | décimal                              | non          | non                     | —          | détail, Équipement « 7 mm » ; D-15                          |
| Participation           | weight_kg                   | Lest (kg)                                                       | décimal                              | non          | non                     | S          | détail, Équipement « Lest » (vide dans la maquette) ; D-15  |
| Observation             | participation_id            | Participation où l'espèce a été vue                             | réf. Participation                   | oui          | avec `position`         | —          | D-19                                                        |
| Observation             | position                    | Rang d'affichage de l'étiquette                                 | entier (0 à 49)                      | oui          | avec `participation_id` | —          | ordre des étiquettes de la maquette ; D-19                  |
| Observation             | label                       | Espèce observée (étiquette libre)                               | texte                                | oui          | par participation       | —          | détail, Notes « Mérou brun », « Barracudas » ; D-19         |
| Observation             | count                       | Nombre d'individus                                              | entier                               | non          | non                     | —          | détail, Notes « Mérou brun · 2 » ; D-19                     |
| Binôme                  | id                          | Identifiant du contact                                          | uuid (généré client)                 | oui          | oui                     | —          | `Buddy.id`                                                  |
| Binôme                  | owner_id                    | Plongeur dont c'est le contact                                  | réf. Plongeur                        | oui          | non                     | —          | Réponse Q2                                                  |
| Binôme                  | first_name                  | Prénom du binôme                                                | texte                                | oui          | non                     | P (tiers)  | `Buddy.firstName` ; « Lucas Bernard »                       |
| Binôme                  | last_name                   | Nom du binôme                                                   | texte                                | oui          | non                     | P (tiers)  | `Buddy.lastName` ; « L. Bernard »                           |
| Binôme                  | linked_diver_id             | Compte E-Deep correspondant, s'il existe                        | réf. Plongeur                        | non          | par propriétaire        | P          | Réponse Q2 (relation réflexive)                             |
| Binôme                  | certification_level_id      | Niveau **courant** du contact, déclaré par le propriétaire      | réf. Niveau                          | non          | non                     | P (tiers)  | détail, Palanquée « Lucas Bernard · N3 » ; D-21             |
| Palanquée               | participation_id, buddy_id  | Binôme présent à ma participation                               | association                          | —            | couple                  | S          | `Dive.buddies` ; « avec L. Bernard & T. Nguyen »            |
| Compte                  | id                          | Identifiant du compte de connexion                              | uuid (serveur)                       | oui          | oui                     | —          | D-34                                                        |
| Compte                  | diver_id                    | Plongeur du compte (aucun pour le staff)                        | réf. Plongeur                        | non          | oui                     | —          | D-34 ; D36 (`ARCHITECTURE.md`)                              |
| Compte                  | email                       | Adresse de connexion, normalisée                                | texte                                | oui          | oui                     | P          | formulaires de connexion et d'inscription ; D-34            |
| Compte                  | password_hash               | Empreinte Argon2id du mot de passe (PHC)                        | texte                                | oui          | non                     | P (secret) | D35 (`ARCHITECTURE.md`)                                     |
| Compte                  | role                        | Rôle : plongeur, support, admin                                 | diver \| support \| admin            | oui          | non                     | —          | D-34                                                        |
| Compte                  | email_verified_at           | Vérification de l'adresse (lot email, jamais posée en V1)       | date-heure                           | non          | non                     | —          | D39 (`ARCHITECTURE.md`)                                     |
| Compte                  | password_changed_at         | Dernier changement de mot de passe                              | date-heure                           | oui          | non                     | —          | D-34                                                        |
| Compte                  | totp_secret                 | Secret TOTP chiffré (staff seulement)                           | texte (chiffré)                      | non          | non                     | P (secret) | D-34 ; D42 (`ARCHITECTURE.md`)                              |
| Compte                  | totp_last_used_step         | Dernier pas TOTP accepté (anti-rejeu)                           | entier                               | non          | non                     | —          | D-34 ; D42                                                  |
| Session                 | id                          | Identifiant de la session                                       | uuid (serveur)                       | oui          | oui                     | —          | D-35                                                        |
| Session                 | account_id                  | Compte connecté                                                 | réf. Compte                          | oui          | non                     | —          | D-35                                                        |
| Session                 | token_hash                  | SHA-256 du token du cookie                                      | octets (32)                          | oui          | oui                     | —          | D-35 ; D33                                                  |
| Session                 | audience                    | Front de la session                                             | web \| admin                         | oui          | non                     | —          | D-35 ; D34                                                  |
| Session                 | last_seen_at                | Dernière activité (écriture bornée)                             | date-heure                           | oui          | non                     | P          | D-35                                                        |
| Session                 | expires_at                  | Expiration absolue                                              | date-heure                           | oui          | non                     | —          | D-35                                                        |
| Consentement            | id                          | Identifiant                                                     | uuid (serveur)                       | oui          | oui                     | —          | D-36                                                        |
| Consentement            | diver_id                    | Plongeur qui consent                                            | réf. Plongeur                        | oui          | non                     | —          | D-36                                                        |
| Consentement            | purpose                     | Finalité                                                        | `health_data_processing`             | oui          | vivant, avec `diver_id` | —          | D-36 ; D38 (art. 9.2.a)                                     |
| Consentement            | policy_version              | Version du texte accepté                                        | texte (`HealthPolicyVersion`)        | oui          | non                     | —          | D-36                                                        |
| Consentement            | granted_at                  | Date de l'accord                                                | date-heure                           | oui          | non                     | P          | `/welcome`, `/consent` ; D-36                               |
| Consentement            | withdrawn_at                | Date du retrait (remplacé par une nouvelle version)             | date-heure                           | non          | non                     | P          | D-36                                                        |
| Événement d'auth        | id                          | Identifiant                                                     | uuid (serveur)                       | oui          | oui                     | —          | D-37                                                        |
| Événement d'auth        | account_id                  | Compte concerné (aucun si supprimé ou inconnu)                  | réf. Compte                          | non          | non                     | —          | D-37                                                        |
| Événement d'auth        | type                        | Type d'événement de sécurité                                    | liste fermée (D-37)                  | oui          | non                     | —          | D40 (`ARCHITECTURE.md`)                                     |
| Événement d'auth        | occurred_at                 | Instant                                                         | date-heure                           | oui          | non                     | P          | D-37                                                        |

**Champs techniques.** Tables synchronisées (`dive_sites`, `dive_events`, `dive_participations`,
`buddies`) : `created_at`, `updated_at` (horodatage **serveur**, curseur de synchronisation),
`deleted_at` (tombstone). `divers`, `certification_levels` et `accounts` ont `created_at` /
`updated_at`, sans tombstone. `sessions` a `created_at` et `last_seen_at` ; `consents` et
`auth_events` n'ont que leurs dates métier (`granted_at` / `withdrawn_at`, `occurred_at`). Les tables
de l'authentification ne sont **pas synchronisées** : elles ne sont lues et écrites qu'en ligne par
l'API, et aucune n'entre dans le pull. `dive_buddies.owner_id` est une copie technique servant aux FK composites (D-04).
`dive_observations` n'a aucun horodatage : comme la palanquée, elle est synchronisée avec sa
participation (D-19).

**Tous les champs ajoutés le 2026-11-16 sont facultatifs et sans défaut** (D-13 à D-21) : `NULL`
signifie « non renseigné », jamais « non » ni « aucun » (même logique que D-11). Les plongées déjà
saisies n'ont pas ces données.

**Champs de protocole, non stockés** (D-12) : `base_updated_at` (dernier `updated_at` serveur vu
par le client, envoyé avec chaque enregistrement poussé) et date du dernier pull réussi.

**Non stockés (calculés ou présentation).** « Plongée vivante » = participation **et** événement non
supprimés.

| Donnée affichée                                                  | Source                              | Calcul                                                                                          |
| ---------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| Plongées totales « 127 »                                         | `stats.totalDives`                  | `COUNT(*)` de mes participations vivantes                                                       |
| Temps sous l'eau « 84 h 23 min », « moy. 39 min »                | `stats.totalUnderwaterMinutes`      | `SUM` / `AVG(duration_min)` des participations                                                  |
| Profondeur max « 42 m · Pointe de la Revellata · 08 sept. 2025 » | `stats.maxDepthEver`                | participation de `max_depth_m` maximale ⋈ événement ⋈ site                                      |
| Sites explorés « 23 », « 6 régions »                             | `stats.sitesVisited`                | `COUNT(DISTINCT dive_events.site_id)`, `COUNT(DISTINCT region)` sur mes participations vivantes |
| Plongées par mois (12 mois), « 52 total 12M », « +3 ce mois »    | `divesPerMonth`, `recentMonthDelta` | `GROUP BY date_trunc('month', started_at + utc_offset_minutes)` (mois **local**)                |
| « 14 jours depuis ta dernière plongée »                          | —                                   | `now() - MAX(started_at)`                                                                       |
| Date et heure affichées                                          | `Dive.date`                         | `started_at` décalé de `utc_offset_minutes` (D-10)                                              |
| Marqueur carte : compteur, « -42m PROF. MAX »                    | `DiveSite.diveCount`, `maxDepthM`   | `COUNT`, `MAX(max_depth_m)` par `dive_events.site_id`                                           |
| « 24 plongées » d'un binôme, classement « Binômes fréquents »    | `Buddy.sharedDives`                 | `COUNT` sur `dive_buddies` (participations vivantes)                                            |
| `User.level` / `User.federation`                                 | contrat front                       | dérivés du niveau courant : `code`, `agency` (D-09)                                             |
| Niveau sur le badge « Air · N2 »                                 | —                                   | snapshot `dive_participations.certification_level_id`, choisi à la saisie (D-09)                |
| Initiales « LB »                                                 | `Buddy.initials`                    | dérivées de `first_name` / `last_name`                                                          |
| Couleur d'avatar                                                 | `Buddy.accentColor`                 | présentation, dérivée de l'id côté front (H-09)                                                 |
| Zone « Méditerranée occidentale »                                | `stats.mainArea`                    | `dive_sites.area` la plus fréquente sur mes plongées vivantes (D-20)                            |
| Heure de sortie « Sortie à 14:58 »                               | détail                              | `started_at + duration_min`, affichée dans `utc_offset_minutes`                                 |
| « 140 bar consommés »                                            | détail                              | `start_pressure_bar - end_pressure_bar`, si les deux sont saisies (D-15)                        |
| Segment « palier » de la barre de temps                          | détail                              | `safety_stop_duration_min / duration_min` (D-16)                                                |
| Paliers de déco. « Aucun »                                       | détail                              | `has_decompression = false` ; le détail des paliers n'est pas modélisé (D-16)                   |
| % O₂ « 21 % » d'un mélange Air ou Nitrox                         | détail                              | déduit de `gas_mix` (21, 32, 36) ; stocké seulement pour `OTHER` (D-15)                         |
| Qualificatif de visibilité « Bonne »                             | détail                              | barème côté front sur `visibility_m` (présentation)                                             |
| Niveau « N2 · FFESSM » à la plongée                              | détail                              | `dive_participations.certification_level_id` ⋈ `certification_levels` (D-09)                    |
| « Créée le … · modifiée le … »                                   | détail                              | `p.created_at` ; `GREATEST(e.updated_at, p.updated_at)`                                         |

## 2. Règles de gestion

- **RG-01** _(révisée par D-09, puis par D-38)_ — Un plongeur a au plus un niveau de certification
  courant, choisi dans le référentiel des niveaux, et **exactement un** avant tout accès au carnet
  (RG-43) ; le niveau détermine l'organisme (« N2 » est un niveau FFESSM). Un niveau peut être détenu
  par 0 à n plongeurs. Un niveau obsolète est désactivé, jamais supprimé.
- **RG-02** — Un site appartient à un seul plongeur ; un plongeur possède 0 à n sites. Les sites ne
  sont pas partagés entre plongeurs. _(décision utilisateur Q1)_
- **RG-03** _(révisée par D-08)_ — Un événement de plongée est créé par un seul plongeur ; un plongeur
  crée 0 à n événements (état vide du dashboard « Enregistrer ma première plongée »).
- **RG-04** _(révisée par D-08)_ — Un événement se déroule sur exactement un site, qui appartient à
  son créateur ; un site accueille 0 à n événements. _(« 0 » : hypothèse H-04)_
- **RG-05** — Un binôme est un contact appartenant à un seul plongeur ; un plongeur a 0 à n binômes.
  _(décision utilisateur Q2)_
- **RG-06** — Un binôme peut être lié à au plus un compte E-Deep, qui n'est jamais son propriétaire ;
  un compte peut être lié depuis 0 à n contacts (de propriétaires différents). Un même propriétaire
  ne lie un compte donné qu'à un seul de ses contacts vivants. _(Q2 ; unicité : hypothèse H-05)_
- **RG-07** _(révisée par D-08)_ — Une participation compte 0 à n binômes, tous contacts du plongeur
  participant ; un binôme accompagne 0 à n participations. _(« 0 » : hypothèse H-08)_
- **RG-08** — Le mélange d'une participation est l'un de : Air, Nitrox 32, Nitrox 36, Autre.
  _(source `labels.ts`)_
- **RG-09** — Profondeur maximale et durée sont strictement positives ; la visibilité est positive ou
  nulle ; latitude ∈ [-90, 90], longitude ∈ [-180, 180] ; décalage UTC ∈ [-720, 840] minutes.
  _(bornes : hypothèse H-10 ; décalage : D-10)_
- **RG-10** — Lier un binôme à un compte ne donne à ce compte **aucun accès** aux plongées du
  propriétaire. _(hypothèse H-05)_
- **RG-11** — La suppression d'un site, d'une plongée (événement + participation) ou d'un binôme par
  le plongeur est logique (tombstone) jusqu'à la purge ; la suppression du compte efface
  physiquement toutes ses données, sous réserve de RG-22 pour les événements partagés.
  _(D-03, D-07, RGPD)_
- **RG-12** _(révisée par D-08)_ — Un site utilisé par un événement non supprimé ne peut pas être
  supprimé. _(hypothèse H-11)_
- **RG-13** — Toutes les statistiques sont calculées sur les plongées vivantes du plongeur
  (participation et événement non supprimés).
- **RG-14** — En cas de modifications concurrentes d'un même enregistrement (deux appareils), la
  dernière écriture reçue par le serveur l'emporte, enregistrement entier — sauf la résurrection
  d'une tombstone (RG-20). _(décision utilisateur Q3, complétée par D-12)_
- **RG-15** _(révisée par D-08)_ — Une plongée (événement + ma participation + mes binômes) s'écrit
  d'un bloc, dans une transaction.
- **RG-16** _(D-08)_ — Un événement compte 1 à n participations ; un plongeur participe 0 à n
  événements, **au plus une fois** chacun. Une participation retirée puis rajoutée est restaurée,
  pas recréée.
- **RG-17** _(D-08, invariant MVP)_ — Un événement a exactement une participation, celle de son
  créateur. Seul le créateur modifie l'événement ; seul le plongeur concerné modifie sa
  participation.
- **RG-18** _(D-09, révisée)_ — Le niveau d'une participation est fixé à la saisie, côté client :
  le niveau courant du plongeur est proposé, le plongeur peut le modifier. Le serveur conserve la
  valeur fournie et ne copie le niveau courant du plongeur qu'en l'absence de valeur. Il n'est
  jamais mis à jour quand le plongeur change de niveau, mais le plongeur peut le corriger. Il peut
  référencer un niveau désactivé ou supérieur au niveau courant ; seul le niveau courant du plongeur
  doit être actif (RG-01). Une participation référence exactement un niveau ; un niveau est
  référencé par 0 à n participations.
- **RG-19** _(D-10)_ — Un événement porte le décalage UTC de l'heure locale de la plongée ; dates et
  heures s'affichent dans ce décalage, quel que soit le fuseau de l'appareil qui consulte.
- **RG-20** _(D-12)_ — Une écriture qui annulerait une suppression faite après la dernière lecture
  du client est rejetée ; la tombstone est conservée.
- **RG-21** _(D-12)_ — Une plongée écrite qui référence un site ou des binômes supprimés les
  restaure dans la même transaction : aucune référence vivante ne pointe vers un parent supprimé.
- **RG-22** _(D-08, D-07)_ — La suppression du compte du créateur d'un événement n'efface jamais la
  participation des autres plongeurs : c'est une plongée qu'ils ont faite, elle reste dans leur
  carnet. Avant l'effacement, chaque événement qui a d'autres participations vivantes est transféré
  à un autre participant, avec une copie du site dans les sites du nouveau propriétaire ; les
  événements sans autre participation sont supprimés. _(trivialement respectée en MVP, où un
  événement n'a que la participation de son créateur ; conception cible dans D-08)_
- **RG-23** _(D-15)_ — Le pourcentage d'O₂ n'est saisi que pour un mélange « Autre » ; pour Air,
  Nitrox 32 et Nitrox 36, il découle du mélange et n'est pas stocké. Il est compris entre 0
  (exclu) et 100 %.
- **RG-24** _(D-15)_ — Une participation décrit au plus un bloc (volume, matière, pressions de
  début et de fin). La pression de fin ne dépasse jamais la pression de début quand les deux sont
  saisies ; la consommation en bar est calculée, jamais stockée, et il n'y a pas de consommation
  en L/min.
- **RG-25** _(D-16)_ — Le palier de sécurité est décrit par une durée et une profondeur, saisies
  ensemble ou pas du tout. Sa profondeur ne dépasse pas la profondeur maximale, et sa durée est
  inférieure à la durée de la plongée. Le détail des paliers de décompression n'est pas
  enregistré (seul `has_decompression` l'est).
- **RG-26** _(D-17)_ — La plongée successive est déclarée par le plongeur, jamais déduite par le
  serveur ; le client peut proposer une valeur.
- **RG-27** _(D-19)_ — Une participation compte 0 à 50 observations d'espèces. Une étiquette y
  figure au plus une fois, avec un effectif facultatif (> 0), et l'ordre de saisie est conservé.
  Une observation appartient à exactement une participation et disparaît avec elle.
- **RG-28** _(D-21)_ — Un binôme a 0 ou 1 niveau de certification, son niveau courant déclaré par
  le propriétaire du contact (un niveau désactivé est admis) ; un niveau est référencé par 0 à n
  binômes. Ce niveau n'est jamais lu sur le compte lié (RG-10).
- **RG-29** _(D-13, D-18)_ — Le type de mise à l'eau, le moment (jour / nuit), la météo, la
  température de l'air, l'état de la mer, le courant et la structure appartiennent à l'événement :
  ils sont communs à la palanquée et seul le créateur les modifie (RG-17).
- **RG-30** _(D-13 à D-21)_ — Les données ajoutées par l'évolution du détail de plongée sont toutes
  facultatives, sans valeur par défaut : une valeur absente signifie « non renseigné ».
- **RG-31** _(D-27)_ — Le type d'un site est facultatif, dans une liste fermée (`tombant`, `epave`,
  `sec`, `grotte`, `herbier`, `autre`).
- **RG-32** _(D-27)_ — Les profondeurs d'un site (min, max) sont celles du site, facultatives, à une
  décimale : min ∈ [0 ; 350], max ∈ ]0 ; 350], min ≤ max quand les deux sont saisies.
- **RG-33** _(D-27)_ — Les notes d'accès d'un site sont facultatives, 1 à 2 000 caractères non blancs.
- **RG-34** _(D-28)_ — Un site a une origine immuable : `quick` (créé par son nom depuis une plongée)
  ou `full` (créé depuis la page Carte).
- **RG-35** _(D-29)_ — Fusionner A dans B rattache toutes les plongées de A à B, complète les champs
  vides de B par ceux de A et supprime A, qui garde la trace de B. A ≠ B, deux sites vivants du même
  plongeur.
- **RG-36** _(D-30)_ — Une écriture qui référence un site fusionné est redirigée vers sa cible ; la
  chaîne de fusion est toujours réduite à un saut. Un site fusionné n'est jamais restauré.
- **RG-37** _(D-31)_ — Un site n'est supprimé que s'il n'a aucune plongée vivante.
- **RG-38** _(D-34)_ — Un plongeur a 0 ou 1 compte de connexion ; un compte de rôle `diver` a
  exactement un plongeur, un compte staff (`support`, `admin`) n'en a aucun. L'email d'un compte est
  unique, comparé après normalisation (`btrim` + minuscules).
- **RG-39** _(D-34)_ — Seul un compte staff porte un secret TOTP et un dernier pas accepté ; un compte
  staff sans secret ne peut pas se connecter tant qu'il n'est pas enrôlé. Un code TOTP n'est
  accepté qu'une fois (pas strictement croissant).
- **RG-40** _(D-35)_ — Un compte a 0 à n sessions ; une session appartient à un seul compte et à une
  seule audience (`web` ou `admin`). Elle expire à `expires_at` ou après une inactivité propre à son
  audience. Un changement de mot de passe révoque les **autres** sessions du compte et tourne le
  token de la session courante ; une réinitialisation par l'exploitation les révoque toutes.
- **RG-41** _(D-36)_ — Un plongeur a au plus un consentement **vivant** par finalité. Consentir à une
  nouvelle version retire l'ancien consentement et en insère un nouveau, dans une transaction :
  l'historique des versions est conservé. Il n'y a pas de retrait seul : retirer son consentement,
  c'est supprimer son compte.
- **RG-42** _(D-37)_ — Un événement de sécurité a un type de la liste fermée et concerne 0 ou 1
  compte ; il est effacé avec le compte, et purgé après 180 jours. `account_deleted` n'a jamais de
  compte.
- **RG-43** _(D-38)_ — Un plongeur peut exister sans nom ni niveau (inscription minimale) ; le carnet
  ne lui est ouvert qu'une fois le niveau saisi et le consentement santé donné à la version courante.
  Une participation a toujours un niveau (RG-18).

## 3. MCD (notation Merise)

```mermaid
flowchart LR
  NIVEAU["<b>NIVEAU DE CERTIFICATION</b><br/># id<br/>organisme<br/>code<br/>libellé<br/>rang<br/>actif"]
  PLONGEUR["<b>PLONGEUR</b><br/># id<br/>prénom<br/>nom<br/>avatar"]
  SITE["<b>SITE</b><br/># id<br/>nom<br/>localité<br/>région<br/>zone<br/>latitude<br/>longitude"]
  EVENEMENT["<b>ÉVÉNEMENT DE PLONGÉE</b><br/># id<br/>début<br/>décalage_utc<br/>type_mise_à_l'eau<br/>moment<br/>météo<br/>temp_air<br/>état_mer<br/>courant<br/>structure"]
  PARTICIPATION["<b>PARTICIPATION</b><br/># id<br/>prof_max<br/>durée<br/>temp_fond<br/>temp_surface<br/>visibilité<br/>mélange<br/>pct_o2<br/>déco<br/>paliers_ok<br/>palier_sécu_durée<br/>palier_sécu_prof<br/>successive<br/>bloc_volume<br/>bloc_matière<br/>pression_début<br/>pression_fin<br/>combi_type<br/>combi_épaisseur<br/>lest<br/>notes"]
  BINOME["<b>BINÔME</b><br/># id<br/>prénom<br/>nom"]
  OBSERVATION["<b>OBSERVATION</b><br/># rang<br/>espèce<br/>effectif"]
  COMPTE["<b>COMPTE</b><br/># id<br/>email<br/>empreinte_mdp<br/>rôle<br/>email_vérifié_le<br/>mdp_changé_le<br/>secret_totp<br/>dernier_pas_totp"]
  SESSION["<b>SESSION</b><br/># id<br/>empreinte_token<br/>audience<br/>vu_le<br/>expire_le"]
  CONSENTEMENT["<b>CONSENTEMENT</b><br/># id<br/>finalité<br/>version<br/>accordé_le<br/>retiré_le"]
  EVENEMENT_AUTH["<b>ÉVÉNEMENT D'AUTH</b><br/># id<br/>type<br/>survenu_le"]

  DETENIR(["DÉTENIR"])
  REPERER(["REPÉRER"])
  CREER(["CRÉER"])
  SE_DEROULER(["SE DÉROULER"])
  CONCERNER(["CONCERNER"])
  PARTICIPER(["PARTICIPER"])
  ETRE_CERTIFIE(["ÊTRE CERTIFIÉ À"])
  CONNAITRE(["CONNAÎTRE"])
  CORRESPONDRE(["CORRESPONDRE À"])
  ACCOMPAGNER(["ACCOMPAGNER"])
  NOTER(["NOTER"])
  ETRE_DE_NIVEAU(["ÊTRE DE NIVEAU"])
  SE_CONNECTER(["SE CONNECTER PAR"])
  OUVRIR(["OUVRIR"])
  CONSENTIR(["CONSENTIR"])
  TRACER(["TRACER"])

  NIVEAU ---|"0,n"| DETENIR
  DETENIR ---|"0,1"| PLONGEUR
  PLONGEUR ---|"0,n"| REPERER
  REPERER ---|"1,1"| SITE
  PLONGEUR ---|"0,n"| CREER
  CREER ---|"1,1"| EVENEMENT
  SITE ---|"0,n"| SE_DEROULER
  SE_DEROULER ---|"1,1"| EVENEMENT
  EVENEMENT ---|"1,n"| CONCERNER
  CONCERNER ---|"1,1"| PARTICIPATION
  PLONGEUR ---|"0,n"| PARTICIPER
  PARTICIPER ---|"1,1"| PARTICIPATION
  NIVEAU ---|"0,n"| ETRE_CERTIFIE
  ETRE_CERTIFIE ---|"1,1"| PARTICIPATION
  PLONGEUR ---|"0,n"| CONNAITRE
  CONNAITRE ---|"1,1"| BINOME
  PLONGEUR ---|"0,n"| CORRESPONDRE
  CORRESPONDRE ---|"0,1"| BINOME
  PARTICIPATION ---|"0,n"| ACCOMPAGNER
  ACCOMPAGNER ---|"0,n"| BINOME
  PARTICIPATION ---|"0,n"| NOTER
  NOTER ---|"1,1"| OBSERVATION
  NIVEAU ---|"0,n"| ETRE_DE_NIVEAU
  ETRE_DE_NIVEAU ---|"0,1"| BINOME
  PLONGEUR ---|"0,1"| SE_CONNECTER
  SE_CONNECTER ---|"0,1"| COMPTE
  COMPTE ---|"0,n"| OUVRIR
  OUVRIR ---|"1,1"| SESSION
  PLONGEUR ---|"0,n"| CONSENTIR
  CONSENTIR ---|"1,1"| CONSENTEMENT
  COMPTE ---|"0,n"| TRACER
  TRACER ---|"0,1"| EVENEMENT_AUTH
```

| Association                                      | Cardinalités                        | RG                                                              |
| ------------------------------------------------ | ----------------------------------- | --------------------------------------------------------------- |
| DÉTENIR (niveau–plongeur, niveau courant)        | Niveau 0,n · Plongeur 0,1           | RG-01, RG-43                                                    |
| REPÉRER (plongeur–site)                          | Plongeur 0,n · Site 1,1             | RG-02                                                           |
| CRÉER (plongeur–événement)                       | Plongeur 0,n · Événement 1,1        | RG-03                                                           |
| SE DÉROULER (site–événement)                     | Site 0,n · Événement 1,1            | RG-04                                                           |
| CONCERNER (événement–participation)              | Événement 1,n · Participation 1,1   | RG-16 (1 seule en MVP : RG-17)                                  |
| PARTICIPER (plongeur–participation)              | Plongeur 0,n · Participation 1,1    | RG-16                                                           |
| ÊTRE CERTIFIÉ À (niveau–participation, snapshot) | Niveau 0,n · Participation 1,1      | RG-18                                                           |
| CONNAÎTRE (plongeur–binôme, propriétaire)        | Plongeur 0,n · Binôme 1,1           | RG-05                                                           |
| CORRESPONDRE À (binôme–plongeur, compte lié)     | Plongeur 0,n · Binôme 0,1           | RG-06 — réflexive « plongeur ↔ plongeur » portée par le contact |
| ACCOMPAGNER (participation–binôme)               | Participation 0,n · Binôme 0,n      | RG-07                                                           |
| NOTER (participation–observation)                | Participation 0,n · Observation 1,1 | RG-27 (au plus 50)                                              |
| ÊTRE DE NIVEAU (niveau–binôme, niveau courant)   | Niveau 0,n · Binôme 0,1             | RG-28                                                           |
| SE CONNECTER PAR (plongeur–compte)               | Plongeur 0,1 · Compte 0,1           | RG-38 (compte staff : aucun plongeur)                           |
| OUVRIR (compte–session)                          | Compte 0,n · Session 1,1            | RG-40                                                           |
| CONSENTIR (plongeur–consentement)                | Plongeur 0,n · Consentement 1,1     | RG-41 (un seul vivant par finalité)                             |
| TRACER (compte–événement d'auth)                 | Compte 0,n · Événement d'auth 0,1   | RG-42                                                           |

**Observation : entité faible.** OBSERVATION n'a pas d'existence propre : elle est identifiée
relativement à sa participation (`# rang` + identifiant de PARTICIPATION), disparaît avec elle et
se synchronise avec elle (D-19). L'espèce est une étiquette libre, pas une référence à un
catalogue : il n'y a pas d'entité ESPÈCE tant qu'aucun référentiel n'est retenu (évolution
prévisible).

**Équipement et conditions : attributs, pas entités.** Bloc, combinaison et lest décrivent la
participation (une plongée = un équipement, D-15) ; météo, mer, courant, type et structure
décrivent l'événement (D-13, D-18). Aucun écran ne les gère comme des objets réutilisables.

**Participation : entité plutôt qu'association porteuse.** PARTICIPATION est sémantiquement une
association porteuse PLONGEUR (0,n) – ÉVÉNEMENT (1,n). Elle est modélisée en entité (identifiant
propre `# id`, deux associations 1,1) parce qu'elle est générée hors ligne, référencée par
ACCOMPAGNER et synchronisée individuellement. L'identifiant naturel `(événement, plongeur)` reste une
clé candidate (`UNIQUE`, RG-16).

**Compte : entité distincte du plongeur.** COMPTE porte la connexion, PLONGEUR le carnet (D-34) :
un compte staff n'a pas de plongeur, et le futur pull du plongeur ne transportera jamais
d'empreinte de mot de passe. SESSION, CONSENTEMENT et ÉVÉNEMENT D'AUTH ne sont pas synchronisés.

**Redondances vérifiées.**

- PLONGEUR → ÉVÉNEMENT → SITE et PLONGEUR → SITE : pas de redondance (un site existe sans
  événement, REPÉRER porte la propriété). La cohérence « le site est celui du créateur » est imposée
  par la FK composite `(creator_id, site_id)`.
- CRÉER et PARTICIPER relient PLONGEUR à la même plongée par deux rôles distincts (saisie /
  pratique). En MVP le créateur et l'unique participant coïncident (RG-17), mais le partage futur
  les sépare : on garde les deux.
- DÉTENIR et ÊTRE CERTIFIÉ À : pas de redondance, l'une est le niveau courant, l'autre le niveau
  à la date de la plongée, choisi à la saisie (snapshot, RG-18) ; ils peuvent légitimement différer.
- ÊTRE DE NIVEAU (binôme) et DÉTENIR (via CORRESPONDRE À) : pas de redondance. Le premier est ce
  que le propriétaire déclare de son contact, le second appartient au compte lié et n'est jamais
  lu (RG-10, RG-28).
- CONNAÎTRE et CORRESPONDRE À : rôles distincts (propriétaire / compte lié).

## 4. MLD

```
certification_levels(**id**, agency, code, label, rank, is_active, created_at, updated_at)
divers(**id**, first_name, last_name, #certification_level_id, avatar_url, created_at, updated_at)
dive_sites(**id**, #owner_id, name, locality, region, area, latitude, longitude,
            type, depth_min_m, depth_max_m, access_notes, created_via, #merged_into_id,
            created_at, updated_at, deleted_at)
dive_events(**id**, #creator_id, #site_id, started_at, utc_offset_minutes,
            entry_type, time_of_day, weather, air_temperature_c, sea_state, current_strength,
            dive_center, created_at, updated_at, deleted_at)
dive_participations(**id**, #dive_event_id, #diver_id, #certification_level_id, max_depth_m,
            duration_min, water_temperature_c, surface_water_temperature_c, visibility_m, gas_mix,
            o2_percent, has_decompression, stops_ok, safety_stop_duration_min, safety_stop_depth_m,
            is_repetitive, tank_volume_l, tank_material, start_pressure_bar, end_pressure_bar,
            suit_type, suit_thickness_mm, weight_kg, notes, created_at, updated_at, deleted_at)
buddies(**id**, #owner_id, first_name, last_name, #linked_diver_id, #certification_level_id,
            created_at, updated_at, deleted_at)
dive_buddies(**#participation_id, #buddy_id**, #owner_id)
dive_observations(**#participation_id, position**, label, count)
accounts(**id**, #diver_id, email, password_hash, role, email_verified_at, password_changed_at,
            totp_secret, totp_last_used_step, created_at, updated_at)
sessions(**id**, #account_id, token_hash, audience, created_at, last_seen_at, expires_at)
consents(**id**, #diver_id, purpose, policy_version, granted_at, withdrawn_at)
auth_events(**id**, #account_id, type, occurred_at)
```

- `dive_events.(creator_id, site_id)` → `dive_sites.(owner_id, id)`.
- `dive_sites.(owner_id, merged_into_id)` → `dive_sites.(owner_id, id)` (réflexive, D-30).
- `dive_buddies.(owner_id, participation_id)` → `dive_participations.(diver_id, id)` ;
  `dive_buddies.(owner_id, buddy_id)` → `buddies.(owner_id, id)`.
- `divers.certification_level_id` et `dive_participations.certification_level_id` →
  `certification_levels.id`.
- `buddies.linked_diver_id` → `divers.id` (rôle « compte lié », distinct de `owner_id`).
- `buddies.certification_level_id` → `certification_levels.id` (niveau déclaré du contact, D-21).
- `dive_observations.participation_id` → `dive_participations.id` (entité faible, D-19).
- `accounts.diver_id` → `divers.id` (`UNIQUE`, nullable : compte staff) ; `consents.diver_id` →
  `divers.id` ; `sessions.account_id` et `auth_events.account_id` (nullable) → `accounts.id`.

**Normalisation.**

- 1FN : pas de liste en colonne (palanquée dans `dive_buddies`).
- 2FN : clé composite unique = `dive_buddies(participation_id, buddy_id)`. `owner_id` dépend de
  `participation_id` seul : **violation 2FN volontaire** (D-04), neutralisée par les deux FK
  composites.
- 3FN : la dépendance transitive `level → federation` de la version précédente est supprimée
  (D-09) : `divers` ne porte plus que `certification_level_id`, l'organisme dépend du niveau dans
  `certification_levels`. `dive_participations` ne contient ni site ni date (dans `dive_events`),
  `dive_events` ne contient ni nom de site ni région (joints). `started_at` n'est **pas** copié dans
  les participations (D-08).
- `dive_participations.certification_level_id` n'est pas une dépendance de `diver_id` : c'est un
  snapshot (niveau à la date de la plongée), donnée historique distincte du niveau courant.
- BCNF : `dive_participations` a deux clés candidates (`id` et `(dive_event_id, diver_id)`), sans
  attribut non-clé déterminant une partie de clé.
- **`o2_percent` (D-15)** : pour `AIR`, `NITROX32` et `NITROX36`, `gas_mix → o2` est une
  dépendance fonctionnelle. Stocker le pourcentage pour ces mélanges créerait une dépendance
  transitive (violation 3FN) et un risque d'incohérence (« Nitrox 32 à 28 % »). Le `CHECK`
  `ck_dive_participations__o2_percent` le réserve donc à `OTHER`, où il ne dépend que de la clé.
- **Bar consommés, heure de sortie** : calculés (RG-24, D-08), pas de colonne dérivée.
- `dive_observations` : clé `(participation_id, position)`, seconde clé candidate
  `(participation_id, label)`. `label` et `count` dépendent de la clé entière ; aucun attribut ne
  dépend de `participation_id` seul (2FN, BCNF).
- Conditions sur l'événement (D-13) : elles dépendent de la plongée (un instant sur un site), pas
  du site seul (la météo change) ni du plongeur. `area` dépend du site (D-20).
- Anomalies sur `dive_participations` / `dive_events` : un site peut exister sans événement ; changer
  la date d'une plongée = 1 UPDATE sur l'événement ; changer de niveau ne réécrit pas l'historique ;
  supprimer la dernière participation d'un site ne supprime pas le site.

## 5. Schéma physique (PostgreSQL 18)

```mermaid
erDiagram
  certification_levels ||--o{ divers : "niveau courant"
  certification_levels ||--o{ dive_participations : "niveau à la plongée"
  certification_levels |o--o{ buddies : "niveau déclaré"
  divers ||--o{ dive_sites : "possède"
  divers ||--o{ dive_events : "crée"
  divers ||--o{ dive_participations : "participe"
  divers ||--o{ buddies : "possède (owner)"
  divers |o--o{ buddies : "est lié à (linked)"
  dive_sites ||--o{ dive_events : "accueille"
  dive_events ||--|{ dive_participations : "concerne"
  dive_participations ||--o{ dive_buddies : "compte"
  buddies ||--o{ dive_buddies : "accompagne"
  dive_participations ||--o{ dive_observations : "note"
  divers |o--o| accounts : "se connecte via"
  divers ||--o{ consents : "consent"
  accounts ||--o{ sessions : "ouvre"
  accounts |o--o{ auth_events : "trace"

  certification_levels {
    uuid id PK
    text agency UK
    text code UK
    text label
    smallint rank
    boolean is_active
    timestamptz created_at
    timestamptz updated_at
  }
  divers {
    uuid id PK
    text first_name
    text last_name
    uuid certification_level_id FK
    text avatar_url
    timestamptz created_at
    timestamptz updated_at
  }
  dive_sites {
    uuid id PK
    uuid owner_id FK
    text name
    text locality
    text region
    text area
    numeric latitude
    numeric longitude
    text type
    numeric depth_min_m
    numeric depth_max_m
    text access_notes
    text created_via
    uuid merged_into_id FK
    timestamptz created_at
    timestamptz updated_at
    timestamptz deleted_at
  }
  dive_events {
    uuid id PK
    uuid creator_id FK
    uuid site_id FK
    timestamptz started_at
    smallint utc_offset_minutes
    text entry_type
    text time_of_day
    text weather
    numeric air_temperature_c
    text sea_state
    text current_strength
    text dive_center
    timestamptz created_at
    timestamptz updated_at
    timestamptz deleted_at
  }
  dive_participations {
    uuid id PK
    uuid dive_event_id FK
    uuid diver_id FK
    uuid certification_level_id FK
    numeric max_depth_m
    smallint duration_min
    numeric water_temperature_c
    numeric surface_water_temperature_c
    smallint visibility_m
    text gas_mix
    numeric o2_percent
    boolean has_decompression
    boolean stops_ok
    smallint safety_stop_duration_min
    numeric safety_stop_depth_m
    boolean is_repetitive
    numeric tank_volume_l
    text tank_material
    smallint start_pressure_bar
    smallint end_pressure_bar
    text suit_type
    numeric suit_thickness_mm
    numeric weight_kg
    text notes
    timestamptz created_at
    timestamptz updated_at
    timestamptz deleted_at
  }
  buddies {
    uuid id PK
    uuid owner_id FK
    text first_name
    text last_name
    uuid linked_diver_id FK
    uuid certification_level_id FK
    timestamptz created_at
    timestamptz updated_at
    timestamptz deleted_at
  }
  dive_buddies {
    uuid participation_id PK
    uuid buddy_id PK
    uuid owner_id FK
  }
  dive_observations {
    uuid participation_id PK
    smallint position PK
    text label UK
    smallint count
  }
  accounts {
    uuid id PK
    uuid diver_id FK, UK "NULL si staff"
    text email UK
    text password_hash
    text role
    timestamptz email_verified_at
    timestamptz password_changed_at
    text totp_secret
    bigint totp_last_used_step
    timestamptz created_at
    timestamptz updated_at
  }
  sessions {
    uuid id PK
    uuid account_id FK
    bytea token_hash UK
    text audience
    timestamptz created_at
    timestamptz last_seen_at
    timestamptz expires_at
  }
  consents {
    uuid id PK
    uuid diver_id FK
    text purpose
    text policy_version
    timestamptz granted_at
    timestamptz withdrawn_at
  }
  auth_events {
    uuid id PK
    uuid account_id FK
    text type
    timestamptz occurred_at
  }
```

### Types et colonnes

| Table                   | Colonne                     | Type PG        | Null | Défaut              | Note                                                                                                      |
| ----------------------- | --------------------------- | -------------- | ---- | ------------------- | --------------------------------------------------------------------------------------------------------- |
| certification_levels    | id                          | uuid           | non  | `uuidv7()`          | référentiel serveur (D-09)                                                                                |
| certification_levels    | agency, code                | text           | non  | —                   | 1..40 caractères non blancs ; `UNIQUE (agency, code)`                                                     |
| certification_levels    | label                       | text           | non  | —                   | 1..120 caractères non blancs                                                                              |
| certification_levels    | rank                        | smallint       | non  | —                   | `> 0`                                                                                                     |
| certification_levels    | is_active                   | boolean        | non  | `true`              |                                                                                                           |
| divers                  | id                          | uuid           | non  | `uuidv7()`          | créé en ligne à l'inscription (D-02)                                                                      |
| divers                  | first_name                  | text           | non  | —                   | `char_length(btrim(x)) BETWEEN 1 AND 100`                                                                 |
| divers                  | last_name                   | text           | oui  | —                   | `IS NULL OR char_length(btrim(x)) BETWEEN 1 AND 100` (D-38)                                               |
| divers                  | certification_level_id      | uuid           | oui  | —                   | FK certification_levels ; `NULL` jusqu'à `/welcome` (D-38)                                                |
| divers                  | avatar_url                  | text           | oui  | —                   | `char_length(avatar_url) <= 2048`                                                                         |
| dive_sites              | id                          | uuid           | non  | aucun (client)      | UUIDv7 fourni par le client (D-02)                                                                        |
| dive_sites              | owner_id                    | uuid           | non  | —                   | FK divers                                                                                                 |
| dive_sites              | name                        | text           | non  | —                   | 1..120 caractères non blancs                                                                              |
| dive_sites              | region                      | text           | oui  | —                   | 1..120 caractères non blancs (D-23)                                                                       |
| dive_sites              | locality, area              | text           | oui  | —                   | 1..120 caractères non blancs (D27, D-20)                                                                  |
| dive_sites              | latitude                    | numeric(8,6)   | oui  | —                   | `BETWEEN -90 AND 90` ; avec `longitude` ou aucune (D-23)                                                  |
| dive_sites              | longitude                   | numeric(9,6)   | oui  | —                   | `BETWEEN -180 AND 180`                                                                                    |
| dive_sites              | type                        | text           | oui  | —                   | liste fermée RG-31 (D-27)                                                                                 |
| dive_sites              | depth_min_m, depth_max_m    | numeric(4,1)   | oui  | —                   | min 0..350, max ]0..350], min ≤ max (RG-32)                                                               |
| dive_sites              | access_notes                | text           | oui  | —                   | 1..2000 caractères non blancs (RG-33)                                                                     |
| dive_sites              | created_via                 | text           | non  | —                   | `quick` / `full`, immuable (RG-34, D-28)                                                                  |
| dive_sites              | merged_into_id              | uuid           | oui  | —                   | cible d'une fusion, tombstone seulement (D-30)                                                            |
| dive_events             | id                          | uuid           | non  | aucun (client)      |                                                                                                           |
| dive_events             | creator_id, site_id         | uuid           | non  | —                   | FK composite vers dive_sites                                                                              |
| dive_events             | started_at                  | timestamptz    | non  | —                   | instant UTC                                                                                               |
| dive_events             | utc_offset_minutes          | smallint       | non  | —                   | `BETWEEN -720 AND 840` (D-10)                                                                             |
| dive_events             | entry_type                  | text           | oui  | —                   | `IN ('BOAT','SHORE')` (D-13)                                                                              |
| dive_events             | time_of_day                 | text           | oui  | —                   | `IN ('DAY','NIGHT')` (D-13)                                                                               |
| dive_events             | weather                     | text           | oui  | —                   | `IN ('SUNNY','CLOUDY','OVERCAST','RAIN')` (D-13, H-18)                                                    |
| dive_events             | air_temperature_c           | numeric(3,1)   | oui  | —                   | `BETWEEN -40 AND 60` (H-17)                                                                               |
| dive_events             | sea_state                   | text           | oui  | —                   | `IN ('CALM','SLIGHT','MODERATE','ROUGH')` (D-13, H-18)                                                    |
| dive_events             | current_strength            | text           | oui  | —                   | `IN ('NONE','WEAK','MODERATE','STRONG')` (D-13, H-18)                                                     |
| dive_events             | dive_center                 | text           | oui  | —                   | 1..120 caractères non blancs (D-18)                                                                       |
| dive_participations     | id                          | uuid           | non  | aucun (client)      |                                                                                                           |
| dive_participations     | dive_event_id, diver_id     | uuid           | non  | —                   | `UNIQUE (dive_event_id, diver_id)`                                                                        |
| dive_participations     | certification_level_id      | uuid           | non  | —                   | snapshot fourni par le client ; à défaut, niveau courant copié par le service (D-09)                      |
| dive_participations     | max_depth_m                 | numeric(4,1)   | non  | —                   | `> 0 AND <= 350`                                                                                          |
| dive_participations     | duration_min                | smallint       | non  | —                   | `> 0 AND <= 1440`                                                                                         |
| dive_participations     | water_temperature_c         | numeric(3,1)   | oui  | —                   | `BETWEEN -5 AND 45`                                                                                       |
| dive_participations     | visibility_m                | smallint       | oui  | —                   | `BETWEEN 0 AND 100`                                                                                       |
| dive_participations     | gas_mix                     | text           | non  | —                   | `IN ('AIR','NITROX32','NITROX36','OTHER')`                                                                |
| dive_participations     | has_decompression           | boolean        | non  | `false`             |                                                                                                           |
| dive_participations     | stops_ok                    | boolean        | non  | **aucun**           | saisie imposée (D-11)                                                                                     |
| dive_participations     | notes                       | text           | oui  | —                   | `char_length <= 5000`                                                                                     |
| dive_participations     | surface_water_temperature_c | numeric(3,1)   | oui  | —                   | `BETWEEN -5 AND 45` (comme `water_temperature_c`)                                                         |
| dive_participations     | safety_stop_duration_min    | smallint       | oui  | —                   | `> 0 AND <= 60`, `< duration_min` ; nul avec `safety_stop_depth_m` (D-16)                                 |
| dive_participations     | safety_stop_depth_m         | numeric(3,1)   | oui  | —                   | `> 0 AND <= 20`, `<= max_depth_m` (D-16)                                                                  |
| dive_participations     | is_repetitive               | boolean        | oui  | **aucun**           | déclarée (D-17)                                                                                           |
| dive_participations     | o2_percent                  | numeric(4,1)   | oui  | —                   | seulement si `gas_mix = 'OTHER'`, `> 0 AND <= 100` (D-15)                                                 |
| dive_participations     | tank_volume_l               | numeric(3,1)   | oui  | —                   | `> 0 AND <= 30` (H-17)                                                                                    |
| dive_participations     | tank_material               | text           | oui  | —                   | `IN ('STEEL','ALUMINIUM')` (D-15)                                                                         |
| dive_participations     | start_pressure_bar          | smallint       | oui  | —                   | `> 0 AND <= 350` (H-17)                                                                                   |
| dive_participations     | end_pressure_bar            | smallint       | oui  | —                   | `BETWEEN 0 AND 350`, `<= start_pressure_bar` si saisie (RG-24)                                            |
| dive_participations     | suit_type                   | text           | oui  | —                   | `IN ('WET','SEMI_DRY','DRY')` (D-15, H-18)                                                                |
| dive_participations     | suit_thickness_mm           | numeric(3,1)   | oui  | —                   | `> 0 AND <= 15` (H-17)                                                                                    |
| dive_participations     | weight_kg                   | numeric(3,1)   | oui  | —                   | `BETWEEN 0 AND 40` (H-17)                                                                                 |
| buddies                 | id                          | uuid           | non  | aucun (client)      |                                                                                                           |
| buddies                 | owner_id                    | uuid           | non  | —                   | FK divers                                                                                                 |
| buddies                 | first_name, last_name       | text           | non  | —                   | 1..100 caractères non blancs                                                                              |
| buddies                 | linked_diver_id             | uuid           | oui  | —                   | FK divers, `<> owner_id`                                                                                  |
| buddies                 | certification_level_id      | uuid           | oui  | —                   | FK certification_levels, niveau déclaré du contact (D-21)                                                 |
| dive_buddies            | participation_id, buddy_id  | uuid           | non  | —                   | PK composite                                                                                              |
| dive_buddies            | owner_id                    | uuid           | non  | —                   | copie technique pour FK composites                                                                        |
| dive_observations       | participation_id, position  | uuid, smallint | non  | —                   | PK composite ; `position BETWEEN 0 AND 49` (plafond de 50, RG-27)                                         |
| dive_observations       | label                       | text           | non  | —                   | 1..80 caractères non blancs ; `UNIQUE (participation_id, label)`                                          |
| dive_observations       | count                       | smallint       | oui  | —                   | `BETWEEN 1 AND 9999`                                                                                      |
| accounts                | id                          | uuid           | non  | `uuidv7()`          | serveur                                                                                                   |
| accounts                | diver_id                    | uuid           | oui  | —                   | FK divers, `UNIQUE` ; `NULL` ⇔ compte staff (D-34)                                                        |
| accounts                | email                       | text           | non  | —                   | `lower(btrim(email))`, 3..254 caractères, `@` après le 1er caractère ; ASCII en bêta (contrôlé par l'API) |
| accounts                | password_hash               | text           | non  | —                   | PHC commençant par `$argon2id$` (D35)                                                                     |
| accounts                | role                        | text           | non  | `'diver'`           | `IN ('diver','support','admin')`                                                                          |
| accounts                | email_verified_at           | timestamptz    | oui  | —                   | préparé pour le lot email (D39)                                                                           |
| accounts                | password_changed_at         | timestamptz    | non  | `now()`             |                                                                                                           |
| accounts                | totp_secret                 | text           | oui  | —                   | `v1.<iv>.<tag>.<chiffré>` (AES-256-GCM, id du compte en données authentifiées) ; staff seulement          |
| accounts                | totp_last_used_step         | bigint         | oui  | —                   | dernier pas de 30 s accepté (anti-rejeu) ; staff seulement                                                |
| sessions                | id                          | uuid           | non  | `uuidv7()`          | serveur                                                                                                   |
| sessions                | account_id                  | uuid           | non  | —                   | FK accounts                                                                                               |
| sessions                | token_hash                  | bytea          | non  | —                   | SHA-256 du token (32 octets) ; le token n'est jamais stocké                                               |
| sessions                | audience                    | text           | non  | —                   | `IN ('web','admin')`                                                                                      |
| sessions                | created_at, last_seen_at    | timestamptz    | non  | `now()`             | `last_seen_at` écrit au plus 1 fois par heure (web) ou par minute (admin)                                 |
| sessions                | expires_at                  | timestamptz    | non  | —                   | expiration absolue (web : 180 j, ou 24 h sans « Rester connecté » ; admin : 8 h)                          |
| consents                | id                          | uuid           | non  | `uuidv7()`          | serveur                                                                                                   |
| consents                | diver_id                    | uuid           | non  | —                   | FK divers                                                                                                 |
| consents                | purpose                     | text           | non  | —                   | `IN ('health_data_processing')`                                                                           |
| consents                | policy_version              | text           | non  | —                   | 1..32 caractères (`HealthPolicyVersion`, `'2026-11'`)                                                     |
| consents                | granted_at                  | timestamptz    | non  | `now()`             |                                                                                                           |
| consents                | withdrawn_at                | timestamptz    | oui  | —                   | `>= granted_at`                                                                                           |
| auth_events             | id                          | uuid           | non  | `uuidv7()`          | serveur                                                                                                   |
| auth_events             | account_id                  | uuid           | oui  | —                   | FK accounts ; `NULL` pour `account_deleted`, `login_throttled` et un `login_failed` sur un email inconnu  |
| auth_events             | type                        | text           | non  | —                   | liste fermée de D-37 (11 valeurs)                                                                         |
| auth_events             | occurred_at                 | timestamptz    | non  | `now()`             | purge après 180 jours                                                                                     |
| _toutes sauf jonctions_ | created_at                  | timestamptz    | non  | `now()`             | jonctions = `dive_buddies`, `dive_observations` ; ni `consents` ni `auth_events`                          |
| _toutes sauf jonctions_ | updated_at                  | timestamptz    | non  | `clock_timestamp()` | posé par **trigger** à chaque INSERT/UPDATE (D-03) ; ni `sessions`, ni `consents`, ni `auth_events`       |
| _synchronisées_         | deleted_at                  | timestamptz    | oui  | —                   | tombstone                                                                                                 |

### Données initiales (migration)

`certification_levels` : uniquement ce que les sources attestent (D-09).

| agency | code | label    | rank |
| ------ | ---- | -------- | ---- |
| FFESSM | N1   | Niveau 1 | 10   |
| FFESSM | N2   | Niveau 2 | 20   |
| FFESSM | N3   | Niveau 3 | 30   |
| FFESSM | N4   | Niveau 4 | 40   |

La liste complémentaire (CMAS, PADI, SSI) est une **proposition à valider** dans `decisions.md`
(D-09), non insérée.

## 6. Contraintes et index

### Contraintes

| Table                | Nom                                                                                        | Définition                                                                                                                                                                                                    | Justification                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| certification_levels | uq_certification_levels__agency_code                                                       | `UNIQUE (agency, code)`                                                                                                                                                                                       | un code par organisme                                                                                                |
| certification_levels | ck_certification_levels__agency / __code / __label                                         | longueurs non blanches                                                                                                                                                                                        |                                                                                                                      |
| certification_levels | ck_certification_levels__rank                                                              | `rank > 0`                                                                                                                                                                                                    |                                                                                                                      |
| divers               | fk_divers__certification_level_id                                                          | → certification_levels(id) **ON DELETE RESTRICT**                                                                                                                                                             | RG-01 : un niveau se désactive, il ne se supprime pas                                                                |
| divers               | ck_divers__first_name / __last_name                                                        | `char_length(btrim(x)) BETWEEN 1 AND 100` ; `last_name IS NULL OR …` depuis `AllowIncompleteDiverProfile`                                                                                                     | nom non vide ; nom facultatif (D-38)                                                                                 |
| divers               | ck_divers__avatar_url                                                                      | `avatar_url IS NULL OR char_length(avatar_url) <= 2048`                                                                                                                                                       |                                                                                                                      |
| dive_sites           | fk_dive_sites__owner_id                                                                    | → divers(id) **ON DELETE CASCADE**                                                                                                                                                                            | RG-02, RG-11                                                                                                         |
| dive_sites           | uq_dive_sites__owner_id_id                                                                 | `UNIQUE (owner_id, id)`                                                                                                                                                                                       | cible de FK composite (D-04)                                                                                         |
| dive_sites           | ck_dive_sites__latitude / __longitude                                                      | bornes WGS84                                                                                                                                                                                                  | RG-09                                                                                                                |
| dive_sites           | ck_dive_sites__name / __region                                                             | 1..120 caractères non blancs                                                                                                                                                                                  |                                                                                                                      |
| dive_sites           | ck_dive_sites__locality / __area                                                           | `x IS NULL OR char_length(btrim(x)) BETWEEN 1 AND 120`                                                                                                                                                        | D27, D-20                                                                                                            |
| dive_sites           | ck_dive_sites__position                                                                    | `(latitude IS NULL) = (longitude IS NULL)`                                                                                                                                                                    | D-23                                                                                                                 |
| dive_sites           | ck_dive_sites__type                                                                        | `type IS NULL OR type IN ('tombant','epave','sec','grotte','herbier','autre')`                                                                                                                                | RG-31, D-27                                                                                                          |
| dive_sites           | ck_dive_sites__depth_min_m / __depth_max_m / __depth_range                                 | `IS NULL OR BETWEEN 0 AND 350` / `IS NULL OR (> 0 AND <= 350)` / `min IS NULL OR max IS NULL OR min <= max`                                                                                                   | RG-32                                                                                                                |
| dive_sites           | ck_dive_sites__access_notes                                                                | `access_notes IS NULL OR char_length(btrim(access_notes)) BETWEEN 1 AND 2000`                                                                                                                                 | RG-33                                                                                                                |
| dive_sites           | ck_dive_sites__created_via                                                                 | `created_via IN ('quick','full')`                                                                                                                                                                             | RG-34, D-28                                                                                                          |
| dive_sites           | fk_dive_sites__owner_id_merged_into_id                                                     | (owner_id, merged_into_id) → dive_sites(owner_id, id) **NO ACTION**                                                                                                                                           | RG-35, D-30 (cible du même plongeur)                                                                                 |
| dive_sites           | ck_dive_sites__merged_into_id_tombstone / __merged_into_id_not_self                        | `merged_into_id IS NULL OR deleted_at IS NOT NULL` / `merged_into_id IS NULL OR merged_into_id <> id`                                                                                                         | RG-36, D-30                                                                                                          |
| dive_events          | fk_dive_events__creator_id                                                                 | → divers(id) **ON DELETE CASCADE**                                                                                                                                                                            | RG-03, RG-11 ; MVP seulement : passera en **RESTRICT** avec le partage, après transfert des événements (RG-22, D-08) |
| dive_events          | fk_dive_events__creator_id_site_id                                                         | (creator_id, site_id) → dive_sites(owner_id, id) **ON DELETE RESTRICT**                                                                                                                                       | RG-04 (site du créateur), RG-12 (purge d'un site référencé impossible)                                               |
| dive_events          | ck_dive_events__utc_offset_minutes                                                         | `utc_offset_minutes BETWEEN -720 AND 840`                                                                                                                                                                     | RG-09, D-10                                                                                                          |
| dive_events          | ck_dive_events__entry_type / __time_of_day / __weather / __sea_state / __current_strength  | `x IS NULL OR x IN (...)` (valeurs : voir types)                                                                                                                                                              | RG-29, D-13, D-14                                                                                                    |
| dive_events          | ck_dive_events__air_temperature_c                                                          | `air_temperature_c IS NULL OR air_temperature_c BETWEEN -40 AND 60`                                                                                                                                           | H-17                                                                                                                 |
| dive_events          | ck_dive_events__dive_center                                                                | `dive_center IS NULL OR char_length(btrim(dive_center)) BETWEEN 1 AND 120`                                                                                                                                    | D-18                                                                                                                 |
| dive_participations  | fk_dive_participations__dive_event_id                                                      | → dive_events(id) **ON DELETE CASCADE**                                                                                                                                                                       | composition : la participation suit l'événement                                                                      |
| dive_participations  | fk_dive_participations__diver_id                                                           | → divers(id) **ON DELETE CASCADE**                                                                                                                                                                            | RG-11                                                                                                                |
| dive_participations  | fk_dive_participations__certification_level_id                                             | → certification_levels(id) **ON DELETE RESTRICT**                                                                                                                                                             | RG-18                                                                                                                |
| dive_participations  | uq_dive_participations__dive_event_id_diver_id                                             | `UNIQUE (dive_event_id, diver_id)` (tombstones incluses)                                                                                                                                                      | RG-16                                                                                                                |
| dive_participations  | uq_dive_participations__diver_id_id                                                        | `UNIQUE (diver_id, id)`                                                                                                                                                                                       | cible de FK composite de `dive_buddies`                                                                              |
| dive_participations  | ck_dive_participations__max_depth_m, __duration_min, __water_temperature_c, __visibility_m | voir types                                                                                                                                                                                                    | RG-09                                                                                                                |
| dive_participations  | ck_dive_participations__gas_mix                                                            | `gas_mix IN (...)`                                                                                                                                                                                            | RG-08                                                                                                                |
| dive_participations  | ck_dive_participations__notes                                                              | `notes IS NULL OR char_length(notes) <= 5000`                                                                                                                                                                 | borne technique                                                                                                      |
| dive_participations  | ck_dive_participations__surface_water_temperature_c                                        | `IS NULL OR BETWEEN -5 AND 45`                                                                                                                                                                                | H-17                                                                                                                 |
| dive_participations  | ck_dive_participations__safety_stop                                                        | `(safety_stop_duration_min IS NULL) = (safety_stop_depth_m IS NULL)`                                                                                                                                          | RG-25 : palier complet ou absent                                                                                     |
| dive_participations  | ck_dive_participations__safety_stop_duration_min                                           | `IS NULL OR (safety_stop_duration_min > 0 AND safety_stop_duration_min <= 60 AND safety_stop_duration_min < duration_min)`                                                                                    | RG-25                                                                                                                |
| dive_participations  | ck_dive_participations__safety_stop_depth_m                                                | `IS NULL OR (safety_stop_depth_m > 0 AND safety_stop_depth_m <= 20 AND safety_stop_depth_m <= max_depth_m)`                                                                                                   | RG-25                                                                                                                |
| dive_participations  | ck_dive_participations__o2_percent                                                         | `o2_percent IS NULL OR (gas_mix = 'OTHER' AND o2_percent > 0 AND o2_percent <= 100)`                                                                                                                          | RG-23, D-15 (3FN)                                                                                                    |
| dive_participations  | ck_dive_participations__tank_volume_l                                                      | `IS NULL OR (tank_volume_l > 0 AND tank_volume_l <= 30)`                                                                                                                                                      | H-17                                                                                                                 |
| dive_participations  | ck_dive_participations__start_pressure_bar                                                 | `IS NULL OR (start_pressure_bar > 0 AND start_pressure_bar <= 350)`                                                                                                                                           | H-17                                                                                                                 |
| dive_participations  | ck_dive_participations__end_pressure_bar                                                   | `IS NULL OR (end_pressure_bar BETWEEN 0 AND 350 AND (start_pressure_bar IS NULL OR end_pressure_bar <= start_pressure_bar))`                                                                                  | RG-24                                                                                                                |
| dive_participations  | ck_dive_participations__tank_material / __suit_type                                        | `x IS NULL OR x IN (...)`                                                                                                                                                                                     | D-14, D-15                                                                                                           |
| dive_participations  | ck_dive_participations__suit_thickness_mm / __weight_kg                                    | `IS NULL OR` bornes (voir types)                                                                                                                                                                              | H-17                                                                                                                 |
| buddies              | fk_buddies__certification_level_id                                                         | → certification_levels(id) **ON DELETE RESTRICT**                                                                                                                                                             | RG-28 ; un niveau se désactive, il ne se supprime pas                                                                |
| dive_observations    | pk_dive_observations                                                                       | `PRIMARY KEY (participation_id, position)`                                                                                                                                                                    | entité faible (D-19)                                                                                                 |
| dive_observations    | uq_dive_observations__participation_id_label                                               | `UNIQUE (participation_id, label)`                                                                                                                                                                            | RG-27 : une étiquette une fois par participation                                                                     |
| dive_observations    | fk_dive_observations__participation_id                                                     | → dive_participations(id) **ON DELETE CASCADE**                                                                                                                                                               | composition : les observations suivent la participation (purge, effacement du compte)                                |
| dive_observations    | ck_dive_observations__position                                                             | `position BETWEEN 0 AND 49`                                                                                                                                                                                   | RG-27 : plafond de 50 garanti par la base                                                                            |
| dive_observations    | ck_dive_observations__label                                                                | `char_length(btrim(label)) BETWEEN 1 AND 80`                                                                                                                                                                  |                                                                                                                      |
| dive_observations    | ck_dive_observations__count                                                                | `count IS NULL OR count BETWEEN 1 AND 9999`                                                                                                                                                                   | RG-27                                                                                                                |
| buddies              | fk_buddies__owner_id                                                                       | → divers(id) **ON DELETE CASCADE**                                                                                                                                                                            | RG-05, RG-11                                                                                                         |
| buddies              | fk_buddies__linked_diver_id                                                                | → divers(id) **ON DELETE SET NULL**                                                                                                                                                                           | RG-06                                                                                                                |
| buddies              | ck_buddies__not_self                                                                       | `linked_diver_id IS NULL OR linked_diver_id <> owner_id`                                                                                                                                                      | RG-06                                                                                                                |
| buddies              | uq_buddies__owner_id_linked_diver_id                                                       | `UNIQUE (owner_id, linked_diver_id) WHERE linked_diver_id IS NOT NULL AND deleted_at IS NULL`                                                                                                                 | RG-06                                                                                                                |
| buddies              | uq_buddies__owner_id_id                                                                    | `UNIQUE (owner_id, id)`                                                                                                                                                                                       | cible de FK composite                                                                                                |
| dive_buddies         | pk_dive_buddies                                                                            | `PRIMARY KEY (participation_id, buddy_id)`                                                                                                                                                                    | un binôme une fois par participation                                                                                 |
| dive_buddies         | fk_dive_buddies__owner_id_participation_id                                                 | → dive_participations(diver_id, id) **ON DELETE CASCADE**                                                                                                                                                     | composition : la palanquée suit la participation                                                                     |
| dive_buddies         | fk_dive_buddies__owner_id_buddy_id                                                         | → buddies(owner_id, id) **ON DELETE CASCADE**                                                                                                                                                                 | purge d'un contact = retrait de ses participations                                                                   |
| dive_buddies         | fk_dive_buddies__owner_id                                                                  | → divers(id) **ON DELETE CASCADE**                                                                                                                                                                            | cohérence, effacement du compte                                                                                      |
| accounts             | pk_accounts                                                                                | `PRIMARY KEY (id)`                                                                                                                                                                                            |                                                                                                                      |
| accounts             | fk_accounts__diver_id                                                                      | → divers(id) **ON DELETE CASCADE**                                                                                                                                                                            | effacement du compte (art. 17) : `DELETE divers` emporte le compte                                                   |
| accounts             | uq_accounts__diver_id                                                                      | `UNIQUE (diver_id)`                                                                                                                                                                                           | RG-38 : un compte par plongeur                                                                                       |
| accounts             | uq_accounts__email                                                                         | `UNIQUE (email)`                                                                                                                                                                                              | RG-38                                                                                                                |
| accounts             | ck_accounts__email                                                                         | `email = lower(btrim(email)) AND char_length(email) BETWEEN 3 AND 254 AND position('@' in email) > 1`                                                                                                         | email normalisé, sans `citext` (D-34)                                                                                |
| accounts             | ck_accounts__password_hash                                                                 | `starts_with(password_hash, '$argon2id$')`                                                                                                                                                                    | jamais de mot de passe en clair ni d'autre algorithme                                                                |
| accounts             | ck_accounts__role                                                                          | `role IN ('diver','support','admin')`                                                                                                                                                                         | D-14 (liste fermée)                                                                                                  |
| accounts             | ck_accounts__diver_role                                                                    | `(role = 'diver') = (diver_id IS NOT NULL)`                                                                                                                                                                   | RG-38 : un compte staff n'a pas de plongeur                                                                          |
| accounts             | ck_accounts__totp_staff_only                                                               | `role <> 'diver' OR (totp_secret IS NULL AND totp_last_used_step IS NULL)`                                                                                                                                    | RG-39 (migration `AddStaffTotp`)                                                                                     |
| sessions             | pk_sessions                                                                                | `PRIMARY KEY (id)`                                                                                                                                                                                            |                                                                                                                      |
| sessions             | fk_sessions__account_id                                                                    | → accounts(id) **ON DELETE CASCADE**                                                                                                                                                                          | les sessions suivent le compte                                                                                       |
| sessions             | uq_sessions__token_hash                                                                    | `UNIQUE (token_hash)`                                                                                                                                                                                         | lecture de la session par index unique à chaque requête (D-35)                                                       |
| sessions             | ck_sessions__token_hash                                                                    | `octet_length(token_hash) = 32`                                                                                                                                                                               | SHA-256                                                                                                              |
| sessions             | ck_sessions__audience                                                                      | `audience IN ('web','admin')`                                                                                                                                                                                 | RG-40                                                                                                                |
| consents             | pk_consents                                                                                | `PRIMARY KEY (id)`                                                                                                                                                                                            |                                                                                                                      |
| consents             | fk_consents__diver_id                                                                      | → divers(id) **ON DELETE CASCADE**                                                                                                                                                                            | effacement du compte                                                                                                 |
| consents             | ck_consents__purpose                                                                       | `purpose IN ('health_data_processing')`                                                                                                                                                                       | D-36                                                                                                                 |
| consents             | ck_consents__policy_version                                                                | `char_length(policy_version) BETWEEN 1 AND 32`                                                                                                                                                                |                                                                                                                      |
| consents             | ck_consents__withdrawn_after_granted                                                       | `withdrawn_at IS NULL OR withdrawn_at >= granted_at`                                                                                                                                                          |                                                                                                                      |
| auth_events          | pk_auth_events                                                                             | `PRIMARY KEY (id)`                                                                                                                                                                                            |                                                                                                                      |
| auth_events          | fk_auth_events__account_id                                                                 | → accounts(id) **ON DELETE CASCADE**                                                                                                                                                                          | la trace suit le compte                                                                                              |
| auth_events          | ck_auth_events__type                                                                       | `type IN ('login_succeeded','login_failed','login_throttled','logout','sessions_revoked','password_changed','password_reset_by_operator','consent_granted','account_deleted','account_created','totp_reset')` | RG-42 ; réécrite à la main par `AddAccountCreatedAuthEvent` et `AddStaffTotp`                                        |

Aucune contrainte SQL n'impose `dive_participations.diver_id = dive_events.creator_id` ni « une seule
participation par événement » : ce sont des invariants **MVP** tenus par les services (RG-17), qui
seront levés avec le partage (D-08).

Pas de `CHECK (totp_last_used_step >= 0)` : le pas est toujours écrit par l'API à partir de
l'horloge (dette notée au §11 d'`ARCHITECTURE.md`). Le niveau obligatoire avant le carnet (RG-43)
n'est pas une contrainte : c'est le statut d'onboarding calculé par l'API.

### Index

| Table               | Nom                                             | Définition                                                    | Justification                                                                                                                  |
| ------------------- | ----------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| dive_participations | idx_dive_participations__diver_id_dive_event_id | `(diver_id, dive_event_id) WHERE deleted_at IS NULL`          | Dashboard : toutes les statistiques partent de mes participations vivantes puis joignent l'événement par PK (D-08)             |
| dive_participations | idx_dive_participations__diver_id_updated_at_id | `(diver_id, updated_at, id)`                                  | Pull de synchronisation (tombstones incluses)                                                                                  |
| dive_events         | idx_dive_events__creator_id_updated_at_id       | `(creator_id, updated_at, id)`                                | Pull de synchronisation ; couvre la FK `creator_id`                                                                            |
| dive_events         | idx_dive_events__creator_id_site_id             | `(creator_id, site_id)`                                       | FK composite (contrôle RESTRICT), refus de suppression d'un site utilisé (RG-12), `NOT EXISTS` de la purge des sites           |
| dive_sites          | idx_dive_sites__owner_id_updated_at_id          | `(owner_id, updated_at, id)`                                  | Pull ; la FK `owner_id` est couverte par `uq_dive_sites__owner_id_id`                                                          |
| dive_sites          | idx_dive_sites__owner_id_merged_into_id         | `(owner_id, merged_into_id) WHERE merged_into_id IS NOT NULL` | FK réflexive (suppression d'une cible à la purge), réduction des chaînes à la fusion (D-30)                                    |
| buddies             | idx_buddies__owner_id_updated_at_id             | `(owner_id, updated_at, id)`                                  | Pull                                                                                                                           |
| buddies             | idx_buddies__linked_diver_id                    | `(linked_diver_id) WHERE linked_diver_id IS NOT NULL`         | FK `ON DELETE SET NULL` à la suppression d'un compte                                                                           |
| dive_buddies        | idx_dive_buddies__owner_id_buddy_id             | `(owner_id, buddy_id)`                                        | FK composite vers buddies ; « Binômes fréquents »                                                                              |
| sessions            | idx_sessions__account_id                        | `(account_id)`                                                | FK `CASCADE`, révocation de toutes les sessions d'un compte                                                                    |
| sessions            | idx_sessions__expires_at                        | `(expires_at)`                                                | purge des sessions expirées                                                                                                    |
| consents            | uq_consents__live                               | `UNIQUE (diver_id, purpose) WHERE withdrawn_at IS NULL`       | RG-41 : un seul consentement vivant ; lecture du consentement courant                                                          |
| consents            | idx_consents__diver_id                          | `(diver_id)`                                                  | couvre la FK pour toutes les lignes (l'index partiel ignore les retirés) : la cascade de l'effacement ne parcourt pas la table |
| auth_events         | idx_auth_events__account_id                     | `(account_id)`                                                | FK `CASCADE`                                                                                                                   |
| auth_events         | idx_auth_events__occurred_at                    | `(occurred_at)`                                               | purge après 180 jours                                                                                                          |

FK couvertes par un index existant : `dive_participations.dive_event_id` (par
`uq_dive_participations__dive_event_id_diver_id`), `dive_participations.diver_id` (par
`uq_dive_participations__diver_id_id`), `dive_buddies.(owner_id, participation_id)` (PK, colonne
`participation_id` en tête), `dive_buddies.owner_id` (par `idx_dive_buddies__owner_id_buddy_id`),
`dive_observations.participation_id` (PK, colonne en tête), `accounts.diver_id` (par
`uq_accounts__diver_id`).

Pas d'index `(audience, last_seen_at)` : la purge des sessions inactives parcourt la table
(dette notée au §11 d'`ARCHITECTURE.md`).

**Aucun index ajouté par l'évolution du 2026-11-16** : le détail lit une plongée par PK, et aucune
liste ne filtre ni ne trie sur les nouvelles colonnes (D-25 : filtres côté front). Pas d'index sur
`dive_observations.label` tant qu'aucune recherche ou statistique par espèce n'existe.

**FK volontairement non indexées** : `divers.certification_level_id`,
`dive_participations.certification_level_id` et `buddies.certification_level_id` (D-21). Un index de FK ne sert qu'au contrôle `RESTRICT` lors
de la suppression d'un niveau, or les niveaux ne sont jamais supprimés (désactivation, RG-01) ni
purgés (D-12). Aucun écran ne filtre par niveau. À ajouter si une statistique « plongées par niveau »
apparaît.

Pas d'index sur `dive_events.started_at` : les requêtes du dashboard partent des participations du
plongeur (quelques milliers au plus, H-14) et joignent l'événement par PK (D-08).

### Triggers (SQL brut)

- `set_updated_at()` : `BEFORE INSERT OR UPDATE` sur `certification_levels`, `divers`, `dive_sites`,
  `dive_events`, `dive_participations`, `buddies` et `accounts` (`trg_accounts__set_updated_at`,
  `CreateAuthSchema`) : `NEW.updated_at := clock_timestamp()`. Le
  serveur est seul maître de `updated_at` (D-03).
- `touch_participation_on_buddies_change()` : `AFTER INSERT OR DELETE` sur `dive_buddies`, fait
  avancer `dive_participations.updated_at` de la participation concernée (D-04). Pendant une cascade
  (suppression de compte, purge), la participation est déjà supprimée : l'UPDATE ne touche aucune
  ligne et ne lève pas d'erreur (vérifié sur PostgreSQL 18, à couvrir par les tests, D-12 e).
- `trg_dive_observations__touch_participation` : `AFTER INSERT OR UPDATE OR DELETE` sur
  `dive_observations`, réutilise **la même fonction** `touch_participation_on_buddies_change()`
  (son corps ne lit que `participation_id`). Un changement d'observations fait remonter la
  participation dans le pull (D-19). `UPDATE` est inclus parce que le remplacement de l'ensemble
  peut, selon l'implémentation, modifier `count` ou `position` en place.
