# Mission : implémenter l'accueil public, la connexion et l'inscription

Tu vas développer la page publique d'accueil (`/`), qui présente l'app et permet de se connecter ou de s'inscrire, ainsi que les écrans mobiles de connexion et d'inscription, la gestion de session côté front (simulée) et la protection des routes. Le design system et les composants existants (Card, Button, TextInput, FormField, Tabs si existant, Toast…) sont à **réutiliser**. Le travail se fait **par phases** : à la fin de chacune, fais un compte rendu court (fichiers créés ou modifiés, écarts avec la maquette, questions) et **attends mon « OK »**.

## À lire d'abord (obligatoire)

1. `CLAUDE.md` et `design/README.md`.
2. **`design/pages/accueil.md`** : spec, elle fait foi (routes, redirections, formulaires, erreurs, session, accessibilité).
3. Les captures `design/screenshots/50` à `53`.
4. `design/mockups/welcome.jsx` (lecture seule) pour les mesures et les textes exacts. **Ne reproduis pas** l'aperçu par les composants du dashboard : la spec impose des images.
5. Le code existant : routing, layout de l'app (sidebar, top bar), primitives de formulaire, `src/config/app.ts`.

Utilise le skill `/implement-screen` pour chaque bloc.

## Décisions déjà prises (ne pas les remettre en question)

- **Une seule page publique** : présentation + carte d'authentification dans le hero (desktop) ; sur mobile et tablette, écrans dédiés `/login` et `/signup`.
- **Inscription minimale** : prénom, e-mail, mot de passe. Niveau et fédération au premier lancement (`/welcome`, placeholder).
- **Mot de passe** : afficher/masquer, critères en direct, pas de champ de confirmation.
- **Message d'erreur de connexion non discriminant.**
- **Aucun témoignage ni chiffre inventé** ; promesses conditionnées par `features.offline` et `privacy.copy`.
- **Aperçu produit en images WebP** dans `public/marketing/`, pas en composants.
- **Session simulée en V1** derrière un `authClient` remplaçable ; aucun jeton dans `localStorage`.
- **`APP_NAME`** partout (la maquette affiche « DiveLog »).
- **Dépendances** : aucune nouvelle sans me demander.

## Phase 0 — Plan (aucun code)

- **Routing** : layout public (sans sidebar) et layout de l'app, `ProtectedRoute` / loader de garde, redirections (`next`, utilisateur déjà connecté), `/login` et `/signup` qui changent de rendu selon le breakpoint.
- **Session** : forme de `authClient`, `AuthProvider` / `useAuth`, stratégie de jetons à confirmer (recommandation de la spec : jeton d'accès en mémoire + cookie `httpOnly` de rafraîchissement). **Liste les questions à me poser pour le back NestJS** (endpoints, format d'erreur, limitation des tentatives, durée de session).
- **Composants** : `PublicLayout`, `PublicHeader`, `HeroSection`, `AuthCard`, `AuthTabs`, `LoginForm`, `SignupForm`, `PasswordField` (afficher/masquer), `PasswordStrength`, `ProductPreview` (cadres navigateur et téléphone), `StepsSection`, `FeaturesSection`, `FinalCta`, `PublicFooter`, `LoginPage` et `SignupPage` (mobile).
- Liste les valeurs des maquettes sans token, avec ta proposition.
- **Stop.**

## Phase 1 — Session et routing

- `authClient` simulé (comptes de test et erreurs de la spec), `AuthProvider`, `useAuth`, gardes de routes, redirections, déconnexion depuis le menu utilisateur de la sidebar.
- Placeholders : `/forgot-password`, `/welcome`, pages légales.
- Tests Vitest : redirection d'une route protégée vers `/login?next=…` puis retour, utilisateur connecté redirigé depuis `/`, `next` externe ignoré, déconnexion.
- **Stop.**

## Phase 2 — Formulaires

- `LoginForm` et `SignupForm` avec tous leurs états (erreur d'identifiants, trop de tentatives avec compte à rebours, erreur réseau, compte existant, chargement), `PasswordField`, `PasswordStrength` (règles bloquantes et conseillées), attributs `autocomplete`, `inputMode`, validation au blur puis à l'envoi.
- `AuthTabs` (pattern ARIA Tabs, synchronisés avec l'URL, conservation de l'e-mail saisi).
- Tests : règles du mot de passe, chaque erreur, onglets au clavier, envoi par Entrée, double envoi impossible.
- **Stop.**

## Phase 3 — Accueil desktop

- `PublicHeader`, hero (texte + `AuthCard`), `ProductPreview` (convertis `design/screenshots/01` et `04` en WebP 1× et 2× dans `public/marketing/`), étapes, fonctionnalités (drapeau `features.offline`), appel final (remonte à la carte et choisit l'onglet), pied de page.
- Ancres et défilement doux (respect de `prefers-reduced-motion`), méta SEO et Open Graph.
- `node scripts/screenshot.mjs "/" 1440` et comparaison avec la capture 50 (et 51 pour l'onglet inscription). 3 passes max. **Stop.**

## Phase 4 — Mobile et tablette

- Accueil mobile (capture 52), écrans `/login` (capture 53) et `/signup`, tablette (768–1023) avec le comportement mobile pour l'authentification.
- Captures à 375, 768 et 1440. **Stop.**

## Phase 5 — Contrôle qualité

- Audit accessibilité (h1 unique, onglets, erreurs liées, annonces des critères, contrastes, focus).
- Poids de la page publique : aucun import du code de l'app connectée (vérifie le découpage du bundle et le chargement à la demande des routes de l'app).
- Grep des valeurs en dur dans les nouveaux composants.
- `npm run typecheck`, `npm run lint`, `npm run test` et `npm run build` doivent tous passer.
- Compte rendu final : composants livrés, écarts, dette (pré-rendu SEO, vraies captures produit, OAuth, mot de passe oublié, premier lancement), questions back en suspens.

## Règles de travail

- Ne modifie rien dans `design/` ni dans les tokens générés.
- Si la spec et la maquette se contredisent, la spec gagne. Si l'information manque, demande-moi.
- Commits petits à la fin de chaque phase (Conventional Commits, en anglais). Ne push pas.
