// "Mes plongées" — carnet de plongée (liste).
// Desktop 1440 (nominal, aucun résultat, carnet vierge) + mobile 375 (nominal, filtres).
// Uses DL_TOKENS + atoms (Icons, Overline, Btn, Card). Wrapped in an IIFE so its
// top-level names never collide with the other mockup scripts.

(function () {
const T = window.DL_TOKENS;
const { Icon, Icons, Overline, Btn, Card } = window;

/* ── Extra icons (same 24 grid, 1.5 stroke) ─────────────── */
const Ix = {
  download: (p) => <Icon {...p}><path d="M12 4v11" /><path d="m7 10 5 5 5-5" /><path d="M5 20h14" /></Icon>,
  upload: (p) => <Icon {...p}><path d="M12 15V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></Icon>,
  sliders: (p) => (
    <Icon {...p}>
      <path d="M4 7h10" /><path d="M18 7h2" /><circle cx="16" cy="7" r="2" />
      <path d="M4 17h4" /><path d="M12 17h8" /><circle cx="10" cy="17" r="2" />
    </Icon>
  ),
  sort: (p) => <Icon {...p}><path d="M7 4v16" /><path d="m3 16 4 4 4-4" /><path d="M17 20V4" /><path d="m13 8 4-4 4 4" /></Icon>,
  x: (p) => <Icon {...p} d="M6 6l12 12M18 6 6 18" />,
  check: (p) => <Icon {...p} d="m5 12 5 5 9-10" />,
  chevronLeft: (p) => <Icon {...p} d="M15 6l-6 6 6 6" />,
  book: (p) => (
    <Icon {...p}>
      <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z" />
      <path d="M4 19a2 2 0 0 1 2-2h13" /><path d="M9 7h6" />
    </Icon>
  ),
};

/* ── Data (cohérente avec le dashboard : #127 = Revellata, 42 m) ── */
const BUDDY = {
  LB: { n: 'Lucas Bernard', c: '#3a5a82' }, TN: { n: 'Thao Nguyen', c: '#2a6a6a' },
  EM: { n: 'Élise Marchand', c: '#5a3a7a' }, RP: { n: 'Rémi Pascal', c: '#3a7a5a' },
  SB: { n: 'Sofia Barros', c: '#7a5a3a' }, JK: { n: 'Julien Kervella', c: '#3a4a7a' },
  CL: { n: 'Camille Leroy', c: '#6a4a3a' }, MA: { n: 'Mathieu Aubert', c: '#2f5a6e' },
  HD: { n: 'Hugo Durand', c: '#4a5a2f' }, NF: { n: 'Nina Fabre', c: '#6a3a52' },
  MR: { n: 'Marine Rousseau (toi)', self: true },
};

const GROUPS = [
  { month: 'Avril 2026', total: '2 h 57', dives: [
    { no: 127, d: '08 avr.', dow: 'mer.', site: 'Pointe de la Revellata', region: 'Calvi · Corse', depth: 42, dur: 38, temp: 14, gas: 'Air', team: ['LB', 'TN'], peak: true },
    { no: 126, d: '07 avr.', dow: 'mar.', site: 'La Bibliothèque', region: 'Calvi · Corse', depth: 28, dur: 46, temp: 14, gas: 'Nx 32', team: ['LB', 'TN', 'EM', 'RP'], hover: true },
    { no: 125, d: '06 avr.', dow: 'lun.', site: 'Épave du B-17', region: 'Calvi · Corse', depth: 27, dur: 41, temp: 14, gas: 'Nx 32', team: ['LB', 'TN', 'CL'] },
    { no: 124, d: '05 avr.', dow: 'dim.', site: 'Punta Bianca', region: 'Calvi · Corse', depth: 18, dur: 52, temp: 15, gas: 'Air', team: ['TN'] },
  ]},
  { month: 'Mars 2026', total: '1 h 57', dives: [
    { no: 123, d: '22 mars', dow: 'dim.', site: 'Les Moyades', region: 'Riou · Marseille', depth: 35, dur: 40, temp: 13, gas: 'Air', team: ['EM', 'HD', 'NF'] },
    { no: 122, d: '21 mars', dow: 'sam.', site: 'Épave du Liban', region: 'Frioul · Marseille', depth: 32, dur: 35, temp: 13, gas: 'Air', team: ['EM', 'RP'] },
    { no: 121, d: '08 mars', dow: 'dim.', site: 'Sec de la Croix', region: 'Hyères · Var', depth: 30, dur: 42, temp: 13, gas: 'Nx 32', team: ['RP', 'CL', 'MA', 'HD', 'NF'] },
  ]},
  { month: 'Février 2026', total: '1 h 09', dives: [
    { no: 120, d: '15 févr.', dow: 'dim.', site: 'La Gabinière', region: 'Port-Cros · Var', depth: 38, dur: 37, temp: 13, gas: 'Air', team: ['SB'] },
    { no: 119, d: '14 févr.', dow: 'sam.', site: 'Épave du Donator', region: 'Porquerolles · Var', depth: 39, dur: 32, temp: 13, gas: 'Air', team: ['SB', 'JK', 'MA'] },
  ]},
  { month: 'Décembre 2025', total: '0 h 44', dives: [
    { no: 118, d: '28 déc.', dow: 'dim.', site: 'Cap Roux', region: 'Esterel · Var', depth: 24, dur: 44, temp: 14, gas: 'Air', team: ['JK'] },
  ]},
];

const MAX_SCALE = 60; // échelle des barres de profondeur

/* ── Shared bits ─────────────────────────────────────────── */
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

const Avatar = ({ id, size = 26, ring = T.color.surface1 }) => {
  const self = BUDDY[id].self;
  return (
    <div style={{ width: size, height: size, borderRadius: size / 2, flexShrink: 0,
      background: self ? T.color.surface0 : BUDDY[id].c,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: self ? `0 0 0 2px ${ring}, inset 0 0 0 1px ${T.color.lineStrong}` : `0 0 0 2px ${ring}`,
      ...sans(size * 0.38, self ? T.color.textMed : T.color.textHigh, { fontWeight: 600 }) }}>{id}</div>
  );
};

// Palanquée complète : toi (MR, en premier, avatar neutre) + les autres plongeurs.
// Au-delà de `max` avatars, les suivants sont résumés en « +N ». Survol : liste des noms.
const Palanquee = ({ ids, size = 26, ring = T.color.surface1, max = 5 }) => {
  const all = ['MR', ...ids];
  const shown = all.length > max ? all.slice(0, max - 1) : all;
  const rest = all.length - shown.length;
  const names = all.map((id) => BUDDY[id].n).join(', ');
  return (
    <div title={names} aria-label={`Palanquée de ${all.length} : ${names}`} style={{ display: 'flex', alignItems: 'center' }}>
      {shown.map((id, i) => <div key={id} style={{ marginLeft: i ? -2 : 0 }}><Avatar id={id} size={size} ring={ring} /></div>)}
      {rest > 0 && (
        <div style={{ marginLeft: -2, height: size, minWidth: size, padding: '0 6px', borderRadius: size / 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.color.surface3,
          boxShadow: `0 0 0 2px ${ring}`, ...mono(size * 0.4, T.color.textHigh, { fontWeight: 600 }) }}>+{rest}</div>
      )}
    </div>
  );
};

const IconBtn = ({ label, children, size = 40 }) => (
  <button aria-label={label} style={{ width: size, height: size, borderRadius: T.radius.md, border: 'none', cursor: 'pointer',
    background: 'rgba(154,186,224,0.06)', color: T.color.textMed, boxShadow: `inset 0 0 0 1px ${T.color.lineStrong}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</button>
);

/* ── Sidebar (Mes plongées actif) ───────────────────────── */
const NAV = [['Dashboard', Icons.dashboard], ['Mes plongées', Icons.dives], ['Carte', Icons.map], ['Statistiques', Icons.stats]];

const Sidebar = () => (
  <aside style={{ width: 240, flexShrink: 0, background: T.color.surface0, borderRight: `1px solid ${T.color.line}`,
    display: 'flex', flexDirection: 'column', padding: '28px 20px', alignSelf: 'stretch' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 6px', marginBottom: 36 }}>
      <Logo />
      <div style={sans(15, T.color.textHigh, { fontWeight: 600, letterSpacing: -0.2 })}>DiveLog</div>
    </div>
    <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
      <div style={{ padding: '0 14px 8px' }}><Overline>Navigation</Overline></div>
      {NAV.map(([label, Ic]) => {
        const active = label === 'Mes plongées';
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, height: 44, padding: '0 14px',
            borderRadius: T.radius.md, position: 'relative',
            background: active ? T.color.accentSoft : 'transparent', color: active ? T.color.accent : T.color.textMed,
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

const DesktopFrame = ({ height, children }) => (
  <div style={{ width: 1440, minHeight: height, background: T.color.abyss, display: 'flex',
    fontFamily: T.font.sans, color: T.color.textHigh,
    backgroundImage: `radial-gradient(1200px 600px at 80% -10%, rgba(79,214,201,0.04), transparent 60%),
                      radial-gradient(900px 500px at 10% 30%, rgba(27,49,86,0.35), transparent 60%)` }}>
    <Sidebar />
    <main style={{ flex: 1, padding: '32px 48px 48px', minWidth: 0 }}>{children}</main>
  </div>
);

/* ── Header ─────────────────────────────────────────────── */
const PageHeader = ({ subtitle }) => (
  <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
    <div>
      <Overline style={{ color: T.color.accent }}>Carnet de plongée · N2 FFESSM</Overline>
      <h1 style={{ ...sans(T.type.display.size, T.color.textHigh), lineHeight: `${T.type.display.lh}px`,
        fontWeight: T.type.display.w, letterSpacing: T.type.display.ls, margin: '8px 0 0' }}>Mes plongées</h1>
      <div style={{ ...sans(15, T.color.textMed), marginTop: 8 }}>{subtitle}</div>
    </div>
    <div style={{ display: 'flex', gap: 10 }}>
      <Btn kind="secondary" icon={<Ix.download size={16} />}>Exporter</Btn>
      <Btn kind="primary" icon={<Icons.plus size={16} stroke={T.color.accentInk} sw={2.2} />}>Nouvelle plongée</Btn>
    </div>
  </header>
);

/* ── Toolbar: search + filtres + tri ────────────────────── */
const SearchField = ({ value, width = 340, height = 40 }) => (
  <div style={{ width, height, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px',
    borderRadius: T.radius.md, background: T.color.surface0, boxShadow: `inset 0 0 0 1px ${T.color.lineStrong}` }}>
    <Icons.search size={16} style={{ color: T.color.textLow }} />
    <span style={sans(14, value ? T.color.textHigh : T.color.textLow, { flex: 1, whiteSpace: 'nowrap', overflow: 'hidden' })}>
      {value || 'Site, plongeur, note…'}
    </span>
    <span style={{ ...mono(11, T.color.textLow), padding: '2px 6px', borderRadius: 4, boxShadow: `inset 0 0 0 1px ${T.color.line}` }}>/</span>
  </div>
);

const FilterBtn = ({ label, value, active }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 40, padding: '0 12px 0 14px',
    borderRadius: T.radius.md, cursor: 'pointer', whiteSpace: 'nowrap',
    background: active ? T.color.accentSoft : 'transparent',
    boxShadow: `inset 0 0 0 1px ${active ? T.color.accentLine : T.color.line}`,
    ...sans(13, active ? T.color.accent : T.color.textMed, { fontWeight: 500 }) }}>
    {label}{active && <span style={{ width: 6, height: 6, borderRadius: 3, background: T.color.accent }} />}
    <Icons.chevronDown size={14} style={{ opacity: 0.7 }} />
  </div>
);

const Toolbar = ({ search, active = {} }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
    <SearchField value={search} />
    <div style={{ width: 1, height: 24, background: T.color.line, margin: '0 6px' }} />
    <FilterBtn label="Période" value={active.periode} active={!!active.periode} />
    <FilterBtn label="Région" value={active.region} active={!!active.region} />
    <FilterBtn label="Profondeur" value={active.prof} active={!!active.prof} />
    <FilterBtn label="Gaz" />
    <FilterBtn label="Palanquée" />
    <div style={{ flex: 1 }} />
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 12px', whiteSpace: 'nowrap',
      ...sans(13, T.color.textMed) }}>
      <Ix.sort size={16} style={{ color: T.color.textLow }} />
      Plus récentes
      <Icons.chevronDown size={14} style={{ opacity: 0.7 }} />
    </div>
  </div>
);

/* ── Bandeau de synthèse (suit les filtres) ─────────────── */
const SummaryBand = ({ items, note }) => (
  <div style={{ display: 'flex', alignItems: 'center', padding: '16px 24px', marginBottom: 16,
    borderRadius: T.radius.lg, background: T.color.surface0, boxShadow: `inset 0 0 0 1px ${T.color.line}` }}>
    {items.map(([label, value, unit], i) => (
      <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
        {i > 0 && <div style={{ width: 1, height: 36, background: T.color.line, margin: '0 28px' }} />}
        <div>
          <Overline>{label}</Overline>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
            <span style={mono(24, T.color.textHigh, { fontWeight: 600, letterSpacing: -0.5, lineHeight: '28px' })}>{value}</span>
            {unit && <span style={mono(12, T.color.textLow)}>{unit}</span>}
          </div>
        </div>
      </div>
    ))}
    <div style={{ flex: 1 }} />
    <span style={sans(12, T.color.textLow)}>{note}</span>
  </div>
);

/* ── Table ──────────────────────────────────────────────── */
const COLS = '64px 100px minmax(0, 1fr) 132px 84px 76px 84px 168px 24px';

const HeadCell = ({ children, align = 'left', sorted }) => (
  <div style={{ textAlign: align, display: 'flex', alignItems: 'center', gap: 4,
    justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
    <Overline style={{ color: sorted ? T.color.textMed : T.color.textLow }}>{children}</Overline>
    {sorted && <Icons.chevronDown size={12} style={{ color: T.color.accent }} />}
  </div>
);

const DepthCell = ({ depth, peak }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
    <div style={{ width: 64, height: 4, borderRadius: 2, background: T.color.gridline, position: 'relative' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(depth / MAX_SCALE) * 100}%`,
        borderRadius: 2, background: peak ? T.color.accent : 'rgba(154,186,224,0.35)' }} />
    </div>
    <span style={{ ...mono(14, T.color.textHigh, { fontWeight: 500 }), width: 44, textAlign: 'right' }}>
      {depth}<span style={mono(11, T.color.textLow)}> m</span>
    </span>
  </div>
);

const Row = ({ dv }) => (
  <div style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', gap: 16, height: 60, padding: '0 20px',
    borderTop: `1px solid ${T.color.line}`, cursor: 'pointer', position: 'relative',
    background: dv.hover ? T.color.surface2 : 'transparent' }}>
    {dv.hover && <span style={{ position: 'absolute', left: 0, top: 12, bottom: 12, width: 2, borderRadius: 1, background: T.color.accent }} />}
    <span style={mono(13, T.color.textLow)}>#{dv.no}</span>
    <div>
      <div style={mono(13, T.color.textHigh)}>{dv.d}</div>
      <div style={sans(11, T.color.textLow)}>{dv.dow}</div>
    </div>
    <div style={{ minWidth: 0 }}>
      <div style={sans(14, T.color.textHigh, { fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' })}>{dv.site}</div>
      <div style={sans(12, T.color.textLow)}>{dv.region}</div>
    </div>
    <DepthCell depth={dv.depth} peak={dv.peak} />
    <span style={{ ...mono(14, T.color.textHigh), textAlign: 'right' }}>{dv.dur}<span style={mono(11, T.color.textLow)}> min</span></span>
    <span style={{ ...mono(14, T.color.textMed), textAlign: 'right' }}>{dv.temp}<span style={mono(11, T.color.textLow)}> °C</span></span>
    <span style={mono(12, dv.gas === 'Air' ? T.color.textMed : T.color.textHigh)}>{dv.gas}</span>
    <Palanquee ids={dv.team} ring={dv.hover ? T.color.surface2 : T.color.surface1} />
    <Icons.chevronRight size={16} style={{ color: dv.hover ? T.color.accent : T.color.textMuted }} />
  </div>
);

const GroupHeader = ({ g }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 40, padding: '0 20px',
    borderTop: `1px solid ${T.color.line}`, background: 'rgba(11,26,46,0.55)' }}>
    <span style={sans(13, T.color.textHigh, { fontWeight: 600 })}>{g.month}</span>
    <span style={mono(11, T.color.textLow, { letterSpacing: 0.3 })}>
      {g.dives.length} {g.dives.length > 1 ? 'plongées' : 'plongée'} · {g.total}
    </span>
  </div>
);

const TableHead = () => (
  <div style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', gap: 16, height: 44, padding: '0 20px' }}>
    <HeadCell>N°</HeadCell>
    <HeadCell sorted>Date</HeadCell>
    <HeadCell>Site</HeadCell>
    <HeadCell align="right">Prof. max</HeadCell>
    <HeadCell align="right">Durée</HeadCell>
    <HeadCell align="right">Temp.</HeadCell>
    <HeadCell>Gaz</HeadCell>
    <HeadCell>Palanquée</HeadCell>
    <span />
  </div>
);

const PageBtn = ({ children, active, disabled, label }) => (
  <div aria-label={label} style={{ minWidth: 36, height: 36, padding: '0 8px', borderRadius: T.radius.sm,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'default' : 'pointer',
    background: active ? T.color.accentSoft : 'transparent',
    boxShadow: active ? `inset 0 0 0 1px ${T.color.accentLine}` : 'none',
    ...mono(13, active ? T.color.accent : disabled ? T.color.textMuted : T.color.textMed) }}>{children}</div>
);

const Pagination = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px',
    borderTop: `1px solid ${T.color.line}` }}>
    <span style={sans(13, T.color.textLow)}>
      <span style={mono(13, T.color.textMed)}>1–10</span> sur <span style={mono(13, T.color.textMed)}>127</span> plongées
    </span>
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <PageBtn disabled label="Page précédente"><Ix.chevronLeft size={16} /></PageBtn>
      <PageBtn active>1</PageBtn><PageBtn>2</PageBtn><PageBtn>3</PageBtn>
      <PageBtn disabled>…</PageBtn><PageBtn>13</PageBtn>
      <PageBtn label="Page suivante"><Icons.chevronRight size={16} /></PageBtn>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...sans(13, T.color.textLow) }}>
      Afficher
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 10px', borderRadius: T.radius.sm,
        boxShadow: `inset 0 0 0 1px ${T.color.lineStrong}`, ...mono(13, T.color.textMed) }}>
        10 <Icons.chevronDown size={12} />
      </div>
      par page
    </div>
  </div>
);

