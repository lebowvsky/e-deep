# Spec : écrans de compte (lot 6b)

Statut : **validé par le porteur le 2026-11-26** (`docs/plans/auth.md` §4 « 6b »).
Ce document est subordonné à `CLAUDE.md`, `ARCHITECTURE.md` puis `docs/plans/auth.md`. Il décrit les
trois écrans **sans maquette** du lot 6b, `/welcome`, `/consent` et `/settings`, ainsi que la
suppression de `DEV_AUTH_STUB`. Aucune route d'API n'est ajoutée : toutes existent depuis le lot 3.

## 1. Principes communs

- **Ton et composants de l'accueil** (lot 6a) : tutoiement, phrases courtes, aucune promesse que le
  produit ne tient pas. On réutilise `AuthScreen` (marque, carte centrée), `PasswordField`,
  `PasswordStrength`, `FormBanner` et `AuthSubmitButton`, ainsi que les primitives DiveLog
  `FormField`, `TextInput`, `Select`, `Checkbox`, `Button`, `Card`, `Toast` et `ConfirmDialog`.
- **Formulaires** : même comportement que la connexion et l'inscription.
  - Validation locale à la sortie du champ, puis à l'envoi.
  - Les `fieldErrors` du serveur s'affichent sous le champ concerné.
  - Le focus va sur le premier champ en erreur, ou sur le bandeau pour une erreur globale.
  - Le bouton passe en état occupé pendant l'envoi (`aria-busy`, libellé « …ment… »).
  - Une erreur réseau ou 5xx affiche un bandeau générique et ne change rien d'autre.
  - Une 429 `too-many-attempts` affiche le compte à rebours `Retry-After` sur le bouton, comme à
    la connexion.
- **Accessibilité** (README design §6) : un `h1` par écran, labels visibles, cibles de 44 px,
  focus visible, résumé d'erreurs annoncé (`role="alert"`) et `prefers-reduced-motion`.
- **Mobile-first** : écrans vérifiés à 375, 768 et 1280 px. Aucune valeur en dur dans les SCSS.
- **Après une fin de session** (suppression du compte, déconnexion de tous les appareils), on
  applique le même nettoyage que la déconnexion (`endSession`) : cache vidé, brouillons purgés,
  autres onglets prévenus.

## 2. `/welcome` : premier lancement

**Accès** : session web avec `onboarding: 'profile-required'` (loader `requireOnboardingStep`,
déjà en place). Sinon, redirection selon le statut. Aucune route du carnet n'est accessible avant
la fin de cet écran : l'API répond `403 onboarding-required` et le web redirige ici.

**Mise en page** : `AuthScreen` (marque en haut, carte centrée, sans la navigation de l'app),
titre « Bienvenue, {prénom} », sous-titre « Deux infos et ton carnet est prêt. ».

**Champs** :

| Champ              | Composant                  | Règle                                                                                                                                                                            |
| ------------------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Niveau de plongée  | `Select` (variant `field`) | Obligatoire. Options issues de `GET /api/certification-levels`, libellé « Niveau 2 · FFESSM ». Aucune option présélectionnée : un premier choix « Choisis ton niveau » invalide. |
| Nom                | `TextInput`                | Facultatif, 100 caractères maximum. Aide : « Facultatif. Il apparaît sur ton carnet. »                                                                                           |
| Consentement santé | `Checkbox`                 | **Non pré-cochée et obligatoire**. Texte au §5. Lien « En savoir plus » vers `/privacy`.                                                                                         |

Le « n° de départ du carnet » de la spec d'accueil est hors périmètre (D26). Le prénom, saisi à
l'inscription, n'est pas modifiable ici.

**Envoi** : bouton « Ouvrir mon carnet ». Il envoie `POST /api/me/onboarding` avec
`{ lastName, certificationLevelId, healthDataConsent: true, policyVersion }`, où
`policyVersion` est la `currentPolicyVersion` de `/me`. La réponse met à jour la requête `me`,
puis on navigue vers `next` s'il est sûr (`safeNext`), sinon vers `/dashboard`.

**Erreurs** :

- Case non cochée : « Coche la case pour continuer : sans ton accord, ton carnet ne peut pas
  enregistrer tes plongées. ».
- Niveau manquant : « Choisis ton niveau. ».
- `409 onboarding-complete` (fait dans un autre onglet) : on recharge `me`, puis on suit son statut.
- La liste des niveaux ne charge pas : bandeau « Impossible de charger les niveaux. » avec un
  bouton « Réessayer ». Le formulaire reste visible mais l'envoi est bloqué.

**Sortie** : lien discret « Ce n'est pas toi ? Se déconnecter » (le même `fetcher.Form` vers
`/logout`).

