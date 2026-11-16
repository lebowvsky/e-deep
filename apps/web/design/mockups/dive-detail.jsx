// "Détail d'une plongée" — #127 Pointe de la Revellata.
// Desktop 1440 + mobile 375 + variante de la carte profil sans données d'ordinateur.
// Uses DL_TOKENS + atoms (Icon, Icons, Overline, Btn, Card). IIFE: no global name collisions.

(function () {
const T = window.DL_TOKENS;
const { Icon, Icons, Overline, Btn, Card } = window;

/* ── Extra icons ─────────────────────────────────────────── */
const Ix = {
  chevronLeft: (p) => <Icon {...p} d="M15 6l-6 6 6 6" />,
  pencil: (p) => <Icon {...p}><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="m13.5 6.5 4 4" /></Icon>,
  more: (p) => <Icon {...p}><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></Icon>,
  tank: (p) => <Icon {...p}><rect x="8" y="6" width="8" height="15" rx="4" /><path d="M10 6V4h4v2" /><path d="M12 2v2" /></Icon>,
  sun: (p) => <Icon {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Icon>,
  note: (p) => <Icon {...p}><path d="M5 3h10l4 4v14H5z" /><path d="M15 3v4h4" /><path d="M8 12h8M8 16h5" /></Icon>,
  users: (p) => <Icon {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7" /><path d="M18 14a6.5 6.5 0 0 1 3.5 6" /></Icon>,
  profile: (p) => <Icon {...p}><path d="M2 5h3l3 9 4 2 4 1 3-12h3" /></Icon>,
};

/* ── Données — cohérentes avec « Mes plongées » #127 ─────── */
const DIVE = {
  no: 127, date: 'mer. 08 avr. 2026', time: '14:20',
  site: 'Pointe de la Revellata', region: 'Calvi · Corse · Méditerranée',
  depth: 42, dur: 38, tempBottom: 14, visi: 25,
};

const TEAM = [
  { id: 'MR', n: 'Marine Rousseau', lvl: 'N2', self: true },
  { id: 'LB', n: 'Lucas Bernard', lvl: 'N3', c: '#3a5a82', together: 24 },
  { id: 'TN', n: 'Thao Nguyen', lvl: 'N2', c: '#2a6a6a', together: 18 },
];

// Profil (minutes, mètres) — ordinateur de plongée.
const PROFILE = [
  [0, 0], [1, 9], [2.5, 24], [4, 38], [5, 42], [6.5, 41], [8, 37], [10, 34], [12, 31], [14, 29], [16, 26],
  [18, 24], [20, 21], [22, 18], [24, 15], [26, 12], [28, 9], [29.5, 6], [30.5, 5], [33.5, 5], [35, 3], [36.5, 1], [38, 0],
];

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

const Avatar = ({ m, size = 36 }) => (
  <div style={{ width: size, height: size, borderRadius: size / 2, flexShrink: 0,
    background: m.self ? T.color.surface0 : m.c,
    boxShadow: m.self ? `inset 0 0 0 1px ${T.color.lineStrong}` : 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    ...sans(size * 0.36, m.self ? T.color.textMed : T.color.textHigh, { fontWeight: 600 }) }}>{m.id}</div>
);

const CardHead = ({ icon, title, aside }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.color.textLow }}>
      {icon}<Overline>{title}</Overline>
    </div>
    {aside}
  </div>
);

const Tag = ({ children, tone = 'neutral' }) => {
  const tones = {
    neutral: ['rgba(154,186,224,0.08)', T.color.textMed],
    success: ['rgba(91,211,145,0.12)', T.color.success],
    accent: [T.color.accentSoft, T.color.accent],
  };
  const [bg, fg] = tones[tone];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: T.radius.pill,
      background: bg, whiteSpace: 'nowrap', ...mono(11, fg, { letterSpacing: 0.2 }) }}>{children}</span>
  );
};