/* ──────────────────────────────────────────────
   DESKTOP — NOMINAL
   ────────────────────────────────────────────── */
const DivesDesktop = () => (
  <DesktopFrame height={1240}>
    <PageHeader subtitle={<>127 plongées depuis juin 2019. <span style={{ color: T.color.textLow }}>Avec 14 plongeurs différents.</span></>} />
    <Toolbar />
    <SummaryBand note="Calculé sur la sélection — suit les filtres et la recherche"
      items={[['Plongées', '127'], ['Temps cumulé', '84', 'h 23 min'], ['Prof. moyenne', '24,6', 'm'], ['Prof. max', '42', 'm'], ['Sites', '23']]} />
    <Card elev={1} pad={0} style={{ overflow: 'hidden' }}>
      <TableHead />
      {GROUPS.map((g) => (
        <div key={g.month}>
          <GroupHeader g={g} />
          {g.dives.map((dv) => <Row key={dv.no} dv={dv} />)}
        </div>
      ))}
      <Pagination />
    </Card>
    <div style={{ marginTop: 24, ...mono(10, T.color.textMuted, { letterSpacing: 0.3 }), display: 'flex', gap: 16 }}>
      <span>DIVELOG V1 · MES PLONGÉES</span><span>·</span><span>Ligne #126 en état survol</span><span>·</span>
      <span>Clic ligne → détail de la plongée</span>
    </div>
  </DesktopFrame>
);

