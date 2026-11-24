// Public bundle check (D45): the landing page and the sign-in / sign-up pages must not load any
// code of the signed-in app. Builds with sourcemaps into a temporary directory, follows every
// chunk `index.html` loads (entry script, modulepreload) and their static imports, and fails if
// one of their source modules belongs to the app (frame, screens, features) or is MapLibre.
//
// Usage: pnpm --filter web run check:public-bundle
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';

/** Modules of the signed-in app: they must reach the browser on demand only (lazy routes). */
const FORBIDDEN = [
  /src\/app\/layout\/(AppShell|Sidebar|TopBar|Drawer|Fab|NavItem|UserCard|LogoutButton)\//,
  /src\/app\/routes\/(Dashboard|Dives|DiveDetail|DiveForm|Map|SiteDetail|Status)Page\.tsx$/,
  /src\/features\/(dashboard|dives|sites|health)\//,
  /src\/shared\/ui\/MapView\//,
  /node_modules\/.*maplibre-gl\//,
];

/** Allowed on purpose: the dependency-free purge of the dive drafts, run at sign-out (D41). */
const ALLOWED = [/src\/features\/dives\/form\/draftPurge\.ts$/];

const STATIC_IMPORT = /(?:^|[;\n}])\s*import\s*(?:[^'"]*?from\s*)?["']\.\/([^"']+\.js)["']/g;

const outDir = mkdtempSync(join(tmpdir(), 'e-deep-public-bundle-'));
try {
  await build({ logLevel: 'warn', build: { outDir, emptyOutDir: true, sourcemap: true } });

  const html = readFileSync(join(outDir, 'index.html'), 'utf8');
  const queue = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map(
    (match) => match[1],
  );
  const chunks = new Set();
  while (queue.length > 0) {
    const chunk = queue.shift();
    if (chunks.has(chunk)) continue;
    chunks.add(chunk);
    const code = readFileSync(join(outDir, chunk), 'utf8');
    for (const match of code.matchAll(STATIC_IMPORT)) queue.push(`assets/${match[1]}`);
  }

  const violations = [];
  let gzipBytes = 0;
  for (const chunk of chunks) {
    const code = readFileSync(join(outDir, chunk));
    gzipBytes += gzipSync(code).length;
    const { sources } = JSON.parse(readFileSync(join(outDir, `${chunk}.map`), 'utf8'));
    for (const source of sources) {
      const forbidden = FORBIDDEN.some((pattern) => pattern.test(source));
      if (forbidden && !ALLOWED.some((pattern) => pattern.test(source))) {
        violations.push(`${chunk}: ${source.replace(/^.*?(src\/|node_modules\/)/, '$1')}`);
      }
    }
  }

  const size = `${(gzipBytes / 1024).toFixed(1)} kB gzip`;
  if (violations.length > 0) {
    console.error(`✖ The public bundle (${chunks.size} chunks, ${size}) loads app code:`);
    for (const violation of violations) console.error(`  ${violation}`);
    process.exitCode = 1;
  } else {
    console.log(`✔ Public bundle: ${chunks.size} chunks, ${size}, no code of the signed-in app.`);
  }
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
