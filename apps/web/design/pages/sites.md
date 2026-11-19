# Spec — Sites : création express, page Carte (« Mes sites »), fiche site

Complète `design/README.md`, `design/pages/formulaire-plongee.md` et `design/pages/detail-plongee.md`.
Maquette : `design/mockups/sites.jsx` (lecture seule). Captures : `design/screenshots/40` → `46`.

**Les sites sont privés** : chaque plongeur ne voit et ne gère que les siens. **V1 = saisie manuelle.**

## Organisation : deux points d'entrée

| Besoin | Où | Format |
|---|---|---|
| Créer un site **pendant la saisie** d'une plongée | Champ Site du formulaire | **Création express** : panneau accroché sous le champ (desktop), bottom sheet (mobile). Ne quitte jamais le formulaire. |
| **Gérer** ses sites (voir, placer, compléter, fusionner) | Page **Carte** (`/map`), entrée « Carte » de la navigation | Carte + liste. Ajout et édition dans un **panneau latéral** (desktop) ou plein écran (mobile), la carte restant visible. |
| **Consulter** un site | **Fiche site** `/sites/:id` | Page dédiée. |

Pas de nouvelle entrée de navigation : il en reste 4 (Dashboard, Mes plongées, Carte, Statistiques). Dans l'interface, la page Carte s'intitule « Mes sites ».

## Écrans de référence

| Capture | Composant maquette | Taille | Contenu |
|---|---|---|---|
| `40-site-quick-create-desktop.png` | `QuickCreateDesktop` | 640 | Création express sous le champ Site |
| `41-site-quick-create-mobile.png` | `QuickCreateMobile` | 375 | Création express en bottom sheet |
| `42-map-sites-desktop.png` | `MapSitesDesktop` | 1440 | Carte + liste, site sélectionné avec son aperçu |
| `43-map-place-site-desktop.png` | `MapAddSiteDesktop` | 1440 | Panneau « Placer le site » (compléter un site express) |
| `44-map-sites-mobile.png` | `MapSitesMobile` | 375 | Carte + liste en bottom sheet |
| `45-site-detail-desktop.png` | `SiteDetailDesktop` | 1440 | Fiche site, menu « … » ouvert |
| `46-site-detail-mobile.png` | `SiteDetailMobile` | 375 | Fiche site mobile |

La carte des maquettes est **stylisée** : la géographie et les positions ne sont qu'indicatives.

## Modèle

```
Site {
  id, ownerId,
  name,                       // obligatoire
  region,                     // texte libre (« Calvi · Corse »), suggéré
  zone,                       // 'mediterranee' | 'atlantique' | 'manche' | 'autre' (déduite de la position, sinon de la région)
  type?,                      // 'tombant' | 'epave' | 'sec' | 'grotte' | 'herbier' | 'autre'
  depthMinM?, depthMaxM?,
  latitude?, longitude?,      // absents ⇒ « Position à préciser »
  accessNotes?,               // « Accès & conseils »
  createdVia: 'quick' | 'full',
  createdAt, updatedAt
}
```

Valeurs **calculées** (jamais stockées) depuis les plongées de l'utilisateur : nombre de plongées, profondeur max personnelle, dernière plongée, temps cumulé, température moyenne au fond, structure habituelle et mise à l'eau habituelle (la plus fréquente).

## 1. Création express (captures 40, 41)

- **Déclencheur** : l'option « Créer le site « … » » de la combobox Site (capture 32), ou Entrée quand aucun site ne correspond.
- **Champs** :
  - **Nom** * : prérempli avec le texte tapé, focus dessus à l'ouverture.
  - **Région** : combobox des régions déjà utilisées, préremplie avec celle de la dernière plongée (aide « Comme ta dernière plongée · modifiable »).
  - **Type** : puces, facultatif.
- Info : « Tu pourras placer le site sur la carte plus tard, depuis la page Carte. »
- « Créer et sélectionner » (primary) : crée le site (`createdVia: 'quick'`, sans position), le sélectionne dans le champ, ferme le panneau et rend le focus au champ suivant (Date). « Annuler » ou Échap ferme le panneau sans rien créer.
- **Anti-doublon** : si un site existant est proche du nom (cf. § Recherche), le panneau affiche au-dessus des champs « Un site proche existe : **Pointe de la Revellata** (8 plongées) [Utiliser celui-ci] ».
- Desktop : `role="dialog"` non modal, ancré au champ, avec une petite flèche. Mobile : bottom sheet modale (focus trap, scrim).