const LinkText = ({ children, size = 13 }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
    ...sans(size, T.color.accent, { fontWeight: 500 }) }}>{children}<Icons.arrowRight size={14} /></span>
);

/* Key / value rows (paramètres, conditions) */
const KV = ({ k, v, unit, sub, missing, last }) => (
  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, padding: '11px 0',
    borderBottom: last ? 'none' : `1px solid ${T.color.line}` }}>
    <span style={sans(13, T.color.textLow)}>{k}</span>
    {missing ? (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        <span style={mono(14, T.color.textMuted)}>—</span>
        <span style={{ ...sans(12, T.color.accent, { fontWeight: 500 }), cursor: 'pointer' }}>Compléter</span>
      </span>
    ) : (
      <span style={{ textAlign: 'right' }}>
        <span style={/\d/.test(v) ? mono(14, T.color.textHigh) : sans(14, T.color.textHigh, { fontWeight: 500 })}>{v}</span>
        {unit && <span style={mono(11, T.color.textLow)}> {unit}</span>}
        {sub && <span style={{ display: 'block', ...sans(11, T.color.textLow), marginTop: 2 }}>{sub}</span>}
      </span>
    )}
  </div>
);

/* ── Sidebar (Mes plongées actif) ───────────────────────── */
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
        const active = label === 'Mes plongées';
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, height: 44, padding: '0 14px',
            borderRadius: T.radius.md, position: 'relative',
            background: active ? T.color.accentSoft : 'transparent',
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

/* ── Profil de plongée (SVG) ────────────────────────────── */
const DiveProfile = ({ w = 760, h = 250, compact }) => {
  const padL = compact ? 30 : 40, padR = 12, padT = 12, padB = 26;
  const maxT = 38, maxD = 45;
  const x = (t) => padL + (t / maxT) * (w - padL - padR);
  const y = (d) => padT + (d / maxD) * (h - padT - padB);
  const line = PROFILE.map(([t, d], i) => `${i ? 'L' : 'M'}${x(t).toFixed(1)} ${y(d).toFixed(1)}`).join(' ');
  const area = `${line} L${x(maxT)} ${y(0)} L${x(0)} ${y(0)} Z`;
  const depthTicks = compact ? [0, 20, 40] : [0, 10, 20, 30, 40];
  const timeTicks = compact ? [0, 10, 20, 30, 38] : [0, 5, 10, 15, 20, 25, 30, 35, 38];
  const gid = compact ? 'pfm' : 'pfd';
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} role="img"
      aria-label="Profil de plongée : descente à 42 mètres en 5 minutes, remontée progressive, palier de 3 minutes à 5 mètres, sortie à 38 minutes."
      style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(79,214,201,0.02)" />
          <stop offset="1" stopColor="rgba(79,214,201,0.16)" />
        </linearGradient>
      </defs>
      {depthTicks.map((d) => (
        <g key={d}>
          <line x1={padL} x2={w - padR} y1={y(d)} y2={y(d)} stroke={d === 0 ? T.color.lineStrong : T.color.gridline} strokeWidth="1" />
          <text x={padL - 8} y={y(d) + 3.5} textAnchor="end" style={mono(10, T.color.textLow)} fill={T.color.textLow}>{d}{d === 0 ? '' : ' m'}</text>
        </g>
      ))}
      {timeTicks.map((t) => (
        <text key={t} x={x(t)} y={h - 8} textAnchor="middle" style={mono(10, T.color.textLow)} fill={T.color.textLow}>{t}{t === maxT ? "'" : ''}</text>
      ))}
      {/* palier de sécurité */}
      <rect x={x(30.5)} y={y(5) - 5} width={x(33.5) - x(30.5)} height="10" rx="3" fill="rgba(91,211,145,0.18)" />
      {!compact && (
        <text x={x(32)} y={y(5) + 22} textAnchor="middle" style={mono(10, T.color.success)} fill={T.color.success}>palier 3' · 5 m</text>
      )}
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke="rgba(175,193,214,0.75)" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      {/* max depth marker */}
      <line x1={x(5)} x2={x(5)} y1={y(0)} y2={y(42)} stroke={T.color.accentLine} strokeDasharray="3 4" />
      <circle cx={x(5)} cy={y(42)} r="9" fill={T.color.accentSoft} />
      <circle cx={x(5)} cy={y(42)} r="4" fill={T.color.accent} />
      <g transform={`translate(${x(5) + 12}, ${y(42) - 8})`}>
        <rect width={compact ? 64 : 86} height="20" rx="5" fill={T.color.surface2} stroke={T.color.accentLine} />
        <text x="8" y="14" style={mono(11, T.color.accent)} fill={T.color.accent}>{compact ? '42 m' : '42 m · 5\''}</text>
      </g>
    </svg>
  );
};

