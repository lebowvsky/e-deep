// Sites — création express (depuis le formulaire), page Carte (= espace des sites),
// panneau « Ajouter un site », fiche site. Desktop 1440 + mobile 375.
// IIFE: no global name collisions with the other mockup scripts.

(function () {
const T = window.DL_TOKENS;
const { Icon, Icons, Overline, Btn, Card } = window;

/* ── Icons ───────────────────────────────────────────────── */
const Ix = {
  chevronLeft: (p) => <Icon {...p} d="M15 6l-6 6 6 6" />,
  x: (p) => <Icon {...p} d="M6 6l12 12M18 6 6 18" />,
  check: (p) => <Icon {...p} d="m5 12 5 5 9-10" />,
  pencil: (p) => <Icon {...p}><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="m13.5 6.5 4 4" /></Icon>,
  more: (p) => <Icon {...p}><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></Icon>,
  crosshair: (p) => <Icon {...p}><circle cx="12" cy="12" r="7" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></Icon>,
  locate: (p) => <Icon {...p}><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="8" /><path d="M12 1v3M12 20v3M1 12h3M20 12h3" /></Icon>,
  layers: (p) => <Icon {...p}><path d="m12 3 9 5-9 5-9-5 9-5z" /><path d="m3 13 9 5 9-5" /></Icon>,
  zoomIn: (p) => <Icon {...p} d="M12 5v14M5 12h14" />,
  zoomOut: (p) => <Icon {...p} d="M5 12h14" />,
  info: (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8v.5" /></Icon>,
  merge: (p) => <Icon {...p}><path d="M6 3v6a6 6 0 0 0 6 6h6" /><path d="M18 3v18" /><path d="m15 12 3 3 3-3" /></Icon>,
  list: (p) => <Icon {...p} d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
};

/* ── Helpers ────────────────────────────────────────────── */
const mono = (size, color = T.color.textHigh, extra = {}) => ({
  fontFamily: T.font.mono, fontSize: size, color, fontVariantNumeric: 'tabular-nums', ...extra,
});
const sans = (size, color = T.color.textHigh, extra = {}) => ({ fontFamily: T.font.sans, fontSize: size, color, ...extra });

const Logo = ({ size = 28 }) => (
  <div style={{ width: size, height: size, borderRadius: size * 0.28, background: T.color.surface2,
    display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `inset 0 0 0 1px ${T.color.accentLine}` }}>
    <svg width={size * 0.57} height={size * 0.57} viewBox="0 0 16 16" fill="none" stroke={T.color.accent} strokeWidth="1.6" strokeLinecap="round">
      <path d="M2 6c1.5 0 1.5-1.2 3-1.2S6.5 6 8 6s1.5-1.2 3-1.2S12.5 6 14 6" />
      <path d="M2 10c1.5 0 1.5-1.2 3-1.2S6.5 10 8 10s1.5-1.2 3-1.2S12.5 10 14 10" />
    </svg>
  </div>
);

const Tag = ({ children, tone = 'neutral' }) => {
  const tones = {
    neutral: ['rgba(154,186,224,0.08)', T.color.textMed],
    warning: ['rgba(231,178,74,0.12)', T.color.warning],
    accent: [T.color.accentSoft, T.color.accent],
  };
  const [bg, fg] = tones[tone];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: T.radius.pill,
      background: bg, whiteSpace: 'nowrap', ...mono(11, fg, { letterSpacing: 0.2 }) }}>{children}</span>
  );
};

const NoPos = () => <Tag tone="warning"><Ix.crosshair size={11} sw={2} />Position à préciser</Tag>;

const RING = {
  default: `inset 0 0 0 1px ${T.color.lineStrong}`,
  focus: `inset 0 0 0 1px ${T.color.accent}, 0 0 0 3px rgba(79,214,201,0.18)`,
};

const Field = ({ label, req, hint, children, style }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, ...style }}>
    <label style={sans(13, T.color.textMed, { fontWeight: 500 })}>{label}{req && <span style={{ color: T.color.accent }}> *</span>}</label>
    {children}
    {hint && <div style={sans(12, T.color.textLow, { lineHeight: 1.45 })}>{hint}</div>}
  </div>
);

const Input = ({ value, ph, unit, icon, focus, caret, monoValue, right, h = 44 }) => (
  <div style={{ height: h, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', borderRadius: T.radius.md,
    background: T.color.surface0, boxShadow: focus ? RING.focus : RING.default }}>
    {icon && <span style={{ color: T.color.textLow, display: 'flex' }}>{icon}</span>}
    <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      ...(value ? (monoValue ? mono(14, T.color.textHigh) : sans(14, T.color.textHigh)) : sans(14, T.color.textMuted)) }}>
      {value || ph}
      {caret && <span style={{ display: 'inline-block', width: 1.5, height: 18, background: T.color.accent, marginLeft: 1, verticalAlign: -3 }} />}
    </span>
    {unit && <span style={mono(12, T.color.textLow)}>{unit}</span>}
    {right}
  </div>
);

const Chips = ({ options, value }) => (
  <div role="radiogroup" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
    {options.map((o) => {
      const on = o === value;
      return (
        <span key={o} role="radio" aria-checked={on} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34,
          padding: '0 12px', borderRadius: T.radius.pill,
          background: on ? T.color.accentSoft : 'rgba(154,186,224,0.06)',
          boxShadow: `inset 0 0 0 1px ${on ? T.color.accentLine : T.color.line}`,
          ...sans(13, on ? T.color.accent : T.color.textMed, { fontWeight: 500 }) }}>
          {on && <Ix.check size={13} sw={2.2} />}{o}
        </span>
      );
    })}
  </div>
);