## 2. Page Carte — « Mes sites » (`/map`)

### Desktop (capture 42)

- En-tête : overline « Carte · 23 sites · 6 régions », h1 « Mes sites », sous-titre « Tes sites sont privés. N sites attendent leur position. » (masqué si 0), action « Ajouter un site » (primary).
- Grille : **carte** (flex 1) et **liste** (380px), même hauteur (`calc(100vh − en-tête)`, min. 640px).
- **Carte** :
  - puces de zone en haut à gauche (Tous · N / Méditerranée · N / Bretagne · N… : seules les zones qui ont des sites), qui recadrent la vue sur leurs sites ;
  - contrôles en haut à droite : zoom +/−, « Centrer sur ma position » (géolocalisation du navigateur, sur action seulement), fond de carte ;
  - échelle en bas à gauche ;
  - **repères** : cercle `surface3` avec contour `accentLine` et le nombre de plongées en mono. Le rayon croît avec le nombre de plongées (plafonné). Le site sélectionné est en `accent`, avec un halo ;
  - **regroupement** des repères proches quand on dézoome (bulle avec le nombre de sites) ;
  - **aperçu** au clic sur un repère (popover `surface2`) : type · région, nom, plongées, ta profondeur max, dernière plongée, « Voir la fiche → ».
- **Liste** :
  - recherche, filtres Type et Région, filtre **« À compléter · N »** (sites sans position, en `warning`) ;
  - tri par défaut : nombre de plongées décroissant (options : nom, dernière plongée, profondeur max) ;
  - ligne : pastille avec le nombre de plongées, nom, « région · type » ou l'étiquette « Position à préciser », profondeur max personnelle, date de la dernière plongée ;
  - **liste et carte sont synchronisées** : survoler une ligne met le repère en évidence, cliquer sélectionne et recentre la carte, cliquer un repère sélectionne la ligne et la fait défiler. Un site sans position se sélectionne sans recentrer et propose « Placer sur la carte ».
- Pas de pagination : la liste défile (virtualisée au-delà de 100 sites).

### Panneau « Ajouter un site » / « Placer le site » / « Modifier » (capture 43)

- Panneau latéral de 420px qui **remplace la liste**. La carte reste visible et interactive, avec un curseur en croix.
- Titre selon le mode : « Nouveau site », « Placer le site » (overline « Compléter un site express ») ou « Modifier le site ».
- Aide : « Clique sur la carte pour placer le site, puis ajuste en glissant le repère. »
- **Position** : clic sur la carte (pose le repère), glisser le repère, ou saisie de la latitude et de la longitude (décimales, 4 chiffres ; collage accepté au format « 42.5794, 8.7262 » ou en degrés-minutes). Les champs et le repère restent synchronisés. Le repère en cours de pose est en accent, en pointillés.
- **Champs** :
  - Nom * ;
  - Région (suggérée depuis la position : région du site existant le plus proche à moins de 15 km, sinon aucune suggestion ; **pas de géocodage externe en V1**) ;
  - Type (puces) ;
  - Profondeur min et max (m) ;
  - Accès & conseils (textarea).
- Pied du panneau : « Annuler » (ghost) et « Enregistrer le site » (primary). Quitter avec des modifications non enregistrées demande confirmation.
- URL : `/map?panel=new`, `/map?panel=place&id=:id`, `/map?panel=edit&id=:id`.

### Mobile (capture 44)

- Top bar standard (menu, logo, notifications) et FAB « Nouvelle plongée » masqué sur cette page.
- La carte occupe le haut, avec les puces de zone et le bouton de géolocalisation.
- **Bottom sheet** à 3 crans (replié : en-tête seul / mi-hauteur : défaut / plein écran). En-tête : « Mes sites », « N sites · N à compléter », bouton « + Site ».
- Ajout et édition **en plein écran** : la carte en haut (40 %) avec un **repère fixe au centre** (on déplace la carte sous le repère), et le formulaire en dessous.