/* ──────────────────────────────────────────────
   DESKTOP — AUCUN RÉSULTAT (filtres trop restrictifs)
   ────────────────────────────────────────────── */
const Chip = ({ children }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 6px 0 12px',
    borderRadius: T.radius.pill, background: T.color.accentSoft, boxShadow: `inset 0 0 0 1px ${T.color.accentLine}`,
    ...sans(12, T.color.accent, { fontWeight: 500 }) }}>
    {children}
    <span aria-label="Retirer le filtre" style={{ width: 20, height: 20, borderRadius: 10, display: 'flex',
      alignItems: 'center', justifyContent: 'center', background: 'rgba(79,214,201,0.12)' }}><Ix.x size={12} sw={2} /></span>
  </span>
);

const DivesNoResults = () => (
  <DesktopFrame height={980}>
    <PageHeader subtitle={<>127 plongées depuis juin 2019. <span style={{ color: T.color.textLow }}>Avec 14 plongeurs différents.</span></>} />
    <Toolbar search="épave" active={{ region: 'Bretagne', prof: '> 40 m' }} />
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <span style={sans(13, T.color.textLow)}>Filtres actifs :</span>
      <Chip>Recherche « épave »</Chip><Chip>Région : Bretagne</Chip><Chip>Profondeur : &gt; 40 m</Chip>
      <span style={{ ...sans(13, T.color.textMed, { fontWeight: 500 }), marginLeft: 8, textDecoration: 'underline',
        textUnderlineOffset: 3, cursor: 'pointer' }}>Tout réinitialiser</span>
    </div>
    <SummaryBand note="Aucune plongée dans la sélection"
      items={[['Plongées', '0'], ['Temps cumulé', '—'], ['Prof. moyenne', '—'], ['Prof. max', '—'], ['Sites', '—']]} />
    <Card elev={1} pad={0} style={{ overflow: 'hidden' }}>
      <TableHead />
      <div style={{ borderTop: `1px solid ${T.color.line}`, padding: '72px 40px 80px', display: 'flex',
        flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, borderRadius: 24, background: 'rgba(154,186,224,0.08)',
          boxShadow: `inset 0 0 0 1px ${T.color.lineStrong}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20, color: T.color.textMed }}><Icons.search size={20} /></div>
        <div style={sans(20, T.color.textHigh, { fontWeight: 600, letterSpacing: -0.3, marginBottom: 8 })}>
          Aucune plongée ne correspond
        </div>
        <div style={sans(14, T.color.textMed, { maxWidth: 440, lineHeight: 1.55, marginBottom: 24 })}>
          Tu as 3 plongées sur des épaves en Bretagne, mais aucune au-delà de 40 m.
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn kind="secondary">Retirer « &gt; 40 m » · 3 résultats</Btn>
          <Btn kind="ghost">Tout réinitialiser</Btn>
        </div>
      </div>
    </Card>
  </DesktopFrame>
);

/* ──────────────────────────────────────────────
   DESKTOP — CARNET VIERGE (0 plongée)
   ────────────────────────────────────────────── */
const DivesEmpty = () => (
  <DesktopFrame height={900}>
    <header style={{ marginBottom: 28 }}>
      <Overline style={{ color: T.color.accent }}>Carnet de plongée · N2 FFESSM</Overline>
      <h1 style={{ ...sans(T.type.display.size, T.color.textHigh), lineHeight: `${T.type.display.lh}px`,
        fontWeight: T.type.display.w, letterSpacing: T.type.display.ls, margin: '8px 0 0' }}>Mes plongées</h1>
    </header>
    <Card elev={1} pad={0} style={{ position: 'relative', overflow: 'hidden', minHeight: 560 }}>
      {/* lignes de carnet fantômes */}
      <div style={{ position: 'absolute', inset: 0, padding: '24px 0', opacity: 0.5 }}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} style={{ height: 60, borderTop: i ? `1px dashed ${T.color.line}` : 'none' }} />
        ))}
      </div>
      <div style={{ position: 'relative', minHeight: 560, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 40 }}>
        <div style={{ width: 56, height: 56, borderRadius: 28, background: T.color.accentSoft,
          border: `1px solid ${T.color.accentLine}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20, color: T.color.accent }}><Ix.book size={24} /></div>
        <div style={sans(24, T.color.textHigh, { fontWeight: 600, letterSpacing: -0.4, marginBottom: 8 })}>Ton carnet est vierge</div>
        <div style={sans(15, T.color.textMed, { maxWidth: 460, lineHeight: 1.55, marginBottom: 28 })}>
          Chaque plongée enregistrée prendra son numéro, à la suite de ton carnet papier si tu en as un.
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn kind="primary" icon={<Icons.plus size={16} stroke={T.color.accentInk} sw={2.2} />}
            style={{ height: 48, padding: '0 22px', fontSize: 15 }}>Enregistrer ma première plongée</Btn>
          <Btn kind="secondary" icon={<Ix.upload size={16} />} style={{ height: 48, padding: '0 18px' }}>Importer (UDDF, CSV)</Btn>
        </div>
        <div style={{ ...sans(12, T.color.textLow), marginTop: 18 }}>
          Déjà 54 plongées sur papier ? Tu pourras démarrer la numérotation à <span style={mono(12, T.color.textMed)}>#55</span>.
        </div>
      </div>
    </Card>
  </DesktopFrame>
);