const IconBtn = ({ label, children, size = 40 }) => (
  <button aria-label={label} style={{ width: size, height: size, borderRadius: T.radius.md, border: 'none', cursor: 'pointer',
    background: T.color.surface2, color: T.color.textMed, boxShadow: `inset 0 0 0 1px ${T.color.lineStrong}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</button>
);

/* ── Données ────────────────────────────────────────────── */
// x/y = position dans la carte stylisée (viewBox 1000 × 640)
const SITES = [
  { id: 'rev', n: 'Pointe de la Revellata', r: 'Calvi · Corse', t: 'Tombant', d: 8, max: 42, last: '08 avr. 2026', x: 752, y: 318 },
  { id: 'bib', n: 'La Bibliothèque', r: 'Calvi · Corse', t: 'Tombant', d: 3, max: 28, last: '07 avr. 2026', x: 760, y: 296 },
  { id: 'b17', n: 'Épave du B-17', r: 'Calvi · Corse', t: 'Épave', d: 2, max: 27, last: '06 avr. 2026', x: 748, y: 342 },
  { id: 'pb', n: 'Punta Bianca', r: 'Calvi · Corse', t: 'Sec', d: 1, max: 18, last: '05 avr. 2026', x: 768, y: 280 },
  { id: 'grc', n: 'Revellata — Grotte aux Corbs', r: 'Calvi · Corse', t: 'Grotte', d: 1, max: 22, last: '04 avr. 2026', nopos: true },
  { id: 'moy', n: 'Les Moyades', r: 'Riou · Marseille', t: 'Sec', d: 6, max: 35, last: '22 mars 2026', x: 300, y: 196 },
  { id: 'lib', n: 'Épave du Liban', r: 'Frioul · Marseille', t: 'Épave', d: 4, max: 32, last: '21 mars 2026', x: 282, y: 178 },
  { id: 'sdc', n: 'Sec de la Croix', r: 'Hyères · Var', t: 'Sec', d: 5, max: 30, last: '08 mars 2026', x: 432, y: 214 },
  { id: 'gab', n: 'La Gabinière', r: 'Port-Cros · Var', t: 'Tombant', d: 11, max: 38, last: '15 févr. 2026', x: 480, y: 244 },
  { id: 'don', n: 'Épave du Donator', r: 'Porquerolles · Var', t: 'Épave', d: 2, max: 39, last: '14 févr. 2026', x: 452, y: 252 },
  { id: 'cr', n: 'Cap Roux', r: 'Esterel · Var', t: 'Tombant', d: 3, max: 24, last: '28 déc. 2025', x: 566, y: 166 },
];

/* ── Carte stylisée ─────────────────────────────────────── */
const Marker = ({ s, selected, small, k = 1 }) => {
  const r = small ? 9 : Math.min(9 + s.d * 1.1, 20);
  return (
    <g transform={`translate(${s.x}, ${s.y}) scale(${k})`} style={{ cursor: 'pointer' }}>
      {selected && <circle r={r + 9} fill={T.color.accentSoft} />}
      <circle r={r} fill={selected ? T.color.accent : T.color.surface3} stroke={selected ? T.color.accent : T.color.accentLine} strokeWidth="1.2" />
      <text y="4" textAnchor="middle" style={mono(small ? 9 : 11, selected ? T.color.accentInk : T.color.textHigh, { fontWeight: 600 })}
        fill={selected ? T.color.accentInk : T.color.textHigh}>{s.d}</text>
    </g>
  );
};

const MapCanvas = ({ selected = 'rev', newPin, children, small, viewBox = '0 0 1000 640', grid = 40, k = 1 }) => (
  <svg width="100%" height="100%" viewBox={viewBox} preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, display: 'block' }}
    role="img" aria-label="Carte de tes sites de plongée">
    <defs>
      <radialGradient id="sea" cx="55%" cy="60%" r="70%">
        <stop offset="0" stopColor="#10264A" /><stop offset="1" stopColor={T.color.surface0} />
      </radialGradient>
      <pattern id="mapgrid" width={grid} height={grid} patternUnits="userSpaceOnUse">
        <path d={`M${grid} 0H0v${grid}`} fill="none" stroke={T.color.gridline} strokeWidth="1" />
      </pattern>
    </defs>
    <rect width="1000" height="1000" fill="url(#sea)" />
    <rect width="1000" height="1000" fill="url(#mapgrid)" />
    {/* Côte continentale (Languedoc → Provence → Riviera) */}
    <path d="M0 0 H1000 V90 C 960 100, 920 120, 880 118 C 820 115, 760 120, 700 130 C 640 140, 600 150, 570 158
      C 540 166, 520 190, 490 205 C 470 212, 450 205, 430 206 C 400 208, 370 200, 340 192 C 310 186, 295 175, 270 172
      C 240 170, 220 182, 190 190 C 150 200, 110 220, 80 260 C 60 290, 40 300, 0 305 Z"
      fill={T.color.surface1} stroke={T.color.lineStrong} strokeWidth="1.2" />
    {/* Corse */}
    <path d="M800 270 C 820 262, 840 266, 848 284 C 856 300, 852 318, 862 340 C 872 370, 868 410, 860 450
      C 852 490, 836 530, 818 560 C 806 578, 790 572, 786 552 C 780 520, 770 500, 772 470 C 774 440, 760 420, 758 392
      C 756 360, 766 340, 772 320 C 778 296, 786 278, 800 270 Z"
      fill={T.color.surface1} stroke={T.color.lineStrong} strokeWidth="1.2" />
    {/* Îles d'Hyères */}
    <path d="M440 236 c 8 -4, 20 -3, 26 1 c -6 4, -18 5, -26 -1 Z M470 230 c 6 -3, 14 -2, 18 1 c -5 3, -13 3, -18 -1 Z"
      fill={T.color.surface1} stroke={T.color.lineStrong} strokeWidth="1" />
    {k === 1 && !small && [['Marseille', 300, 160], ['Toulon', 410, 190], ['Calvi', 818, 282], ['Ajaccio', 790, 470]].map(([n, x, y]) => (
      <text key={n} x={x} y={y} textAnchor="middle" style={mono(11, T.color.textLow, { letterSpacing: 1 })} fill={T.color.textLow}>{n.toUpperCase()}</text>
    ))}
    {SITES.filter((s) => !s.nopos).map((s) => <Marker key={s.id} s={s} selected={s.id === selected} small={small} k={k} />)}
    {newPin && (
      <g transform={`translate(${newPin[0]}, ${newPin[1]}) scale(${k})`}>
        <circle r="26" fill="none" stroke={T.color.accent} strokeDasharray="4 5" opacity="0.7" />
        <circle r="12" fill={T.color.accentSoft} stroke={T.color.accent} strokeWidth="1.5" />
        <circle r="4" fill={T.color.accent} />
        <line x1="-40" x2="-30" y1="0" y2="0" stroke={T.color.accent} /><line x1="30" x2="40" y1="0" y2="0" stroke={T.color.accent} />
        <line y1="-40" y2="-30" x1="0" x2="0" stroke={T.color.accent} /><line y1="30" y2="40" x1="0" x2="0" stroke={T.color.accent} />
      </g>
    )}
    {children}
  </svg>
);

const MapControls = () => (
  <div style={{ position: 'absolute', right: 16, top: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{ display: 'flex', flexDirection: 'column', borderRadius: T.radius.md, overflow: 'hidden',
      boxShadow: `inset 0 0 0 1px ${T.color.lineStrong}`, background: T.color.surface2 }}>
      <button aria-label="Zoomer" style={{ width: 40, height: 40, border: 'none', background: 'transparent', color: T.color.textMed,
        display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: `1px solid ${T.color.line}` }}><Ix.zoomIn size={16} /></button>
      <button aria-label="Dézoomer" style={{ width: 40, height: 40, border: 'none', background: 'transparent', color: T.color.textMed,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ix.zoomOut size={16} /></button>
    </div>
    <IconBtn label="Centrer sur ma position"><Ix.locate size={16} /></IconBtn>
    <IconBtn label="Fond de carte"><Ix.layers size={16} /></IconBtn>
  </div>
);

const RegionChips = ({ value = 'Méditerranée' }) => (
  <div style={{ position: 'absolute', left: 16, top: 16, display: 'flex', gap: 6, padding: 4, borderRadius: T.radius.md,
    background: 'rgba(11,26,46,0.85)', backdropFilter: 'blur(8px)', boxShadow: `inset 0 0 0 1px ${T.color.line}` }}>
    {[['Tous', 23], ['Méditerranée', 18], ['Bretagne', 5]].map(([r, c]) => {
      const on = r === value;
      return (
        <span key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 10px', borderRadius: 7,
          background: on ? T.color.surface2 : 'transparent', boxShadow: on ? `inset 0 0 0 1px ${T.color.lineStrong}` : 'none',
          ...sans(12, on ? T.color.textHigh : T.color.textLow, { fontWeight: on ? 500 : 400 }) }}>
          {r}<span style={mono(11, T.color.textLow)}>{c}</span>
        </span>
      );
    })}
  </div>
);

const SitePopover = ({ left, top }) => (
  <div style={{ position: 'absolute', left, top, width: 250, padding: 14, borderRadius: T.radius.lg, background: T.color.surface2,
    boxShadow: `inset 0 0 0 1px ${T.color.lineStrong}, ${T.shadow.raised}` }}>
    <Overline>Tombant · Calvi</Overline>
    <div style={sans(15, T.color.textHigh, { fontWeight: 600, marginTop: 4 })}>Pointe de la Revellata</div>
    <div style={{ display: 'flex', gap: 18, marginTop: 10 }}>
      <div><div style={mono(16, T.color.accent, { fontWeight: 600 })}>8</div><div style={sans(11, T.color.textLow)}>plongées</div></div>
      <div><div style={mono(16, T.color.textHigh, { fontWeight: 600 })}>42 m</div><div style={sans(11, T.color.textLow)}>ta prof. max</div></div>
      <div><div style={mono(13, T.color.textHigh, { lineHeight: '22px' })}>08 avr.</div><div style={sans(11, T.color.textLow)}>dernière</div></div>
    </div>
    <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, ...sans(13, T.color.accent, { fontWeight: 500 }) }}>
      Voir la fiche <Icons.arrowRight size={14} />
    </div>
  </div>
);

/* ── Sidebar (Carte actif) ──────────────────────────────── */
const NAV = [['Dashboard', Icons.dashboard], ['Mes plongées', Icons.dives], ['Carte', Icons.map], ['Statistiques', Icons.stats]];
const Sidebar = () => (
  <aside style={{ width: 240, flexShrink: 0, background: T.color.surface0, borderRight: `1px solid ${T.color.line}`,
    display: 'flex', flexDirection: 'column', padding: '28px 20px', alignSelf: 'stretch' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 6px', marginBottom: 36 }}>
      <Logo /><div style={sans(15, T.color.textHigh, { fontWeight: 600, letterSpacing: -0.2 })}>DiveLog</div>
    </div>
    <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
      <div style={{ padding: '0 14px 8px' }}><Overline>Navigation</Overline></div>
      {NAV.map(([label, Ic]) => {
        const active = label === 'Carte';
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, height: 44, padding: '0 14px',
            borderRadius: T.radius.md, position: 'relative', background: active ? T.color.accentSoft : 'transparent',
            boxShadow: active ? `inset 0 0 0 1px ${T.color.accentLine}` : 'none',
            ...sans(14, active ? T.color.accent : T.color.textMed, { fontWeight: active ? 500 : 400 }) }}>
            <Ic size={18} /><span>{label}</span>
            {active && <span style={{ position: 'absolute', left: -20, top: 10, width: 3, height: 24, borderRadius: 2,
              background: T.color.accent, boxShadow: `0 0 10px ${T.color.accent}` }} />}
          </div>
        );
      })}
    </nav>
    <div style={{ marginTop: 24, padding: 12, borderRadius: T.radius.md, background: T.color.surface1,
      boxShadow: `inset 0 0 0 1px ${T.color.line}`, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 18, background: 'linear-gradient(135deg, #24406D, #4FD6C9)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', ...sans(13, T.color.textHigh, { fontWeight: 600 }) }}>MR</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={sans(13, T.color.textHigh, { fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' })}>Marine Rousseau</div>
        <div style={mono(10, T.color.textLow, { letterSpacing: 0.3 })}>N2 · FFESSM</div>
      </div>
      <Icons.chevronDown size={14} style={{ color: T.color.textLow }} />
    </div>
  </aside>
);

const Frame = ({ h, children }) => (
  <div style={{ width: 1440, minHeight: h, background: T.color.abyss, display: 'flex', fontFamily: T.font.sans, color: T.color.textHigh,
    backgroundImage: `radial-gradient(1200px 600px at 80% -10%, rgba(79,214,201,0.04), transparent 60%),
                      radial-gradient(900px 500px at 10% 30%, rgba(27,49,86,0.35), transparent 60%)` }}>
    <Sidebar />
    <main style={{ flex: 1, padding: '32px 48px 48px', minWidth: 0 }}>{children}</main>
  </div>
);

const H1 = ({ children, size = T.type.display.size, lh = T.type.display.lh }) => (
  <h1 style={{ margin: '8px 0 0', ...sans(size, T.color.textHigh), lineHeight: `${lh}px`, fontWeight: 600, letterSpacing: T.type.display.ls }}>{children}</h1>
);

/* ── Liste des sites (panneau) ──────────────────────────── */
const SiteRow = ({ s, selected, compact }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: compact ? '12px 4px' : '12px 14px', cursor: 'pointer',
    borderTop: `1px solid ${T.color.line}`, background: selected ? T.color.surface2 : 'transparent', position: 'relative' }}>
    {selected && <span style={{ position: 'absolute', left: 0, top: 10, bottom: 10, width: 2, borderRadius: 1, background: T.color.accent }} />}
    <span style={{ width: 32, height: 32, borderRadius: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: selected ? T.color.accent : T.color.surface3, ...mono(12, selected ? T.color.accentInk : T.color.textHigh, { fontWeight: 600 }) }}>{s.d}</span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={sans(14, T.color.textHigh, { fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' })}>{s.n}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
        {s.nopos ? <NoPos /> : <span style={sans(12, T.color.textLow)}>{s.r} · {s.t}</span>}
      </div>
    </div>
    <div style={{ textAlign: 'right' }}>
      <div style={mono(13, T.color.textHigh)}>{s.max}<span style={mono(10, T.color.textLow)}> m</span></div>
      <div style={mono(10, T.color.textLow)}>{s.last.replace(/ 20\d\d/, '')}</div>
    </div>
  </div>
);

const ListPanel = () => (
  <Card elev={1} pad={0} style={{ width: 380, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Input ph="Rechercher un site…" icon={<Icons.search size={16} />} h={40} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['Type', 'Région'].map((f) => (
            <span key={f} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 32, padding: '0 10px', borderRadius: T.radius.sm,
              boxShadow: `inset 0 0 0 1px ${T.color.line}`, ...sans(12, T.color.textMed) }}>{f}<Icons.chevronDown size={12} /></span>
          ))}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 10px', borderRadius: T.radius.sm,
            whiteSpace: 'nowrap', background: 'rgba(231,178,74,0.10)', boxShadow: 'inset 0 0 0 1px rgba(231,178,74,0.35)', ...sans(12, T.color.warning) }}>
            À compléter <span style={mono(11, T.color.warning)}>1</span></span>
        </div>
      </div>
    </div>
    <div>
      {[...SITES].sort((a, b) => b.d - a.d).slice(0, 10).map((s) => <SiteRow key={s.id} s={s} selected={s.id === 'rev'} />)}
    </div>
    <div style={{ padding: '12px 16px', borderTop: `1px solid ${T.color.line}`, ...sans(12, T.color.textLow) }}>
      <span style={mono(12, T.color.textMed)}>10</span> sur <span style={mono(12, T.color.textMed)}>23</span> sites · suite au défilement
    </div>
  </Card>
);

/* ──────────────────────────────────────────────
   CARTE — desktop nominal
   ────────────────────────────────────────────── */
const MapHeader = () => (
  <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
    <div>
      <Overline style={{ color: T.color.accent }}>Carte · 23 sites · 6 régions</Overline>
      <H1>Mes sites</H1>
      <div style={{ ...sans(15, T.color.textMed), marginTop: 8 }}>Tes sites sont privés. <span style={{ color: T.color.textLow }}>1 site attend sa position.</span></div>
    </div>
    <Btn kind="primary" icon={<Icons.plus size={16} stroke={T.color.accentInk} sw={2.2} />}>Ajouter un site</Btn>
  </header>
);

const MapSitesDesktop = () => (
  <Frame h={1080}>
    <MapHeader />
    <div style={{ display: 'flex', gap: 16, height: 860 }}>
      <Card elev={1} pad={0} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <MapCanvas selected="rev" viewBox="250 60 625 760" />
        <RegionChips />
        <MapControls />
        <SitePopover left={300} top={215} />
        <div style={{ position: 'absolute', left: 16, bottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 60, height: 2, background: T.color.textLow }} />
          <span style={mono(10, T.color.textLow)}>50 km</span>
        </div>
      </Card>
      <ListPanel />
    </div>
  </Frame>
);

/* ──────────────────────────────────────────────
   CARTE — panneau « Ajouter un site » (position posée sur la carte)
   ────────────────────────────────────────────── */
const AddSitePanel = ({ mobile }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: T.radius.md,
      background: T.color.accentSoft, boxShadow: `inset 0 0 0 1px ${T.color.accentLine}`, ...sans(13, T.color.textHigh, { lineHeight: 1.45 }) }}>
      <Ix.crosshair size={16} style={{ color: T.color.accent, marginTop: 1, flexShrink: 0 }} />
      <span>{mobile ? 'Déplace la carte pour placer le repère sur le site.' : 'Clique sur la carte pour placer le site, puis ajuste en glissant le repère.'}</span>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <Field label="Latitude"><Input value="42.5794" unit="° N" monoValue /></Field>
      <Field label="Longitude"><Input value="8.7262" unit="° E" monoValue /></Field>
    </div>
    <Field label="Nom" req><Input value="Revellata — Grotte aux Corbs" monoValue={false} focus caret /></Field>
    <Field label="Région" hint="Suggérée depuis la position"><Input value="Calvi · Corse" monoValue={false} icon={<Icons.pin size={16} />}
      right={<Icons.chevronDown size={14} style={{ color: T.color.textLow }} />} /></Field>
    <Field label="Type"><Chips options={['Tombant', 'Épave', 'Sec', 'Grotte', 'Herbier', 'Autre']} value="Grotte" /></Field>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <Field label="Profondeur min"><Input value="8" unit="m" monoValue /></Field>
      <Field label="Profondeur max"><Input value="24" unit="m" monoValue /></Field>
    </div>
    <Field label="Accès & conseils" hint="Mouillage, courant, repères… visible sur la fiche">
      <div style={{ minHeight: 76, padding: 12, borderRadius: T.radius.md, background: T.color.surface0, boxShadow: RING.default,
        ...sans(14, T.color.textMuted, { lineHeight: 1.5 }) }}>Ex. : mouillage côté nord, entrée à 12 m…</div>
    </Field>
  </div>
);

const MapAddSiteDesktop = () => (
  <Frame h={1080}>
    <MapHeader />
    <div style={{ display: 'flex', gap: 16, height: 860 }}>
      <Card elev={1} pad={0} style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: 'crosshair' }}>
        <MapCanvas selected="none" newPin={[738, 330]} viewBox="676 220 160 206" grid={10} k={0.3} />
        <MapControls />
        <div style={{ position: 'absolute', left: '50%', bottom: 20, transform: 'translateX(-50%)', padding: '8px 14px', borderRadius: T.radius.pill,
          background: 'rgba(11,26,46,0.9)', boxShadow: `inset 0 0 0 1px ${T.color.lineStrong}`, ...mono(12, T.color.textMed) }}>
          42.5794° N · 8.7262° E · <span style={{ color: T.color.accent }}>repère posé</span>
        </div>
      </Card>
      <Card elev={2} pad={0} role="dialog" aria-label="Ajouter un site"
        style={{ width: 420, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 12px 12px 20px',
          borderBottom: `1px solid ${T.color.line}` }}>
          <div>
            <Overline>Compléter un site express</Overline>
            <div style={sans(18, T.color.textHigh, { fontWeight: 600, marginTop: 2 })}>Placer le site</div>
          </div>
          <button aria-label="Fermer" style={{ width: 40, height: 40, border: 'none', background: 'transparent', color: T.color.textLow,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ix.x size={18} /></button>
        </div>
        <div style={{ flex: 1, padding: 20, overflow: 'hidden' }}><AddSitePanel /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 20px', borderTop: `1px solid ${T.color.line}` }}>
          <Btn kind="ghost">Annuler</Btn>
          <Btn kind="primary" icon={<Ix.check size={16} stroke={T.color.accentInk} sw={2.2} />}>Enregistrer le site</Btn>
        </div>
      </Card>
    </div>
  </Frame>
);

/* ──────────────────────────────────────────────
   FICHE SITE — desktop
   ────────────────────────────────────────────── */
const KPI = ({ label, value, unit, caption, accent, compact }) => (
  <Card elev={1} pad={compact ? 14 : 20} style={{ minHeight: compact ? 92 : 120, display: 'flex', flexDirection: 'column',
    justifyContent: 'space-between', borderRadius: compact ? T.radius.md : T.radius.lg }}>
    <Overline style={compact ? { fontSize: 10 } : undefined}>{label}</Overline>
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 8 }}>
        <span style={mono(compact ? 26 : 36, accent ? T.color.accent : T.color.textHigh, { fontWeight: 600, letterSpacing: -0.8, lineHeight: 1 })}>{value}</span>
        {unit && <span style={mono(compact ? 12 : 14, T.color.textLow)}>{unit}</span>}
      </div>
      <div style={{ ...sans(compact ? 11 : 12, T.color.textLow), marginTop: 6 }}>{caption}</div>
    </div>
  </Card>
);

const KV = ({ k, v, last }) => (
  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, padding: '11px 0',
    borderBottom: last ? 'none' : `1px solid ${T.color.line}` }}>
    <span style={sans(13, T.color.textLow)}>{k}</span>
    <span style={/\d/.test(v) ? mono(14, T.color.textHigh) : sans(14, T.color.textHigh, { fontWeight: 500 })}>{v}</span>
  </div>
);

const CardHead = ({ title, aside }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
    <Overline>{title}</Overline>{aside}
  </div>
);

const DIVES_HERE = [
  [127, '08 avr. 2026', 42, 38, ['LB', 'TN']],
  [109, '18 sept. 2025', 38, 41, ['LB']],
  [108, '17 sept. 2025', 35, 44, ['LB', 'EM']],
  [96, '12 juin 2025', 30, 46, ['TN']],
  [95, '11 juin 2025', 33, 40, ['TN', 'RP']],
];
const COL = { LB: '#3a5a82', TN: '#2a6a6a', EM: '#5a3a7a', RP: '#3a7a5a' };

const DivesHere = ({ compact }) => (
  <Card elev={1} pad={0}>
    <div style={{ padding: compact ? '16px 16px 6px' : '20px 24px 8px' }}>
      <CardHead title="Tes plongées ici · 8" aside={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...sans(13, T.color.accent, { fontWeight: 500 }) }}>
        {compact ? 'Tout voir' : 'Voir dans Mes plongées'} <Icons.arrowRight size={14} /></span>} />
    </div>
    {DIVES_HERE.slice(0, compact ? 3 : 5).map(([no, d, dep, dur, team], i) => (
      <div key={no} style={{ display: 'grid', gridTemplateColumns: compact ? '52px 1fr auto' : '64px 1fr 90px 90px 110px 20px', alignItems: 'center',
        gap: 12, height: 56, padding: compact ? '0 16px' : '0 24px', borderTop: `1px solid ${T.color.line}` }}>
        <span style={mono(13, T.color.textLow)}>#{no}</span>
        <span style={mono(13, T.color.textHigh)}>{d}</span>
        <span style={{ ...mono(14, i === 0 ? T.color.accent : T.color.textHigh), textAlign: 'right' }}>{dep}<span style={mono(11, T.color.textLow)}> m</span></span>
        {!compact && <span style={{ ...mono(14, T.color.textHigh), textAlign: 'right' }}>{dur}<span style={mono(11, T.color.textLow)}> min</span></span>}
        {!compact && (
          <div style={{ display: 'flex' }}>
            {['MR', ...team].map((id, j) => (
              <span key={id} style={{ marginLeft: j ? -2 : 0, width: 24, height: 24, borderRadius: 12, display: 'flex', alignItems: 'center',
                justifyContent: 'center', background: id === 'MR' ? T.color.surface0 : COL[id],
                boxShadow: `0 0 0 2px ${T.color.surface1}${id === 'MR' ? `, inset 0 0 0 1px ${T.color.lineStrong}` : ''}`,
                ...sans(9, id === 'MR' ? T.color.textMed : T.color.textHigh, { fontWeight: 600 }) }}>{id}</span>
            ))}
          </div>
        )}
        {!compact && <Icons.chevronRight size={16} style={{ color: T.color.textMuted }} />}
      </div>
    ))}
  </Card>
);

const SiteMiniMap = ({ h }) => (
  <Card elev={1} pad={0} style={{ height: h, position: 'relative', overflow: 'hidden' }}>
    <MapCanvas selected="rev" viewBox="682 288 150 62" grid={8} k={0.3} />
    <div style={{ position: 'absolute', left: 14, bottom: 12, padding: '6px 10px', borderRadius: T.radius.sm,
      background: 'rgba(11,26,46,0.9)', ...mono(11, T.color.textMed) }}>42.5800° N · 8.7250° E</div>
    <div style={{ position: 'absolute', right: 12, bottom: 12, padding: '6px 10px', borderRadius: T.radius.sm,
      background: 'rgba(11,26,46,0.9)', ...sans(12, T.color.accent, { fontWeight: 500 }) }}>Ouvrir sur la carte</div>
  </Card>
);

const InfosCard = () => (
  <Card elev={1} pad={20}>
    <CardHead title="Infos du site" />
    <KV k="Type" v="Tombant" />
    <KV k="Profondeur" v="15 – 60 m" />
    <KV k="Mise à l'eau" v="Bateau" />
    <KV k="Structure habituelle" v="Calvi Plongée" />
    <KV k="Région" v="Calvi · Corse" last />
  </Card>
);

const NotesCard = () => (
  <Card elev={1} pad={20}>
    <CardHead title="Accès & conseils" />
    <p style={{ margin: 0, ...sans(14, T.color.textMed, { lineHeight: 1.6 }) }}>
      Mouillage au pied du phare. Tombant plein nord, courant possible en pointe : rester côté abrité. Gorgones rouges dès 30 m.
    </p>
  </Card>
);

const SiteDetailDesktop = () => (
  <Frame h={1180}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
      <nav aria-label="Fil d'Ariane" style={{ display: 'flex', alignItems: 'center', gap: 8, ...sans(13, T.color.textLow) }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: T.color.textMed }}><Ix.chevronLeft size={16} /> Carte</span>
        <span style={{ color: T.color.textMuted }}>/</span><span>Pointe de la Revellata</span>
      </nav>
    </div>
    <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
      <div>
        <Overline style={{ color: T.color.accent }}>Site · Tombant · privé</Overline>
        <H1>Pointe de la Revellata</H1>
        <div style={{ ...sans(15, T.color.textMed), marginTop: 8 }}>Calvi · Corse · Méditerranée</div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Btn kind="secondary" icon={<Icons.plus size={16} />}>Nouvelle plongée ici</Btn>
        <Btn kind="secondary" icon={<Ix.pencil size={16} />}>Modifier</Btn>
        <div style={{ position: 'relative' }}>
          <IconBtn label="Plus d'actions"><Ix.more size={18} /></IconBtn>
          {/* Menu ouvert : fusionner */}
          <div role="menu" style={{ position: 'absolute', right: 0, top: 48, width: 230, padding: 6, zIndex: 2, borderRadius: T.radius.md,
            background: T.color.surface2, boxShadow: `inset 0 0 0 1px ${T.color.lineStrong}, ${T.shadow.raised}` }}>
            {[[Ix.merge, 'Fusionner avec un autre site…', true], [Ix.x, 'Supprimer le site']].map(([Ic, l, on]) => (
              <div key={l} role="menuitem" style={{ display: 'flex', alignItems: 'center', gap: 10, height: 40, padding: '0 10px',
                borderRadius: 8, background: on ? 'rgba(154,186,224,0.08)' : 'transparent',
                ...sans(13, l.startsWith('Supprimer') ? T.color.danger : T.color.textHigh) }}><Ic size={15} />{l}</div>
            ))}
          </div>
        </div>
      </div>
    </header>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
      <KPI label="Tes plongées ici" value="8" caption="Depuis juin 2025" />
      <KPI label="Ta prof. max ici" value="42" unit="m" caption="#127 · 08 avr. 2026" accent />
      <KPI label="Temps cumulé" value="5" unit="h 18 min" caption="moy. 40 min" />
      <KPI label="Temp. fond moy." value="15" unit="°C" caption="de 13 à 19 °C" />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 16, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SiteMiniMap h={300} />
        <DivesHere />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <InfosCard />
        <NotesCard />
        <div style={{ padding: '0 4px', ...sans(12, T.color.textLow, { lineHeight: 1.6 }) }}>
          Ce site n'est visible que par toi. Fusionner deux sites regroupe leurs plongées sous un seul nom.
        </div>
      </div>
    </div>
  </Frame>
);

/* ──────────────────────────────────────────────
   CRÉATION EXPRESS — depuis le champ Site du formulaire
   ────────────────────────────────────────────── */
const QuickFields = () => (
  <>
    <Field label="Nom" req><Input value="Grotte aux Corbs" monoValue={false} focus caret /></Field>
    <Field label="Région" hint="Comme ta dernière plongée · modifiable">
      <Input value="Calvi · Corse" monoValue={false} icon={<Icons.pin size={16} />} right={<Icons.chevronDown size={14} style={{ color: T.color.textLow }} />} />
    </Field>
    <Field label="Type (facultatif)"><Chips options={['Tombant', 'Épave', 'Sec', 'Grotte', 'Autre']} value="Grotte" /></Field>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, ...sans(12, T.color.textLow, { lineHeight: 1.5 }) }}>
      <Ix.info size={14} style={{ marginTop: 1, flexShrink: 0 }} />
      Tu pourras placer le site sur la carte plus tard, depuis la page Carte.
    </div>
  </>
);

const QuickCreateDesktop = () => (
  <div style={{ width: 640, padding: 24, background: T.color.abyss, fontFamily: T.font.sans }}>
    <Card elev={1} pad={24}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <span style={{ width: 26, height: 26, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: T.color.surface0, boxShadow: `inset 0 0 0 1px ${T.color.lineStrong}`, ...mono(12, T.color.textMed) }}>1</span>
        <span style={sans(16, T.color.textHigh, { fontWeight: 600 })}>L'essentiel</span>
      </div>
      <Field label="Site" req>
        <Input value="Grotte aux Corbs" monoValue={false} icon={<Icons.search size={16} />} />
      </Field>
      {/* Panneau accroché sous le champ */}
      <div role="dialog" aria-label="Créer un site" style={{ marginTop: 8, padding: 18, borderRadius: T.radius.lg, background: T.color.surface2,
        boxShadow: `inset 0 0 0 1px ${T.color.lineStrong}, ${T.shadow.raised}`, display: 'flex', flexDirection: 'column', gap: 14, position: 'relative' }}>
        <span style={{ position: 'absolute', top: -6, left: 28, width: 12, height: 12, transform: 'rotate(45deg)', background: T.color.surface2,
          boxShadow: `-1px -1px 0 ${T.color.lineStrong}` }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={sans(15, T.color.textHigh, { fontWeight: 600 })}>Nouveau site</span>
          <span style={mono(11, T.color.textLow)}>Échap pour annuler</span>
        </div>
        <QuickFields />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
          <Btn kind="ghost">Annuler</Btn>
          <Btn kind="primary" icon={<Ix.check size={16} stroke={T.color.accentInk} sw={2.2} />}>Créer et sélectionner</Btn>
        </div>
      </div>
      <div style={{ marginTop: 18, opacity: 0.35, display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: 12 }}>
        {['Date', 'Immersion', 'Sortie'].map((l) => <Field key={l} label={l}><Input ph="—" /></Field>)}
      </div>
    </Card>
  </div>
);

const QuickCreateMobile = () => (
  <div style={{ width: 375, height: 812, position: 'relative', overflow: 'hidden', background: T.color.abyss, fontFamily: T.font.sans }}>
    <div style={{ padding: 16, opacity: 0.5 }}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 22px', ...sans(15, T.color.textHigh, { fontWeight: 600 }) }}>Nouvelle plongée</div>
      <Card elev={1} pad={16}><Field label="Site" req><Input value="Grotte aux Corbs" monoValue={false} icon={<Icons.search size={16} />} /></Field></Card>
    </div>
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(6,12,24,0.6)', backdropFilter: 'blur(4px)' }} />
    <div role="dialog" aria-label="Créer un site" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: T.color.surface0,
      borderRadius: `${T.radius.xl}px ${T.radius.xl}px 0 0`, boxShadow: `inset 0 1px 0 ${T.color.lineStrong}, 0 -20px 50px rgba(0,0,0,0.5)` }}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
        <span style={{ width: 36, height: 4, borderRadius: 2, background: T.color.lineStrong }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px 4px 20px' }}>
        <span style={sans(18, T.color.textHigh, { fontWeight: 600 })}>Nouveau site</span>
        <button aria-label="Fermer" style={{ width: 44, height: 44, border: 'none', background: 'transparent', color: T.color.textLow,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ix.x size={18} /></button>
      </div>
      <div style={{ padding: '8px 20px 0', display: 'flex', flexDirection: 'column', gap: 14 }}><QuickFields /></div>
      <div style={{ padding: '16px 20px 28px' }}>
        <Btn kind="primary" icon={<Ix.check size={16} stroke={T.color.accentInk} sw={2.2} />}
          style={{ width: '100%', height: 48, justifyContent: 'center', fontSize: 15 }}>Créer et sélectionner</Btn>
      </div>
    </div>
  </div>
);

/* ──────────────────────────────────────────────
   MOBILE — Carte et fiche
   ────────────────────────────────────────────── */
const MobileTopBar = ({ back, title }) => (
  <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 12px 14px 10px',
    background: 'rgba(6,12,24,0.85)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${T.color.line}`, position: 'relative', zIndex: 2 }}>
    {back ? (
      <span style={{ height: 44, display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px', ...sans(14, T.color.textHigh, { fontWeight: 500 }) }}>
        <Ix.chevronLeft size={20} /> {back}</span>
    ) : (
      <span style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.color.textHigh }}><Icons.menu size={20} /></span>
    )}
    {back ? <span /> : title ? <span style={sans(14, T.color.textHigh, { fontWeight: 600 })}>{title}</span>
      : <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Logo size={24} /><span style={sans(14, T.color.textHigh, { fontWeight: 600 })}>DiveLog</span></div>}
    <span style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.color.textMed }}>
      {back ? <Ix.more size={20} /> : <Icons.bell size={18} />}</span>
  </header>
);

