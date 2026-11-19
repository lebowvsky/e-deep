# Spec — formulaire « Nouvelle plongée » / « Modifier la plongée »

Routes : `/dives/new`, `/dives/new?from=:id` (dupliquer) et `/dives/:id/edit` (modifier).
Complète `design/README.md`, `design/pages/mes-plongees.md` et `design/pages/detail-plongee.md`.
Maquette : `design/mockups/dive-form.jsx` (lecture seule). Captures : `design/screenshots/30` → `32`.

**V1 = saisie manuelle uniquement**, sans import. Tout champ affiché sur le détail d'une plongée doit pouvoir être saisi ici, et réciproquement.

## Écrans de référence

| Capture | Composant maquette | Taille | État |
|---|---|---|---|
| `30-dive-form-desktop.png` | `DiveFormDesktop` | 1440 | Nouvelle plongée #128 préremplie depuis #127, « Pression fin » en cours de saisie, avertissement de profondeur |
| `31-dive-form-mobile-errors.png` | `DiveFormMobile` | 375 | Après un clic sur Enregistrer avec 2 erreurs ; sections facultatives repliées |
| `32-dive-form-site-combobox.png` | `SiteCombobox` | 600 | Choix du site, liste ouverte |

## Principes

- **Une seule page, pas d'assistant par étapes** : utilisateur récurrent, saisie fréquente.
- **Une colonne par section.** Seuls les champs manifestement liés sont côte à côte : immersion / sortie, pressions début / fin, eau surface / fond, bloc / matériau.
- **Labels au-dessus des champs**, jamais de placeholder qui sert de label. Le placeholder sert seulement d'exemple.
- **Seule la section 1 est obligatoire.** Ses champs portent un `*` (avec la légende « * obligatoire »). Les sections 2 à 6 portent l'étiquette « facultatif ».
- **Unités en suffixe** dans le champ (m, min, bar, L, °C, kg, %), en mono `textLow`. Valeurs en mono.

## Sections et champs

Les sections suivent l'ordre des cartes du détail. Le modèle sépare **l'événement partagé (É)** et **la participation (P)** (cf. `detail-plongee.md`).

### 1. L'essentiel (obligatoire)

| Champ | Contrôle | Règle |
|---|---|---|
| Site (É) * | Combobox (capture 32) : recherche tolérante dans *mes sites* (accents, articles, fautes légères), texte trouvé surligné, nombre de plongées, option « Créer le site « … » » | Obligatoire. « Créer le site » ouvre la **création express** (captures 40 et 41, spec `sites.md`) : nom, région, type facultatif ; le site est créé, sélectionné, et marqué « Position à préciser ». `/dives/new?site=:id` (depuis la fiche site) préremplit le champ. |
| N° de plongée (P) | Nombre, prérempli à max + 1 | Avertissement (non bloquant) s'il existe déjà dans le carnet |
| Date (É) * | `type="date"` natif, affichage « jeu. 09/04/2026 » | Obligatoire, pas dans le futur |
| Immersion (P) * / Sortie (P) * | `type="time"` natifs côte à côte | Obligatoires. Sortie > immersion, sauf si Moment = Nuit (passage de minuit autorisé) |
| Durée (P) | Nombre + « min », icône de lien | **Liée aux heures** : modifier la sortie recalcule la durée, modifier la durée recalcule la sortie. 1–300 min. Aide : « Calculée depuis les heures — modifiable. » |
| Profondeur max (P) * | Nombre décimal + « m » | Obligatoire, 1–100 m. **Avertissement non bloquant** au-delà de la limite du niveau de l'utilisateur (N1 > 20 m, N2 > 40 m, N3/N4 > 60 m) : « Au-delà de 40 m, limite d'un N2 encadré. Vérifie la valeur. » |

### 2. Déroulé (facultatif)