## 3. `/consent` : re-consentement

**Accès** : session web avec `onboarding: 'consent-required'`, c'est-à-dire un consentement d'une
version périmée. Un `403 consent-required` reçu en cours de navigation y mène déjà (lot 5).

**Mise en page** : `AuthScreen`, titre « Notre politique a changé », sous-titre « Relis-la et
confirme ton accord pour continuer à utiliser ton carnet. ».

**Contenu** :

- Le texte du consentement (§5) et le lien vers `/privacy`.
- La même case, non pré-cochée et obligatoire, puis le bouton « Continuer ». Il envoie
  `POST /api/me/consents` avec `{ purpose: 'health_data_processing', policyVersion }`, puis
  navigue vers `next` ou `/dashboard`.
- **Refuser** : sous un séparateur, « Tu ne veux pas donner ton accord ? Sans lui, ton carnet ne
  peut pas être conservé. » et un bouton secondaire « Supprimer mon compte ». Il ouvre la même
  boîte de dialogue que dans `/settings` (§4.4). Retirer son consentement revient à supprimer son
  compte (D38).
- Lien « Se déconnecter ».

Une seule version de politique existe aujourd'hui (`2026-11`). Cet écran ne s'affiche donc en
réel qu'après la publication d'une nouvelle version. Il est testé par Vitest et par le forçage
`?state=` en dev.

## 4. `/settings` : compte

**Accès** : l'app connectée (layout protégé, `AppShell`), à la place du placeholder actuel. Le
lien « Paramètres » du menu utilisateur existe déjà.

**Mise en page** : titre « Paramètres », puis une colonne de `Card`, une par section, avec une
largeur de lecture bornée sur desktop.

### 4.1 Compte (lecture seule)

Prénom et nom, e-mail, niveau. La modification du profil est hors périmètre : pas de lien mort,
pas de bouton « Modifier ».

### 4.2 Mot de passe

- Champs « Mot de passe actuel » et « Nouveau mot de passe » (`PasswordField`, avec
  `autocomplete` `current-password` et `new-password`), ainsi que la jauge `PasswordStrength`
  (15 à 128 caractères, D35). Il n'y a pas de champ de confirmation, comme à l'inscription :
  l'affichage du mot de passe suffit.
- Bouton « Changer le mot de passe ». Il envoie `PUT /api/me/password`.
- Succès (204) : les champs sont vidés, puis un toast annonce « Mot de passe modifié. Tes autres
  appareils ont été déconnectés. ». La session courante continue, l'API ayant tourné le cookie.
- Erreurs :
  - `401 invalid-credentials` : « Mot de passe actuel incorrect. » sous le premier champ, qui est
    vidé ;
  - `fieldErrors.newPassword` (trop court, compromis, contient ton e-mail ou ton nom) : les
    messages de l'inscription ;
  - 429 : compte à rebours.

### 4.3 Appareils connectés

Texte : « Tu t'es connecté sur un appareil qui ne t'appartient pas ? Déconnecte-les tous, y
compris celui-ci. ». Bouton secondaire « Déconnecter tous les appareils ».

Il passe par une confirmation `ConfirmDialog` avant d'envoyer `POST /api/auth/logout-all`. En cas
de succès, on fait le nettoyage local puis on renvoie vers `/` (comme la déconnexion). En cas
d'échec, un toast d'erreur s'affiche et rien d'autre ne change.

### 4.4 Consentement et suppression du compte

- Ligne d'information : « Tu as donné ton accord le {date} (version {policyVersion}). ».
- Zone « Supprimer mon compte », séparée visuellement (bordure `danger`) : « Ton compte, ton carnet,
  tes sites et tes binômes sont effacés définitivement. Retirer ton accord revient à supprimer ton
  compte. ». Bouton `danger` « Supprimer mon compte ».
