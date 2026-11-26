// Public bundle check (D45): the landing page and the sign-in / sign-up pages must load nothing of
// the signed-in app. Builds with sourcemaps into a temporary directory, then:
//   1. follows every chunk `index.html` loads (entry script, modulepreload) and their static
//      imports: each of their source modules must be on the allow-list below, so that a new
//      feature or a shared module of the app fails here until it is lazy (or knowingly allowed);
//   2. reads every emitted chunk: no dev-only module (mocks, `?state=` forcing) in the build at all;
//   3. reads the stylesheets `index.html` links: no MapLibre rule.
//
// Usage: pnpm --filter web run check:public-bundle
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';

/** Source modules (of `src/`) the public pages may load. Anything else of `src/` fails. */
const PUBLIC_MODULES = [
  /^src\/main\.tsx$/,
  /^src\/app\/(App|appSession|logoutRoute|providers|router|routes|services|sessionNavigation)\.tsx?$/,
  /^src\/app\/layout\/PublicLayout\//,
  /^src\/app\/routes\/(Home|Login|Signup|ForgotPassword|LegalPlaceholder|Placeholder|RouteError)Page\.tsx$/,
  /^src\/app\/routes\/SessionPending\.tsx$/,
  /^src\/design\/tokens\.ts$/,
  /^src\/features\/(auth|home)\//,
  // The dependency-free purge of the dive drafts, run at sign-out (D41).
  /^src\/features\/dives\/form\/draftPurge\.ts$/,
  /^src\/shared\/config\//,
  /^src\/shared\/session\/(api|lib|hooks)\//,
  /^src\/shared\/session\/(authClient|authServices)\.ts$/,
  /^src\/shared\/hooks\/useMediaQuery\.ts$/,
  /^src\/shared\/lib\/(apiBaseUrl|apiClient|apiClientContext|classNames|env|format|guards|queryClient)\.ts$/,
  /^src\/shared\/ui\/(Brand|Button|Card|Checkbox|FormField|Icon|IconButton|Overline|ResponsiveText|TextInput|Toast)\//,
];

/** Dependencies the public pages must not load either. */
const FORBIDDEN_PACKAGES = [/node_modules\/.*maplibre-gl\//];

/** Dev-only modules (`?state=` forcing, fixtures): never in a production build. */
const DEV_ONLY = [/\/mocks\//, /\/devState\.ts$/, /\/fakeAuthClient\.ts$/, /\/lazyAuthClient\.ts$/];

const STATIC_IMPORT = /(?:^|[;\n}])\s*import\s*(?:[^'"]*?from\s*)?["']\.\/([^"']+\.js)["']/g;

/** `…/apps/web/src/app/App.tsx` → `src/app/App.tsx`; packages keep their `node_modules/` path. */
const shortPath = (source) => source.replace(/^.*?(src\/|node_modules\/)/, '$1');

const outDir = mkdtempSync(join(tmpdir(), 'e-deep-public-bundle-'));
try {
  await build({ logLevel: 'warn', build: { outDir, emptyOutDir: true, sourcemap: true } });
  const read = (file) => readFileSync(join(outDir, file), 'utf8');
  const sourcesOf = (chunk) => JSON.parse(read(`${chunk}.map`)).sources.map(shortPath);
  const violations = [];

  // 1. The chunks of the public pages.
  const html = read('index.html');
  const queue = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map(
    (match) => match[1],
  );
  const chunks = new Set();
  while (queue.length > 0) {
    const chunk = queue.shift();
    if (chunks.has(chunk)) continue;
    chunks.add(chunk);
    for (const match of read(chunk).matchAll(STATIC_IMPORT)) queue.push(`assets/${match[1]}`);
  }
  let gzipBytes = 0;
  for (const chunk of chunks) {
    gzipBytes += gzipSync(readFileSync(join(outDir, chunk))).length;
    for (const source of sourcesOf(chunk)) {
      const isAppModule =
        source.startsWith('src/') && !PUBLIC_MODULES.some((pattern) => pattern.test(source));
      const isForbiddenPackage = FORBIDDEN_PACKAGES.some((pattern) => pattern.test(source));
      if (isAppModule || isForbiddenPackage) violations.push(`public ${chunk}: ${source}`);
    }
  }

  // 2. Every chunk of the build.
  const allChunks = readdirSync(join(outDir, 'assets')).filter((file) => file.endsWith('.js'));
  for (const file of allChunks) {
    for (const source of sourcesOf(`assets/${file}`)) {
      if (DEV_ONLY.some((pattern) => pattern.test(source))) {
        violations.push(`dev-only in assets/${file}: ${source}`);
      }
    }
  }

  // 3. The stylesheets of the public pages.
  const stylesheets = [...html.matchAll(/href="\/(assets\/[^"]+\.css)"/g)].map((match) => match[1]);
  let cssGzipBytes = 0;
  for (const stylesheet of stylesheets) {
    const css = read(stylesheet);
    cssGzipBytes += gzipSync(css).length;
    if (css.includes('maplibregl')) violations.push(`public ${stylesheet}: MapLibre styles`);
  }

  const size = `${(gzipBytes / 1024).toFixed(1)} kB gzip of JS, ${(cssGzipBytes / 1024).toFixed(1)} kB gzip of CSS`;
  if (violations.length > 0) {
    console.error(`✖ Public bundle (${chunks.size} chunks, ${size}):`);
    for (const violation of violations) console.error(`  ${violation}`);
    process.exitCode = 1;
  } else {
    console.log(
      `✔ Public bundle: ${chunks.size} chunks, ${size}; no app code, no dev-only module in ${allChunks.length} chunks.`,
    );
  }
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
