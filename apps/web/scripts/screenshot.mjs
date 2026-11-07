// Visual check: screenshot a running page at the mockup's widths, to compare
// with design/screenshots/*.png.
//
// Usage (dev server running):
//   node scripts/screenshot.mjs                      → /dashboard at 1440 and 375
//   node scripts/screenshot.mjs /dashboard?state=empty 1440
//
// Output: .screenshots/<route>-<width>.png  (git-ignored)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const route = process.argv[2] ?? '/dashboard';
const widths = process.argv[3] ? [Number(process.argv[3])] : [1440, 375];

mkdirSync('.screenshots', { recursive: true });
const browser = await chromium.launch();
for (const width of widths) {
  const page = await browser.newPage({ viewport: { width, height: width < 768 ? 812 : 1280 } });
  await page.goto(BASE + route, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const name = route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'root';
  const path = `.screenshots/${name}-${width}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log('✔', path);
  await page.close();
}
await browser.close();
