// DiveLog — Design tokens · SOURCE OF TRUTH
// ------------------------------------------------------------
// Edit values HERE only. Then run `pnpm --filter web run tokens` to regenerate:
//   - src/styles/tokens/_tokens.scss   (SCSS variables)
//   - src/styles/tokens/_vars.scss     (:root CSS custom properties)
// Never hardcode a hex / px value in a component: go through the tokens.
// Reference: design/mockups/tokens.jsx · design/screenshots/00-visual-direction.png

export const color = {
  // Surfaces — deepest → elevated (navy stratification, never neutral grey)
  abyss: '#060C18', // page background
  surface0: '#0B1A2E', // sidebar, inset surfaces
  surface1: '#122544', // primary card surface
  surface2: '#1B3156', // popover / hovered / elevated
  surface3: '#24406D', // marker rings, chips, hover on surface2
  line: 'rgba(154, 186, 224, 0.10)', // hairline divider
  lineStrong: 'rgba(154, 186, 224, 0.18)',

  // Text emphasis scale
  textHigh: '#EAF2FB', // AAA on surface0 (~16:1) — titles + KPI
  textMed: '#AFC1D6', // AA on surface0 (7.4:1) — body copy
  textLow: '#6E819A', // meta, captions (3.1:1 → never for essential text < 18px)
  textMuted: '#43556F', // disabled / decorative only

  // Accent — cold turquoise, used SPARINGLY (CTA, active state, peak datapoint)
  accent: '#4FD6C9',
  accentSoft: 'rgba(79, 214, 201, 0.14)',
  accentLine: 'rgba(79, 214, 201, 0.35)',
  accentInk: '#062A27', // text on accent fill

  // Semantic — desaturated, legible on dark. `*Soft` = badge background (colour at 12 %).
  success: '#5BD391',
  successSoft: 'rgba(91, 211, 145, 0.12)',
  warning: '#E7B24A',
  warningSoft: 'rgba(231, 178, 74, 0.12)',
  danger: '#E06A70',
  dangerSoft: 'rgba(224, 106, 112, 0.12)',

  // Controls — secondary button fill (atoms.jsx · Btn secondary)
  controlFill: 'rgba(154, 186, 224, 0.06)',
  chipFill: 'rgba(154, 186, 224, 0.08)', // neutral chip (visual-direction · Chips & badges)
  ringSubtle: 'rgba(255, 255, 255, 0.08)', // inset ring on avatars

  // Overlays — mobile top bar glass and drawer scrim
  abyssGlass: 'rgba(6, 12, 24, 0.85)',
  scrim: 'rgba(6, 12, 24, 0.6)',

  // Data viz
  chart: '#4FD6C9',
  chartDim: 'rgba(79, 214, 201, 0.22)',
  chartBar: 'rgba(154, 186, 224, 0.22)', // non-peak bars
  gridline: 'rgba(154, 186, 224, 0.08)',

  // Map placeholder — stylised coastlines, strongest to faintest
  coast: 'rgba(154, 186, 224, 0.14)',
  coastDim: 'rgba(154, 186, 224, 0.09)',
  coastFaint: 'rgba(154, 186, 224, 0.07)',
} as const;

export const font = {
  sans: '"Geist Variable", "Geist", -apple-system, system-ui, sans-serif',
  mono: '"Geist Mono Variable", "Geist Mono", "JetBrains Mono", ui-monospace, monospace',
} as const;

// size / line-height / weight / letter-spacing (px)
export const type = {
  display: { size: 40, lh: 44, w: 600, ls: -1.0 },
  h1: { size: 28, lh: 34, w: 600, ls: -0.6 },
  h2: { size: 20, lh: 26, w: 600, ls: -0.3 },
  h3: { size: 16, lh: 22, w: 600, ls: -0.1 },
  body: { size: 14, lh: 20, w: 400, ls: 0 },
  bodyMed: { size: 14, lh: 20, w: 500, ls: 0 },
  button: { size: 14, lh: 20, w: 500, ls: -0.1 },
  bodySm: { size: 13, lh: 18, w: 500, ls: 0 }, // compact labels (buddy names, avatar initials)
  caption: { size: 12, lh: 16, w: 500, ls: 0.1 },
  overline: { size: 11, lh: 14, w: 600, ls: 0.8 }, // mono + uppercase
  kpi: { size: 44, lh: 48, w: 600, ls: -1.2 }, // mono + tabular-nums
  chip: { size: 11, lh: 14, w: 400, ls: 0.2 }, // mono — badges / chips
  overlineSm: { size: 10, lh: 14, w: 600, ls: 0.8 }, // mono + uppercase — mobile labels
  captionSm: { size: 11, lh: 15, w: 400, ls: 0 }, // mobile KPI captions
  kpiSm: { size: 28, lh: 28, w: 600, ls: -0.6 }, // mono — mobile KPI tiles
  metric: { size: 26, lh: 30, w: 600, ls: -0.6 }, // mono — last dive metrics
  metricSm: { size: 18, lh: 22, w: 600, ls: -0.4 },
  figure: { size: 20, lh: 24, w: 600, ls: -0.4 }, // mono — chart total
  unit: { size: 16, lh: 20, w: 400, ls: 0 }, // mono — KPI units
  unitSm: { size: 12, lh: 16, w: 400, ls: 0 },
  unitXs: { size: 10, lh: 14, w: 400, ls: 0 },
  meta: { size: 10, lh: 14, w: 400, ls: 0.3 }, // mono — user level, footnotes
  bodyLg: { size: 15, lh: 22, w: 400, ls: 0 }, // drawer nav, header subtitle
  brand: { size: 15, lh: 20, w: 600, ls: -0.2 },
  brandSm: { size: 14, lh: 20, w: 600, ls: -0.1 },
} as const;

