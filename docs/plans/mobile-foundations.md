# Plan : fondations de l'app mobile compagnon

Statut : **validé le 2026-11-27, non commencé.** Ce plan prépare l'arrivée d'une app mobile React Native (Expo) sans retravailler l'existant. Il est subordonné à `CLAUDE.md` puis à `ARCHITECTURE.md` : un conflit se signale, il ne se tranche pas en silence (les conflits relevés sont listés au §1.3 avec leur résolution validée).

> **Skills** : `writing-clean-code` et `developing-typescript` (remplaçants de `design-patterns-pro` et `typescript-excellence`, comme dans `docs/plans/auth.md`). Le mobile n'a encore ni agent ni skill (§5.4).

## 0. État des lieux (résumé, commit `aba3264`)

| Zone                       | Constat                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code partagé               | ~13 modules dupliqués entre web et admin, dont certains ont déjà divergé : `apiClient` (web : PUT/DELETE, AbortController ; admin : GET/POST, `AbortSignal.timeout`, `onSessionError`), `guards` (web surensemble), `safeNext`, `sessionNavigation`, `fakeApiClient`. Identiques : `promiseCache`, `ErrorBoundary`, `useHealth`, `env`, `apiBaseUrl`, `apiClientContext`/`useApiClient`, `useCountdown`. La condition de factorisation de D13 (« dès que les copies divergent ») est remplie. Réaction au 401 : callback du client côté admin, `QueryCache.onError` côté web.                                                                                                                                                                                                                                             |
| Réutilisable par le mobile | **Pur** : `features/dives/lib/*` (`selectDives`…), formulaire de plongée pur (`form/{model,validation,convert,derived,prefill,sources,timeLink,diveFormReducer}`, `fieldErrorMapping`), `shared/sites/lib/*`, `siteContract`, port `SitesRepository` et son adaptateur HTTP, `passwordRules`, `authValidation`, `authErrors`, `toAuthFailure`, `shared/model/*`. **Pur mais Intl** : `format.ts` (formateurs `fr-FR` au niveau du module), `diveTime.ts` (`timeZone`), `geo.ts`. **Lié à une lib** : hooks TanStack, `queryOptions` des `*Api.ts`, React Router (`useDives`, `useDive`, `useDashboard`). **Navigateur** : `useDiveForm`, `draftStore`/`draftPurge` (localStorage), `authBroadcast`, `labels.ts` des sites, `focus.ts`. Il n'existe pas de `formatDiveLog.ts` (seulement son test, qui teste `format.ts`). |
| `packages/shared`          | Types seuls, `exports` `{ ".": { types } }`, aucun build ; garde-fou `no-restricted-syntax` (2 sélecteurs) et, côté consommateurs, `no-restricted-imports` + `allowTypeImports`. Résolu par le lien workspace (`bundler` pour les fronts, `nodenext` CJS pour l'API).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Tokens                     | `apps/web/src/design/tokens.ts` : objets `as const`. Utilisables par RN : couleurs, `space`, `radius`, `type`, `opacity`, `iconSize`, `avatarPalette`. Syntaxe CSS, donc inutilisables : `shadow`, `gradient`, `motion.easing`, `font`. `generate-tokens.ts` émet `_tokens.scss` et `_vars.scss` ; `_mixins.scss` est écrit à la main.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Auth                       | Guards globaux `OriginGuard` → `JsonBodyGuard` → `SessionGuard`. Token lu **dans le cookie seulement** ; aucun code ne lit `Authorization`. Audience déduite du chemin (`audienceOfPath`, web/admin). `OriginGuard` refuse toute méthode non sûre sans `Sec-Fetch-Site`/`Origin` : un client natif est bloqué, login compris. `roleMatchesAudience` exige un rôle staff pour toute audience autre que `web`. Le contrôle onboarding/consentement n'est fait que pour `'web'` (`session.guard.ts:77`). `LoginThrottle` maison en mémoire (IP et email). Changement de mot de passe : révoque les autres sessions et tourne la courante.                                                                                                                                                                                    |
| Sync                       | Primitives prêtes mais **aucune route** : `upsertOwnedRow`, `pullPage` (curseur `(updated_at, id)` en µs), `assertWithinPurgeHorizon` (`409 full-sync-required`), `isStaleRestore` (comparaison à la ms, inactif en ligne), `SYNC_PURGE_HORIZON_DAYS` = 90. `upsertIn`/`pull` pour sites et binômes, `upsertDiveIn`/`pullEvents`/`pullParticipations` pour les plongées. `deleteDive` sans route, binômes sans contrôleur, `PurgeService` jamais appelé, `deleted_at` des tombstones repris du client, participation tirée par le serveur en UUID v4, `DiverId` absent des signatures de sync, limite JSON implicite (100 kB).                                                                                                                                                                                            |
| Règles heurtées            | LWW strict (D-25), numéro calculé (D26), carnet complet en une requête (D25), purge des brouillons au logout côté client (D41), `403 onboarding-required` / `consent-required` (D37, D38).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

Versions vérifiées le 2026-11-27 (sources en §8.4) : **Expo SDK 58** (React Native 0.88.1, React 19.3.0, Metro 0.87, Hermes V1), Node 26 supporté, installations pnpm isolées supportées, `jest-expo` 58 avec Jest 30.

## 1. Résumé et décisions

On prépare quatre fondations, livrées en lots indépendants avant toute ligne de `apps/mobile` :

- deux paquets runtime en sources TS, **sans React ni DOM** : `@e-deep/client` (transport, contrats, domaine, protocole de sync) et `@e-deep/design-tokens` ; web et admin y migrent (fin de D13) ;
- une troisième audience de session, `mobile`, portée par un **Bearer opaque** dans la table `sessions` ;
- un canal de synchronisation : `POST /api/sync/push` (lot, résultat par enregistrement, **détection de conflit**) et `GET /api/sync/pull` (global, curseur composite, cohérent entre tables), plus la suppression d'une plongée et la purge planifiée ;
- le cadrage de l'app : Expo, expo-sqlite chiffré par SQLCipher, TanStack Query, MapLibre en ligne, périmètre V1 compagnon.

**Le web reste en ligne** : aucune écriture hors ligne n'y est ajoutée. Le hors ligne de D22 passe au mobile.

### 1.1 Décisions d'architecture (à reporter au §10 d'`ARCHITECTURE.md` au dernier lot)

Décisions prises avec les fondations mobiles (**2026-11-27**). Détail : `docs/plans/mobile-foundations.md`.

| #   | Décision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Raison                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D46 | **Le hors ligne est porté par l'app mobile ; le web reste en ligne.** Le web n'ajoute ni IndexedDB, ni file d'écriture, ni service worker de données. Les justifications « PWA hors ligne » de D22, D25 et D42 se lisent désormais « app mobile hors ligne » ; les identifiants client (D22, D-02) et le carnet complet (D25) restent valables pour le web. Les durées de session web (D42) ne changent pas.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | L'usage hors ligne est un usage de terrain (bateau, site isolé), naturellement mobile ; un seul client hors ligne divise par deux le code de sync à maintenir pour une personne seule. Amende D22, D25, D42.                                                                                                                                                                                                             |
| D47 | **Deux paquets runtime : `@e-deep/client` et `@e-deep/design-tokens`, en sources TS exposées par `exports` (`types` et `default` vers `src/…`), sans build.** `@e-deep/client` est découpé en sous-chemins (`./http`, `./guards`, `./session`, `./contracts`, `./dives`, `./sites`, `./format`, `./ids`, `./sync`, `./consent`, `./testing`), `sideEffects: false`, imports internes sans extension. **Ni React, ni DOM, ni TanStack, ni router** dans les paquets : hooks, contextes, `ErrorBoundary`, loaders, stockage, SCSS et `env` restent dans chaque app. L'API n'importe jamais ces paquets (`no-restricted-imports` dans le bloc `apps/api/**`).                                                                                                                                                                                                                             | Vite et Metro transpilent les paquets workspace : un build ESM (prévu par §6) ajouterait une étape de build et de watch avant `typecheck` et `dev` dans trois apps, sans consommateur CommonJS. Sans React dans les paquets, aucun risque de double instance de React. Deux paquets plutôt qu'un : l'admin n'utilise pas les tokens, et leur cycle de vie (générateur SCSS) est différent. Amende D13 et §6.             |
| D48 | **Transport injectable, sans DOM.** `createApiClient({ baseUrl, fetch, auth, timeoutMs, onSessionError })`, avec `auth` = `{ kind: 'same-origin-cookie' }` (web, admin : `credentials: 'same-origin'`) ou `{ kind: 'bearer', token }` (mobile : `credentials: 'omit'` et en-tête `Authorization`). `fetch` est injecté et typé par une interface minimale du paquet ; URL par concaténation après validation de la base ; timeout par `AbortController`. Garde-fous : `lib: ["ES2023"]` sans `DOM` et `types: []` dans `packages/client/tsconfig.json` ; `no-restricted-globals` (`window`, `document`, `navigator`, `location`, `localStorage`, `sessionStorage`, `fetch`, `crypto`, `BroadcastChannel`, `requestAnimationFrame`), `no-restricted-imports` (`react*`, `react-native`, `@tanstack/*`, `react-router`), `import.meta` interdit ; tests Vitest en `environment: 'node'`. | Le même client sert le cookie same-origin et le Bearer sans branche par plateforme. Le typage sans DOM rend une dépendance au navigateur impossible à compiler, l'ESLint couvre les globaux typés ailleurs (`crypto`, `fetch`). Aucune dépendance nouvelle.                                                                                                                                                              |
| D49 | **UUIDv7 écrit dans `@e-deep/client/ids`** : `uuidv7(now, fillRandom)`, aléa injecté (`crypto.getRandomValues` côté web, `expo-crypto` côté mobile). Le web passe ses ids de plongée et de site au v7 ; le serveur tire la participation en v7 ; le canal de sync valide `@IsUUID('7')`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | D-02 demande du v7, le code tire du v4. `crypto.randomUUID` n'est pas garanti sous Hermes et `expo-crypto` ne fournit que du v4 ; une vingtaine de lignes évitent la dépendance `uuid`.                                                                                                                                                                                                                                  |
| D50 | **Tokens dans `packages/design-tokens/src/tokens.ts`** (source unique). `apps/web/scripts/generate-tokens.ts` les importe et produit le même SCSS ; le mobile importe les sous-objets compatibles. Dans un second temps, `shadow` et `motion` deviennent des valeurs structurées (`{ x, y, blur, spread, color }`, courbes en tuples), converties en CSS par le générateur. Polices système sur mobile en V1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Évite une seconde source à recopier à la main. Amende la règle de `CLAUDE.md` (« tokens édités uniquement dans `src/design/tokens.ts` ») et §5.                                                                                                                                                                                                                                                                          |
| D51 | **Audience `mobile` par Bearer opaque**, dans la table `sessions` (CHECK étendu). Token de 32 octets base64url préfixé `edm_`, SHA-256 en base comme D33. Routes dédiées `POST /api/mobile/auth/login` et `POST /api/mobile/auth/logout` : le token est renvoyé **dans le corps** (`MobileLoginResponse`), jamais en cookie, et stocké par l'app dans le Keychain / Keystore. Pas de JWT, pas de refresh token. Rôle `diver` seulement. Le contrôle onboarding et consentement s'applique à toute audience autre que `admin`.                                                                                                                                                                                                                                                                                                                                                          | D33 tient : une seule API, révocation immédiate (perte du téléphone, « déconnecter tous les appareils », suppression du compte), et sans refresh token aucune course access/refresh pendant un rejeu hors ligne. Le préfixe permet aux scanners de secrets de repérer une fuite. Amende D33 (« le corps ne contient jamais le token ») et §6 (« aucun token dans ces types ») pour cette seule réponse.                  |
| D52 | **Audience déduite du crédit hors `/api/admin/*`.** Les routes métier sont partagées : sur un chemin non admin, un cookie web donne `web`, un `Authorization: Bearer` donne `mobile`. **Cookie de session et Bearer dans la même requête : `401 unauthenticated`**. En mode Bearer, les cookies sont ignorés. Décorateur `@Audiences(...)` pour restreindre une route (`/api/sync/*` : `mobile` ; fusion de sites, dashboard : `web`). `OriginGuard` laisse passer une méthode non sûre sans `Sec-Fetch-Site` ni `Origin` seulement si la requête porte un Bearer **sans** cookie de session, ou si la route porte `@NativeClient()` (le seul login mobile) ; un `Sec-Fetch-Site` présent doit toujours valoir `same-origin`.                                                                                                                                                          | Un Bearer n'est pas un crédit ambiant : un site tiers ne peut ni l'ajouter (pas de CORS, donc pas de preflight accepté), ni envoyer du JSON (`JsonBodyGuard`), ni lire la réponse du login. Refuser le mélange cookie + Bearer ferme le contournement où un navigateur ajouterait un Bearer pour échapper à l'`OriginGuard` tout en portant un cookie. Amende D34 et D37.                                                |
| D53 | **Durées mobiles : 90 jours d'inactivité, 180 jours au maximum**, `touch` au plus une fois par heure ; pas de `rememberMe`. Rotation au login (et au changement de mot de passe fait depuis le mobile, hors V1) ; pas de rotation à l'usage. Limitation des tentatives : seaux `LoginThrottle` existants, seau IP plus large sur `@NativeClient` (rafale 60), seau email inchangé. `auth_events` : types existants, sans colonne d'audience.                                                                                                                                                                                                                                                                                                                                                                                                                                           | Un téléphone hors ligne ne fait pas de `touch` : 30 jours couperaient une saison d'expédition. 90 jours s'alignent sur `SYNC_PURGE_HORIZON_DAYS` (au-delà, une sync complète est exigée de toute façon). 180 jours bornent l'exposition d'un appareil perdu. Une rotation à l'usage créerait une course avec les requêtes rejouées. Les opérateurs mobiles mettent beaucoup d'utilisateurs derrière une même IP (CGNAT). |
| D54 | **Canal de synchronisation `/api/sync/*`**, réservé à l'audience `mobile` : `POST /api/sync/push` et `GET /api/sync/pull` (protocole : D-39 à D-41). Débit limité **par session** (seaux à jetons généralisés depuis `LoginThrottle` dans `common/rate-limit/`, en mémoire comme D35) : push en rafale de 10 puis 1 toutes les 6 s, pull en rafale de 60 puis 1 par seconde. Limite du corps JSON rendue explicite dans `configure-app.ts` (100 kB). Compression des réponses par le reverse proxy, pas de middleware. `Cache-Control: no-store` (déjà posé par `SessionGuard`, plus `NoStoreGuard` sur le contrôleur mobile public). Aucun log du push ni du pull.                                                                                                                                                                                                                    | La clé par session évite de pénaliser un CGNAT. 100 kB couvrent un lot de 25 plongées complètes. Sans dépendance (`@nestjs/throttler`, `compression`).                                                                                                                                                                                                                                                                   |
| D55 | **Purge planifiée par une commande** `pnpm --filter api run purge` (même modèle que `account:*`), lancée par le cron de l'hébergeur. Pas de `@nestjs/schedule`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `PurgeService` existe mais n'est jamais appelé ; une commande est testable et ne tourne pas dans chaque instance de l'API.                                                                                                                                                                                                                                                                                               |
| D56 | **App mobile : Expo (SDK 58 au cadrage) en CNG**, dev builds (SQLCipher et MapLibre sont absents d'Expo Go), builds locaux, EAS Submit pour les stores, pas d'EAS Update en V1. **Expo Router**, **TanStack Query au-dessus de SQLite** (`networkMode: 'always'`), **expo-sqlite en SQL brut** (migrations par `PRAGMA user_version`, pas d'ORM), **MapLibre React Native** avec une carte **en ligne** en V1. Pas de NetInfo : sync au retour au premier plan, après chaque écriture locale et par tirer-pour-rafraîchir. Pas de sync en arrière-plan en V1.                                                                                                                                                                                                                                                                                                                          | Le moins de dépendances possible, toutes de premier parti sauf MapLibre (même moteur que le web, pas de clé Google). Même modèle mental et mêmes clés que le web pour TanStack. WatermelonDB impose son propre protocole, incompatible avec D-03 et D-12 ; op-sqlite est hors SDK.                                                                                                                                       |
| D57 | **Données de santé sur l'appareil** : une base SQLCipher **par plongeur** (`useSQLCipher`), clé de 32 octets aléatoires dans `expo-secure-store` en `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`, base refusée à l'ouverture si `PRAGMA cipher_version` est vide. Purge (base, `-wal`, `-shm`, clé, token, cache de requêtes, cache de tuiles) au logout, à la suppression du compte, au changement de plongeur et au premier lancement après réinstallation (le Keychain iOS survit à la désinstallation). Base et SecureStore exclus des sauvegardes iCloud et Android. Un seul compte actif. Sélecteur d'apps masqué (`expo-screen-capture`), captures autorisées.                                                                                                                                                                                                                         | RGPD art. 9 : chiffrement au repos et clé non migrable. Sans SQLCipher, `PRAGMA key` est ignoré sans erreur : le contrôle `cipher_version` couvre cet échec silencieux. Apple 5.1.3(ii) interdit les données de santé dans iCloud.                                                                                                                                                                                       |
| D58 | **Exception de style : `StyleSheet.create` dans `apps/mobile` uniquement**, valeurs tirées de `@e-deep/design-tokens`, aucune couleur, taille ou espacement en dur, pas d'objet de style en ligne dans le JSX. `react-native` est interdit hors `apps/mobile` ; SCSS, Tailwind et `react-dom` sont interdits dans `apps/mobile`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | React Native n'a ni CSS ni SCSS ; l'exception est bornée comme celle de Tailwind dans l'admin, avec un garde-fou ESLint (`no-restricted-syntax` sur les littéraux de couleur hors `src/theme/` et sur `style={{…}}`).                                                                                                                                                                                                    |
| D59 | **Périmètre V1 compagnon.** Inclus : connexion, carnet (recherche, filtres, groupage par mois de `selectDives`), détail, saisie et édition hors ligne (site créé par son nom, binômes existants ou par nom), suppression d'une plongée, carte des sites (en ligne) et liste hors ligne, état de la sync et conflits, **re-consentement natif**, réglages minimaux (déconnexion, déconnecter tous les appareils, **suppression du compte native** avec mot de passe ressaisi, effacer les données de cet appareil, version, mentions et attributions). Exclus : inscription, onboarding initial (message et lien vers le web), dashboard et statistiques, gestion fine des sites, gestion des binômes, changement de mot de passe, export, partage.                                                                                                                                     | Apple (5.1.1(v)) et Google Play exigent un chemin de suppression du compte dans l'app. Le re-consentement est bloquant pour la sync (`403 consent-required`) : le renvoyer au web couperait le terrain. Le reste de la gestion fine reste sur le web.                                                                                                                                                                    |
| D60 | **`apps/mobile` dans le monorepo** : `nodeLinker` reste `isolated` (`hoisted` est global au workspace, en dernier recours seulement) ; Metro configuré par `expo/metro-config` ; ESLint et Prettier centralisés (D15), sans `eslint-config-expo` ; tests Jest 30 + `jest-expo` + `@testing-library/react-native` pour l'UI, logique métier et protocole de sync testés en Vitest dans `packages/client` ; CI : `lint`, `typecheck`, `test` et `expo export` (pas de build natif). Exclusions `minimumReleaseAge` et entrées `allowBuilds` ajoutées au lot 0, chacune justifiée dans `pnpm-workspace.yaml`.                                                                                                                                                                                                                                                                             | Une seule configuration de lint et de format. `expo export` prouve la résolution des paquets workspace par Metro sans chaîne native en CI.                                                                                                                                                                                                                                                                               |

### 1.2 Décisions du modèle de données (à reporter dans `docs/data-model/decisions.md`)

Au format de ce document (`### D-nn — Titre`), à la suite de D-38.

| #    | Décision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Raison                                                                                                                                                                                                                                                                                                                                                         |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-39 | **Push par lot.** Enveloppe `{ protocolVersion, lastPulledAt, changes }`, au plus 25 changements de type `site`, `dive` ou `dive-delete` (pas de binôme autonome en V1 : ils sont créés par l'agrégat plongée). **Une transaction par enregistrement**, traités dans l'ordre du tableau (le client envoie les sites avant les plongées qui les référencent). Résultat par enregistrement : `applied` (avec `updatedAt`), `rejected` (avec la raison et l'état serveur), `invalid` (`fieldErrors` par chemin) ou `failed` (code métier). L'enveloppe est validée par DTO ; chaque `record` est validé ensuite par les DTO existants (`DiveWriteRequestDto`, `SiteWriteRequestDto`). L'agrégat plongée passe par `DiveWriteService.writeIn(manager, diverId, request, mode)`, extrait de `create` et `replace` (`mode` : `create`, `replace` ou `sync`). `lastPulledAt` est le `serverTime` du dernier pull complet ; l'horizon est contrôlé une fois par lot. Idempotence par id, sans table de clés. | Un enregistrement invalide ne bloque pas les autres, et une transaction courte limite l'interblocage connu avec la fusion de sites. Le même DTO et le même service servent le formulaire web et la sync : rien n'est dupliqué.                                                                                                                                 |
| D-40 | **Pull global.** `GET /api/sync/pull?cursor=…&limit=…` (500 par défaut, 1000 au maximum). Une page = une transaction `REPEATABLE READ` qui lit, dans l'ordre de D-03, `sites` → `buddies` → `events` → `participations` (avec `buddyIds` et `observations`) sous un budget commun ; **une table aval n'est lue que si toutes les tables amont sont épuisées dans le même instantané**. Curseur opaque (base64url) qui porte un sous-curseur `(updatedAt µs, id)` par table et une phase `start`/`continue` : la fenêtre de 5 s de D-03 est appliquée par le serveur à la première page d'une session de pull, jamais entre deux pages. Tombstones minimales `{ id, updatedAt, deletedAt }`. Niveaux de certification complets (inactifs compris) à la première page et quand ils changent. Profil par `GET /api/me`. Curseur antérieur à l'horizon : `409 full-sync-required`.                                                                                                                       | Un seul aller-retour par page et une cohérence entre tables garantie par le serveur : une participation ne peut pas arriver avant le site ou l'événement qu'elle référence. Une tombstone ne recopie aucune donnée de santé. Amende D-03 (« pull par table ») et D-03.1.                                                                                       |
| D-41 | **Détection de conflit sur le canal de sync** (choix du porteur, 2026-11-27). Un enregistrement poussé avec `baseUpdatedAt` est `rejected` avec `reason: 'conflict'` et l'état serveur quand la ligne serveur a changé depuis : pour une plongée, `max(event.updated_at, participation.updated_at) > baseUpdatedAt` ; pour un site, `updated_at > baseUpdatedAt`. Comparaison à la **microseconde** (même précision que le curseur ; `isStaleRestore` est aligné). `baseUpdatedAt = null` sur une ligne existante du plongeur : `applied` si le contenu est identique (`isSameDiveWrite`, rejeu), sinon `conflict`. **Le PUT web reste en LWW strict (D-25 inchangé).** Sans migration.                                                                                                                                                                                                                                                                                                              | Un mobile hors ligne plusieurs semaines écraserait en silence une correction faite sur le web, l'outil de gestion fine. Côté mobile, la version serveur est appliquée et la version locale devient un brouillon de conflit, avec un choix explicite : réappliquer (nouveau push avec une base à jour) ou abandonner. Amende D-03 (LWW) pour la sync seulement. |
| D-42 | **Tombstones horodatées par le serveur** : `deleted_at = now()` à l'application, la valeur du client n'est jamais reprise (`dives.service.ts`, `buddies.service.ts`, `dive-sites.service.ts`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | D-03 : seule l'horloge serveur est fiable. Le code actuel reprend `write.deletedAt`.                                                                                                                                                                                                                                                                           |
| D-43 | **Suppression d'une plongée** (ferme la question #19) : l'événement et la participation sont tombstonés (MVP à participant unique, H-16), par `DELETE /api/dives/:id` (204 idempotent, 404 générique si la plongée est absente ou étrangère) et par `dive-delete` dans le push (conflit selon D-41). Le texte d'interface dit « supprimer ma plongée », pour le futur partage.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `deleteDive` existe sans route. Supprimer aussi l'événement évite une ligne orpheline tant qu'il n'y a qu'un participant.                                                                                                                                                                                                                                      |
| D-44 | **Client périmé** (ferme la question #20) : `protocolVersion` dans le push et `v` dans le pull ; hors de la plage supportée, `409 client-outdated`, qui prime sur le `400` de D-22. L'app affiche « Mise à jour requise » et garde sa file.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Un seul code, sans en-tête `Upgrade` (qu'imposerait un 426).                                                                                                                                                                                                                                                                                                   |
| D-45 | **Identifiants v7 partout** : web et mobile tirent des UUIDv7 (D49), la participation est tirée par le serveur en v7, le canal de sync exige `@IsUUID('7')`. Les routes en ligne gardent `@IsUUID('all')` le temps que les anciens brouillons v4 disparaissent (30 jours).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Solde l'écart entre D-02 et le code (v4).                                                                                                                                                                                                                                                                                                                      |

### 1.3 Conflits entre sources et résolution validée

| #   | Conflit                                                                                                                            | Résolution (2026-11-27)                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1   | Brief « le web reste en ligne » / D22, D25, D42, D-02, D-22 (PWA hors ligne)                                                       | D46 amende les justifications ; rien ne change dans le code web.                           |
| 2   | §6 « paquet runtime en build ESM » / sources TS                                                                                    | D47, choix du porteur.                                                                     |
| 3   | `CLAUDE.md` « tokens édités uniquement dans `src/design/tokens.ts` » / déplacement                                                 | D50. **`CLAUDE.md` est amendé au lot 1e**, avant le déplacement.                           |
| 4   | §6 et D33 « aucun token dans un corps ni un type » / `MobileLoginResponse`                                                         | D51, pour cette seule réponse.                                                             |
| 5   | D34, D37 (`OriginGuard` sans exception, audience tirée du chemin) / exemption Bearer ; `auth.md` §8 place le mobile hors périmètre | D52 ; ce plan prend le relais d'`auth.md` pour le mobile.                                  |
| 6   | D-03 « horloge serveur seule » / code (`deletedAt` client)                                                                         | D-42 corrige le code.                                                                      |
| 7   | D-02 (ids client v7) / D-24 et code (participation v4 tirée par le serveur)                                                        | D-45.                                                                                      |
| 8   | D-03.1 (niveaux en pull complet) / route publique limitée aux niveaux actifs                                                       | D-40 sert les niveaux complets dans le pull ; la route publique ne change pas.             |
| 9   | §11 « CARTO sans clé » / conditions CARTO (clé obligatoire, cache ≤ 30 jours)                                                      | **Non tranché ici** : concerne déjà le web. Risque §8.1.                                   |
| 10  | Brief « paramètres du compte sur le web » / Apple 5.1.1(v), Google Play                                                            | D59 : suppression du compte native.                                                        |
| 11  | D24 et `apps/web/CLAUDE.md` (query keys dans `features/<domaine>/api/`) / code                                                     | À réaligner au lot 1c, quand les clés passent dans le paquet.                              |
| 12  | D2 (TS `~6.0.3`) / compatibilité Expo SDK 58 non documentée                                                                        | **À vérifier au lot 0** ; un besoin de TS 7 se signale, il ne se tranche pas. Risque §8.1. |

## 2. Contrats

### 2.1 Types à ajouter dans `@e-deep/shared` (types seulement, unions de littéraux)

`packages/shared/src/auth.ts` :

```ts
/** Body of POST /api/mobile/auth/login. No rememberMe: mobile sessions are always long (D53). */
export interface MobileLoginRequest {
  email: string;
  password: string;
}

/** 200 of POST /api/mobile/auth/login. The only response that carries a token (D51). */
export interface MobileLoginResponse {
  /** Opaque, "edm_" + 43 base64url characters. Stored in the Keychain / Keystore, never logged. */
  token: string;
  me: MeResponse;
}
```

`packages/shared/src/sync.ts` (nouveau ; esquisse figée au lot 3) :

```ts
export type SyncProtocolVersion = 1;

/** Microsecond ISO 8601 instant, as served by the pull (D-40). */
export type SyncInstant = string;

export interface SyncSiteWrite extends SiteWriteRequest {
  baseUpdatedAt: SyncInstant | null;
}

export type SyncChange =
  | { kind: 'site'; record: SyncSiteWrite }
  | { kind: 'dive'; record: DiveWriteRequest }
  | { kind: 'dive-delete'; id: string; baseUpdatedAt: SyncInstant };

export interface SyncPushRequest {
  protocolVersion: SyncProtocolVersion;
  /** serverTime of the last complete pull. */
  lastPulledAt: SyncInstant;
  /** 1 to 25 changes, applied in order. */
  changes: SyncChange[];
}

export type SyncRejectReason = 'conflict' | 'stale-restore' | 'merged';

export type SyncRecordFailureCode =
  | 'not-found'
  | 'identifier-conflict'
  | 'invalid-reference'
  | 'site-in-use'
  | 'inactive-certification-level'
  | 'buddy-link-conflict'
  | 'duplicate-observation'
  | 'too-many-observations'
  | 'unsupported-contract-value';

export type SyncPushResult =
  | { status: 'applied'; id: string; updatedAt: SyncInstant }
  | { status: 'rejected'; id: string; reason: SyncRejectReason; current: SyncRecord | null }
  | { status: 'invalid'; id: string | null; fieldErrors: ApiFieldErrors }
  | { status: 'failed'; id: string; code: SyncRecordFailureCode };

export interface SyncPushResponse {
  /** Same length and order as changes. */
  results: SyncPushResult[];
  serverTime: SyncInstant;
}

export interface SyncTombstone {
  id: string;
  updatedAt: SyncInstant;
  deletedAt: SyncInstant;
}

/** A live row: every field present, null when not filled (as in DiveDetail). */
export type SyncLive<T> = T & { updatedAt: SyncInstant; deletedAt: null };

export type SyncSiteRecord = SyncLive<SiteWriteRequest & { createdVia: SiteOrigin }>;
export type SyncBuddyRecord = SyncLive<{
  id: string;
  firstName: string;
  lastName: string | null;
  levelCode: string | null;
}>;
export type SyncEventRecord = SyncLive<DiveWriteEvent>;
export type SyncParticipationRecord = SyncLive<
  DiveWriteParticipation & {
    id: string;
    eventId: string;
    buddyIds: string[];
    observations: DiveWriteObservation[];
  }
>;

export type SyncRecord =
  | { kind: 'site'; row: SyncSiteRecord | SyncTombstone }
  | {
      kind: 'dive';
      event: SyncEventRecord | SyncTombstone;
      participation: SyncParticipationRecord | SyncTombstone;
    };

export interface SyncPullResponse {
  sites: Array<SyncSiteRecord | SyncTombstone>;
  buddies: Array<SyncBuddyRecord | SyncTombstone>;
  events: Array<SyncEventRecord | SyncTombstone>;
  participations: Array<SyncParticipationRecord | SyncTombstone>;
  /** Present on the first page and when the referential changed; inactive levels included. */
  levels: CertificationLevelOption[] | null;
  nextCursor: string;
  hasMore: boolean;
  serverTime: SyncInstant;
}
```

`ApiDomainErrorCode` gagne `client-outdated` (409). `not-found` n'existe que dans `SyncRecordFailureCode`. Les champs exacts des binômes et le traitement d'un site fusionné (aujourd'hui `mergedIntoId` côté service) sont fixés au lot 3 à partir des `pull` existants ; toute nouvelle valeur d'union se déploie front d'abord (§6).

### 2.2 Routes

| Route                                                                          | Audience                              | Succès                                                   | Erreurs                                                                                                                       |
| ------------------------------------------------------------------------------ | ------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/mobile/auth/login`                                                  | publique, `@NativeClient`, `no-store` | 200 `MobileLoginResponse`, aucun `Set-Cookie`            | 400, 401 `invalid-credentials`, 429                                                                                           |
| `POST /api/mobile/auth/logout`                                                 | `mobile`                              | 204, session supprimée, `logout`                         | 401                                                                                                                           |
| `POST /api/auth/logout-all`                                                    | `web`, `mobile`                       | 204 (révoque aussi les sessions mobiles)                 | 401                                                                                                                           |
| `GET /api/me`, `POST /api/me/consents`, `DELETE /api/me`                       | `web`, `mobile`                       | inchangés (`DELETE` : pas de cookie à effacer en mobile) | inchangées                                                                                                                    |
| `GET /api/dives`, `GET /api/dives/:id`, `GET /api/sites`, `GET /api/sites/:id` | `web`, `mobile`                       | inchangés                                                | inchangées                                                                                                                    |
| `DELETE /api/dives/:id`                                                        | `web`                                 | 204, idempotent                                          | 401, 403, 404 générique                                                                                                       |
| `POST /api/sync/push`                                                          | `mobile`                              | 200 `SyncPushResponse`                                   | 400 (enveloppe), 401, 403 `onboarding-required`/`consent-required`, 409 `full-sync-required`/`client-outdated`, 413, 415, 429 |
| `GET /api/sync/pull`                                                           | `mobile`                              | 200 `SyncPullResponse`                                   | 400 (curseur), 401, 403, 409 `full-sync-required`/`client-outdated`, 429                                                      |

Les autres routes d'écriture (`POST`/`PUT` des plongées et des sites, fusion, `PUT /api/me/password`, `POST /api/me/onboarding`) et `GET /api/dashboard` restent `web` : le mobile écrit par la sync seulement. Une requête portant un cookie de session et un Bearer reçoit `401 unauthenticated` sur toute route ; un Bearer sur `/api/admin/*` aussi.

### 2.3 Exemples

Push :

```json
{
  "protocolVersion": 1,
  "lastPulledAt": "2026-11-27T10:00:00.123456Z",
  "changes": [
    {
      "kind": "site",
      "record": {
        "id": "01938f6e-…",
        "name": "Sec de la Fourmigue",
        "locality": null,
        "region": null,
        "area": null,
        "latitude": null,
        "longitude": null,
        "type": null,
        "depthMinM": null,
        "depthMaxM": null,
        "accessNotes": null,
        "baseUpdatedAt": null
      }
    },
    {
      "kind": "dive",
      "record": {
        "event": {
          "id": "01938f6f-…",
          "siteId": "01938f6e-…",
          "startedAt": "2026-11-20T10:05:00+01:00"
        },
        "participation": {},
        "observations": [],
        "site": { "id": "01938f6e-…" },
        "buddies": [],
        "baseUpdatedAt": null
      }
    },
    { "kind": "dive-delete", "id": "01937a10-…", "baseUpdatedAt": "2026-11-02T18:30:12.000123Z" }
  ]
}
```

(Les objets de la plongée sont abrégés : chaque champ de `DiveWriteRequest` est présent, D-22.)

```json
{
  "results": [
    { "status": "applied", "id": "01938f6e-…", "updatedAt": "2026-11-27T10:04:01.551203Z" },
    {
      "status": "invalid",
      "id": "01938f6f-…",
      "fieldErrors": { "participation.maxDepthM": ["max"] }
    },
    {
      "status": "rejected",
      "id": "01937a10-…",
      "reason": "conflict",
      "current": { "kind": "dive", "event": {}, "participation": {} }
    }
  ],
  "serverTime": "2026-11-27T10:04:01.560000Z"
}
```

Pull (première page, sans curseur ; lignes abrégées) :

```json
{
  "sites": [
    { "id": "…", "name": "…", "updatedAt": "2026-10-01T08:00:00.000001Z", "deletedAt": null }
  ],
  "buddies": [],
  "events": [],
  "participations": [],
  "levels": [{ "code": "N2" }],
  "nextCursor": "eyJ2IjoxLCJwaGFzZSI6ImNvbnRpbnVlIiwi…",
  "hasMore": true,
  "serverTime": "2026-11-27T10:05:00.000000Z"
}
```

### 2.4 Client (protocole, `@e-deep/client/sync`, pur)

- **Outbox** : une entrée par enregistrement (la dernière écriture locale remplace la précédente), avec sa `baseUpdatedAt`. Elle prime sur un enregistrement reçu tant qu'elle n'est pas poussée : chaque cycle fait **push puis pull**. La première connexion fait un pull complet avant toute saisie.
- **Application d'une page** : une transaction SQLite par page ; `nextCursor` et `serverTime` ne sont retenus comme base du cycle suivant qu'à la dernière page (`hasMore: false`).
- **`full-sync-required`** : pull complet sans curseur ; les lignes locales absentes du résultat sont supprimées (purgées côté serveur), sauf celles qui ont une entrée d'outbox. Puis **rebase de l'outbox** : une entrée avec `baseUpdatedAt` dont la ligne n'existe plus côté serveur est abandonnée et signalée ; une création (`baseUpdatedAt: null`) est conservée.
- **Conflit** : la version serveur est appliquée, la version locale est gardée en brouillon de conflit jusqu'au choix du plongeur.
- **Numéro de plongée** (D26) : `ROW_NUMBER() OVER (ORDER BY started_at, id)` sur les plongées vivantes de la base locale (`started_at` en UTC normalisé, `id` en minuscules) ; provisoire seulement si un autre appareil a écrit depuis le dernier pull. Le `number` des réponses serveur n'est pas utilisé. Les statistiques restent sur le web.
- **Port `LocalStore`** : adaptateur expo-sqlite dans l'app, faux en mémoire dans le paquet, pour tester le protocole en Vitest.

### 2.5 Cas limites d'authentification pendant la sync

| Événement                             | Comportement                                                                                                                                                                                                                                                                                       |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 401 au milieu d'un lot                | Arrêt du cycle (les résultats déjà reçus sont appliqués), écran de connexion, données et file masquées mais conservées. Après reconnexion, le `diverId` de `/me` doit être le même ; sinon, proposition d'effacer l'ancienne base (avertissement si la file n'est pas vide). Puis push, puis pull. |
| 403 `consent-required`                | Arrêt, écran natif de re-consentement (texte de `@e-deep/client/consent`, version courante), `POST /api/me/consents`, reprise. `onboarding-required` : message et lien vers le web.                                                                                                                |
| Compte supprimé depuis le web         | Les sessions partent en cascade : 401, indistinguable d'une expiration. L'écran de connexion propose toujours « Effacer les données de cet appareil ». Limite assumée : les données restent chiffrées et masquées jusqu'à l'effacement.                                                            |
| Changement de mot de passe sur le web | Les autres sessions sont révoquées : 401, reconnexion sous le même plongeur, rejeu de la file, aucune perte.                                                                                                                                                                                       |
| Logout avec écritures en attente      | Dialogue « N modifications non synchronisées seront perdues » : Synchroniser d'abord, Se déconnecter quand même, Annuler. Puis `POST /api/mobile/auth/logout` et purge locale (D57).                                                                                                               |
| Réinstallation sur iOS                | Le Keychain survit : sans marqueur local au premier lancement, les entrées SecureStore sont purgées avant tout.                                                                                                                                                                                    |

## 3. Découpage en lots

Chaque lot est mergeable et testé seul, dans l'ordre. Avant chaque commit : `pnpm lint && pnpm typecheck && pnpm test && pnpm build`, `pnpm --filter web run check:public-bundle` pour un lot qui touche le web, `pnpm format`. Commits conventionnels, sans attribution.

| Lot     | Contenu                                      | Agent                                                                                             | Skills                                                            |
| ------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1a à 1e | Paquets runtime, migration de web et admin   | `frontend-toolkit:react-developer` (web, admin), `test-runner-fixer`                              | `writing-clean-code`, `developing-typescript`, `developing-react` |
| 2       | Audience `mobile`                            | `Backend NestJS Expert`, `test-runner-fixer`                                                      | `writing-clean-code`, `developing-typescript`                     |
| 3a à 3c | Sync : préalables et suppression, pull, push | `Backend NestJS Expert` (API), `typescript-pro` (`packages/client/src/sync`), `test-runner-fixer` | `writing-clean-code`, `developing-typescript`                     |
| 4       | Documentation                                | agent principal                                                                                   | —                                                                 |

### Lot 1 : paquets runtime et fin de D13

Règles communes : **on déplace sans réécrire** ; les tests suivent leur module ; l'app importe le paquet et la copie locale est supprimée, sans réexport depuis `@/shared/lib`.

- **1a, `http` et `guards`.** Fichiers : `packages/client/{package.json,tsconfig.json,src/http/*,src/guards/*,src/testing/*}`, `eslint.config.js` (bloc `packages/client/**`, interdiction dans `apps/api/**`), `apps/{web,admin}/src/shared/lib/{apiClient,guards}.ts` supprimés, `apps/{web,admin}/src/app/services.ts`, `apps/web/src/app/appSession.ts`. Le client fusionné part du web (PUT, DELETE avec corps, AbortController) et prend `onSessionError` de l'admin ; `fakeApiClient` du web devient `createFakeApiClient` dans `./testing`, l'admin s'y adapte. `env.ts` et `apiBaseUrl.ts` restent dans chaque app.
- **1b, `session`.** `sessionEventOf`, `safeNext` paramétré (`defaultNext`, chemins refusés), `toAuthFailure`, `passwordRules`, `authValidation`, `authErrors`, texte du consentement (`./consent`).
- **1c, domaine et format.** `./contracts` (`siteContract`, conversions et guards de `divesApi`, `diveLogApi` et `dashboardApi`, sans `queryOptions`), `./dives`, `./sites`, `./format`, query keys en tuples `readonly` (chaque app les enveloppe dans `queryOptions`) ; mise à jour de D24 et d'`apps/web/CLAUDE.md` (conflit 11).
- **1d, `ids`.** `uuidv7` (D49) ; `useDiveForm` et `useSiteCommands` passent au v7.
- **1e, tokens.** `CLAUDE.md` amendé d'abord ; `packages/design-tokens/src/tokens.ts` ; `apps/web/scripts/generate-tokens.ts` importe le paquet (vérifier que Node 26 exécute le TS du chemin réel du workspace, hors `node_modules`) ; puis structuration de `shadow` et `motion`.

Critères d'acceptation :

- aucune copie restante (vérifiable par `grep` sur les noms de modules) ;
- un `window`, un `import 'react'` ou un `import.meta` ajouté dans `packages/client` fait échouer `typecheck` ou `lint` (vérifié une fois à la main, consigné dans la PR) ;
- `check:public-bundle` vert ; taille gzip des bundles web et admin à ±0,5 kB de la référence ;
- 1e : SCSS généré **identique octet pour octet** avant la structuration.

Tests :

- unitaires Vitest déplacés avec leurs modules (`environment: 'node'`) ;
- client : mode cookie (`credentials: 'same-origin'`, aucun `Authorization`), mode bearer (`credentials: 'omit'`, en-tête), timeout, `onSessionError` sur 401 et 403, `Retry-After` ;
- `uuidv7` : version, variante, ordre croissant, aléa injecté ;
- tests web et admin existants inchangés et verts.

### Lot 2 : audience `mobile`

Fichiers :

- `apps/api/src/modules/auth/{session-audiences,session-lifetimes,session.entity,session.service,authentication.service,login-throttle}.ts` et `mobile-auth.controller.ts` (nouveau) ;
- `apps/api/src/common/auth/{session-cookie,route-audience,session.guard,origin.guard}.ts` et, nouveaux, `session-credential.ts`, `audiences.decorator.ts`, `native-client.decorator.ts` ;
- migration `AddMobileSessionAudience` : CHECK `ck_sessions__audience` étendu et index `(audience, last_seen_at)` (dette §11) ; `down()` qui échoue tant qu'une session `mobile` existe ;
- `apps/api/src/modules/dives/purge.service.ts` (clause d'inactivité `mobile`) ;
- `packages/shared/src/auth.ts`.

Points précis : `audienceOfPath` devient `allowedAudiencesOf(route)` (fonction pure) ; `AUDIENCE_ROLES.mobile = ['diver']` et `roleMatchesAudience` ; `assertOnboarded` pour `audience !== 'admin'` ; le `'web'` codé en dur de `loginDiver` devient un paramètre ; regex stricte de l'en-tête (`Bearer edm_[A-Za-z0-9_-]{43}`), toute autre forme donne 401.

Critères d'acceptation :

- le login mobile renvoie un token et aucun `Set-Cookie` ;
- Bearer accepté sur les routes `web, mobile`, refusé sur `/api/admin/*` et sur les routes `web` seules ;
- cookie + Bearer → 401 sur toute route ; Bearer mal formé → 401 ; session staff présentée en Bearer → 401 ;
- `onboarding-required` et `consent-required` s'appliquent au mobile ;
- `logout-all` et le changement de mot de passe depuis le web révoquent les sessions mobiles ;
- aucun token, email ni id dans les logs.

Tests :

- unitaires : `allowedAudiencesOf`, extraction du Bearer (absent, vide, mauvais schéma, mauvais préfixe, mauvaise longueur), `roleMatchesAudience`, durées mobiles, `OriginGuard` (matrice d'en-têtes) ;
- e2e sans base : `route-inventory.e2e-spec.ts` gagne une table figée `ROUTE_AUDIENCES` (route → audiences) comparée à `allowedAudiencesOf` ; `no-store` sur les routes mobiles ; login natif sans `Origin` accepté ; Bearer + `Sec-Fetch-Site: cross-site` refusé ; Bearer + cookie refusé ;
- `test:db` : `authorization-matrix.db-spec.ts`, chaque route × {sans crédit, cookie web, Bearer mobile, cookie admin, cookie + Bearer, Bearer mal formé, Bearer d'une session staff} ; purge des sessions mobiles inactives ; révocation par `logout-all` et par changement de mot de passe.

### Lot 3 : synchronisation

**3a, préalables et suppression.**

- `DiverId` dans les signatures `upsertIn` et `pull` des trois services ;
- tombstones horodatées par le serveur (D-42) ;
- participation en UUIDv7 (D-45) ;
- `isStaleRestore` à la microseconde ;
- `DELETE /api/dives/:id` (D-43) ;
- commande `purge` (D55, `apps/api/src/cli/`) ;
- limite JSON explicite (`configure-app.ts`) ;
- seaux à jetons généralisés (`common/rate-limit/token-buckets.ts`).

**3b, pull.**

- `apps/api/src/modules/sync/{sync.module,sync.controller,sync-pull.service,sync-cursor}.ts` ;
- `findAll` des niveaux ;
- `packages/shared/src/sync.ts` ;
- côté client, `packages/client/src/sync/{cursor,applyPage}.ts`.

**3c, push.**

- `modules/sync/{sync-push.service,dto/*}.ts` ;
- `DiveWriteService.writeIn` extrait de `create` et `replace` (D-39) ;
- règle de conflit (D-41) ;
- `client-outdated` (D-44) ;
- côté client, `packages/client/src/sync/{outbox,push,rebase}.ts`.

Critères d'acceptation :

- résultat par enregistrement dans l'ordre (`applied`, `rejected`, `invalid`, `failed`), un enregistrement invalide n'empêche pas les suivants ;
- `full-sync-required` au-delà de l'horizon (push et pull) ;
- conflit détecté selon D-41, PUT web toujours en LWW ;
- pull cohérent entre tables sous écriture concurrente ; tombstones sans donnée ;
- `DELETE /api/dives/:id` idempotent, 404 générique ;
- `client-outdated` ; 429 par session ;
- `pnpm --filter api run purge` purge ce que `PurgeService` purge en test ;
- aucun log du push ni du pull.

Tests :

- unitaires : encodage et validation du curseur, budget par page, préfixage des `fieldErrors` par chemin (`changes.1.record.participation.maxDepthM`), règle de conflit, protocole client (outbox, application des pages, rebase) en Vitest avec le faux `LocalStore` ;
- e2e sans base : enveloppe (26 changements → 400, corps > 100 kB → 413, non JSON → 415), audiences de `/api/sync/*` (cookie web → 401), `no-store` ;
- `test:db` : scénarios du §7.

### Lot 4 : documentation

- `ARCHITECTURE.md` :
  - §1 à §3 : paquets et `apps/mobile` à venir ;
  - §5 : exception `StyleSheet` (D58) ;
  - §6 réécrit (paquets runtime, token de `MobileLoginResponse`) ;
  - §8 : tests du paquet et de la sync ;
  - §9 : Bearer, données sur l'appareil ;
  - §10 : D46 à D60, avec les amendements de D13, D22, D25, D33, D34, D37 et D42 ;
  - §11 : point « App mobile » soldé ou mis à jour ;
- `docs/data-model/decisions.md` : D-39 à D-45 ; questions #19 et #20 fermées ;
- `CLAUDE.md` : exception `StyleSheet`, tokens (déjà amendés au lot 1e), commande `purge` ;
- ce plan passe au statut « terminé ».

Critère : chaque conflit du §1.3 est tranché ou explicitement reporté ; aucune décision n'est appliquée sans entrée au §10.

## 4. Lot 0 de l'app mobile (esquisse)

Après les lots 1 à 3, pour que l'app démarre sur des fondations prêtes :

- `apps/mobile` (`@e-deep/mobile`) : `package.json`, `app.json` (plugins `expo-sqlite` avec `useSQLCipher`, MapLibre, exclusion des sauvegardes), `tsconfig.json` qui étend `packages/tsconfig/base.json`, `metro.config.ts`, `app/_layout.tsx`, `app/(auth)/login.tsx`, `app/_dev/intl.tsx`, `src/theme/` (tokens) ;
- adaptateur `LocalStore` expo-sqlite, ouverture de la base avec contrôle `cipher_version`, token dans SecureStore, client `@e-deep/client` en mode bearer ;
- `pnpm-workspace.yaml` (`allowBuilds`, exclusions `minimumReleaseAge` justifiées), `eslint.config.js` (bloc mobile, interdits croisés), `.github/workflows/ci.yml` (job mobile : `lint`, `typecheck`, `test`, `expo export`).

Critères :

- dev build iOS et Android qui démarre et se connecte à l'API de dev ;
- `@e-deep/client` et `@e-deep/design-tokens` résolus par Metro ; `pnpm why --depth=10 react-native` sans doublon ;
- fichier de base illisible par `sqlite3` sans la clé ;
- écran `/_dev/intl` identique au web sur les deux plateformes (Jest tourne sur l'ICU de Node, pas sur Hermes) ;
- points « à vérifier au lot 0 » du §8.4 consignés.

Tests : Jest 30 + `jest-expo` + RNTL ≥ 14, rendu de l'écran de connexion par rôles, faux `LocalStore` branché. Pas de test natif automatisé.

Lots suivants (hors fondations) : carnet et détail en lecture, saisie hors ligne et outbox, carte, réglages, préparation des stores.

### 4.1 Dépendances prévues pour `apps/mobile`

| Paquet                                                                                                                  | Rôle                             | Alternative native écartée                             |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------ |
| `expo`, `react`, `react-native`                                                                                         | Socle                            | —                                                      |
| `expo-router` et ses pairs (`react-native-screens`, `react-native-safe-area-context`, `expo-linking`, `expo-constants`) | Navigation                       | Pile maison                                            |
| `expo-sqlite`                                                                                                           | Base locale chiffrée             | AsyncStorage (non chiffré, non relationnel)            |
| `expo-secure-store`                                                                                                     | Token et clé de base             | —                                                      |
| `expo-crypto`                                                                                                           | Aléa pour UUIDv7 et clé          | `crypto` global, non garanti sous Hermes               |
| `@tanstack/react-query`                                                                                                 | Cache réactif (déjà dans le web) | `useSyncExternalStore` maison                          |
| `@maplibre/maplibre-react-native`                                                                                       | Carte                            | `react-native-maps` (clé Google, transfert de données) |
| `expo-screen-capture`                                                                                                   | Masquer le sélecteur d'apps      | —                                                      |
| dev : `jest@^30` (déjà dans l'API), `jest-expo`, `@testing-library/react-native`                                        | Tests                            | —                                                      |

Exclus : ORM, zod, `uuid`, bibliothèque de dates, gestionnaire d'état, polices, i18n, NetInfo, `eslint-config-expo`. Impact sur `minimumReleaseAge` : un patch Expo épinglé par `expo install --fix` peut avoir moins d'un jour ; exclusions ciblées, retirées ensuite (comme pour Nest, D5). Impact sur `allowBuilds` : pnpm liste au premier install les scripts refusés ; chaque autorisation est justifiée.

## 5. Points de relecture

### 5.1 Après chaque lot

Revue par un agent **qui n'a pas écrit le code** (`code-reviewer`), avec cette checklist :

- pas de `any`, exports nommés, `import type` pour `@e-deep/shared` ;
- propriétaire vérifié sur **chaque** enregistrement poussé et chaque ligne tirée (`DiverId` dans la signature, filtre en SQL) ;
- aucune donnée personnelle ou de santé dans les logs (§9) ; aucune valeur reçue reprise dans une erreur ;
- migrations réversibles (`down()` testé, ou échec explicite documenté) ; `synchronize: false` ;
- aucune dépendance au DOM, à React ni à `window` dans `packages/client` et `packages/design-tokens` ;
- aucune nouvelle dépendance non justifiée ;
- documentation du lot à jour.

### 5.2 Revue sécurité dédiée avant le merge du lot 2 et du lot 3c

- **IDOR enregistrement par enregistrement** : un `changes[i]` portant l'id d'une ligne de B (site, événement, participation, binôme référencé) ne lit ni n'écrit rien de B et ne révèle pas son existence (`identifier-conflict` et `not-found` ne permettent pas de distinguer une ligne de B d'une ligne absente au-delà de ce que révèlent déjà les routes en ligne) ; le `current` d'un `rejected` n'est jamais une ligne de B.
- **Contournement de l'`OriginGuard`** : cookie + Bearer, Bearer vide ou mal formé avec cookie, `Sec-Fetch-Site: cross-site` + Bearer, `@NativeClient` limité au seul login.
- **Rejeu** : un lot rejoué deux fois donne les mêmes résultats sans doublon ; un `dive-delete` rejoué reste `applied` ; un token révoqué rejoué donne 401.
- **Tailles** : 25 changements, 100 kB, 50 observations et 50 binômes par plongée, `limit` du pull plafonné, curseur forgé (JSON invalide, horodatage hors format, id non UUID) → 400.

### 5.3 Accessibilité (lots mobiles suivants)

Passage VoiceOver et TalkBack à chaque lot d'écran, texte à 200 %, cibles de 44 pt / 48 dp, annonces de la sync.

### 5.4 Outillage Claude Code à créer (périmètre seulement)

- **Agent `react-native-developer`** : Expo, Expo Router, `StyleSheet` et tokens, accessibilité RN, tests RNTL ; lit `ARCHITECTURE.md` et ne touche ni `apps/web` ni `apps/admin`.
- **Skill `developing-react-native`** : conventions d'`apps/mobile`, exception `StyleSheet`, interdits (DOM, SCSS, Tailwind), dev builds, Hermes et Intl.
- **Skill `offline-sync`** : protocole push/pull, outbox, rebase, conflits, purge locale ; à suivre pour `packages/client/src/sync` et `apps/api/src/modules/sync`.
- **Skill `mobile-release`** : checklist EAS et stores, déclarations de confidentialité, suppression du compte, vérification SQLCipher et sauvegardes.

`implement-screen`, `developing-scss` et `react-developer` ne s'appliquent pas à `apps/mobile`.

## 6. Accessibilité, RGPD et stores (cadrage V1)

- **Accessibilité** : `accessibilityRole`, `accessibilityLabel` et `accessibilityState` partout ; `allowFontScaling` respecté, mise en page testée à 200 % ; cibles de 44 pt (iOS) et 48 dp (Android) ; contrastes des tokens (D21, déjà AA) ; `AccessibilityInfo.announceForAccessibility` sur les changements d'état de la sync ; tests RNTL par `getByRole`.
- **Déclarations Apple** : Health (données saisies), Contact Info (email), Identifiers (user ID), toutes « Linked to you », sans tracking.
- **Google Play, Data safety** : Health info, email, chiffrement en transit, suppression du compte dans l'app et lien web.
- **Politique de confidentialité** mise à jour : stockage local chiffré, purge, aucune sauvegarde cloud.

## 7. Tests transverses

### 7.1 Matrice d'autorisation « A ne peut ni lire ni écrire les données de B »

Extension d'`authorization-matrix.db-spec.ts` :

- **push** de A avec, pour chaque type de changement, l'id d'une ligne de B (création et modification) : `failed: identifier-conflict`, ligne de B inchangée ;
- **push** d'une plongée de A qui référence le site ou un binôme de B : `failed: invalid-reference` ;
- **`dive-delete`** de A sur une plongée de B : `failed: not-found`, plongée de B vivante ;
- **`DELETE /api/dives/:id`** de A sur B : 404 ;
- **pull** de A : aucune ligne de B, tombstones comprises, quelle que soit la position du curseur ; curseur de B rejoué par A : uniquement les lignes de A ;
- **`rejected`** : `current` ne porte jamais de donnée de B.

### 7.2 Scénarios de sync (`test:db`)

1. **Rejeu** : le même lot poussé deux fois donne les mêmes résultats ; aucune ligne en double.
2. **Ordre** : site créé puis plongée qui le référence dans le même lot → deux `applied` ; ordre inverse → la plongée crée le site par son nom (`quick`).
3. **Isolement** : un enregistrement invalide au milieu du lot ; les autres sont appliqués.
4. **Conflit** : plongée modifiée par le PUT web après le dernier pull du mobile → `rejected: conflict` avec l'état serveur ; même modification avec la base à jour → `applied`. Création rejouée identique avec `baseUpdatedAt: null` → `applied` ; différente → `conflict`.
5. **Tombstone** : suppression web puis pull → tombstone minimale ; push d'une modification sur cette plongée → `rejected: stale-restore`.
6. **Horizon dépassé** : `lastPulledAt` ou curseur antérieur à 90 jours → `409 full-sync-required` ; pull complet puis rebase de l'outbox (protocole client).
7. **Cohérence du pull** : création concurrente d'un site puis d'un événement qui le référence entre deux pages → le site arrive au plus tard dans la même page que l'événement ; budget épuisé par les sites → aucune participation dans la page.
8. **Fenêtre de 5 s** : une ligne validée juste avant le `serverTime` d'une session précédente est relue à la session suivante.
9. **401 au milieu d'un lot** : session révoquée entre deux enregistrements (`logout-all` concurrent) → les enregistrements déjà traités restent appliqués, le cycle suivant reçoit 401 ; côté client, la file garde les entrées non confirmées.
10. **Purge** : tombstones au-delà de l'horizon supprimées par la commande `purge` ; un pull complet ultérieur ne les sert plus.
11. **Client périmé** : `protocolVersion: 2` → `409 client-outdated`.

## 8. Risques, dette assumée, hors périmètre

### 8.1 Risques

- **TS 6 et Expo** (D2) : compatibilité non documentée ; si Expo exige TS 7, le conflit se signale avant le lot 0.
- **Hermes et Intl** : `DateTimeFormat` avec `timeZone` et `en-CA` peut différer ; écran `/_dev/intl`, polyfill FormatJS seulement en cas d'écart (dépendance à justifier).
- **`normalize('NFKC')`** sous Hermes pour `passwordRules` : à défaut, contrôle de longueur désactivé côté mobile, l'API reste l'autorité.
- **`credentials: 'omit'` sous RN** : si la pile iOS partage les cookies malgré tout, le mobile n'appelle aucune route qui pose un cookie (aucune en V1).
- **CARTO** (conflit 9) : clé obligatoire, cache ≤ 30 jours, attribution ; vaut déjà pour le web. À régler avec l'hébergement ; packs hors ligne en V2 (CARTO à expiration, ou tuiles auto-hébergées, licences à vérifier).
- **SQLCipher sur Android** : régressions signalées par la communauté (OpenSSL, pages de 16 KB) ; contrôle `cipher_version` à chaque ouverture.
- **Limitation de débit en mémoire** (D35) : une seule instance ; le CGNAT aggrave le partage des seaux IP au login.
- **`nodeLinker: isolated`** : une bibliothèque native incompatible pousserait vers `hoisted`, global au workspace (relance de toute la CI).
- **Interblocage** connu entre la fusion de sites et la réécriture d'une plongée : le push par enregistrement le rend plus rare, pas impossible (500, `40P01`, rejoué par le client).

### 8.2 Dette assumée

- Compte supprimé depuis le web : indistinguable d'une expiration côté mobile ; données chiffrées et masquées jusqu'à l'effacement.
- Pas de suppression de site ni de gestion des binômes depuis le mobile.
- Pas de sync en arrière-plan ; pas d'EAS Update.
- Les routes en ligne acceptent encore les UUID v4 pendant 30 jours (D-45).

### 8.3 Hors périmètre

- Partage des palanquées (D43, modèle cible D-08).
- Notifications push.
- Import depuis un ordinateur de plongée (V2).
- Inscription et onboarding initial sur mobile.
- Plusieurs comptes actifs sur un même appareil.
- Carte hors ligne (V2).

### 8.4 Versions et sources

Vérifié le 2026-11-27 :

- Expo SDK 58 (RN 0.88, R8, libSQL retiré) : https://expo.dev/changelog/sdk-58
- Versions épinglées par SDK 58 (`react` 19.3.0, `react-native` 0.88.1, `expo-sqlite`, `expo-secure-store`, `expo-crypto`, `expo-router`, `jest-expo`, `expo-screen-capture`) : https://raw.githubusercontent.com/expo/expo/sdk-58/packages/expo/bundledNativeModules.json
- React Native 0.88 (React 19.3.0, Metro 0.87, Hermes) : https://reactnative.dev/blog/2026/10/19/react-native-0.88
- Monorepos Expo (installations isolées, Metro automatique, React dupliqué) : https://docs.expo.dev/guides/monorepos/
- pnpm (`nodeLinker`, `minimumReleaseAge`, `allowBuilds`, `strictDepBuilds`) : https://pnpm.io/settings/node-modules, https://pnpm.io/settings/dependency-resolution, https://pnpm.io/settings/build
- expo-sqlite et SQLCipher : https://docs.expo.dev/versions/latest/sdk/sqlite/
- expo-secure-store (Keychain conservé après désinstallation, `THIS_DEVICE_ONLY`, Auto Backup) : https://docs.expo.dev/versions/latest/sdk/securestore/
- expo-crypto (`randomUUID` v4, `getRandomValues`) : https://docs.expo.dev/versions/latest/sdk/crypto/
- Tests (Jest 30, RNTL ≥ 14) : https://docs.expo.dev/develop/unit-testing/
- MapLibre React Native et Expo : https://maplibre.org/maplibre-react-native/docs/setup/expo
- Conditions CARTO (§8 clé, §9.c.ii cache de 30 jours, §13 attribution) : https://carto.com/legal/basemap-terms/
- Hermes et Intl : https://formatjs.github.io/docs/guides/react-native-hermes/
- Apple (5.1.1(v), 5.1.3(ii), fiche de confidentialité) : https://developer.apple.com/app-store/review/guidelines/, https://developer.apple.com/support/offering-account-deletion-in-your-app/, https://developer.apple.com/app-store/app-privacy-details/
- Google Play (suppression du compte, Data safety) : https://support.google.com/googleplay/android-developer/answer/13327111, https://support.google.com/googleplay/android-developer/answer/10787469

**À vérifier au lot 0** : TypeScript 6 avec Expo ; compatibilité de MapLibre RN avec SDK 58 ; `structuredClone`, `AbortSignal.timeout`, `URL`, `normalize('NFKC')` et `TextEncoder` sous Hermes V1 ; envoi de `Sec-Fetch-Site` ou d'`Origin` par le `fetch` de RN ; `credentials: 'omit'` respecté ; exclusion iCloud d'un fichier SQLite ; `expo-screen-capture` et le sélecteur d'apps ; scripts d'install des paquets Expo et MapLibre ; patchs Expo de moins d'un jour face à `minimumReleaseAge`.

## 9. Mises à jour documentaires

- **Dès maintenant** (avec ce plan) : un point ouvert « App mobile » dans `ARCHITECTURE.md` §11, qui pointe vers ce plan.
- **Au lot 1e** : `CLAUDE.md` (emplacement des tokens), avant le déplacement.
- **Au lot 4** (dernier lot d'implémentation, comme pour l'authentification) : D46 à D60 reportées au §10 d'`ARCHITECTURE.md`, D-39 à D-45 dans `docs/data-model/decisions.md`, et les sections listées au lot 4.
