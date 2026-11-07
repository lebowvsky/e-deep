---
name: implement-screen
description: Implémente ou corrige un écran ou un composant du front plongeur (apps/web) à partir des maquettes DiveLog de apps/web/design/ (captures + code mockups), avec vérification visuelle. À utiliser pour « implémente le dashboard », « fais le composant KpiCard », « aligne X sur la maquette ».
---

# Implémenter un écran depuis la maquette

Contexte : `ARCHITECTURE.md` (racine) puis `apps/web/CLAUDE.md`. En cas de conflit entre ce skill
et `ARCHITECTURE.md` : s'arrêter et signaler.

1. **Cadrer** : lis `apps/web/design/README.md` (§ 3 mapping, § 5 écarts connus). Identifie la ou
   les captures concernées dans `apps/web/design/screenshots/` et ouvre-les.
2. **Relever la spec** dans `apps/web/design/mockups/*.jsx` (la fonction listée dans le mapping) :
   dimensions, paddings, gaps, tailles de police, couleurs, textes exacts. Traduis chaque valeur
   en token (`$space-*`, `$type-*`, `$color-*`, `$radius-*`). Si une valeur n'a pas de token
   proche, **signale-le** (ou ajoute-le dans `src/design/tokens.ts` puis
   `pnpm --filter web run tokens`) au lieu d'inventer une valeur en dur.
3. **Lister les composants** à créer ou réutiliser (commencer par `src/shared/ui/` s'ils
   manquent), puis annoncer le plan en quelques lignes.
4. **Implémenter** selon `apps/web/CLAUDE.md` : un dossier par composant (`shared/ui`,
   `app/layout`, `features/dashboard/components`), SCSS Module mobile-first, données depuis
   `@/features/dashboard/mocks/dashboard`, formatage via `@/shared/lib/format`, accessibilité selon
   `design/README.md` § 6.
5. **Vérifier** : `pnpm typecheck`, `pnpm lint`, `pnpm test`, puis avec `pnpm dev:web` lancé :
   `pnpm --filter web run screenshot "<route>?state=<état>"` (1440 et 375). Compare
   `apps/web/.screenshots/` avec la capture de référence et corrige les écarts. Fais au plus 3
   passes, puis liste les écarts restants s'il y en a.
6. **Rendre compte** : composants créés, écarts volontaires (avec la raison, ex. bug
   d'histogramme de la maquette), points ouverts.
