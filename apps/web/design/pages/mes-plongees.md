# Spec — page « Mes plongées » (carnet de plongée)

Complète `design/README.md` (tokens, layout, a11y, Laws of UX : tout s'applique ici).
Maquette : `design/mockups/dives-list.jsx` (lecture seule). Captures : `design/screenshots/10` → `14`.

## Objectif de l'écran

Retrouver une plongée et relire son carnet. Action secondaire : enregistrer une nouvelle plongée.

## Écrans de référence

| Capture | Composant maquette | Taille | État |
|---|---|---|---|
| `10-dives-desktop.png` | `DivesDesktop` | 1440 | Nominal : 127 plongées, page 1, ligne #126 au survol |
| `11-dives-no-results.png` | `DivesNoResults` | 1440 | Filtres trop restrictifs, 0 résultat |
| `12-dives-empty.png` | `DivesEmpty` | 1440 | Carnet vierge (0 plongée) |
| `13-dives-mobile.png` | `DivesMobile` | 375 | Nominal mobile |
| `14-dives-mobile-filters.png` | `DivesMobileFilters` | 375 × 812 | Panneau de filtres ouvert |

## Structure (desktop ≥ 1024)

1. **En-tête** : overline accent « Carnet de plongée · {niveau} {fédération} », h1 « Mes plongées » (display), sous-titre « {n} plongées depuis {mois année de la 1re}. Avec {k} plongeurs différents. ». Actions : `Exporter` (secondary, icône download) et `Nouvelle plongée` (primary).
2. **Barre d'outils** : recherche (placeholder « Site, plongeur, note… », raccourci clavier `/`), séparateur, boutons de filtre `Période · Région · Profondeur · Gaz · Palanquée` (popover au clic ; état actif = fond `accentSoft` + pastille), puis le tri à droite (« Plus récentes » ; options : plus anciennes, profondeur, durée).
3. **Filtres actifs** (seulement s'il y en a, cf. capture 11) : puces supprimables + « Tout réinitialiser ».
4. **Bandeau de synthèse** (`surface0`) : Plongées · Temps cumulé · Prof. moyenne · Prof. max · Sites, **calculé sur la sélection filtrée** (pas sur la page). « — » quand 0 résultat.
5. **Tableau** (`Card` elev 1, padding 0) :
   - En-tête de colonnes : N° · Date (tri actif, chevron accent) · Site · Prof. max · Durée · Temp. · Gaz · Palanquée · (chevron).
   - **Groupes par mois** : ligne d'en-tête « Avril 2026 » + à droite « 4 plongées · 2 h 57 ».
   - Lignes de 60px : `#127` mono textLow · date mono + jour abrégé · site (500) + région (caption) · mini-barre de profondeur (échelle 0–60 m) + valeur · durée · température · gaz · palanquée · chevron.
   - La **profondeur max de la sélection** a sa barre en `accent` (seul usage de l'accent dans les lignes).
   - Survol : fond `surface2`, filet accent 2px à gauche, chevron accent. Toute la ligne mène au détail `/dives/:id`.
   - Nombres alignés à droite, unités en `textLow` plus petites.
6. **Pagination** dans le pied de la carte : « 1–10 sur 127 plongées » · pages (‹ 1 2 3 … 13 ›) · « Afficher [10 ▾] par page » (10 / 20 / 50).

## Colonne Palanquée

- Montre **tous les plongeurs de la palanquée** (2, 3, 4… plongeurs), **l'utilisateur en premier** avec un avatar neutre (`surface0` + contour `lineStrong`, texte `textMed`), puis les autres (avatar coloré, initiales).
- Au-delà de 5 avatars (desktop) ou 4 (mobile) : les derniers sont résumés en bulle « +N » (`surface3`).
- Survol / focus : infobulle avec la liste complète des noms. Pour les lecteurs d'écran : « Palanquée de 4 : Marine Rousseau (toi), Lucas Bernard, … ».
- Le terme « binôme » n'est **pas** utilisé dans l'interface.
- **Pas de visa ni de signature de moniteur** : la fonctionnalité n'existe pas.

## Mobile (< 768)

- Top bar + drawer + FAB « Nouvelle plongée » (identiques au dashboard).
- Overline « Carnet · 127 plongées », h1 (28), recherche pleine largeur (44px).
- Rangée de puces qui défile horizontalement : « Filtres » (icône) puis Période, Région, Profondeur, Gaz. Elles ouvrent toutes le **panneau de filtres** (bottom sheet).
- Ligne « 127 plongées · 84 h 23 » + tri.
- Groupes par mois puis **cartes** : `#n · jour date` + palanquée en haut à droite, site (16, 600), région, puis rangée de mesures (prof · durée · temp · gaz). La profondeur max de la sélection est en accent.
- Panneau de filtres (`role="dialog"`, `aria-modal`, poignée, « Réinitialiser », fermer) : Période (segmented 12 mois / 2026 / 2025 / Tout), Région (puces multi-choix avec compteur), Profondeur max (slider à deux poignées 0–60 m), Gaz (Air / Nitrox / Trimix), Plongé avec (puces avatar + compteur, « + N autres »). Bouton collant **« Afficher {n} plongées »**, recalculé en direct.

## Tablette (768–1023)

Non maquettée. Sidebar + tableau ; masquer les colonnes Temp. et Gaz sous 1024px.

## États

| État | Rendu |
|---|---|
| `loading` | Skeleton : bandeau + 6 lignes fantômes avec la même grille de colonnes. `aria-busy`. |
| `empty` (0 plongée) | Capture 12 : icône carnet, « Ton carnet est vierge », CTA primary + « Importer (UDDF, CSV) » secondary, mention de la numérotation de départ. Pas de barre d'outils ni de bandeau. |
| `no-results` | Capture 11 : barre d'outils et puces conservées, bandeau à « — », message + bouton qui retire le filtre le plus restrictif en annonçant le nombre de résultats, et « Tout réinitialiser ». |
| `error` | Non maquetté : carte avec message + « Réessayer », sans casser la mise en page. |
| `ready` | Captures 10 et 13. |

## État dans l'URL

Recherche, filtres, tri, page et taille de page sont dans les query params (`?q=&region=corse&depthMin=20&depthMax=40&gas=air&with=b1&sort=-date&page=2&size=10`) : la vue est partageable, et le retour depuis le détail d'une plongée garde la sélection. Changer un filtre renvoie en page 1.

## Accessibilité

- Tableau sémantique (`<table>`, `<thead>`, `<th scope="col">`, `aria-sort` sur la colonne triée) ; en-têtes de mois en `<th scope="rowgroup" colspan>` (ou `<tbody>` par mois, avec une ligne d'en-tête).
- Ligne cliquable : le lien réel est sur le nom du site, et un clic n'importe où sur la ligne le déclenche. Pas de `onClick` seul sur un `<tr>`.
- Unités lues avec la valeur (« 42 mètres », « 38 minutes »).
- Barres de profondeur `aria-hidden` (la valeur est déjà dans le texte).
- Puces supprimables : `aria-label="Retirer le filtre Région : Bretagne"`.
- Raccourci `/` : ignoré quand le focus est déjà dans un champ.
- Annonce `aria-live="polite"` du nombre de résultats après chaque changement de filtre.

## Hors périmètre (V1)

Export réel (le bouton ouvre un placeholder), import UDDF/CSV, page détail d'une plongée, rôles dans la palanquée (guide de palanquée), visa.