/* ──────────────────────────────────────────────
   MOBILE 375
   ────────────────────────────────────────────── */
const MobileTopBar = () => (
  <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px',
    background: 'rgba(6,12,24,0.85)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${T.color.line}` }}>
    <button aria-label="Ouvrir le menu" style={{ width: 44, height: 44, marginLeft: -10, background: 'transparent', border: 'none',
      color: T.color.textHigh, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icons.menu size={20} /></button>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Logo size={24} /><span style={sans(14, T.color.textHigh, { fontWeight: 600 })}>DiveLog</span>
    </div>
    <button aria-label="Notifications" style={{ width: 44, height: 44, marginRight: -10, background: 'transparent', border: 'none',
      color: T.color.textMed, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <Icons.bell size={18} />
      <span style={{ position: 'absolute', top: 12, right: 12, width: 6, height: 6, borderRadius: 3, background: T.color.accent,
        boxShadow: `0 0 0 2px ${T.color.abyss}` }} />
    </button>
  </header>
);

const MChip = ({ children, active, icon }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 12px', flexShrink: 0,
    borderRadius: T.radius.pill, whiteSpace: 'nowrap',
    background: active ? T.color.accentSoft : 'rgba(154,186,224,0.06)',
    boxShadow: `inset 0 0 0 1px ${active ? T.color.accentLine : T.color.line}`,
    ...sans(13, active ? T.color.accent : T.color.textMed, { fontWeight: 500 }) }}>
    {icon}{children}
  </span>
);

const DiveCard = ({ dv }) => (
  <div style={{ background: T.color.surface1, borderRadius: T.radius.md, padding: 14,
    boxShadow: `inset 0 0 0 1px ${T.color.line}` }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <span style={mono(11, T.color.textLow, { letterSpacing: 0.3 })}>#{dv.no} · {dv.dow} {dv.d}</span>
      <Palanquee ids={dv.team} size={24} max={4} />
    </div>
    <div style={sans(16, T.color.textHigh, { fontWeight: 600, letterSpacing: -0.1 })}>{dv.site}</div>
    <div style={{ ...sans(12, T.color.textLow), marginBottom: 12 }}>{dv.region}</div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', gap: 14 }}>
        {[[dv.depth, 'm', dv.peak], [dv.dur, 'min'], [dv.temp, '°C'], [dv.gas]].map(([v, u, pk], i) => (
          <span key={i} style={mono(15, pk ? T.color.accent : u ? T.color.textHigh : T.color.textMed, { fontWeight: u ? 500 : 400 })}>
            {v}{u && <span style={mono(10, T.color.textLow)}> {u}</span>}
          </span>
        ))}
      </div>
    </div>
  </div>
);

const MobileFrame = ({ height, children }) => (
  <div style={{ width: 375, minHeight: height, position: 'relative', overflow: 'hidden', background: T.color.abyss,
    fontFamily: T.font.sans, color: T.color.textHigh,
    backgroundImage: `radial-gradient(500px 320px at 80% -10%, rgba(79,214,201,0.05), transparent 60%),
                      radial-gradient(400px 250px at -10% 20%, rgba(27,49,86,0.35), transparent 60%)` }}>
    {children}
  </div>
);

const MobileList = () => (
  <>
    <MobileTopBar />
    <div style={{ padding: '20px 20px 0' }}>
      <Overline style={{ color: T.color.accent }}>Carnet · 127 plongées</Overline>
      <h1 style={{ ...sans(T.type.h1.size, T.color.textHigh), lineHeight: `${T.type.h1.lh}px`, fontWeight: 600,
        letterSpacing: T.type.h1.ls, margin: '6px 0 16px' }}>Mes plongées</h1>
      <SearchField width="100%" height={44} />
    </div>
    <div style={{ display: 'flex', gap: 8, padding: '12px 20px', overflow: 'hidden' }}>
      <MChip icon={<Ix.sliders size={15} />}>Filtres</MChip>
      <MChip>Période</MChip><MChip>Région</MChip><MChip>Profondeur</MChip><MChip>Gaz</MChip>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 20px 4px' }}>
      <span style={sans(12, T.color.textLow)}><span style={mono(12, T.color.textMed)}>127</span> plongées · 84 h 23</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...sans(12, T.color.textMed) }}>
        <Ix.sort size={14} /> Plus récentes
      </span>
    </div>
    <div style={{ padding: '0 20px 120px' }}>
      {GROUPS.slice(0, 2).map((g) => (
        <div key={g.month}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '20px 0 10px' }}>
            <span style={sans(14, T.color.textHigh, { fontWeight: 600 })}>{g.month}</span>
            <span style={mono(11, T.color.textLow)}>{g.dives.length} · {g.total}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {g.dives.map((dv) => <DiveCard key={dv.no} dv={dv} />)}
          </div>
        </div>
      ))}
    </div>
  </>
);