const ProfileCard = ({ compact }) => (
  <Card elev={1} pad={compact ? 16 : 24}>
    <CardHead icon={<Ix.profile size={14} />} title="Profil de plongée"
      aside={<Tag tone="accent">V2 · importé (UDDF)</Tag>} />
    <DiveProfile compact={compact} w={compact ? 320 : 760} h={compact ? 170 : 250} />
    <div style={{ display: 'grid', gridTemplateColumns: compact ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: compact ? 12 : 16,
      marginTop: 16, paddingTop: 16, borderTop: `1px solid ${T.color.line}` }}>
      {[['Descente', '5', 'min'], ['Remontée moy.', '9', 'm/min'], ['Palier de sécurité', '3', 'min à 5 m'], ['Prof. moyenne', '23', 'm']].map(([k, v, u]) => (
        <div key={k}>
          <div style={sans(12, T.color.textLow)}>{k}</div>
          <div style={{ marginTop: 4 }}><span style={mono(16, T.color.textHigh, { fontWeight: 500 })}>{v}</span>
            <span style={mono(11, T.color.textLow)}> {u}</span></div>
        </div>
      ))}
    </div>
  </Card>
);

/* V1 — Déroulé de la plongée (saisie manuelle, pas de courbe) */
const RunCard = ({ compact }) => {
  const palierPct = (3 / 38) * 100;
  const Cell = ({ k, v, u }) => (
    <div>
      <div style={sans(12, T.color.textLow)}>{k}</div>
      <div style={{ marginTop: 4 }}><span style={/\d/.test(v) ? mono(16, T.color.textHigh, { fontWeight: 500 }) : sans(15, T.color.textHigh, { fontWeight: 500 })}>{v}</span>
        {u && <span style={mono(11, T.color.textLow)}> {u}</span>}</div>
    </div>
  );
  return (
    <Card elev={1} pad={compact ? 16 : 24}>
      <CardHead icon={<Ix.profile size={14} />} title="Déroulé de la plongée" aside={<Tag>Saisie manuelle</Tag>} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
        <div><div style={sans(12, T.color.textLow)}>Immersion</div><div style={mono(compact ? 18 : 22, T.color.textHigh, { fontWeight: 600 })}>14:20</div></div>
        <div style={{ textAlign: 'center' }}>
          <span style={mono(compact ? 18 : 22, T.color.textHigh, { fontWeight: 600 })}>38</span>
          <span style={mono(12, T.color.textLow)}> min</span>
        </div>
        <div style={{ textAlign: 'right' }}><div style={sans(12, T.color.textLow)}>Sortie</div><div style={mono(compact ? 18 : 22, T.color.textHigh, { fontWeight: 600 })}>14:58</div></div>
      </div>
      <div aria-hidden="true" style={{ position: 'relative', height: 10, borderRadius: 5, background: T.color.surface0,
        boxShadow: `inset 0 0 0 1px ${T.color.line}`, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, right: `${palierPct}%`, background: 'rgba(175,193,214,0.28)' }} />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${palierPct}%`, background: T.color.success, opacity: 0.75 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
        <span style={mono(10, T.color.success)}>palier 3 min à 5 m</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: compact ? 10 : 16,
        marginTop: 14, paddingTop: 16, borderTop: `1px solid ${T.color.line}` }}>
        <Cell k="Palier de sécurité" v="3" u="min à 5 m" />
        <Cell k="Paliers de déco." v="Aucun" />
        <Cell k="Successive" v="Non" />
      </div>
    </Card>
  );
};

/* V2 — même carte une fois l'import de fichier disponible (courbe réelle) */
const ProfileCardV2 = () => (
  <div style={{ width: 760, padding: 24, background: T.color.abyss, fontFamily: T.font.sans }}>
    <ProfileCard />
  </div>
);

/* ── KPI ───────────────────────────────────────────────── */
const KPI = ({ label, value, unit, caption, accent, compact }) => (
  <Card elev={1} pad={compact ? 14 : 20} style={{ minHeight: compact ? 96 : 124, display: 'flex', flexDirection: 'column',
    justifyContent: 'space-between', borderRadius: compact ? T.radius.md : T.radius.lg }}>
    <Overline style={compact ? { fontSize: 10 } : undefined}>{label}</Overline>
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 8 }}>
        <span style={mono(compact ? 28 : 40, accent ? T.color.accent : T.color.textHigh,
          { fontWeight: 600, letterSpacing: compact ? -0.6 : -1, lineHeight: 1 })}>{value}</span>
        <span style={mono(compact ? 12 : 15, T.color.textLow)}>{unit}</span>
      </div>
      <div style={{ ...sans(compact ? 11 : 12, T.color.textLow), marginTop: 6 }}>{caption}</div>
    </div>
  </Card>
);

const KPIS = [
  ['Profondeur max', '42', 'm', 'Ton record personnel', true],
  ['Durée', '38', 'min', 'Sortie à 14:58'],
  ['Temp. fond', '14', '°C', 'Surface 16 °C'],
  ['Visibilité', '25', 'm', 'Bonne'],
];

/* ── Blocs de contenu ──────────────────────────────────── */
const PalanqueeCard = ({ compact }) => (
  <Card elev={1} pad={compact ? 16 : 24}>
    <CardHead icon={<Ix.users size={14} />} title="Palanquée · 3 plongeurs" />
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {TEAM.map((m, i) => (
        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
          borderTop: i ? `1px solid ${T.color.line}` : 'none' }}>
          <Avatar m={m} size={compact ? 32 : 36} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={sans(14, T.color.textHigh, { fontWeight: 500 })}>
              {m.n}{m.self && <span style={sans(12, T.color.textLow, { fontWeight: 400 })}> · toi</span>}
            </div>
            <div style={mono(11, T.color.textLow)}>{m.self ? 'N2 · FFESSM' : `${m.together} plongées ensemble`}</div>
          </div>
          <Tag>{m.lvl}</Tag>
        </div>
      ))}
    </div>
  </Card>
);

const ParamsCard = ({ compact }) => (
  <Card elev={1} pad={compact ? 16 : 24}>
    <CardHead icon={<Ix.tank size={14} />} title="Équipement & gaz" />
    <KV k="Gaz" v="Air" sub="21 % O₂" />
    <KV k="Bloc" v="12" unit="L · acier" />
    <KV k="Pression" v="200 → 60" unit="bar" sub="140 bar consommés" />
    <KV k="Combinaison" v="7 mm" unit="· semi-étanche" />
    <KV k="Lest" missing last />
  </Card>
);

const ConditionsCard = ({ compact }) => (
  <Card elev={1} pad={compact ? 16 : 24}>
    <CardHead icon={<Ix.sun size={14} />} title="Conditions" />
    <KV k="Type" v="Bateau · jour" />
    <KV k="Météo" v="Ensoleillé" sub="Air 19 °C" />
    <KV k="Mer" v="Calme" />
    <KV k="Courant" v="Faible" />
    <KV k="Eau" v="16 → 14" unit="°C" sub="surface → fond" />
    <KV k="Structure" v="Calvi Plongée" last />
  </Card>
);

const NotesCard = ({ compact }) => (
  <Card elev={1} pad={compact ? 16 : 24}>
    <CardHead icon={<Ix.note size={14} />} title="Notes & observations" />
    <p style={{ margin: 0, ...sans(compact ? 14 : 15, T.color.textMed, { lineHeight: 1.6 }), maxWidth: 680 }}>
      Belle descente le long du tombant. Banc de barracudas vers 30 m, deux mérous sous la roche à 38 m.
      Gorgones rouges magnifiques sur toute la paroi. Courant faible à la remontée, palier tranquille au mouillage.
    </p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
      <Tag>Mérou brun · 2</Tag><Tag>Barracudas</Tag><Tag>Gorgones rouges</Tag><Tag>Corb</Tag><Tag>Murène</Tag>
    </div>
  </Card>
);

const MiniMap = ({ h = 180 }) => (
  <div style={{ height: h, borderRadius: T.radius.md, position: 'relative', overflow: 'hidden',
    background: `radial-gradient(400px 200px at 40% 60%, rgba(27,49,86,0.6), transparent 70%), ${T.color.surface0}`,
    boxShadow: `inset 0 0 0 1px ${T.color.line}` }}>
    <svg width="100%" height="100%" viewBox="0 0 320 180" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
      <defs><pattern id="mmgrid" width="32" height="32" patternUnits="userSpaceOnUse">
        <path d="M32 0H0v32" fill="none" stroke={T.color.gridline} strokeWidth="1" /></pattern></defs>
      <rect width="320" height="180" fill="url(#mmgrid)" />
      <path d="M190 0 C 180 30, 210 50, 200 80 S 230 120, 250 140 S 300 160, 320 150 L320 0 Z" fill={T.color.surface1} />
      <path d="M190 0 C 180 30, 210 50, 200 80 S 230 120, 250 140 S 300 160, 320 150" fill="none" stroke={T.color.lineStrong} strokeWidth="1" />
      <path d="M0 120 Q 80 110, 140 130 T 320 170" fill="none" stroke="rgba(154,186,224,0.06)" />
    </svg>
    <div style={{ position: 'absolute', left: '58%', top: '46%', transform: 'translate(-50%,-50%)' }}>
      <div style={{ width: 28, height: 28, borderRadius: 14, background: T.color.accentSoft, display: 'flex',
        alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 0 1px ${T.color.accentLine}` }}>
        <div style={{ width: 10, height: 10, borderRadius: 5, background: T.color.accent }} />
      </div>
    </div>
    <span style={{ position: 'absolute', left: 12, bottom: 10, ...mono(10, T.color.textLow) }}>42.580° N · 8.725° E</span>
  </div>
);