// 4px scale
export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 32,
  8: 40,
  9: 48,
  10: 64,
  11: 80,
} as const;

export const radius = { xs: 4, sm: 6, md: 10, lg: 14, xl: 20, pill: 999 } as const;

export const shadow = {
  card: 'inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 6px 24px rgba(0, 0, 0, 0.35)',
  raised: 'inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 12px 40px rgba(0, 0, 0, 0.45)',
  focus: '0 0 0 2px rgba(79, 214, 201, 0.55)',
  accentGlow: '0 0 0 1px rgba(79, 214, 201, 0.2), 0 6px 20px rgba(79, 214, 201, 0.12)',
  navIndicator: '0 0 10px #4FD6C9',
  drawer: '10px 0 40px rgba(0, 0, 0, 0.5)',
  fab: '0 0 0 4px rgba(79, 214, 201, 0.15), 0 10px 28px rgba(79, 214, 201, 0.4)',
  dotRing: '0 0 0 2px #060C18', // notification dot cut out of the page background
  ringSurface: '0 0 0 2px #122544', // overlapping avatars on a surface1 card
  marker: 'inset 0 0 0 1px rgba(79, 214, 201, 0.35), 0 4px 12px rgba(0, 0, 0, 0.4)',
  markerActive: '0 0 0 3px rgba(79, 214, 201, 0.2), 0 6px 18px rgba(79, 214, 201, 0.35)',
  popover: 'inset 0 0 0 1px rgba(154, 186, 224, 0.18), 0 12px 32px rgba(0, 0, 0, 0.5)',
  peak: '0 0 16px rgba(79, 214, 201, 0.3)',
} as const;

// Page backgrounds: abyss + two discreet radial glows (dashboard mockups).
export const gradient = {
  pageMobile:
    'radial-gradient(500px 320px at 80% -10%, rgba(79, 214, 201, 0.05), transparent 60%), radial-gradient(400px 250px at -10% 20%, rgba(27, 49, 86, 0.35), transparent 60%)',
  pageDesktop:
    'radial-gradient(1200px 600px at 80% -10%, rgba(79, 214, 201, 0.04), transparent 60%), radial-gradient(900px 500px at 10% 30%, rgba(27, 49, 86, 0.35), transparent 60%)',
  mapMobile: 'radial-gradient(300px 200px at 50% 55%, rgba(36, 64, 109, 0.5), transparent 70%)',
  mapDesktop:
    'radial-gradient(800px 400px at 55% 60%, rgba(36, 64, 109, 0.4), transparent 70%), radial-gradient(500px 300px at 20% 30%, rgba(79, 214, 201, 0.05), transparent 70%)',
} as const;

export const motion = {
  ease: {
    out: 'cubic-bezier(.2, .7, .3, 1)',
    in: 'cubic-bezier(.5, 0, .75, 0)',
    std: 'cubic-bezier(.4, 0, .2, 1)',
  },
  dur: { fast: 120, base: 180, slow: 280 }, // ms
} as const;

// Content dimmed while a refresh is in flight.
export const opacity = { busy: 0.6, mapGrid: 0.6, spark: 0.7, pulse: 0.35 } as const;

export const breakpoint = {
  mobile: 375, // baseline
  tablet: 768, // sidebar appears
  desktop: 1024,
  large: 1280, // 4 KPI columns and paired cards (too tight at 1024 with the sidebar)
  wide: 1440, // primary desktop target
} as const;

export const layout = {
  sidebarWidth: 240,
  hitTarget: 44, // Fitts — min touch target
  fabSize: 56,
  contentMaxWidth: 640, // single-column pages (no sidebar yet)
  controlHeight: 40, // buttons (atoms.jsx · Btn)
  avatarSm: 32,
  avatarMd: 36,
  avatarLg: 40,
  badgePadX: 10,
  badgePadY: 6,
  badgeGap: 6,
  badgeDot: 6,
  sidebarPadY: 28,
  navPadX: 14,
  navIndicatorWidth: 3,
  topBarPadY: 14,
  drawerWidth: 296,
  brandMark: 28,
  brandMarkSm: 24,
  brandGlyph: 16,
  brandGlyphSm: 13,
  brandRadius: 8,
  blurGlass: 12,
  blurScrim: 6,
  hairline: 2, // map scale bar, empty chart bar
  avatarXs: 26,
  kpiMinHeight: 148,
  tileMinHeight: 96,
  tilePad: 14,
  sparkHeight: 30,
  mapHeight: 440,
  mapHeightSm: 280,
  mapGrid: 60,
  mapGridSm: 40,
  markerXs: 22,
  markerSm: 26,
  markerMd: 28,
  markerLg: 36,
  markerPulse: 20, // pulse ring = marker + 20px
  popoverWidth: 200,
  popoverOffset: 30, // gap between the popover and the marker centre
  popoverTail: 12,
  filterHeight: 30,
  scaleBar: 60,
  scaleBarSm: 40,
  chartHeight: 120,
  chartHeightSm: 80,
  barMaxWidth: 24,
  buddyCard: 180,
  buddyCardSm: 140,
} as const;

// Icon sizes (px) — TS only: used as SVG width/height attributes.
export const iconSize = { sm: 14, md: 16, lg: 18, xl: 20, xxl: 22 } as const;

// Icon stroke widths — TS only (SVG attribute). `bold` = FAB plus.
export const iconStroke = { regular: 1.5, bold: 2.2, brand: 1.6 } as const;

export const tokens = {
  color,
  font,
  type,
  space,
  radius,
  shadow,
  gradient,
  motion,
  opacity,
  breakpoint,
  layout,
  iconSize,
  iconStroke,
};
export type Tokens = typeof tokens;