const MapSitesMobile = () => (
  <div style={{ width: 375, height: 812, position: 'relative', overflow: 'hidden', background: T.color.abyss, fontFamily: T.font.sans }}>
    <MobileTopBar />
    <div style={{ position: 'absolute', left: 0, right: 0, top: 73, height: 420 }}>
      <MapCanvas selected="rev" viewBox="420 140 470 528" k={0.8} />
      <div style={{ position: 'absolute', left: 12, top: 12, display: 'flex', gap: 6 }}>
        {['Tous · 23', 'Méditerranée', 'Bretagne'].map((r, i) => (
          <span key={r} style={{ height: 32, display: 'inline-flex', alignItems: 'center', padding: '0 10px', borderRadius: T.radius.pill,
            background: i === 1 ? T.color.surface2 : 'rgba(11,26,46,0.85)', boxShadow: `inset 0 0 0 1px ${i === 1 ? T.color.lineStrong : T.color.line}`,
            ...sans(12, i === 1 ? T.color.textHigh : T.color.textLow, { fontWeight: i === 1 ? 500 : 400 }) }}>{r}</span>
        ))}
      </div>
      <div style={{ position: 'absolute', right: 12, top: 12 }}><IconBtn label="Centrer sur ma position" size={36}><Ix.locate size={15} /></IconBtn></div>
    </div>
    {/* Liste en bottom sheet (mi-hauteur) */}
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 440, background: T.color.surface0,
      borderRadius: `${T.radius.xl}px ${T.radius.xl}px 0 0`, boxShadow: `inset 0 1px 0 ${T.color.lineStrong}, 0 -16px 40px rgba(0,0,0,0.45)` }}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 2px' }}>
        <span style={{ width: 36, height: 4, borderRadius: 2, background: T.color.lineStrong }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 16px 10px 20px' }}>
        <div>
          <div style={sans(17, T.color.textHigh, { fontWeight: 600 })}>Mes sites</div>
          <div style={sans(12, T.color.textLow)}><span style={mono(12, T.color.textMed)}>23</span> sites · 1 à compléter</div>
        </div>
        <Btn kind="secondary" icon={<Icons.plus size={15} />} style={{ height: 36, padding: '0 12px', fontSize: 13 }}>Site</Btn>
      </div>
      <div style={{ padding: '0 16px' }}>
        {[...SITES].sort((a, b) => b.d - a.d).slice(0, 5).map((s) => <SiteRow key={s.id} s={s} selected={s.id === 'rev'} compact />)}
      </div>
    </div>
  </div>
);

