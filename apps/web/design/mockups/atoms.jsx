// Small reusable atoms & icons for DiveLog mockups.
// All use DL_TOKENS. Components are attached to window at the bottom so other
// Babel <script> blocks can use them.

const T = window.DL_TOKENS;

/* ── Icons (stroke-based, 20px grid, 1.5 stroke) ───────────────── */
const Icon = ({ d, size = 18, stroke = 'currentColor', sw = 1.5, fill = 'none', children, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke}
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }}>
    {d ? <path d={d} /> : children}
  </svg>
);

const Icons = {
  dashboard: (p) => (
    <Icon {...p}>
      <rect x="3" y="3" width="7" height="9" rx="1.2" />
      <rect x="14" y="3" width="7" height="5" rx="1.2" />
      <rect x="14" y="12" width="7" height="9" rx="1.2" />
      <rect x="3" y="16" width="7" height="5" rx="1.2" />
    </Icon>
  ),
  dives: (p) => (
    <Icon {...p}>
      <path d="M4 7h12" />
      <path d="M4 12h16" />
      <path d="M4 17h9" />
    </Icon>
  ),
  map: (p) => (
    <Icon {...p}>
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
      <path d="M9 4v14" />
      <path d="M15 6v14" />
    </Icon>
  ),
  stats: (p) => (
    <Icon {...p}>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-8" />
      <path d="M22 20H2" />
    </Icon>
  ),
  plus: (p) => <Icon {...p} d="M12 5v14M5 12h14" />,
  chevronDown: (p) => <Icon {...p} d="M6 9l6 6 6-6" />,
  chevronRight: (p) => <Icon {...p} d="M9 6l6 6-6 6" />,
  search: (p) => (
    <Icon {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Icon>
  ),
  bell: (p) => (
    <Icon {...p}>
      <path d="M6 8a6 6 0 1 1 12 0c0 4 1.5 6 2 7H4c.5-1 2-3 2-7z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </Icon>
  ),
  clock: (p) => (
    <Icon {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Icon>
  ),
  depth: (p) => (
    // stylized downward arrow / depth marker
    <Icon {...p}>
      <path d="M12 3v15" />
      <path d="M7 14l5 5 5-5" />
      <path d="M5 21h14" />
    </Icon>
  ),
  pin: (p) => (
    <Icon {...p}>
      <path d="M12 21s-7-7.5-7-12a7 7 0 1 1 14 0c0 4.5-7 12-7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </Icon>
  ),
  logout: (p) => (
    <Icon {...p}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 17l-5-5 5-5" />
      <path d="M5 12h12" />
    </Icon>
  ),
  settings: (p) => (
    <Icon {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </Icon>
  ),
  menu: (p) => <Icon {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Icon>,
  arrowRight: (p) => <Icon {...p} d="M5 12h14M13 5l7 7-7 7" />,
  waves: (p) => (
    <Icon {...p}>
      <path d="M2 8c2 0 2-1.5 4-1.5S8 8 10 8s2-1.5 4-1.5S16 8 18 8s2-1.5 4-1.5" />
      <path d="M2 14c2 0 2-1.5 4-1.5S8 14 10 14s2-1.5 4-1.5S16 14 18 14s2-1.5 4-1.5" />
      <path d="M2 20c2 0 2-1.5 4-1.5S8 20 10 20s2-1.5 4-1.5S16 20 18 20s2-1.5 4-1.5" />
    </Icon>
  ),
};

/* ── Typography atoms ───────────────────────────────────── */
const Overline = ({ children, style, color }) => (
  <span style={{
    fontFamily: T.font.mono, fontSize: T.type.overline.size, lineHeight: `${T.type.overline.lh}px`,
    fontWeight: T.type.overline.w, letterSpacing: T.type.overline.ls, textTransform: 'uppercase',
    color: color || T.color.textLow, ...style,
  }}>{children}</span>
);

/* ── Button ─────────────────────────────────────────────── */
const Btn = ({ children, kind = 'secondary', icon, style, ...rest }) => {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    fontFamily: T.font.sans, fontSize: 14, fontWeight: 500,
    border: 'none', cursor: 'pointer', padding: '0 16px', height: 40,
    borderRadius: T.radius.md, transition: `all ${T.dur.base}ms ${T.ease.out}`,
    letterSpacing: -0.1, boxSizing: 'border-box',
  };
  const variants = {
    primary: {
      background: T.color.accent, color: T.color.accentInk,
      boxShadow: '0 0 0 1px rgba(79,214,201,0.2), 0 6px 20px rgba(79,214,201,0.12)',
    },
    secondary: {
      background: 'rgba(154, 186, 224, 0.06)', color: T.color.textHigh,
      boxShadow: `inset 0 0 0 1px ${T.color.lineStrong}`,
    },
    ghost: {
      background: 'transparent', color: T.color.textMed,
    },
  };
  return (
    <button style={{ ...base, ...variants[kind], ...style }} {...rest}>
      {icon}{children}
    </button>
  );
};

/* ── Card (generic surface) ─────────────────────────────── */
const Card = ({ children, style, elev = 1, pad = 20 }) => {
  const bg = elev === 0 ? T.color.surface0 : elev === 1 ? T.color.surface1 : T.color.surface2;
  return (
    <div style={{
      background: bg, borderRadius: T.radius.lg, padding: pad,
      boxShadow: `inset 0 0 0 1px ${T.color.line}, ${T.shadow.card}`,
      ...style,
    }}>{children}</div>
  );
};

/* ── Swatch (for the visual-direction section) ─────────── */
const Swatch = ({ name, value, contrast, fg = '#fff' }) => (
  <div style={{
    background: value, borderRadius: T.radius.md, padding: 14,
    minHeight: 108, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    boxShadow: `inset 0 0 0 1px ${T.color.line}`,
  }}>
    <div style={{ fontFamily: T.font.mono, fontSize: 10, letterSpacing: 0.6, color: fg, opacity: 0.7, textTransform: 'uppercase' }}>{name}</div>
    <div>
      <div style={{ fontFamily: T.font.mono, fontSize: 12, color: fg, letterSpacing: 0.2 }}>{value}</div>
      {contrast && (
        <div style={{ fontFamily: T.font.mono, fontSize: 10, color: fg, opacity: 0.55, marginTop: 4 }}>{contrast}</div>
      )}
    </div>
  </div>
);

Object.assign(window, { Icon, Icons, Overline, Btn, Card, Swatch });
