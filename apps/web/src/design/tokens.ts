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

  // Data viz
  chart: '#4FD6C9',
  chartDim: 'rgba(79, 214, 201, 0.22)',
  chartBar: 'rgba(154, 186, 224, 0.22)', // non-peak bars
  gridline: 'rgba(154, 186, 224, 0.08)',
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
  caption: { size: 12, lh: 16, w: 500, ls: 0.1 },
  overline: { size: 11, lh: 14, w: 600, ls: 0.8 }, // mono + uppercase
  kpi: { size: 44, lh: 48, w: 600, ls: -1.2 }, // mono + tabular-nums
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

export const radius = { sm: 6, md: 10, lg: 14, xl: 20, pill: 999 } as const;

export const shadow = {
  card: 'inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 6px 24px rgba(0, 0, 0, 0.35)',
  raised: 'inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 12px 40px rgba(0, 0, 0, 0.45)',
  focus: '0 0 0 2px rgba(79, 214, 201, 0.55)',
  accentGlow: '0 0 0 1px rgba(79, 214, 201, 0.2), 0 6px 20px rgba(79, 214, 201, 0.12)',
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
export const opacity = { busy: 0.6 } as const;

export const breakpoint = {
  mobile: 375, // baseline
  tablet: 768, // sidebar appears
  desktop: 1024,
  wide: 1440, // primary desktop target
} as const;

export const layout = {
  sidebarWidth: 240,
  hitTarget: 44, // Fitts — min touch target
  fabSize: 56,
  contentMaxWidth: 640, // single-column pages (no sidebar yet)
} as const;

export const tokens = {
  color,
  font,
  type,
  space,
  radius,
  shadow,
  motion,
  opacity,
  breakpoint,
  layout,
};
export type Tokens = typeof tokens;