- **Palier de sécurité** (P) : interrupteur. Activé, il affiche Durée (1–15 min, défaut 3) et Profondeur (3–6 m, défaut 5).
- **Paliers de décompression** (P) : interrupteur. Activé, il affiche une liste de lignes « profondeur · durée » avec « Ajouter un palier ».
- **Plongée successive** (P) : interrupteur. Activé, il affiche l'intervalle de surface (h:mm). Peut se déduire de la plongée précédente si elle date de moins de 12 h.

### 3. Palanquée (facultatif) — événement partagé

- Liste : toi en premier (avatar neutre, « · toi », non retirable), puis les autres membres avec un sélecteur de niveau (N1–N4, PA20/40/60, PE…) et un bouton pour retirer (`aria-label="Retirer Lucas Bernard"`).
- « Ajouter un plongeur » : combobox des plongeurs déjà rencontrés, plus la création d'un plongeur par son nom. Suggestions « Fréquents » sous forme de puces.
- Compteur « N plongeurs » dans l'en-tête de la section.

### 4. Équipement & gaz (facultatif) — participation

| Champ | Contrôle | Règle |
|---|---|---|
| Gaz | Segmented Air / Nitrox | Air ⇒ % O₂ = 21, champ verrouillé |
| % O₂ | Nombre + « % » | Nitrox : 22–40 |
| Bloc / Matériau | Nombre + « L » / Segmented Acier · Alu | 1–30 L |
| Pression début / fin | Nombre + « bar » côte à côte | Début ≤ 300, fin < début. Aide : « → bar consommés calculés à l'enregistrement » |
| Combinaison | Nombre + « mm », Segmented Humide · Semi-étanche · Étanche | — |
| Lest | Nombre + « kg » | 0–30 |

### 5. Conditions (facultatif)

- **Événement :** mise à l'eau (Bateau · Bord), moment (Jour · Nuit), structure (texte, suggestions des structures déjà saisies), météo (select : Ensoleillé, Nuageux, Couvert, Pluie, Vent), température de l'air (°C), mer (Calme · Belle · Agitée · Forte), courant (Nul · Faible · Moyen · Fort).
- **Participation :** eau surface / fond (°C, −2 à 35 ; fond ≤ surface + 5), visibilité (m).
- Le qualificatif de visibilité affiché sur le détail (« Bonne ») est **calculé** : < 5 m Faible, 5–14 Moyenne, 15–24 Bonne, ≥ 25 Excellente. *(Hypothèse à confirmer.)*

### 6. Notes & observations (facultatif) — participation

- Notes : textarea qui s'agrandit (min. 120px), sans limite visible ; compteur au-delà de 2 000 caractères.
- Espèces : saisie en étiquettes (Entrée ou virgule pour ajouter, suppression au clavier), suggestions depuis les espèces déjà saisies.

## Desktop (≥ 1024)

