// Desktop 1440 dashboard — nominal state.

const T = window.DL_TOKENS;
const { Icons, Overline, Btn, Card } = window;

/* ── Sidebar ────────────────────────────── */
const SidebarItem = ({ icon: Ic, label, active }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12,
    height: 44, padding: '0 14px', borderRadius: T.radius.md,
    background: active ? T.color.accentSoft : 'transparent',
    color: active ? T.color.accent : T.color.textMed,
    boxShadow: active ? `inset 0 0 0 1px ${T.color.accentLine}` : 'none',
    fontFamily: T.font.sans, fontSize: 14, fontWeight: active ? 500 : 400,
    cursor: 'pointer', position: 'relative',
  }}>
    <Ic size={18} />
    <span>{label}</span>
    {active && (
      <span style={{ position: 'absolute', left: -20, top: 10, width: 3, height: 24, borderRadius: 2,
        background: T.color.accent, boxShadow: `0 0 10px ${T.color.accent}` }} />
    )}
  </div>
);

const Sidebar = () => (
  <aside style={{
    width: 240, flexShrink: 0,
    background: T.color.surface0,
    borderRight: `1px solid ${T.color.line}`,
    display: 'flex', flexDirection: 'column',
    padding: '28px 20px',
    position: 'sticky', top: 0, alignSelf: 'stretch', minHeight: '100%',
  }}>
    {/* Logo */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 6px', marginBottom: 36 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8, background: T.color.surface2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `inset 0 0 0 1px ${T.color.accentLine}`,
      }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={T.color.accent} strokeWidth="1.6" strokeLinecap="round">
          <path d="M2 6c1.5 0 1.5-1.2 3-1.2S6.5 6 8 6s1.5-1.2 3-1.2S12.5 6 14 6" />
          <path d="M2 10c1.5 0 1.5-1.2 3-1.2S6.5 10 8 10s1.5-1.2 3-1.2S12.5 10 14 10" />
        </svg>
      </div>
      <div style={{ fontFamily: T.font.sans, fontSize: 15, fontWeight: 600, color: T.color.textHigh, letterSpacing: -0.2 }}>
        DiveLog
      </div>
    </div>

    {/* Nav */}
    <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
      <div style={{ padding: '0 14px 8px' }}>
        <Overline>Navigation</Overline>
      </div>
      <SidebarItem icon={Icons.dashboard} label="Dashboard" active />
      <SidebarItem icon={Icons.dives} label="Mes plongées" />
      <SidebarItem icon={Icons.map} label="Carte" />
      <SidebarItem icon={Icons.stats} label="Statistiques" />
    </nav>

    {/* User */}
    <div style={{
      marginTop: 24, padding: 12, borderRadius: T.radius.md,
      display: 'flex', alignItems: 'center', gap: 12,
      background: T.color.surface1,
      boxShadow: `inset 0 0 0 1px ${T.color.line}`,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 18,
        background: `linear-gradient(135deg, #24406D, #4FD6C9)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: T.font.sans, fontSize: 13, fontWeight: 600, color: T.color.textHigh,
      }}>MR</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: T.font.sans, fontSize: 13, fontWeight: 500, color: T.color.textHigh,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Marine Rousseau</div>
        <div style={{ fontFamily: T.font.mono, fontSize: 10, color: T.color.textLow, letterSpacing: 0.3 }}>N2 · FFESSM</div>
      </div>
      <button style={{ background: 'transparent', border: 'none', cursor: 'pointer',
        color: T.color.textLow, width: 28, height: 28, borderRadius: 6, display: 'flex',
        alignItems: 'center', justifyContent: 'center' }}>
        <Icons.chevronDown size={14} />
      </button>
    </div>
  </aside>
);

/* ── Top header ──────────────────────────── */
const DashHeader = () => (
  <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <Overline style={{ color: T.color.accent }}>JEU. 22 AVR. · 14:08</Overline>
        <span style={{ width: 4, height: 4, borderRadius: 2, background: T.color.textMuted }} />
        <Overline>Méditerranée · UTC+2</Overline>
      </div>
      <h1 style={{
        fontFamily: T.font.sans, fontSize: T.type.display.size, lineHeight: `${T.type.display.lh}px`,
        fontWeight: T.type.display.w, letterSpacing: T.type.display.ls, color: T.color.textHigh, margin: 0,
      }}>
        Tableau de bord
      </h1>
      <div style={{ fontFamily: T.font.sans, fontSize: 15, color: T.color.textMed, marginTop: 8 }}>
        Bonjour Marine. <span style={{ color: T.color.textLow }}>14 jours depuis ta dernière plongée.</span>
      </div>
    </div>
    <div style={{ display: 'flex', gap: 10 }}>
      <button aria-label="Rechercher" style={{
        width: 40, height: 40, borderRadius: T.radius.md, border: 'none', cursor: 'pointer',
        background: 'rgba(154,186,224,0.06)', color: T.color.textMed,
        boxShadow: `inset 0 0 0 1px ${T.color.lineStrong}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}><Icons.search size={16} /></button>
      <button aria-label="Notifications" style={{
        width: 40, height: 40, borderRadius: T.radius.md, border: 'none', cursor: 'pointer',
        background: 'rgba(154,186,224,0.06)', color: T.color.textMed, position: 'relative',
        boxShadow: `inset 0 0 0 1px ${T.color.lineStrong}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icons.bell size={16} />
        <span style={{ position: 'absolute', top: 9, right: 10, width: 7, height: 7, borderRadius: 4,
          background: T.color.accent, boxShadow: `0 0 0 2px ${T.color.surface0}` }} />
      </button>
      <Btn kind="primary" icon={<Icons.plus size={16} stroke={T.color.accentInk} sw={2.2} />}>
        Nouvelle plongée
      </Btn>
    </div>
  </header>
);

/* ── KPI cards ──────────────────────────── */
const KPI = ({ label, value, unit, caption, spark }) => (
  <Card elev={1} pad={24} style={{ minHeight: 148, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    position: 'relative', overflow: 'hidden' }}>
    <Overline>{label}</Overline>
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontFamily: T.font.mono, fontSize: T.type.kpi.size, lineHeight: `${T.type.kpi.lh}px`,
          fontWeight: 600, letterSpacing: -1, color: T.color.textHigh, fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </span>
        {unit && <span style={{ fontFamily: T.font.mono, fontSize: 16, color: T.color.textLow, marginLeft: 2 }}>{unit}</span>}
      </div>
      <div style={{ fontFamily: T.font.sans, fontSize: 12, color: T.color.textLow, marginTop: 6 }}>{caption}</div>
    </div>
    {spark}
  </Card>
);

const Spark = ({ path, fill = false }) => (
  <svg viewBox="0 0 120 30" width="100%" height="30" preserveAspectRatio="none"
    style={{ position: 'absolute', bottom: 10, left: 0, right: 0, opacity: 0.7 }}>
    {fill && <path d={`${path} L 120 30 L 0 30 Z`} fill={T.color.accentSoft} />}
    <path d={path} stroke={T.color.accent} strokeWidth="1.5" fill="none" strokeLinejoin="round" strokeLinecap="round" />
  </svg>
);

const KPIs = () => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
    <KPI label="Plongées totales" value="127" caption="+3 ce mois · pace stable"
      spark={<Spark path="M0 24 L15 22 L30 20 L45 18 L60 15 L75 13 L90 9 L105 6 L120 4" />} />
    <KPI label="Temps sous l'eau" value="84" unit="h 23 min" caption="moy. 39 min · +1h42 ce mois"
      spark={<Spark path="M0 22 L20 20 L40 17 L60 14 L80 11 L100 9 L120 6" fill />} />
    <KPI label="Profondeur max" value="42" unit="m" caption="Pointe de la Revellata · 08 sept. 2025" />
    <KPI label="Sites explorés" value="23" unit="sites" caption="6 régions · Med. principalement" />
  </div>
);

/* ── Map ────────────────────────────────── */
// Dark stylized map: radial gradient, abstract coastline lines, dive markers.
const MapBlock = () => {
  const markers = [
    { x: 34, y: 52, count: 8,  label: 'Revellata',        big: true, active: true },
    { x: 42, y: 48, count: 5,  label: 'Calanque Sormiou' },
    { x: 48, y: 44, count: 11, label: 'Port-Cros',        big: true },
    { x: 56, y: 51, count: 3,  label: 'Porquerolles' },
    { x: 62, y: 55, count: 2,  label: 'Îles du Frioul' },
    { x: 71, y: 49, count: 6,  label: 'Cap Taillat',      big: true },
    { x: 78, y: 62, count: 1,  label: 'Banyuls' },
    { x: 25, y: 63, count: 1,  label: 'Bonifacio' },
    { x: 38, y: 38, count: 4,  label: 'Cassis' },
  ];
  return (
    <Card elev={1} pad={0} style={{ position: 'relative', overflow: 'hidden', marginBottom: 24, height: 440 }}>
      {/* Header overlay */}
      <div style={{ position: 'absolute', top: 20, left: 24, right: 24, display: 'flex',
        justifyContent: 'space-between', alignItems: 'center', zIndex: 3 }}>
        <div>
          <Overline>Carte · 23 sites</Overline>
          <div style={{ fontFamily: T.font.sans, fontSize: T.type.h2.size, fontWeight: 600,
            color: T.color.textHigh, letterSpacing: -0.3, marginTop: 4 }}>Méditerranée occidentale</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['1A', '1M', '3M', '1Y', 'Tout'].map((k, i) => (
            <button key={k} style={{
              height: 30, padding: '0 12px', borderRadius: T.radius.sm, border: 'none', cursor: 'pointer',
              fontFamily: T.font.mono, fontSize: 11, letterSpacing: 0.3,
              background: i === 2 ? T.color.accentSoft : 'rgba(154,186,224,0.04)',
              color: i === 2 ? T.color.accent : T.color.textMed,
              boxShadow: i === 2 ? `inset 0 0 0 1px ${T.color.accentLine}` : `inset 0 0 0 1px ${T.color.line}`,
            }}>{k}</button>
          ))}
        </div>
      </div>

      {/* Map canvas */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `
          radial-gradient(800px 400px at 55% 60%, rgba(36,64,109,0.4), transparent 70%),
          radial-gradient(500px 300px at 20% 30%, rgba(79,214,201,0.05), transparent 70%),
          ${T.color.surface0}
        `,
      }}>
        {/* gridlines */}
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.6 }}>
          <defs>
            <pattern id="mapGrid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M60 0H0v60" fill="none" stroke={T.color.gridline} strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#mapGrid)" />
        </svg>

        {/* Abstract coastlines — stylized, no literal geography */}
        <svg viewBox="0 0 1000 440" width="100%" height="100%" preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0 }}>
          <path d="M0 150 Q 120 130, 220 170 T 420 180 Q 480 190, 560 170 T 760 200 Q 840 220, 1000 210"
            fill="none" stroke="rgba(154,186,224,0.14)" strokeWidth="1.2" />
          <path d="M0 230 Q 160 210, 260 240 T 500 260 Q 600 270, 700 250 T 1000 280"
            fill="none" stroke="rgba(154,186,224,0.09)" strokeWidth="1" />
          <path d="M150 340 Q 280 320, 380 350 T 620 360 Q 720 370, 820 350"
            fill="none" stroke="rgba(154,186,224,0.07)" strokeWidth="1" />
        </svg>

        {/* Markers */}
        {markers.map((m, i) => {
          const size = m.big ? 36 : 26;
          return (
            <div key={i} style={{
              position: 'absolute', left: `${m.x}%`, top: `${m.y}%`,
              transform: 'translate(-50%, -50%)', zIndex: m.active ? 4 : 2,
            }}>
              {/* pulse */}
              {m.active && (
                <div style={{ position: 'absolute', inset: -10, borderRadius: '50%',
                  border: `1px solid ${T.color.accent}`, opacity: 0.35,
                  width: size + 20, height: size + 20,
                  left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }} />
              )}
              <div style={{
                width: size, height: size, borderRadius: '50%',
                background: m.active ? T.color.accent : T.color.surface2,
                color: m.active ? T.color.accentInk : T.color.textHigh,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: T.font.mono, fontSize: m.big ? 12 : 11, fontWeight: 600,
                boxShadow: m.active
                  ? `0 0 0 3px rgba(79,214,201,0.2), 0 6px 18px rgba(79,214,201,0.35)`
                  : `inset 0 0 0 1px ${T.color.accentLine}, 0 4px 12px rgba(0,0,0,0.4)`,
                fontVariantNumeric: 'tabular-nums',
              }}>{m.count}</div>
            </div>
          );
        })}

        {/* Active popover */}
        <div style={{
          position: 'absolute', left: '34%', top: '52%', transform: 'translate(-50%, calc(-100% - 30px))',
          background: T.color.surface2, borderRadius: T.radius.md, padding: '12px 14px',
          boxShadow: `inset 0 0 0 1px ${T.color.lineStrong}, 0 12px 32px rgba(0,0,0,0.5)`,
          minWidth: 200, zIndex: 5,
        }}>
          <Overline>Site</Overline>
          <div style={{ fontFamily: T.font.sans, fontSize: 14, fontWeight: 600, color: T.color.textHigh,
            marginTop: 4, letterSpacing: -0.1 }}>Pointe de la Revellata</div>
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            <div>
              <div style={{ fontFamily: T.font.mono, fontSize: 15, color: T.color.accent, fontVariantNumeric: 'tabular-nums' }}>8</div>
              <div style={{ fontFamily: T.font.mono, fontSize: 10, color: T.color.textLow, letterSpacing: 0.3 }}>PLONGÉES</div>
            </div>
            <div>
              <div style={{ fontFamily: T.font.mono, fontSize: 15, color: T.color.textHigh, fontVariantNumeric: 'tabular-nums' }}>-42m</div>
              <div style={{ fontFamily: T.font.mono, fontSize: 10, color: T.color.textLow, letterSpacing: 0.3 }}>PROF. MAX</div>
            </div>
          </div>
          {/* tail */}
          <div style={{ position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%) rotate(45deg)',
            width: 12, height: 12, background: T.color.surface2,
            boxShadow: `1px 1px 0 ${T.color.lineStrong}` }} />
        </div>

        {/* Scale indicator */}
        <div style={{ position: 'absolute', bottom: 20, left: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 60, height: 2, background: T.color.textLow }} />
          <div style={{ fontFamily: T.font.mono, fontSize: 10, color: T.color.textLow, letterSpacing: 0.3 }}>50 km</div>
        </div>
      </div>
    </Card>
  );
};

/* ── Last dive ──────────────────────────── */
const LastDive = () => (
  <Card elev={1} pad={24} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
      <div>
        <Overline>Dernière plongée</Overline>
        <div style={{ fontFamily: T.font.sans, fontSize: T.type.h2.size, fontWeight: 600, color: T.color.textHigh,
          letterSpacing: -0.3, marginTop: 6 }}>
          Pointe de la Revellata
        </div>
        <div style={{ fontFamily: T.font.sans, fontSize: 13, color: T.color.textMed, marginTop: 4 }}>
          Calvi, Corse · 08 sept. 2025
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <span style={{ padding: '5px 10px', background: 'rgba(91,211,145,0.12)', color: T.color.success,
          borderRadius: T.radius.pill, fontFamily: T.font.mono, fontSize: 10, letterSpacing: 0.3 }}>Palier OK</span>
        <span style={{ padding: '5px 10px', background: 'rgba(154,186,224,0.08)', color: T.color.textMed,
          borderRadius: T.radius.pill, fontFamily: T.font.mono, fontSize: 10, letterSpacing: 0.3 }}>Air · N2</span>
      </div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, flex: 1, alignContent: 'center' }}>
      {[
        ['PROF. MAX',  '42',   'm'],
        ['DURÉE',      '38',   'min'],
        ['TEMP. FOND', '14',   '°C'],
        ['VISIBILITÉ', '25',   'm'],
      ].map(([k, v, u]) => (
        <div key={k}>
          <Overline>{k}</Overline>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 6 }}>
            <span style={{ fontFamily: T.font.mono, fontSize: 26, fontWeight: 600, color: T.color.textHigh,
              letterSpacing: -0.6, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
            <span style={{ fontFamily: T.font.mono, fontSize: 12, color: T.color.textLow }}>{u}</span>
          </div>
        </div>
      ))}
    </div>

    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      paddingTop: 16, marginTop: 16, borderTop: `1px solid ${T.color.line}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex' }}>
          {['LB', 'TN'].map((i, idx) => (
            <div key={i} style={{
              width: 26, height: 26, borderRadius: 13,
              background: idx === 0 ? '#3a5a82' : '#2a6a6a',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: T.font.sans, fontSize: 10, fontWeight: 600, color: T.color.textHigh,
              marginLeft: idx === 0 ? 0 : -8, boxShadow: `0 0 0 2px ${T.color.surface1}`,
            }}>{i}</div>
          ))}
        </div>
        <div style={{ fontFamily: T.font.sans, fontSize: 12, color: T.color.textLow }}>
          avec <span style={{ color: T.color.textMed }}>L. Bernard</span> &amp; <span style={{ color: T.color.textMed }}>T. Nguyen</span>
        </div>
      </div>
      <button style={{ background: 'transparent', border: 'none', cursor: 'pointer',
        fontFamily: T.font.sans, fontSize: 13, color: T.color.accent, fontWeight: 500,
        display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}>
        Voir le détail
        <Icons.arrowRight size={14} stroke={T.color.accent} />
      </button>
    </div>
  </Card>
);

/* ── Bar chart — Plongées par mois ──────── */
const BarChart = () => {
  const months = [
    ['mai', 2], ['juin', 4], ['juil', 7], ['août', 9], ['sept', 11], ['oct', 6],
    ['nov', 3], ['déc', 1], ['janv', 0], ['févr', 2], ['mars', 3], ['avr', 4],
  ];
  const max = 11;
  return (
    <Card elev={1} pad={24} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <Overline>Plongées par mois</Overline>
          <div style={{ fontFamily: T.font.sans, fontSize: T.type.h2.size, fontWeight: 600,
            color: T.color.textHigh, letterSpacing: -0.3, marginTop: 6 }}>
            12 derniers mois
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: T.font.mono, fontSize: 20, fontWeight: 600, color: T.color.textHigh,
            letterSpacing: -0.4, fontVariantNumeric: 'tabular-nums' }}>52</div>
          <div style={{ fontFamily: T.font.mono, fontSize: 10, color: T.color.textLow, letterSpacing: 0.3 }}>TOTAL · 12M</div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 8, minHeight: 120, position: 'relative' }}>
        {/* subtle baseline grid — only 2 lines */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1,
          background: T.color.gridline }} />
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 1,
          background: T.color.line }} />
        {months.map(([m, v], i) => {
          const hlPct = (v / max) * 100;
          const isPeak = v === max;
          return (
            <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              position: 'relative' }}>
              {isPeak && (
                <div style={{ position: 'absolute', top: `calc(100% - ${hlPct}% - 26px)`,
                  fontFamily: T.font.mono, fontSize: 11, color: T.color.accent, fontWeight: 600 }}>{v}</div>
              )}
              <div style={{
                width: '100%', maxWidth: 24, height: `${Math.max(hlPct, 2)}%`, minHeight: v === 0 ? 2 : 8,
                borderRadius: 3, background: isPeak ? T.color.accent : 'rgba(154,186,224,0.22)',
                boxShadow: isPeak ? `0 0 16px rgba(79,214,201,0.3)` : 'none',
                transition: 'background 180ms',
              }} />
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        {months.map(([m]) => (
          <div key={m} style={{ flex: 1, textAlign: 'center',
            fontFamily: T.font.mono, fontSize: 10, color: T.color.textLow, letterSpacing: 0.3 }}>
            {m}
          </div>
        ))}
      </div>
    </Card>
  );
};

