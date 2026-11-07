// Mobile 375 — nominal dashboard + drawer variant.

const T = window.DL_TOKENS;
const { Icons, Overline, Card } = window;

/* ── Mobile top bar ─────────────────────── */
const MobileTopBar = ({ onMenu }) => (
  <header style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 20px', position: 'sticky', top: 0, zIndex: 10,
    background: 'rgba(6,12,24,0.85)', backdropFilter: 'blur(12px)',
    borderBottom: `1px solid ${T.color.line}`,
  }}>
    <button aria-label="Ouvrir le menu" onClick={onMenu} style={{
      width: 44, height: 44, marginLeft: -10, background: 'transparent', border: 'none',
      cursor: 'pointer', color: T.color.textHigh, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icons.menu size={20} />
    </button>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 24, height: 24, borderRadius: 6, background: T.color.surface2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `inset 0 0 0 1px ${T.color.accentLine}`,
      }}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke={T.color.accent} strokeWidth="1.6" strokeLinecap="round">
          <path d="M2 6c1.5 0 1.5-1.2 3-1.2S6.5 6 8 6s1.5-1.2 3-1.2S12.5 6 14 6" />
          <path d="M2 10c1.5 0 1.5-1.2 3-1.2S6.5 10 8 10s1.5-1.2 3-1.2S12.5 10 14 10" />
        </svg>
      </div>
      <span style={{ fontFamily: T.font.sans, fontSize: 14, fontWeight: 600, color: T.color.textHigh, letterSpacing: -0.1 }}>DiveLog</span>
    </div>
    <button aria-label="Notifications" style={{
      width: 44, height: 44, marginRight: -10, background: 'transparent', border: 'none',
      cursor: 'pointer', color: T.color.textMed, display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
    }}>
      <Icons.bell size={18} />
      <span style={{ position: 'absolute', top: 12, right: 12, width: 6, height: 6, borderRadius: 3,
        background: T.color.accent, boxShadow: `0 0 0 2px ${T.color.abyss}` }} />
    </button>
  </header>
);

/* ── Mobile KPI tile ─────────────────────── */
const MKPI = ({ label, value, unit, caption }) => (
  <div style={{
    background: T.color.surface1, borderRadius: T.radius.md, padding: 14,
    boxShadow: `inset 0 0 0 1px ${T.color.line}`,
    display: 'flex', flexDirection: 'column', gap: 8, minHeight: 96,
  }}>
    <Overline style={{ fontSize: 10 }}>{label}</Overline>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
      <span style={{ fontFamily: T.font.mono, fontSize: 28, fontWeight: 600, color: T.color.textHigh,
        letterSpacing: -0.6, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      {unit && <span style={{ fontFamily: T.font.mono, fontSize: 12, color: T.color.textLow }}>{unit}</span>}
    </div>
    <div style={{ fontFamily: T.font.sans, fontSize: 11, color: T.color.textLow, lineHeight: 1.4 }}>{caption}</div>
  </div>
);

/* ── Mini map ────────────────────────────── */
const MiniMap = () => (
  <div style={{ height: 280, position: 'relative', borderRadius: T.radius.md, overflow: 'hidden',
    background: `radial-gradient(300px 200px at 50% 55%, rgba(36,64,109,0.5), transparent 70%), ${T.color.surface0}`,
    boxShadow: `inset 0 0 0 1px ${T.color.line}`,
  }}>
    <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.6 }}>
      <defs>
        <pattern id="mMapGrid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0v40" fill="none" stroke={T.color.gridline} strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#mMapGrid)" />
    </svg>
    <svg viewBox="0 0 335 280" width="100%" height="100%" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
      <path d="M0 120 Q 80 100, 140 130 T 280 140 Q 310 150, 335 145"
        fill="none" stroke="rgba(154,186,224,0.14)" strokeWidth="1" />
      <path d="M0 180 Q 100 160, 180 190 T 335 200"
        fill="none" stroke="rgba(154,186,224,0.09)" strokeWidth="1" />
    </svg>
    {[
      { x: 28, y: 48, n: 8, active: true },
      { x: 42, y: 42, n: 5 },
      { x: 55, y: 46, n: 11, big: true },
      { x: 70, y: 52, n: 3 },
      { x: 80, y: 62, n: 2 },
      { x: 38, y: 66, n: 1 },
    ].map((m, i) => {
      const size = m.big ? 30 : m.active ? 28 : 22;
      return (
        <div key={i} style={{ position: 'absolute', left: `${m.x}%`, top: `${m.y}%`, transform: 'translate(-50%,-50%)' }}>
          <div style={{ width: size, height: size, borderRadius: '50%',
            background: m.active ? T.color.accent : T.color.surface2,
            color: m.active ? T.color.accentInk : T.color.textHigh,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: T.font.mono, fontSize: 10, fontWeight: 600,
            boxShadow: m.active ? `0 0 0 2px rgba(79,214,201,0.2), 0 4px 14px rgba(79,214,201,0.3)`
                                 : `inset 0 0 0 1px ${T.color.accentLine}, 0 2px 8px rgba(0,0,0,0.4)`,
          }}>{m.n}</div>
        </div>
      );
    })}
    <div style={{ position: 'absolute', top: 12, left: 14, right: 14, display: 'flex',
      justifyContent: 'space-between', alignItems: 'center' }}>
      <Overline>23 sites · Méditerranée</Overline>
      <button style={{ background: 'rgba(154,186,224,0.06)', border: 'none',
        color: T.color.textMed, padding: '6px 10px', borderRadius: T.radius.sm, cursor: 'pointer',
        fontFamily: T.font.mono, fontSize: 10, letterSpacing: 0.3,
        boxShadow: `inset 0 0 0 1px ${T.color.line}` }}>Agrandir</button>
    </div>
    <div style={{ position: 'absolute', bottom: 12, left: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 40, height: 2, background: T.color.textLow }} />
      <div style={{ fontFamily: T.font.mono, fontSize: 9, color: T.color.textLow, letterSpacing: 0.3 }}>50 km</div>
    </div>
  </div>
);