const SiteCard = ({ compact }) => (
  <Card elev={1} pad={compact ? 16 : 20}>
    <CardHead icon={<Icons.pin size={14} />} title="Site" />
    <MiniMap h={compact ? 150 : 170} />
    <div style={{ marginTop: 14 }}>
      <div style={sans(16, T.color.textHigh, { fontWeight: 600 })}>Pointe de la Revellata</div>
      <div style={sans(12, T.color.textLow)}>Calvi · Corse</div>
    </div>
    <div style={{ display: 'flex', gap: 24, marginTop: 14 }}>
      <div><div style={sans(12, T.color.textLow)}>Tes plongées ici</div><div style={mono(16, T.color.textHigh, { fontWeight: 500 })}>8</div></div>
      <div><div style={sans(12, T.color.textLow)}>Ta prof. max ici</div><div style={mono(16, T.color.textHigh, { fontWeight: 500 })}>42 <span style={mono(11, T.color.textLow)}>m</span></div></div>
    </div>
    <div style={{ marginTop: 14 }}><LinkText>Toutes mes plongées ici</LinkText></div>
  </Card>
);

/* ──────────────────────────────────────────────
   DESKTOP 1440
   ────────────────────────────────────────────── */
const NavBtn = ({ children, disabled, label }) => (
  <div aria-label={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 40, padding: '0 12px',
    borderRadius: T.radius.md, boxShadow: `inset 0 0 0 1px ${T.color.line}`, cursor: disabled ? 'default' : 'pointer',
    ...mono(12, disabled ? T.color.textMuted : T.color.textMed) }}>{children}</div>
);