/* ── Frequent buddies ───────────────────── */
const Buddies = () => {
  const buddies = [
    ['LB', 'Lucas Bernard',    24, '#3a5a82'],
    ['TN', 'Thao Nguyen',       18, '#2a6a6a'],
    ['EM', 'Élise Marchand',    11, '#5a3a7a'],
    ['RP', 'Rémi Pascal',        9, '#3a7a5a'],
    ['SB', 'Sofia Barros',       6, '#7a5a3a'],
    ['JK', 'Julien Kervella',    4, '#3a4a7a'],
  ];
  return (
    <Card elev={1} pad={24}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <Overline>Binômes fréquents</Overline>
          <div style={{ fontFamily: T.font.sans, fontSize: T.type.h2.size, fontWeight: 600,
            color: T.color.textHigh, letterSpacing: -0.3, marginTop: 6 }}>
            6 palanquées régulières
          </div>
        </div>
        <button style={{ background: 'transparent', border: 'none', cursor: 'pointer',
          fontFamily: T.font.sans, fontSize: 13, color: T.color.accent, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 6 }}>
          Voir tous
          <Icons.arrowRight size={14} stroke={T.color.accent} />
        </button>
      </div>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto' }}>
        {buddies.map(([init, name, count, color]) => (
          <div key={init} style={{
            flexShrink: 0, width: 180, padding: 16, borderRadius: T.radius.md,
            background: T.color.surface0, boxShadow: `inset 0 0 0 1px ${T.color.line}`,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 20, background: color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: T.font.sans, fontSize: 13, fontWeight: 600, color: T.color.textHigh,
              boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.08)`,
            }}>{init}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: T.font.sans, fontSize: 13, fontWeight: 500, color: T.color.textHigh,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
              <div style={{ fontFamily: T.font.mono, fontSize: 11, color: T.color.textLow, marginTop: 2 }}>
                {count} plongées
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

/* ── Page ──────────────────────────────── */
const DashboardDesktop = () => (
  <div style={{
    width: 1440, minHeight: 1280,
    background: T.color.abyss,
    display: 'flex',
    fontFamily: T.font.sans,
    color: T.color.textHigh,
    backgroundImage: `radial-gradient(1200px 600px at 80% -10%, rgba(79,214,201,0.04), transparent 60%),
                      radial-gradient(900px 500px at 10% 30%, rgba(27,49,86,0.35), transparent 60%)`,
  }}>
    <Sidebar />
    <main style={{ flex: 1, padding: '32px 48px 48px', minWidth: 0 }}>
      <DashHeader />
      <KPIs />
      <MapBlock />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <LastDive />
        <BarChart />
      </div>
      <Buddies />
      <div style={{ marginTop: 32, fontFamily: T.font.mono, fontSize: 10, color: T.color.textMuted,
        letterSpacing: 0.3, display: 'flex', gap: 16 }}>
        <span>DIVELOG V1 · DASHBOARD</span>
        <span>·</span>
        <span>WCAG AA partout · AAA sur KPI</span>
        <span>·</span>
        <span>Données santé non affichées</span>
      </div>
    </main>
  </div>
);

window.DashboardDesktop = DashboardDesktop;
