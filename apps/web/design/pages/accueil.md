# Spec — Accueil public, connexion, inscription

Complète `design/README.md`. Maquette : `design/mockups/welcome.jsx` (lecture seule ; elle affiche `DashboardDesktop` et `MobileNominal` en aperçu). Captures : `design/screenshots/50` → `53`.

**Objectif :** une seule page publique qui **présente l'app** à qui ne la connaît pas et permet de **se connecter ou de s'inscrire** sans détour.

## Écrans de référence

| Capture | Composant maquette | Taille | Contenu |
|---|---|---|---|
| `50-welcome-desktop.png` | `WelcomeDesktop` | 1440 | Page complète, onglet « Se connecter » actif, focus sur le mot de passe |
| `51-welcome-signup-card.png` | `SignupCard` | 520 | Carte avec l'onglet « Créer un compte », critères du mot de passe |
| `52-welcome-mobile.png` | `WelcomeMobile` | 375 | Accueil mobile |
| `53-login-mobile-error.png` | `LoginMobile` | 375 | Écran de connexion mobile, erreur d'identifiants |

## Routes et redirections

| Route | Desktop (≥ 1024) | Mobile / tablette (< 1024) |
|---|---|---|
| `/` | Accueil, onglet « Se connecter » | Accueil (présentation + 2 boutons) |
| `/login` | Accueil, onglet « Se connecter » actif + focus sur l'e-mail | Écran de connexion dédié (capture 53) |
| `/signup` | Accueil, onglet « Créer un compte » actif + focus sur le prénom | Écran d'inscription dédié (même structure que 53, formulaire de 51) |
| `/forgot-password` | Page placeholder | Page placeholder |

- **Utilisateur déjà connecté** sur `/`, `/login` ou `/signup` : redirection vers `/dashboard`.
- **Route protégée sans session** : redirection vers `/login?next=<chemin>`, puis retour à `next` après connexion (seulement les chemins internes).
- **Après inscription** : redirection vers `/welcome` (premier lancement : niveau, fédération, n° de départ du carnet). **Placeholder dans ce chantier.**
- Les onglets changent l'URL (`/login` ↔ `/signup`) sans recharger la page et sans perdre l'e-mail déjà saisi.

## Structure desktop (capture 50)

1. **En-tête** : marque (`APP_NAME`) à gauche, ancres « Comment ça marche · Fonctionnalités · Confidentialité » à droite (défilement doux, désactivé si `prefers-reduced-motion`).
2. **Hero** en grille `minmax(0,1fr) 440px`, gap 80 :
   - **à gauche** : overline accent « Carnet de plongée numérique · FFESSM · CMAS », h1 (56/60, −1.6), paragraphe (18/1.55), 3 points avec coche accent, indication « Découvre l'app plus bas » ;
   - **à droite** : la **carte d'authentification** (`Card` elev 2, padding 28) avec titre (« Content de te revoir » / « Ouvre ton carnet »), sous-titre, onglets, formulaire.
3. **Aperçu produit** : capture desktop du dashboard dans un cadre de navigateur, et capture mobile dans un cadre de téléphone qui la chevauche en bas à droite.
4. **Comment ça marche** : 3 cartes (01 Saisis ta plongée · 02 Retrouve-la en deux clics · 03 Vois ta progression).
5. **Fonctionnalités** : grille 3 × 2 séparée par des filets (Un vrai carnet · Ta palanquée · Tes sites sur la carte · Ton tableau de bord · Même sans réseau · Tes données restent à toi).
6. **Appel final** : « Ta prochaine plongée mérite mieux qu'un post-it. » + « Se connecter » (secondary) et « Créer mon carnet » (primary). Les deux boutons font remonter à la carte et activent l'onglet correspondant.
7. **Pied de page** : marque et liens Mentions légales · Confidentialité · Conditions d'utilisation · Contact (pages placeholder).

Les textes sont ceux de la maquette. **Aucun témoignage ni chiffre inventé.** Deux promesses dépendent du produit livré et sont pilotées par des drapeaux de configuration (`src/config/app.ts`) :
- `features.offline` : sans mode hors ligne, masquer « Même sans réseau » et le 3e point du hero ;
- `privacy.copy` : textes de confidentialité à valider avant la mise en ligne.

## Aperçu produit : images, pas composants

L'accueil **n'importe pas** les composants du dashboard (poids du bundle public, données fictives à maintenir). Il utilise des **images** :
- au départ, `design/screenshots/01-desktop-nominal.png` et `04-mobile-nominal.png` converties en WebP (1×, 2×) dans `public/marketing/` ;
- plus tard, à remplacer par de vraies captures de l'app ;
- `<img>` avec `width` et `height` (pas de décalage de mise en page), `loading="lazy"`, `alt` descriptif (« Tableau de bord DiveLog : 127 plongées, profondeur max 42 m, carte des sites ») ;
- cadres navigateur et téléphone en CSS.

