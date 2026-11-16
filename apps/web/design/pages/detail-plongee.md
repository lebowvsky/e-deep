# Spec — page « Détail d'une plongée » (`/dives/:id`)

Complète `design/README.md` (tokens, layout, a11y, Laws of UX) et `design/pages/mes-plongees.md` (liste, palanquée, données).
Maquette : `design/mockups/dive-detail.jsx` (lecture seule). Captures : `design/screenshots/20` → `22`.

**V1 = saisie manuelle uniquement.** Aucun import depuis un ordinateur de plongée ni depuis un fichier. La capture `22-dive-profile-v2-reference.png` (courbe de profil) est une **cible V2, à ne pas implémenter**.

## Objectif de l'écran

Relire une plongée de son carnet, la feuilleter (précédente / suivante) et accéder à sa modification.

## Écrans de référence

| Capture | Composant maquette | Taille | Contenu |
|---|---|---|---|
| `20-dive-detail-desktop.png` | `DiveDetailDesktop` | 1440 | Plongée #127, Pointe de la Revellata |
| `21-dive-detail-mobile.png` | `DiveDetailMobile` | 375 | Même plongée |
| `22-dive-profile-v2-reference.png` | `ProfileCardV2` | 760 | **V2 — hors périmètre**, pour référence seulement |

## Structure (desktop ≥ 1024)

1. **Barre de navigation** :
   - à gauche, un fil d'Ariane « ‹ Mes plongées / #127 ». Le lien de retour restitue la liste **avec ses filtres, tri et page** (query string conservée) ;
   - à droite, « ‹ #126 · La Bibliothèque » et « #128 › ». Le bouton est désactivé quand la plongée précédente ou suivante n'existe pas.
2. **En-tête** :
   - overline accent « Plongée #127 » · date longue et heure d'immersion en mono ;
   - h1 = nom du site (display) ;
   - région + étiquettes : « Palier OK » (success) si les paliers ont été faits, gaz, type (Bateau / Bord).
   - Actions : « Modifier ma plongée » (secondary, icône crayon) et un menu « … » (Dupliquer, Exporter, Supprimer).
3. **4 KPI** (même composant que le dashboard) :
   - **Profondeur max** en accent, avec la légende « Ton record personnel » si c'est le max du carnet ;
   - Durée (« Sortie à hh:mm ») ;
   - Temp. fond (« Surface xx °C ») ;
   - Visibilité (qualificatif).
4. **Grille** `minmax(0,1fr) 360px` :
   - **Colonne principale :**
     - **Déroulé de la plongée** (V1, étiquette « Saisie manuelle ») : immersion → durée → sortie au-dessus d'une barre de temps, le palier en `success` en fin de barre, puis 3 valeurs (palier de sécurité, paliers de déco., successive). **Aucune courbe de profil.**
     - Deux cartes côte à côte : **Équipement & gaz** (gaz + % O₂, bloc, pressions début → fin + bar consommés, combinaison, lest) et **Conditions** (type, météo + air, mer, courant, eau surface → fond, structure).
     - **Notes & observations** (texte libre + étiquettes d'espèces).
   - **Colonne latérale :**
     - **Site** : mini-carte (même placeholder stylé que le dashboard en V1), coordonnées, « Tes plongées ici », « Ta prof. max ici », lien « Toutes mes plongées ici → » (`/dives?site=<id>`).
     - **Palanquée** : tous les membres, toi en premier (avatar neutre, « · toi »), puis niveau et « N plongées ensemble ».
     - Mention : « Site, date et palanquée sont partagés entre les plongeurs. Tes mesures, ton équipement et tes notes n'appartiennent qu'à toi. », puis les dates de création et de modification.

## Mobile (< 768)

- Top bar spécifique : « ‹ Mes plongées » (retour), crayon (modifier), « … ». Pas de hamburger ni de FAB sur cette page.
- Overline, h1 (26/30), région, étiquettes ; KPI en 2×2.
- Ordre des cartes : **Déroulé → Palanquée → Équipement & gaz → Conditions → Notes → Site** (la palanquée remonte).
- En bas, deux tuiles précédente / suivante (≥ 64px de haut), la tuile inactive à 45 % d'opacité.

## Tablette (768–1023)

Non maquettée. Colonne unique : en-tête, KPI en 2×2, puis les cartes dans l'ordre mobile.

## Données partielles

Tout champ facultatif vide reste affiché : « — » en `textMuted` + lien « Compléter », qui ouvre `/dives/:id/edit#<champ>`. Une carte ne disparaît jamais. Une carte entièrement vide garde son titre et affiche « Rien de renseigné · Compléter ».

Valeurs calculées autorisées en V1 : `bar consommés = pression début − pression fin`, l'heure de sortie, « Ton record personnel », « N plongées ensemble », « Tes plongées ici », « Ta prof. max ici ». **Pas de consommation en L/min** : sans profondeur moyenne, elle serait fausse.

## Modèle (à valider en phase 0 du prompt)

| Événement partagé (non modifiable par un participant) | Participation (propre à chaque plongeur) |
|---|---|
| site, date, type (bateau/bord, jour/nuit), structure, météo, mer, courant, palanquée | **n° de plongée personnel**, heures d'immersion et de sortie, profondeur max, durée, palier de sécurité, paliers de déco., successive, températures, visibilité, gaz, bloc, pressions, combinaison, lest, notes, observations |

## Actions

- **Modifier ma plongée** → `/dives/:id/edit` (placeholder en V1). On ne modifie que sa participation ; les champs de l'événement sont grisés dans le futur formulaire.
- **Dupliquer** → `/dives/new?from=:id`, préremplit site, type, structure, équipement (utile pour un séjour de plusieurs plongées).
- **Exporter** → toast « Bientôt disponible ».
- **Supprimer** → dialogue de confirmation (« Supprimer la plongée #127 ? Cette action ne supprime que ta participation, pas celle des autres membres de la palanquée. »), bouton danger, puis retour à la liste avec un toast.

## États

| État | Rendu |
|---|---|
| `loading` | Skeleton : en-tête, 4 KPI, carte Déroulé, colonne latérale. `aria-busy`. |
| `not-found` | « Cette plongée n'existe pas ou a été supprimée » + « Retour à mes plongées ». |
| `error` | Message + « Réessayer », sans casser le layout. |
| `ready` | Captures 20 et 21. |

## Accessibilité

- Un seul h1 (le site). Chaque carte est une `<section aria-labelledby>` avec un titre h2 (visuellement en overline).
- Listes clé/valeur en `<dl>` / `<dt>` / `<dd>`.
- Barre de temps `aria-hidden` : l'information est déjà en texte.
- Liens précédente / suivante avec un `aria-label` complet (« Plongée précédente : #126, La Bibliothèque ») ; bouton désactivé avec `aria-disabled`.
- Raccourcis clavier `←` / `→` pour feuilleter, ignorés quand le focus est dans un champ ; `e` pour modifier.
- Menu « … » : bouton `aria-haspopup="menu"`, navigation aux flèches, `Esc`.
- Unités lues avec la valeur.

## Hors périmètre (V1)

Courbe de profil et import (V2), photos, formulaire de modification (page placeholder), export réel, rôles dans la palanquée, visa.