/* ── Mobile bar chart (simpler) ───────── */
const MBars = () => {
  const months = [['M', 2], ['J', 4], ['J', 7], ['A', 9], ['S', 11], ['O', 6],
    ['N', 3], ['D', 1], ['J', 0], ['F', 2], ['M', 3], ['A', 4]];
  const max = 11;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
        {months.map(([, v], i) => (
          <div key={i} style={{ flex: 1, height: `${Math.max((v/max)*100, 3)}%`, minHeight: v === 0 ? 2 : 6,
            background: v === max ? T.color.accent : 'rgba(154,186,224,0.22)', borderRadius: 2 }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {months.map(([m], i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center',
            fontFamily: T.font.mono, fontSize: 9, color: T.color.textLow }}>{m}</div>
        ))}
      </div>
    </div>
  );
};

/* ── FAB ─────────────────────────────── */
const FAB = () => (
  <button aria-label="Nouvelle plongée" style={{
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28, border: 'none',
    background: T.color.accent, color: T.color.accentInk, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: `0 0 0 4px rgba(79,214,201,0.15), 0 10px 28px rgba(79,214,201,0.4)`,
  }}>
    <Icons.plus size={22} stroke={T.color.accentInk} sw={2.2} />
  </button>
);

/* ── Drawer ─────────────────────────── */
const Drawer = () => {
  const items = [
    ['Dashboard',    Icons.dashboard, true],
    ['Mes plongées', Icons.dives,     false],
    ['Carte',        Icons.map,       false],
    ['Statistiques', Icons.stats,     false],
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 20 }}>
      {/* backdrop */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(6,12,24,0.6)', backdropFilter: 'blur(6px)' }} />
      {/* panel */}
      <aside style={{
        position: 'absolute', top: 0, left: 0, bottom: 0, width: 296,
        background: T.color.surface0,
        borderRight: `1px solid ${T.color.lineStrong}`,
        padding: '16px 16px 20px',
        display: 'flex', flexDirection: 'column',
        boxShadow: `10px 0 40px rgba(0,0,0,0.5)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '4px 4px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: T.color.surface2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `inset 0 0 0 1px ${T.color.accentLine}` }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={T.color.accent} strokeWidth="1.6" strokeLinecap="round">
                <path d="M2 6c1.5 0 1.5-1.2 3-1.2S6.5 6 8 6s1.5-1.2 3-1.2S12.5 6 14 6" />
                <path d="M2 10c1.5 0 1.5-1.2 3-1.2S6.5 10 8 10s1.5-1.2 3-1.2S12.5 10 14 10" />
              </svg>
            </div>
            <span style={{ fontFamily: T.font.sans, fontSize: 15, fontWeight: 600, color: T.color.textHigh, letterSpacing: -0.2 }}>DiveLog</span>
          </div>
          <button aria-label="Fermer" style={{ width: 32, height: 32, background: 'transparent', border: 'none',
            cursor: 'pointer', color: T.color.textLow, fontSize: 22, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '0 14px 8px' }}><Overline>Navigation</Overline></div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          {items.map(([label, Ic, active]) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', gap: 14, height: 48, padding: '0 14px',
              borderRadius: T.radius.md,
              background: active ? T.color.accentSoft : 'transparent',
              color: active ? T.color.accent : T.color.textMed,
              boxShadow: active ? `inset 0 0 0 1px ${T.color.accentLine}` : 'none',
              fontFamily: T.font.sans, fontSize: 15, fontWeight: active ? 500 : 400,
            }}>
              <Ic size={20} />
              <span>{label}</span>
            </div>
          ))}
        </nav>

        <div style={{ padding: 12, borderRadius: T.radius.md,
          background: T.color.surface1, boxShadow: `inset 0 0 0 1px ${T.color.line}`,
          display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 18,
            background: `linear-gradient(135deg, #24406D, #4FD6C9)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: T.font.sans, fontSize: 13, fontWeight: 600, color: T.color.textHigh }}>MR</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: T.font.sans, fontSize: 13, fontWeight: 500, color: T.color.textHigh }}>Marine Rousseau</div>
            <div style={{ fontFamily: T.font.mono, fontSize: 10, color: T.color.textLow, letterSpacing: 0.3 }}>N2 · FFESSM</div>
          </div>
          <button aria-label="Déconnexion" style={{ width: 32, height: 32, background: 'transparent', border: 'none',
            cursor: 'pointer', color: T.color.textLow, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icons.logout size={16} />
          </button>
        </div>
      </aside>
    </div>
  );
};

/* ── Mobile frame wrapper ───────────────── */
const MobileFrame = ({ children, withDrawer }) => (
  <div style={{
    width: 375, minHeight: 812, position: 'relative', overflow: 'hidden',
    background: T.color.abyss, fontFamily: T.font.sans, color: T.color.textHigh,
    backgroundImage: `radial-gradient(500px 320px at 80% -10%, rgba(79,214,201,0.05), transparent 60%),
                      radial-gradient(400px 250px at -10% 20%, rgba(27,49,86,0.35), transparent 60%)`,
  }}>
    {children}
    {withDrawer && <Drawer />}
  </div>
);

/* ── Mobile nominal page ─────────────── */
const MobileNominal = () => (
  <MobileFrame>
    <MobileTopBar />
    <div style={{ padding: '20px 20px 100px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <Overline style={{ color: T.color.accent, fontSize: 10 }}>JEU. 22 AVR. · 14:08</Overline>
        <h1 style={{ fontFamily: T.font.sans, fontSize: 26, lineHeight: '30px', fontWeight: 600,
          letterSpacing: -0.6, color: T.color.textHigh, margin: '8px 0 6px' }}>
          Tableau de bord
        </h1>
        <div style={{ fontFamily: T.font.sans, fontSize: 13, color: T.color.textMed }}>
          Bonjour Marine. <span style={{ color: T.color.textLow }}>14 jours depuis ta dernière plongée.</span>
        </div>
      </div>

      {/* KPI grid 2x2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        <MKPI label="Plongées" value="127" caption="+3 ce mois" />
        <MKPI label="Temps" value="84" unit="h" caption="moy. 39 min" />
        <MKPI label="Prof. max" value="42" unit="m" caption="Revellata · sept." />
        <MKPI label="Sites" value="23" caption="6 régions" />
      </div>

      {/* Map */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <div style={{ fontFamily: T.font.sans, fontSize: 16, fontWeight: 600, color: T.color.textHigh,
            letterSpacing: -0.2 }}>Carte</div>
          <button style={{ background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: T.font.sans, fontSize: 12, color: T.color.accent, fontWeight: 500 }}>Tous les sites →</button>
        </div>
        <MiniMap />
      </div>

      {/* Last dive */}
      <Card elev={1} pad={18} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <Overline>Dernière plongée</Overline>
            <div style={{ fontFamily: T.font.sans, fontSize: 16, fontWeight: 600, color: T.color.textHigh,
              marginTop: 6, letterSpacing: -0.2 }}>Pointe de la Revellata</div>
            <div style={{ fontFamily: T.font.sans, fontSize: 12, color: T.color.textMed, marginTop: 2 }}>
              Calvi, Corse · 08 sept.
            </div>
          </div>
          <span style={{ padding: '4px 8px', background: 'rgba(91,211,145,0.12)', color: T.color.success,
            borderRadius: T.radius.pill, fontFamily: T.font.mono, fontSize: 9, letterSpacing: 0.3 }}>OK</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[['PROF', '42', 'm'], ['DURÉE', '38', 'min'], ['TEMP', '14', '°'], ['VIS', '25', 'm']].map(([k, v, u]) => (
            <div key={k}>
              <Overline style={{ fontSize: 9 }}>{k}</Overline>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginTop: 4 }}>
                <span style={{ fontFamily: T.font.mono, fontSize: 18, fontWeight: 600, color: T.color.textHigh,
                  letterSpacing: -0.4, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
                <span style={{ fontFamily: T.font.mono, fontSize: 10, color: T.color.textLow }}>{u}</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ paddingTop: 14, marginTop: 14, borderTop: `1px solid ${T.color.line}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: T.font.sans, fontSize: 11, color: T.color.textLow }}>
            avec <span style={{ color: T.color.textMed }}>L. Bernard</span>, <span style={{ color: T.color.textMed }}>T. Nguyen</span>
          </div>
          <button style={{ background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: T.font.sans, fontSize: 12, color: T.color.accent, fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}>
            Détail <Icons.arrowRight size={12} stroke={T.color.accent} />
          </button>
        </div>
      </Card>

      {/* Bar chart */}
      <Card elev={1} pad={18} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <div>
            <Overline>Plongées · 12 mois</Overline>
            <div style={{ fontFamily: T.font.sans, fontSize: 14, fontWeight: 600, color: T.color.textHigh, marginTop: 4 }}>52 plongées</div>
          </div>
          <div style={{ fontFamily: T.font.mono, fontSize: 10, color: T.color.accent }}>pic · sept.</div>
        </div>
        <MBars />
      </Card>

      {/* Buddies */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <Overline>Binômes fréquents</Overline>
          <button style={{ background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: T.font.sans, fontSize: 12, color: T.color.accent, fontWeight: 500 }}>Tous →</button>
        </div>
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', margin: '0 -20px', padding: '0 20px' }}>
          {[['LB', 'L. Bernard', 24, '#3a5a82'], ['TN', 'T. Nguyen', 18, '#2a6a6a'],
            ['EM', 'É. Marchand', 11, '#5a3a7a'], ['RP', 'R. Pascal', 9, '#3a7a5a'],
            ['SB', 'S. Barros', 6, '#7a5a3a']].map(([i, n, c, col]) => (
            <div key={i} style={{ flexShrink: 0, width: 140, padding: 12, borderRadius: T.radius.md,
              background: T.color.surface1, boxShadow: `inset 0 0 0 1px ${T.color.line}`,
              display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 16, background: col,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: T.font.sans, fontSize: 11, fontWeight: 600, color: T.color.textHigh }}>{i}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: T.font.sans, fontSize: 12, fontWeight: 500, color: T.color.textHigh,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n}</div>
                <div style={{ fontFamily: T.font.mono, fontSize: 10, color: T.color.textLow }}>{c} ×</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
    <FAB />
  </MobileFrame>
);

const MobileDrawer = () => (
  <MobileFrame withDrawer>
    <MobileTopBar />
    <div style={{ padding: '20px 20px', opacity: 0.4 }}>
      <Overline style={{ color: T.color.accent, fontSize: 10 }}>JEU. 22 AVR.</Overline>
      <h1 style={{ fontFamily: T.font.sans, fontSize: 26, lineHeight: '30px', fontWeight: 600,
        letterSpacing: -0.6, color: T.color.textHigh, margin: '8px 0 0' }}>Tableau de bord</h1>
    </div>
  </MobileFrame>
);

window.MobileNominal = MobileNominal;
window.MobileDrawer = MobileDrawer;