const DiveDetailDesktop = () => (
  <div style={{ width: 1440, minHeight: 1220, background: T.color.abyss, display: 'flex', fontFamily: T.font.sans,
    color: T.color.textHigh,
    backgroundImage: `radial-gradient(1200px 600px at 80% -10%, rgba(79,214,201,0.04), transparent 60%),
                      radial-gradient(900px 500px at 10% 30%, rgba(27,49,86,0.35), transparent 60%)` }}>
    <Sidebar />
    <main style={{ flex: 1, padding: '28px 48px 48px', minWidth: 0 }}>
      {/* Breadcrumb + prev/next */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <nav aria-label="Fil d'Ariane" style={{ display: 'flex', alignItems: 'center', gap: 8, ...sans(13, T.color.textLow) }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: T.color.textMed, cursor: 'pointer' }}>
            <Ix.chevronLeft size={16} /> Mes plongées
          </span>
          <span style={{ color: T.color.textMuted }}>/</span>
          <span style={mono(13, T.color.textLow)}>#127</span>
        </nav>
        <div style={{ display: 'flex', gap: 8 }}>
          <NavBtn label="Plongée précédente"><Ix.chevronLeft size={14} /> #126 · La Bibliothèque</NavBtn>
          <NavBtn disabled label="Plongée suivante">#128 <Icons.chevronRight size={14} /></NavBtn>
        </div>
      </div>

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Overline style={{ color: T.color.accent }}>Plongée #127</Overline>
            <span style={{ width: 4, height: 4, borderRadius: 2, background: T.color.textMuted }} />
            <Overline>{DIVE.date} · {DIVE.time}</Overline>
          </div>
          <h1 style={{ margin: 0, ...sans(T.type.display.size, T.color.textHigh), lineHeight: `${T.type.display.lh}px`,
            fontWeight: T.type.display.w, letterSpacing: T.type.display.ls }}>{DIVE.site}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
            <span style={sans(15, T.color.textMed)}>{DIVE.region}</span>
            <Tag tone="success">Palier OK</Tag><Tag>Air</Tag><Tag>Bateau</Tag>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn kind="secondary" icon={<Ix.pencil size={16} />}>Modifier ma plongée</Btn>
          <button aria-label="Plus d'actions" style={{ width: 40, height: 40, borderRadius: T.radius.md, border: 'none',
            background: 'rgba(154,186,224,0.06)', color: T.color.textMed, boxShadow: `inset 0 0 0 1px ${T.color.lineStrong}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Ix.more size={18} /></button>
        </div>
      </header>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {KPIS.map(([l, v, u, c, a]) => <KPI key={l} label={l} value={v} unit={u} caption={c} accent={a} />)}
      </div>

      {/* Content grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <RunCard />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <ParamsCard /><ConditionsCard />
          </div>
          <NotesCard />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SiteCard />
          <PalanqueeCard />
          <div style={{ padding: '4px 4px 0', ...sans(12, T.color.textLow, { lineHeight: 1.6 }) }}>
            Site, date et palanquée sont partagés entre les plongeurs. Tes mesures, ton équipement et tes notes n'appartiennent qu'à toi.
            <div style={{ ...mono(10, T.color.textMuted), marginTop: 8, letterSpacing: 0.3 }}>Créée le 08 avr. 2026 · modifiée le 09 avr.</div>
          </div>
        </div>
      </div>
    </main>
  </div>
);

/* ──────────────────────────────────────────────
   MOBILE 375
   ────────────────────────────────────────────── */
const DiveDetailMobile = () => (
  <div style={{ width: 375, minHeight: 2450, position: 'relative', background: T.color.abyss, fontFamily: T.font.sans,
    color: T.color.textHigh,
    backgroundImage: `radial-gradient(500px 320px at 80% -10%, rgba(79,214,201,0.05), transparent 60%),
                      radial-gradient(400px 250px at -10% 20%, rgba(27,49,86,0.35), transparent 60%)` }}>
    {/* Top bar : retour + actions */}
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 12px 14px 10px',
      background: 'rgba(6,12,24,0.85)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${T.color.line}` }}>
      <button aria-label="Retour à Mes plongées" style={{ height: 44, padding: '0 8px', display: 'flex', alignItems: 'center', gap: 4,
        background: 'transparent', border: 'none', ...sans(14, T.color.textHigh, { fontWeight: 500 }) }}>
        <Ix.chevronLeft size={20} /> Mes plongées
      </button>
      <div style={{ display: 'flex' }}>
        <button aria-label="Modifier ma plongée" style={{ width: 44, height: 44, background: 'transparent', border: 'none',
          color: T.color.textMed, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ix.pencil size={18} /></button>
        <button aria-label="Plus d'actions" style={{ width: 44, height: 44, background: 'transparent', border: 'none',
          color: T.color.textMed, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ix.more size={20} /></button>
      </div>
    </header>

    <div style={{ padding: '20px 20px 0' }}>
      <Overline style={{ color: T.color.accent }}>Plongée #127 · 08 avr. 2026 · 14:20</Overline>
      <h1 style={{ margin: '8px 0 4px', ...sans(26, T.color.textHigh), lineHeight: '30px', fontWeight: 600, letterSpacing: -0.5 }}>
        {DIVE.site}
      </h1>
      <div style={sans(13, T.color.textMed)}>Calvi · Corse</div>
      <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
        <Tag tone="success">Palier OK</Tag><Tag>Air</Tag><Tag>Bateau</Tag>
      </div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '20px 20px 0' }}>
      {KPIS.map(([l, v, u, c, a]) => <KPI key={l} label={l} value={v} unit={u} caption={c} accent={a} compact />)}
    </div>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 20px 0' }}>
      <RunCard compact />
      <PalanqueeCard compact />
      <ParamsCard compact />
      <ConditionsCard compact />
      <NotesCard compact />
      <SiteCard compact />
      <div style={{ padding: '4px 2px', ...sans(12, T.color.textLow, { lineHeight: 1.6 }) }}>
        Site, date et palanquée sont partagés entre les plongeurs. Tes mesures, ton équipement et tes notes n'appartiennent qu'à toi.
      </div>
    </div>

    {/* Précédente / suivante */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '16px 20px 32px' }}>
      <div style={{ padding: '12px 14px', borderRadius: T.radius.md, boxShadow: `inset 0 0 0 1px ${T.color.line}`, minHeight: 64 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, ...mono(11, T.color.textLow) }}><Ix.chevronLeft size={12} /> #126</div>
        <div style={sans(13, T.color.textHigh, { fontWeight: 500, marginTop: 4 })}>La Bibliothèque</div>
      </div>
      <div style={{ padding: '12px 14px', borderRadius: T.radius.md, boxShadow: `inset 0 0 0 1px ${T.color.line}`, minHeight: 64,
        textAlign: 'right', opacity: 0.45 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, ...mono(11, T.color.textLow) }}>#128 <Icons.chevronRight size={12} /></div>
        <div style={sans(13, T.color.textLow, { marginTop: 4 })}>Dernière plongée</div>
      </div>
    </div>
  </div>
);

Object.assign(window, { DiveDetailDesktop, DiveDetailMobile, ProfileCardV2 });
})();
