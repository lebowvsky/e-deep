// DipDive / DiveLog — Design tokens
// Exposed globally so component files can read them regardless of Babel scope.

const DL_TOKENS = {
  // ── Color ────────────────────────────────────────────────
  // Dark surfaces: true deep-navy, not neutral black. Each step adds ~4-6%
  // lightness for clear elevation without noisy blue shifts.
  color: {
    // Surfaces (deepest → elevated)
    abyss:    '#060C18', // page background base
    surface0: '#0B1A2E', // primary surface (from brief: bleu nuit saturé)
    surface1: '#122544', // raised card
    surface2: '#1B3156', // top card / popover
    surface3: '#24406D', // subtle hover on surface2
    line:     'rgba(154, 186, 224, 0.10)', // hairline divider
    lineStrong: 'rgba(154, 186, 224, 0.18)',

    // Text (emphasis scale)
    textHigh:   '#EAF2FB',   // AAA on surface0 (~16:1)
    textMed:    '#AFC1D6',   // AA on surface0
    textLow:    '#6E819A',   // captions, placeholders
    textMuted:  '#43556F',   // disabled / decorative

    // Accent — turquoise froid (190°), utilisé rarement: CTA, markers,
    // états actifs. On garde une luminosité élevée pour respecter AA sur
    // surface0 (~7:1).
    accent:        '#4FD6C9',
    accentSoft:    'rgba(79, 214, 201, 0.14)',
    accentLine:    'rgba(79, 214, 201, 0.35)',
    accentInk:     '#062A27',  // text on accent fill

    // Semantic — désaturés, lisibles sur dark
    success:  '#5BD391',
    warning:  '#E7B24A',
    danger:   '#E06A70',

    // Data viz — dérivées du bleu profond, lisibles
    chart:    '#4FD6C9',
    chartDim: 'rgba(79, 214, 201, 0.22)',
    gridline: 'rgba(154, 186, 224, 0.08)',
  },

  // ── Typography ───────────────────────────────────────────
  // Geist Sans (UI) + Geist Mono (numériques / data). Scale modulaire
  // 1.25 (major third), ancrée sur 14px body.
  font: {
    sans: '"Geist", "Geist Sans", -apple-system, system-ui, sans-serif',
    mono: '"Geist Mono", "JetBrains Mono", ui-monospace, monospace',
  },
  type: {
    // size / lineHeight / weight / tracking
    display:   { size: 40, lh: 44, w: 600, ls: -1.0 },
    h1:        { size: 28, lh: 34, w: 600, ls: -0.6 },
    h2:        { size: 20, lh: 26, w: 600, ls: -0.3 },
    h3:        { size: 16, lh: 22, w: 600, ls: -0.1 },
    body:      { size: 14, lh: 20, w: 400, ls:  0   },
    bodyMed:   { size: 14, lh: 20, w: 500, ls:  0   },
    caption:   { size: 12, lh: 16, w: 500, ls:  0.1 },
    overline:  { size: 11, lh: 14, w: 600, ls:  0.8 }, // mono, uppercase
    kpi:       { size: 44, lh: 48, w: 600, ls: -1.2 }, // mono tabular
  },

  // ── Spacing — échelle 4px ───────────────────────────────
  // Naming: s(px). On expose aussi des noms sémantiques pour le handoff.
  space: {
    0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32, 8: 40, 9: 48, 10: 64, 11: 80,
  },

  // ── Radius ──────────────────────────────────────────────
  radius: { sm: 6, md: 10, lg: 14, xl: 20, pill: 999 },

  // ── Elevation ──────────────────────────────────────────
  // Pas de glow néon. Ombres douces + légère lueur interne pour la
  // séparation sur fond très sombre.
  shadow: {
    card:    '0 1px 0 rgba(255,255,255,0.03) inset, 0 6px 24px rgba(0,0,0,0.35)',
    raised:  '0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 40px rgba(0,0,0,0.45)',
    focus:   '0 0 0 2px rgba(79, 214, 201, 0.55)',
  },

  // ── Motion ─────────────────────────────────────────────
  ease: {
    out:  'cubic-bezier(.2,.7,.3,1)',
    in:   'cubic-bezier(.5,0,.75,0)',
    std:  'cubic-bezier(.4,0,.2,1)',
  },
  dur: { fast: 120, base: 180, slow: 280 },
};

window.DL_TOKENS = DL_TOKENS;