## Mobile (captures 52, 53)

- **Accueil** : en-tête (marque + lien « Se connecter » → `/login`), h1 (34/38), paragraphe, **deux boutons pleine largeur de 52px** au-dessus de la ligne de flottaison (« Créer mon carnet » → `/signup`, « J'ai déjà un compte » → `/login`), capture mobile dans son cadre, étapes en liste, fonctionnalités en cartes, appel final, pied de page.
- **Connexion / inscription** : écran dédié, avec en haut « ‹ Accueil », logo 40px, titre, sous-titre, formulaire, et en bas un lien vers l'autre écran (« Pas encore de compte ? Créer mon carnet »).

## Formulaires

### Connexion

| Champ | Attributs | Règle |
|---|---|---|
| E-mail | `type="email"`, `autocomplete="username"`, `inputMode="email"`, sans majuscule ni correction automatique | Format vérifié au blur |
| Mot de passe | `type="password"`, `autocomplete="current-password"`, bouton afficher/masquer (`aria-label`, `aria-pressed`) | Obligatoire |
| Rester connecté | Case cochée par défaut | Durée de session longue ou courte (côté API) |

- Lien « Mot de passe oublié ? » aligné à droite du label.
- **Erreur d'identifiants** : bandeau `role="alert"` au-dessus des champs, bordures `danger` sur les deux champs, texte **non discriminant** : « E-mail ou mot de passe incorrect. Vérifie ta saisie ou réinitialise ton mot de passe. » Le focus va dans le mot de passe, dont le contenu est vidé.
- **Trop de tentatives** (renvoyé par l'API) : « Trop de tentatives. Réessaie dans N min. », bouton désactivé avec un compte à rebours.
- **Erreur réseau** : « Connexion impossible. Vérifie ton réseau et réessaie. »

### Inscription

| Champ | Attributs | Règle |
|---|---|---|
| Prénom | `autocomplete="given-name"` | Obligatoire, 1–40 caractères. Aide : « Affiché dans ton carnet et ta palanquée. » |
| E-mail | `autocomplete="email"` | Format ; « Un compte existe déjà avec cet e-mail. [Se connecter] » si l'API le signale |
| Mot de passe | `autocomplete="new-password"`, afficher/masquer | **10 caractères min., une majuscule, un chiffre** (bloquants) ; caractère spécial conseillé (non bloquant). Jauge à 4 segments et critères mis à jour **à chaque frappe**. Pas de champ « confirmer ». |

- Mention CGU et confidentialité sous le bouton (liens).
- Bouton « Créer mon carnet » toujours actif ; validation au blur puis à l'envoi (même logique que le formulaire de plongée).

### Commun

- Boutons en chargement (« Connexion… », « Création… ») ; double envoi impossible.
- `Entrée` envoie le formulaire.
- Aucune donnée d'authentification dans les logs ni l'analytics.

## Session (à valider avec le back NestJS)

Le front passe par un module `authClient` (`login`, `signup`, `logout`, `refresh`, `me`) et un `AuthProvider` / `useAuth()`. **En V1 il est simulé** (mocks : `marine.rousseau@mail.fr` / `Plongee2026` valide, tout autre couple renvoie une erreur ; un e-mail `deja@mail.fr` renvoie « compte existant » ; `bloque@mail.fr` renvoie « trop de tentatives »).

Recommandation à confirmer en phase 0 : **jeton d'accès en mémoire** et **jeton de rafraîchissement en cookie `httpOnly` / `Secure` / `SameSite`** posé par l'API. Jamais de jeton dans `localStorage`.

## Accessibilité

- Un seul h1 par écran. Sections avec titres h2.
- Onglets : pattern ARIA Tabs (`role="tablist"`, `tab`, `tabpanel`, flèches gauche/droite), la sélection met à jour l'URL.
- Champs : labels visibles et associés ; erreurs liées par `aria-describedby` ; `aria-invalid`.
- Critères du mot de passe : liste avec un état textuel (« rempli » / « non rempli ») pour les lecteurs d'écran, annoncée en `aria-live="polite"` avec un délai (pas à chaque frappe).
- Contrastes AA, cibles ≥ 44px, focus visible.
- Images d'aperçu avec `alt` ; cadres décoratifs en `aria-hidden`.

## SEO et méta (page publique)

`<title>` « DiveLog — Ton carnet de plongée numérique », meta description, balises Open Graph (image : capture du dashboard), `lang="fr"`. Le pré-rendu statique de `/` est hors périmètre, à noter comme dette.

## Hors périmètre

Connexion via Google ou Apple, mot de passe oublié (page placeholder), vérification de l'e-mail, premier lancement `/welcome` (placeholder), pages légales (placeholders), pré-rendu SEO.
