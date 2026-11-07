// Desktop states — empty (new user) + loading (skeletons).

const T = window.DL_TOKENS;
const { Icons, Overline, Btn, Card } = window;

/* ── Reuse sidebar from nominal ── */
const SidebarShell = ({ activeLabel = 'Dashboard' }) => {
  const items = [
    ['Dashboard', Icons.dashboard],
    ['Mes plongées', Icons.dives],
    ['Carte', Icons.map],
    ['Statistiques', Icons.stats],
  ];
  return (
    <aside style={{
      width: 240, flexShrink: 0,
      background: T.color.surface0,
      borderRight: `1px solid ${T.color.line}`,
      display: 'flex', flexDirection: 'column',
      padding: '28px 20px',
      alignSelf: 'stretch',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 6px', marginBottom: 36 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: T.color.surface2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `inset 0 0 0 1px ${T.color.accentLine}` }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={T.color.accent} strokeWidth="1.6" strokeLinecap="round">
            <path d="M2 6c1.5 0 1.5-1.2 3-1.2S6.5 6 8 6s1.5-1.2 3-1.2S12.5 6 14 6" />
            <path d="M2 10c1.5 0 1.5-1.2 3-1.2S6.5 10 8 10s1.5-1.2 3-1.2S12.5 10 14 10" />
          </svg>
        </div>
        <div style={{ fontFamily: T.font.sans, fontSize: 15, fontWeight: 600, color: T.color.textHigh, letterSpacing: -0.2 }}>DiveLog</div>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        <div style={{ padding: '0 14px 8px' }}><Overline>Navigation</Overline></div>
        {items.map(([label, Ic]) => {
          const active = label === activeLabel;
          return (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', gap: 12, height: 44, padding: '0 14px',
              borderRadius: T.radius.md,
              background: active ? T.color.accentSoft : 'transparent',
              color: active ? T.color.accent : T.color.textMed,
              boxShadow: active ? `inset 0 0 0 1px ${T.color.accentLine}` : 'none',
              fontFamily: T.font.sans, fontSize: 14, fontWeight: active ? 500 : 400,
            }}>
              <Ic size={18} />
              <span>{label}</span>
            </div>
          );
        })}
      </nav>
      <div style={{ marginTop: 24, padding: 12, borderRadius: T.radius.md,
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
      </div>
    </aside>
  );
};

/* ──────────────────────────────────────────────
   EMPTY STATE — débutant, 0 plongée
   ────────────────────────────────────────────── */
const EmptyKPI = ({ label }) => (
  <Card elev={1} pad={24} style={{ minHeight: 148, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
    <Overline>{label}</Overline>
    <div>
      <div style={{ fontFamily: T.font.mono, fontSize: 44, lineHeight: '48px', fontWeight: 600,
        color: T.color.textMuted, letterSpacing: -1.2, fontVariantNumeric: 'tabular-nums' }}>
        —
      </div>
      <div style={{ fontFamily: T.font.sans, fontSize: 12, color: T.color.textMuted, marginTop: 6 }}>
        en attente de données
      </div>
    </div>
  </Card>
);

const EmptyMap = () => (
  <Card elev={1} pad={0} style={{ height: 440, position: 'relative', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', inset: 0,
      background: `radial-gradient(900px 400px at 50% 60%, rgba(27,49,86,0.35), transparent 70%), ${T.color.surface0}` }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.4 }}>
        <defs>
          <pattern id="emptyGrid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M60 0H0v60" fill="none" stroke={T.color.gridline} strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#emptyGrid)" />
      </svg>
      <svg viewBox="0 0 1000 440" width="100%" height="100%" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
        <path d="M0 150 Q 120 130, 220 170 T 420 180 Q 480 190, 560 170 T 760 200 Q 840 220, 1000 210"
          fill="none" stroke="rgba(154,186,224,0.08)" strokeWidth="1" />
        <path d="M0 230 Q 160 210, 260 240 T 500 260 Q 600 270, 700 250 T 1000 280"
          fill="none" stroke="rgba(154,186,224,0.05)" strokeWidth="1" />
      </svg>
    </div>
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 40 }}>
      {/* abstract pin */}
      <div style={{ width: 48, height: 48, borderRadius: 24,
        background: T.color.accentSoft, border: `1px solid ${T.color.accentLine}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <Icons.pin size={22} stroke={T.color.accent} sw={1.5} />
      </div>
      <div style={{ fontFamily: T.font.sans, fontSize: 22, fontWeight: 600, color: T.color.textHigh,
        letterSpacing: -0.3, marginBottom: 8 }}>
        Aucun site marqué pour l&apos;instant
      </div>
      <div style={{ fontFamily: T.font.sans, fontSize: 14, color: T.color.textMed, maxWidth: 420, lineHeight: 1.55 }}>
        Ta carte se remplira au fil de tes plongées. Chaque site exploré y laissera une trace.
      </div>
    </div>
  </Card>
);

const EmptyDesktop = () => (
  <div style={{
    width: 1440, minHeight: 1280,
    background: T.color.abyss, display: 'flex',
    fontFamily: T.font.sans, color: T.color.textHigh,
    backgroundImage: `radial-gradient(1200px 600px at 80% -10%, rgba(79,214,201,0.04), transparent 60%),
                      radial-gradient(900px 500px at 10% 30%, rgba(27,49,86,0.35), transparent 60%)`,
  }}>
    <SidebarShell />
    <main style={{ flex: 1, padding: '32px 48px 48px', minWidth: 0 }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <Overline style={{ color: T.color.accent }}>PREMIÈRE CONNEXION · BIENVENUE</Overline>
          <h1 style={{ fontFamily: T.font.sans, fontSize: T.type.display.size, lineHeight: `${T.type.display.lh}px`,
            fontWeight: T.type.display.w, letterSpacing: T.type.display.ls, color: T.color.textHigh,
            margin: '8px 0 0' }}>
            Bienvenue à bord, Marine
          </h1>
          <div style={{ fontFamily: T.font.sans, fontSize: 15, color: T.color.textMed, marginTop: 8 }}>
            Ton carnet est vierge. <span style={{ color: T.color.textLow }}>La première plongée l&apos;ouvrira.</span>
          </div>
        </div>
        <Btn kind="primary" icon={<Icons.plus size={16} stroke={T.color.accentInk} sw={2.2} />} style={{ height: 48, padding: '0 22px', fontSize: 15 }}>
          Enregistrer ma première plongée
        </Btn>
      </header>

      {/* KPI row — all dashed */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <EmptyKPI label="Plongées totales" />
        <EmptyKPI label="Temps sous l'eau" />
        <EmptyKPI label="Profondeur max" />
        <EmptyKPI label="Sites explorés" />
      </div>

      {/* Empty map */}
      <div style={{ marginBottom: 24 }}>
        <EmptyMap />
      </div>

      {/* Last dive + chart both empty */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <Card elev={1} pad={24} style={{ minHeight: 260, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 10 }}>
          <Overline>Dernière plongée</Overline>
          <div style={{ fontFamily: T.font.sans, fontSize: 16, color: T.color.textMed, maxWidth: 300, lineHeight: 1.5 }}>
            Profondeur, durée, température — tout apparaîtra ici après ta première saisie.
          </div>
        </Card>
        <Card elev={1} pad={24} style={{ minHeight: 260, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 10 }}>
          <Overline>Plongées par mois</Overline>
          <div style={{ fontFamily: T.font.sans, fontSize: 16, color: T.color.textMed, maxWidth: 300, lineHeight: 1.5 }}>
            Le rythme de ton année se dessinera au fil des mois.
          </div>
        </Card>
      </div>
    </main>
  </div>
);

/* ──────────────────────────────────────────────
   LOADING STATE — skeletons cohérents
   ────────────────────────────────────────────── */
const skel = {
  background: `linear-gradient(90deg, rgba(154,186,224,0.06) 0%, rgba(154,186,224,0.14) 50%, rgba(154,186,224,0.06) 100%)`,
  backgroundSize: '200% 100%',
  borderRadius: 4,
};

const SkelBar = ({ w = '100%', h = 12, style }) => (
  <div style={{ width: w, height: h, ...skel, ...style }} />
);

const SkelKPI = () => (
  <Card elev={1} pad={24} style={{ minHeight: 148, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
    <SkelBar w={96} h={10} />
    <div>
      <SkelBar w={120} h={36} style={{ borderRadius: 6 }} />
      <div style={{ height: 6 }} />
      <SkelBar w={160} h={10} />
    </div>
  </Card>
);

const LoadingDesktop = () => (
  <div style={{
    width: 1440, minHeight: 1280,
    background: T.color.abyss, display: 'flex',
    fontFamily: T.font.sans, color: T.color.textHigh,
  }}>
    <SidebarShell />
    <main style={{ flex: 1, padding: '32px 48px 48px', minWidth: 0 }}>
      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SkelBar w={180} h={10} />
          <SkelBar w={320} h={36} style={{ borderRadius: 6 }} />
          <SkelBar w={260} h={12} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ width: 40, height: 40, ...skel, borderRadius: T.radius.md }} />
          <div style={{ width: 40, height: 40, ...skel, borderRadius: T.radius.md }} />
          <div style={{ width: 180, height: 40, ...skel, borderRadius: T.radius.md }} />
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[0,1,2,3].map(i => <SkelKPI key={i} />)}
      </div>

      {/* Map placeholder */}
      <Card elev={1} pad={24} style={{ height: 440, marginBottom: 24, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SkelBar w={100} h={10} />
            <SkelBar w={220} h={22} style={{ borderRadius: 6 }} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[0,1,2,3,4].map(i => <div key={i} style={{ width: 38, height: 28, ...skel, borderRadius: T.radius.sm }} />)}
          </div>
        </div>
        <div style={{ flex: 1, ...skel, borderRadius: T.radius.md, position: 'relative', overflow: 'hidden' }}>
          {/* faint marker placeholders */}
          {[[20,30],[35,50],[48,42],[60,55],[70,48],[80,62]].map(([x,y], i) => (
            <div key={i} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`,
              width: 28, height: 28, borderRadius: 14, transform: 'translate(-50%,-50%)',
              background: 'rgba(154,186,224,0.12)', boxShadow: `inset 0 0 0 1px ${T.color.line}` }} />
          ))}
        </div>
      </Card>

      {/* row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <Card elev={1} pad={24} style={{ minHeight: 260 }}>
          <SkelBar w={120} h={10} />
          <div style={{ height: 10 }} />
          <SkelBar w={240} h={22} style={{ borderRadius: 6 }} />
          <div style={{ height: 6 }} />
          <SkelBar w={160} h={12} />
          <div style={{ height: 28 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <SkelBar w={60} h={8} />
                <SkelBar w={80} h={22} style={{ borderRadius: 6 }} />
              </div>
            ))}
          </div>
        </Card>
        <Card elev={1} pad={24} style={{ minHeight: 260, display: 'flex', flexDirection: 'column' }}>
          <SkelBar w={140} h={10} />
          <div style={{ height: 10 }} />
          <SkelBar w={200} h={22} style={{ borderRadius: 6 }} />
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 28 }}>
            {[40, 60, 80, 95, 70, 45, 30, 20, 35, 50, 55, 65].map((h, i) => (
              <div key={i} style={{ flex: 1, height: `${h}%`, ...skel, borderRadius: 3 }} />
            ))}
          </div>
        </Card>
      </div>

      {/* Style */}
      <style>{`
        @keyframes dlShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        main > *, main > div > * { animation: dlShimmer 1.8s ease-in-out infinite; }
      `}</style>
    </main>
  </div>
);

window.EmptyDesktop = EmptyDesktop;
window.LoadingDesktop = LoadingDesktop;