- Fil d'Ariane « ‹ Mes plongées / Nouvelle plongée », overline « Carnet · plongée #128 », h1, sous-titre « Seule « L'essentiel » est obligatoire… ».
- Grille `minmax(0,1fr) 340px`. À droite, une colonne **collante** :
  1. **Aperçu** en direct : n° · date · heure, site, région, 4 mini-KPI identiques au détail (profondeur max en accent).
  2. **Sommaire des sections** (liens d'ancre) avec un état par section : complète ✓, partielle ◐ (« − Pression fin »), vide ○. La section visible est surlignée (scroll-spy).
  3. Boutons « Enregistrer la plongée » (primary, 48px), « Annuler » (ghost), et la mention « Brouillon enregistré sur l'appareil · hh:mm ».
- Les mêmes boutons sont répétés en bas du formulaire.

## Mobile (< 768)

- Top bar : ✕ (annuler), titre « Nouvelle plongée », « #128 ». Pas de FAB.
- Section 1 dépliée. Les sections 2 à 6 sont **repliées par défaut** (accordéon) : titre, résumé de leur contenu (« Air · 12 L · 200 bar · 7 mm », ou « Rien pour l'instant ») et pastille d'état. Dans une plongée dupliquée, elles restent repliées mais leur résumé est rempli.
- Barre collante en bas : « Enregistrer la plongée » sur toute la largeur + mention du brouillon. Le contenu garde un padding bas suffisant pour ne pas passer dessous.
- Les champs numériques ouvrent le clavier numérique (`inputMode="numeric"` ou `"decimal"`).

## Modes

| Mode | Différences |
|---|---|
| Nouvelle (`/dives/new`) | Champs vides, sauf n° (max + 1) et date (aujourd'hui). S'il existe une plongée de moins de 48 h, bandeau de **suggestion** : « Reprendre la palanquée, l'équipement et les conditions de #127 ? [Reprendre] ». |
| Dupliquer (`?from=:id`) | Prérempli : site, structure, mise à l'eau, moment, palanquée, équipement, conditions. **Jamais** les heures, la profondeur, la durée, les paliers ni les notes. Bandeau accent « Prérempli depuis #127 · … — palanquée, équipement et conditions repris. [Repartir de zéro] » (capture 30). |
| Modifier (`/dives/:id/edit`) | Titre « Modifier la plongée #127 », valeurs existantes, bouton « Enregistrer les modifications », sans bandeau. En V1, tous les champs sont modifiables. Prévoir néanmoins un drapeau `canEditEvent` : quand il est faux (usage club futur), les champs (É) sont en lecture seule avec l'aide « Partagé avec la palanquée — modifiable par la personne qui a créé la plongée ». |

## Validation et erreurs

- Validation **à la sortie du champ** (blur), puis **en direct** une fois le champ en erreur. Validation complète à l'enregistrement.
- Le bouton Enregistrer reste **toujours actif**. Au clic avec des erreurs :
  - un résumé `role="alert"` apparaît en haut (« 2 champs à corriger » + un lien par champ) ;
  - la page défile vers le premier champ en erreur et lui donne le focus ;
  - une section repliée qui contient une erreur s'ouvre.
- Champ en erreur : bordure `danger`, icône dans le champ, message **sous** le champ qui dit quoi faire, `aria-invalid` et `aria-describedby`.
- Avertissements (profondeur, n° en double) : bordure et message `warning`, **non bloquants**.
- Pendant l'enregistrement, le bouton passe en chargement (« Enregistrement… ») pour éviter le double envoi.
- En cas de succès : redirection vers `/dives/:id` avec un toast « Plongée #128 enregistrée ».

## Brouillon et sortie

- Brouillon sauvegardé **sur l'appareil** (debounce 1 s) par mode et par plongée. Il est restauré à la réouverture avec un bandeau « Brouillon restauré · [Effacer] », puis effacé après l'enregistrement.
- Quitter avec des modifications non enregistrées (Annuler, ✕, navigation) : boîte de confirmation « Quitter sans enregistrer ? Ton brouillon reste disponible sur cet appareil. » (Rester / Quitter).

## Accessibilité

- Chaque section est un `<fieldset>` avec une `<legend>` (le titre visible). Sur mobile, l'en-tête d'accordéon est un `<button aria-expanded aria-controls>`.
- Champs obligatoires : `aria-required` + `*` décoratif (`aria-hidden`), avec la légende du `*` en début de formulaire.
- Segmented : `role="radiogroup"`, navigation aux flèches. Interrupteurs : `role="switch"` + `aria-checked`.
- Combobox (site, plongeur) : pattern ARIA 1.2 (`role="combobox"`, `aria-expanded`, `aria-activedescendant`, listbox), avec ↑ ↓ Entrée Échap.
- Saisie d'espèces : chaque étiquette a un bouton « Retirer Mérou brun ». Retour arrière dans un champ vide retire la dernière étiquette.
- Aperçu de la colonne de droite : `aria-live="polite"` désactivé (trop bavard). Seul le résumé d'erreurs est annoncé.
- Ordre de tabulation : formulaire puis colonne de droite. Raccourci `Ctrl/⌘ + Entrée` pour enregistrer.

## Hors périmètre (V1)

Import de fichiers ou depuis un ordinateur (V2), photos, position GPS du site dans le formulaire (se fait depuis la fiche site), signature ou visa, rôles dans la palanquée.