- **`DeleteAccountDialog`** (`ConfirmDialog` en variante `danger`, avec un `PasswordField` en
  enfant) :
  - titre « Supprimer ton compte ? » ;
  - texte « C'est définitif : rien ne pourra être récupéré. Saisis ton mot de passe pour
    confirmer. » ;
  - bouton « Supprimer définitivement », désactivé tant que le champ est vide, puis
    `DELETE /api/me`.
  - Succès (204) : nettoyage local, puis navigation vers `/` avec un état de route. L'accueil
    affiche alors un bandeau `role="status"` : « Ton compte et ton carnet ont été supprimés. ».
  - `401 invalid-credentials` : « Mot de passe incorrect. » dans la boîte, qui reste ouverte.
    429 : compte à rebours sur le bouton.

## 5. Texte du consentement santé (à relire par le porteur)

Libellé de la case, identique dans `/welcome` et `/consent` :

> J'accepte que {APP_NAME} enregistre mes données de plongée, dont certaines sont des données de
> santé (profondeurs, durées, paliers, incidents), pour tenir mon carnet. Elles ne sont visibles
> que par moi. Je peux retirer cet accord à tout moment en supprimant mon compte.

Le texte vit dans le front, dans `shared/config/consent.ts`, indexé par `HealthPolicyVersion` : une
nouvelle version de politique oblige à écrire son texte (le type ne compile pas sinon).

## 6. Suppression de `DEV_AUTH_STUB` (API)

- `config/environment.ts` : la variable, son `@Transform`, la contrainte
  `devAuthStubForbiddenInProduction` et les tests associés sont supprimés. La validation n'utilise
  pas de liste blanche, donc une ligne `DEV_AUTH_STUB` restée dans un `.env` local est ignorée et
  ne bloque pas le démarrage.
- `common/auth/dev-auth-stub.ts` est supprimé. Le repli disparaît de `session.guard.ts`, et
  `auth-context.ts` et `session-cookie.ts` sont simplifiés (plus de session `null` :
  `requireSessionId` devient inutile).
- Tests e2e et db : ceux qui reposaient sur le repli ouvrent une vraie session (helpers de
  `test/support`).
- `.env.example`, commentaire du seed (`dev-seed.data.ts`) et `db/support/app-environment.ts` sont
  mis à jour.
- Critère : `rg DEV_AUTH_STUB apps packages` ne renvoie rien. `ARCHITECTURE.md` et le plan
  conservent les mentions historiques, mises à jour au lot 8.

## 7. Découpage proposé

1. **API** : suppression du stub (agent `Backend NestJS Expert`).
2. **Web, `authClient`** : ajout de `changePassword`, `logoutAll` et `deleteAccount` (HTTP et faux
   client), puis `endSession` généralisé aux trois fins de session.
3. **`/welcome` et `/consent`** : `OnboardingForm` et `ConsentForm`, texte §5, forçage `?state=`.
4. **`/settings`** : `PasswordChangeForm`, appareils connectés, `DeleteAccountDialog`, bandeau
   de l'accueil.
5. Vérification visuelle (375, 768, 1280), relecture en contexte neuf, corrections, commits.

## 8. Tests

- Vitest pour chaque formulaire : validation locale, `fieldErrors` du serveur, focus, bouton
  occupé, 429.
- Aller-retour sur le faux serveur : inscription → `/welcome` → dashboard → déconnexion. Une
  route du carnet visitée avant `/welcome` y renvoie.
- Re-consentement après un `403 consent-required`. Refus suivi de la suppression du compte.
- `SettingsPage` : changement de mot de passe, déconnexion de tous les appareils, suppression du
  compte (mot de passe faux, puis bon : accueil et bandeau).
- `check:public-bundle` reste vert : `/welcome` et `/consent` sont chargés à la demande.
- Passage manuel sur la vraie API, sans stub, aux trois largeurs.

## 9. Hors périmètre

Modification du profil (prénom, nom, niveau, avatar), liste des sessions par appareil, export des
données (art. 20), changement d'e-mail, n° de départ du carnet, réinitialisation du mot de passe
par e-mail (lot email, D39).