## 3. Fiche site (`/sites/:id`) — captures 45, 46

- Fil d'Ariane « ‹ Carte / {nom} » (retour à `/map?site=:id`, qui conserve la sélection).
- En-tête : overline « Site · {type} · privé », h1 = nom, région.
- Actions : « Nouvelle plongée ici » (secondary → `/dives/new?site=:id`), « Modifier » (→ `/map?panel=edit&id=:id`), menu « … » avec « Fusionner avec un autre site… » et « Supprimer le site » (danger).
- **4 KPI** : tes plongées ici (« Depuis {mois année} »), ta profondeur max ici (accent, « #n · date »), temps cumulé (« moy. N min »), température moyenne au fond (« de X à Y °C »). Un KPI sans donnée affiche « — ».
- Colonne principale :
  - **mini-carte** centrée sur le site, avec les coordonnées et « Ouvrir sur la carte » ;
  - **« Tes plongées ici · N »** : les 5 plus récentes (n°, date, profondeur, durée, palanquée) et « Voir dans Mes plongées → » (`/dives?site=:id`). La profondeur max de la liste est en accent.
- Colonne latérale :
  - **Infos du site** : type, profondeur, mise à l'eau habituelle, structure habituelle, région (`<dl>`, « — · Compléter » si vide) ;
  - **Accès & conseils** ;
  - mention « Ce site n'est visible que par toi… ».
- **Site sans position** : la mini-carte est remplacée par un encart « Position à préciser » avec « Placer sur la carte ».
- **Mobile** : top bar « ‹ Carte » + « … », 2 KPI (plongées, profondeur max), mini-carte, « Nouvelle plongée ici » (pleine largeur), 3 dernières plongées, infos, accès.

## Recherche, doublons, fusion, suppression

- **Recherche tolérante** (combobox du formulaire et liste) : insensible à la casse et aux accents, articles ignorés (« la », « le », « les », « l' »), correspondance partielle de mots, petite tolérance aux fautes (distance ≤ 1 sur les mots de 5 lettres ou plus). Tri : préfixe exact > mot complet > approché > nombre de plongées.
- **Fusionner** : boîte de dialogue « Fusionner « {A} » avec… » contenant une combobox du site cible, puis un récapitulatif : « Les 3 plongées de {A} seront rattachées à {B}. Les infos de {B} sont conservées ; les champs vides de {B} sont complétés avec ceux de {A}. {A} sera supprimé. Action irréversible. » Bouton « Fusionner » (danger). Ensuite : redirection vers la fiche de B avec un toast.
- **Supprimer** : possible uniquement pour un site **sans plongée**. Sinon, la boîte de dialogue explique « Ce site a 8 plongées : fusionne-le avec un autre site pour ne pas les perdre. » et propose [Fusionner…].

## États

| Écran | loading | empty | error |
|---|---|---|---|
| Carte | Skeleton de la liste + carte grisée | « Aucun site pour l'instant », « Tes sites apparaissent ici dès ta première plongée. » [Ajouter un site] | Message + Réessayer ; la liste reste utilisable si seule la carte échoue (tuiles) |
| Fiche | Skeleton | — | `not-found` : « Ce site n'existe pas ou a été supprimé » + retour à la carte |

## Accessibilité

- La carte n'est **jamais le seul moyen** : la liste donne accès à tout (sélectionner, ouvrir la fiche, placer). Le canvas de la carte porte un `aria-label` ; les repères sont focusables (Tab) et ont un libellé (« Pointe de la Revellata, 8 plongées »).
- Placer un site au clavier : saisir les coordonnées, ou flèches pour déplacer le repère focalisé (1 px, Maj + flèche 10 px).
- Panneaux et bottom sheets : `role="dialog"`, titre lié, focus initial sur le premier champ, Échap, focus rendu au déclencheur.
- Puces de zone : `role="radiogroup"`. Filtre « À compléter » : `aria-pressed`.
- Couleur jamais seule : « Position à préciser » a une icône et un texte.

## Hors périmètre (V1)

Sites partagés ou publics, import de sites, géocodage inverse externe, photos de site, météo ou marées, itinéraire.