const SiteDetailMobile = () => (
  <div style={{ width: 375, minHeight: 1260, background: T.color.abyss, fontFamily: T.font.sans }}>
    <MobileTopBar back="Carte" />
    <div style={{ padding: '20px 20px 0' }}>
      <Overline style={{ color: T.color.accent }}>Site · Tombant · privé</Overline>
      <h1 style={{ margin: '8px 0 4px', ...sans(26, T.color.textHigh), lineHeight: '30px', fontWeight: 600, letterSpacing: -0.5 }}>Pointe de la Revellata</h1>
      <div style={sans(13, T.color.textMed)}>Calvi · Corse</div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '18px 20px 0' }}>
      <KPI compact label="Plongées ici" value="8" caption="Depuis juin 2025" />
      <KPI compact label="Prof. max ici" value="42" unit="m" caption="#127" accent />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 20px 0' }}>
      <SiteMiniMap h={190} />
      <Btn kind="secondary" icon={<Icons.plus size={16} />} style={{ height: 44, justifyContent: 'center' }}>Nouvelle plongée ici</Btn>
      <DivesHere compact />
      <InfosCard />
      <NotesCard />
    </div>
    <div style={{ height: 32 }} />
  </div>
);

Object.assign(window, {
  QuickCreateDesktop, QuickCreateMobile, MapSitesDesktop, MapAddSiteDesktop, MapSitesMobile, SiteDetailDesktop, SiteDetailMobile,
});
})();