const FAB = () => (
  <button aria-label="Nouvelle plongée" style={{ position: 'absolute', bottom: 24, right: 20, width: 56, height: 56,
    borderRadius: 28, border: 'none', background: T.color.accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 0 0 4px rgba(79,214,201,0.15), 0 10px 28px rgba(79,214,201,0.4)' }}>
    <Icons.plus size={22} stroke={T.color.accentInk} sw={2.2} />
  </button>
);

const DivesMobile = () => (
  <MobileFrame height={1440}>
    <MobileList />
    <FAB />
  </MobileFrame>
);

/* ── Mobile — bottom sheet de filtres ───────────────────── */
const SheetSection = ({ title, aside, children }) => (
  <div style={{ padding: '16px 0', borderTop: `1px solid ${T.color.line}` }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
      <Overline style={{ color: T.color.textMed }}>{title}</Overline>
      {aside && <span style={mono(11, T.color.accent)}>{aside}</span>}
    </div>
    {children}
  </div>
);

const DivesMobileFilters = () => (
  <MobileFrame height={812}>
    <div style={{ height: 812, overflow: 'hidden' }}><MobileList /></div>
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(6,12,24,0.6)', backdropFilter: 'blur(4px)' }} />
    <div role="dialog" aria-label="Filtres" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 56,
      background: T.color.surface0, borderRadius: `${T.radius.xl}px ${T.radius.xl}px 0 0`,
      boxShadow: `inset 0 1px 0 ${T.color.lineStrong}, 0 -20px 50px rgba(0,0,0,0.5)`, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
        <span style={{ width: 36, height: 4, borderRadius: 2, background: T.color.lineStrong }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 12px 8px 20px' }}>
        <span style={sans(18, T.color.textHigh, { fontWeight: 600 })}>Filtres</span>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ ...sans(13, T.color.textMed, { fontWeight: 500 }), padding: '0 10px' }}>Réinitialiser</span>
          <button aria-label="Fermer" style={{ width: 44, height: 44, border: 'none', background: 'transparent',
            color: T.color.textLow, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ix.x size={18} /></button>
        </div>
      </div>
      <div style={{ flex: 1, padding: '0 20px', overflow: 'hidden' }}>
        <SheetSection title="Période">
          <div style={{ display: 'flex', padding: 3, borderRadius: T.radius.md, background: T.color.abyss,
            boxShadow: `inset 0 0 0 1px ${T.color.line}` }}>
            {['12 mois', '2026', '2025', 'Tout'].map((p) => (
              <span key={p} style={{ flex: 1, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 8, ...mono(12, p === 'Tout' ? T.color.textHigh : T.color.textLow),
                background: p === 'Tout' ? T.color.surface2 : 'transparent',
                boxShadow: p === 'Tout' ? `inset 0 0 0 1px ${T.color.lineStrong}` : 'none' }}>{p}</span>
            ))}
          </div>
        </SheetSection>
        <SheetSection title="Région" aside="1 sélectionnée">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <MChip active icon={<Ix.check size={14} sw={2} />}>Corse · 31</MChip>
            <MChip>Var · 48</MChip><MChip>Marseille · 22</MChip><MChip>Esterel · 9</MChip><MChip>Bretagne · 17</MChip>
          </div>
        </SheetSection>
        <SheetSection title="Profondeur max" aside="20 – 40 m">
          <div style={{ position: 'relative', height: 28, margin: '0 10px' }}>
            <div style={{ position: 'absolute', left: 0, right: 0, top: 12, height: 4, borderRadius: 2, background: 'rgba(154,186,224,0.14)' }} />
            <div style={{ position: 'absolute', left: '33%', width: '34%', top: 12, height: 4, borderRadius: 2, background: T.color.accent }} />
            {['33%', '67%'].map((l) => (
              <span key={l} style={{ position: 'absolute', left: l, top: 2, width: 24, height: 24, marginLeft: -12, borderRadius: 12,
                background: T.color.textHigh, boxShadow: `0 0 0 4px ${T.color.accentSoft}` }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', ...mono(10, T.color.textLow), marginTop: 4 }}>
            <span>0 m</span><span>20</span><span>40</span><span>60 m</span>
          </div>
        </SheetSection>
        <SheetSection title="Gaz">
          <div style={{ display: 'flex', gap: 8 }}><MChip>Air</MChip><MChip>Nitrox</MChip><MChip>Trimix</MChip></div>
        </SheetSection>
        <SheetSection title="Plongé avec" aside="1 sélectionné">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <MChip active icon={<Avatar id="LB" size={20} ring="transparent" />}>Lucas · 24</MChip>
            <MChip icon={<Avatar id="TN" size={20} ring="transparent" />}>Thao · 18</MChip>
            <MChip icon={<Avatar id="EM" size={20} ring="transparent" />}>Élise · 11</MChip>
            <MChip>+ 11 autres</MChip>
          </div>
        </SheetSection>
      </div>
      <div style={{ padding: '12px 20px 24px', borderTop: `1px solid ${T.color.line}` }}>
        <Btn kind="primary" style={{ width: '100%', height: 48, justifyContent: 'center', fontSize: 15 }}>
          Afficher 9 plongées
        </Btn>
      </div>
    </div>
  </MobileFrame>
);

Object.assign(window, { DivesDesktop, DivesNoResults, DivesEmpty, DivesMobile, DivesMobileFilters });
})();
