# E-Deep — guide agent

**`ARCHITECTURE.md` est la source de vérité** (stack, conventions, styles, shared, DB, RGPD,
décisions). Le lire avant toute modification. En cas de conflit entre un skill et ce document :
s'arrêter et signaler.

Front plongeur (`apps/web`) : design system DiveLog, règles dans **`apps/web/CLAUDE.md`** et skill
`implement-screen` (`.claude/skills/`) pour implémenter un écran depuis `apps/web/design/`.

## Commandes (depuis la racine)

```bash
pnpm install
docker compose up -d                # PostgreSQL de dev (lit .env)
pnpm migration:run                  # migrations API (build puis CLI TypeORM)
pnpm db:seed                        # données fictives de dev (vide puis remplit le carnet ; base locale seulement)
pnpm dev                            # api :3000, web :5173, admin :5174
pnpm dev:api | dev:web | dev:admin

pnpm lint && pnpm typecheck && pnpm test && pnpm build   # à lancer avant chaque commit
pnpm format                         # Prettier (format:check en CI)

pnpm --filter api run migration:generate src/database/migrations/<Nom>
pnpm --filter <api|web|admin> run <script>
```

## Règles qui piègent

- pnpm 12 : toujours `pnpm -r run <script>` / `pnpm --filter x run <script>`, jamais `pnpm -r build`.
- Pas de `any`. `@e-deep/shared` = types seulement, importés avec `import type`.
- `synchronize: false` toujours ; le schéma ne change que par migrations ; entités en `*.entity.ts`.
- Tailwind **uniquement** dans `apps/admin` ; `apps/web` = SCSS modules, `@use` jamais `@import`.
- `apps/web` : tokens édités **uniquement** dans `src/design/tokens.ts` puis
  `pnpm --filter web run tokens` ; aucune valeur en dur dans les `*.module.scss`.
- Ne pas modifier `apps/admin/src/components/ui/` (shadcn) : wrapper.
- Aucune donnée personnelle / de santé dans les logs (cf. ARCHITECTURE §9).
- Commits conventionnels.
