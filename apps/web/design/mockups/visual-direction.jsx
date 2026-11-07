// Visual direction artboard — palette, typo, spacing, components
// Rendered at 1280 × 1820 inside a DCArtboard.

const T = window.DL_TOKENS;
const { Icons, Overline, Btn, Card, Swatch } = window;

const Section = ({ label, title, children, style }) => (
  <div style={{ marginBottom: 56, ...style }}>
    <Overline style={{ color: T.color.accent }}>{label}</Overline>
    <div style={{ fontFamily: T.font.sans, fontSize: T.type.h1.size, lineHeight: `${T.type.h1.lh}px`,
      fontWeight: T.type.h1.w, letterSpacing: T.type.h1.ls, color: T.color.textHigh, marginTop: 8, marginBottom: 28 }}>
      {title}
    </div>
    {children}
  </div>
);

const Row = ({ children, gap = 16, style }) => (
  <div style={{ display: 'flex', gap, ...style }}>{children}</div>
);

/* ── Palette blocks ─────────────────────────────────────── */
const SurfaceStack = () => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
    <Swatch name="Abyss · page" value={T.color.abyss} />
    <Swatch name="Surface 0"    value={T.color.surface0} />
    <Swatch name="Surface 1"    value={T.color.surface1} />
    <Swatch name="Surface 2"    value={T.color.surface2} />
  </div>
);

const TextStack = () => {
  const sample = 'Aa · 42m · Nice';
  const items = [
    { name: 'Text High · AAA',   value: T.color.textHigh, contrast: '16.2:1 on S0' },
    { name: 'Text Medium · AA',  value: T.color.textMed,  contrast: '7.4:1 on S0' },
    { name: 'Text Low',          value: T.color.textLow,  contrast: '3.1:1 on S0' },
    { name: 'Text Muted',        value: T.color.textMuted, contrast: 'decorative' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
      {items.map((i) => (
        <div key={i.name} style={{ background: T.color.surface0, borderRadius: T.radius.md, padding: 18,
          boxShadow: `inset 0 0 0 1px ${T.color.line}`, minHeight: 108, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: T.font.sans, fontSize: 22, color: i.value, letterSpacing: -0.3 }}>{sample}</div>
          <div>
            <div style={{ fontFamily: T.font.mono, fontSize: 10, color: T.color.textLow, textTransform: 'uppercase', letterSpacing: 0.6 }}>{i.name}</div>
            <div style={{ fontFamily: T.font.mono, fontSize: 11, color: T.color.textMuted, marginTop: 4 }}>{i.value} · {i.contrast}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

const AccentStack = () => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
    <Swatch name="Accent · turquoise" value={T.color.accent} fg={T.color.accentInk} contrast="AA on S0 · 7.1:1" />
    <div style={{ background: T.color.accentSoft, borderRadius: T.radius.md, padding: 14, minHeight: 108,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      boxShadow: `inset 0 0 0 1px ${T.color.accentLine}` }}>
      <div style={{ fontFamily: T.font.mono, fontSize: 10, letterSpacing: 0.6, color: T.color.accent, textTransform: 'uppercase' }}>Accent · soft</div>
      <div>
        <div style={{ fontFamily: T.font.mono, fontSize: 11, color: T.color.accent }}>rgba(79,214,201,.14)</div>
        <div style={{ fontFamily: T.font.mono, fontSize: 10, color: T.color.textLow, marginTop: 4 }}>bg: chips, markers actifs</div>
      </div>
    </div>
    <Swatch name="Success" value={T.color.success} fg="#062916" contrast="AA on S0" />
    <Row gap={12} style={{ gridColumn: 'span 1' }}>
      <div style={{ flex: 1, background: T.color.warning, borderRadius: T.radius.md, padding: 14, minHeight: 108,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: T.font.mono, fontSize: 10, letterSpacing: 0.6, color: '#2d1d04', textTransform: 'uppercase' }}>Warning</div>
        <div style={{ fontFamily: T.font.mono, fontSize: 12, color: '#2d1d04' }}>{T.color.warning}</div>
      </div>
      <div style={{ flex: 1, background: T.color.danger, borderRadius: T.radius.md, padding: 14, minHeight: 108,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: T.font.mono, fontSize: 10, letterSpacing: 0.6, color: '#2e0a0d', textTransform: 'uppercase' }}>Danger</div>
        <div style={{ fontFamily: T.font.mono, fontSize: 12, color: '#2e0a0d' }}>{T.color.danger}</div>
      </div>
    </Row>
  </div>
);

/* ── Type scale ────────────────────────────────────────── */
const typeRows = [
  ['display / 40', 'Tableau de bord', T.type.display, T.font.sans],
  ['h1 / 28',      'Mes plongées',    T.type.h1,      T.font.sans],
  ['h2 / 20',      'Dernière plongée — Pointe de la Revellata', T.type.h2, T.font.sans],
  ['h3 / 16',      'Sites explorés',  T.type.h3,      T.font.sans],
  ['body / 14',    'Tu as passé 84 h 23 min sous l\u2019eau.', T.type.body, T.font.sans],
  ['caption / 12', '12 oct · 16:42 · N2', T.type.caption, T.font.sans],
  ['overline / 11·mono', 'KPI · PROFONDEUR MAX', T.type.overline, T.font.mono],
  ['kpi / 44·mono', '127 · 42m · 84h', T.type.kpi, T.font.mono],
];

const TypeScale = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 0,
    background: T.color.surface0, borderRadius: T.radius.lg,
    boxShadow: `inset 0 0 0 1px ${T.color.line}`, overflow: 'hidden' }}>
    {typeRows.map(([label, sample, sp, font], i) => (
      <div key={label} style={{ display: 'flex', alignItems: 'baseline', padding: '18px 24px',
        borderTop: i === 0 ? 'none' : `1px solid ${T.color.line}`, gap: 24 }}>
        <div style={{ fontFamily: T.font.mono, fontSize: 11, color: T.color.textLow, width: 160, flexShrink: 0, letterSpacing: 0.2 }}>
          {label}
        </div>
        <div style={{
          fontFamily: font, fontSize: sp.size, lineHeight: `${sp.lh}px`, fontWeight: sp.w, letterSpacing: sp.ls,
          color: T.color.textHigh, flex: 1,
          textTransform: label.startsWith('overline') ? 'uppercase' : 'none',
          fontVariantNumeric: font === T.font.mono ? 'tabular-nums' : 'normal',
        }}>{sample}</div>
      </div>
    ))}
  </div>
);

/* ── Spacing ──────────────────────────────────────────── */
const SpacingScale = () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  return (
    <div style={{ background: T.color.surface0, borderRadius: T.radius.lg, padding: 24,
      boxShadow: `inset 0 0 0 1px ${T.color.line}` }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 24 }}>
        {items.map((k) => {
          const px = T.space[k];
          return (
            <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ height: 24, width: px, background: T.color.accent, borderRadius: 2, minWidth: 2 }} />
              <div>
                <div style={{ fontFamily: T.font.mono, fontSize: 11, color: T.color.textHigh }}>s-{k}</div>
                <div style={{ fontFamily: T.font.mono, fontSize: 10, color: T.color.textLow }}>{px}px</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ── Radius ─────────────────────────────────────────── */
const RadiusScale = () => {
  const items = Object.entries(T.radius);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
      {items.map(([k, v]) => (
        <div key={k} style={{ background: T.color.surface1, padding: 20, borderRadius: v === 999 ? 999 : v,
          boxShadow: `inset 0 0 0 1px ${T.color.line}`, minHeight: 88, display: 'flex',
          flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: T.font.mono, fontSize: 11, color: T.color.textHigh }}>r-{k}</div>
          <div style={{ fontFamily: T.font.mono, fontSize: 10, color: T.color.textLow }}>{v === 999 ? 'pill' : `${v}px`}</div>
        </div>
      ))}
    </div>
  );
};

/* ── Components showcase ────────────────────────────── */
const Components = () => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
    {/* Buttons */}
    <Card elev={0} pad={24}>
      <Overline>Buttons</Overline>
      <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
        <Btn kind="primary" icon={<Icons.plus size={16} stroke={T.color.accentInk} sw={2} />}>Nouvelle plongée</Btn>
        <Btn kind="secondary">Voir le détail</Btn>
        <Btn kind="ghost" icon={<Icons.arrowRight size={16} />}>Aller</Btn>
      </div>
      <div style={{ marginTop: 18, fontFamily: T.font.mono, fontSize: 11, color: T.color.textLow, lineHeight: 1.6 }}>
        h = 40px · target ≥44px incl. marge · focus ring accent
      </div>
    </Card>

    {/* KPI card */}
    <Card elev={1} pad={20}>
      <Overline>Plongées totales</Overline>
      <div style={{ fontFamily: T.font.mono, fontSize: T.type.kpi.size, lineHeight: `${T.type.kpi.lh}px`,
        fontWeight: 600, letterSpacing: -1.2, color: T.color.textHigh, fontVariantNumeric: 'tabular-nums', marginTop: 10 }}>
        127
      </div>
      <div style={{ fontFamily: T.font.sans, fontSize: 12, color: T.color.textLow, marginTop: 6 }}>
        +3 ce mois · N2 depuis avr. 2024
      </div>
    </Card>

    {/* Nav item */}
    <Card elev={0} pad={16}>
      <Overline>Sidebar items</Overline>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12 }}>
        {[
          ['Dashboard', Icons.dashboard, true],
          ['Mes plongées', Icons.dives, false],
          ['Carte', Icons.map, false],
          ['Statistiques', Icons.stats, false],
        ].map(([label, Ic, active]) => (
          <div key={label} style={{
            display: 'flex', alignItems: 'center', gap: 12, height: 44, padding: '0 14px',
            borderRadius: T.radius.md,
            background: active ? T.color.accentSoft : 'transparent',
            color: active ? T.color.accent : T.color.textMed,
            boxShadow: active ? `inset 0 0 0 1px ${T.color.accentLine}` : 'none',
          }}>
            <Ic size={18} />
            <span style={{ fontFamily: T.font.sans, fontSize: 14, fontWeight: active ? 500 : 400 }}>{label}</span>
          </div>
        ))}
      </div>
    </Card>

    {/* Chips / Badge */}
    <Card elev={0} pad={20}>
      <Overline>Chips &amp; badges</Overline>
      <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px',
          background: T.color.accentSoft, color: T.color.accent, borderRadius: T.radius.pill,
          fontFamily: T.font.mono, fontSize: 11, letterSpacing: 0.2,
          boxShadow: `inset 0 0 0 1px ${T.color.accentLine}` }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: T.color.accent }} />
          N2 · FFESSM
        </span>
        <span style={{ padding: '6px 10px', background: 'rgba(91,211,145,0.12)', color: T.color.success,
          borderRadius: T.radius.pill, fontFamily: T.font.mono, fontSize: 11 }}>Palier OK</span>
        <span style={{ padding: '6px 10px', background: 'rgba(231,178,74,0.12)', color: T.color.warning,
          borderRadius: T.radius.pill, fontFamily: T.font.mono, fontSize: 11 }}>Visa vérif.</span>
        <span style={{ padding: '6px 10px', background: 'rgba(154,186,224,0.08)', color: T.color.textMed,
          borderRadius: T.radius.pill, fontFamily: T.font.mono, fontSize: 11 }}>Méditerranée</span>
      </div>
    </Card>
  </div>
);

/* ── Laws of UX panel ───────────────────────────────── */
const laws = [
  ['Fitts',        'Sidebar items 44px + padding. CTA header 40px + zone augmentée. FAB mobile 56px.'],
  ['Hick',         '4 entrées de navigation, pas plus. Menu utilisateur replié en bas de sidebar.'],
  ['Miller',       '4 KPI maximum sur la rangée supérieure — cadre de la mémoire de travail.'],
  ['Proximité',    'KPI groupés · carte isolée · ligne « dernière + activité » appariée · binômes en pied.'],
  ['Aesthetic',    'Surfaces stratifiées, aucun ornement gratuit. Tout élément visible sert la lecture.'],
  ['Progressive',  '« Voir le détail » renvoie au carnet. Dashboard résume, ne rejoue pas la plongée.'],
];

const Laws = () => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
    {laws.map(([k, v]) => (
      <div key={k} style={{ padding: 16, background: T.color.surface0, borderRadius: T.radius.md,
        boxShadow: `inset 0 0 0 1px ${T.color.line}` }}>
        <div style={{ fontFamily: T.font.mono, fontSize: 11, letterSpacing: 0.6, color: T.color.accent,
          textTransform: 'uppercase', marginBottom: 6 }}>{k}</div>
        <div style={{ fontFamily: T.font.sans, fontSize: 13, color: T.color.textMed, lineHeight: 1.55 }}>{v}</div>
      </div>
    ))}
  </div>
);

/* ── Page ─────────────────────────────────────────── */
const VisualDirection = () => (
  <div style={{
    width: 1280, minHeight: 1820,
    background: T.color.abyss, padding: '56px 64px 72px',
    fontFamily: T.font.sans,
    boxSizing: 'border-box',
    // subtle radial top-left to give the page elevation without neon
    backgroundImage: `radial-gradient(900px 500px at 15% -10%, rgba(79,214,201,0.06), transparent 60%),
                      radial-gradient(700px 400px at 95% 0%, rgba(36,64,109,0.35), transparent 55%)`,
  }}>
    {/* Header band */}
    <div style={{ marginBottom: 56 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <div style={{ width: 10, height: 10, borderRadius: 2, background: T.color.accent,
          boxShadow: `0 0 0 3px ${T.color.accentSoft}` }} />
        <Overline style={{ color: T.color.accent }}>DIVELOG · DIRECTION VISUELLE · V1</Overline>
      </div>
      <div style={{ fontFamily: T.font.sans, fontSize: T.type.display.size, lineHeight: `${T.type.display.lh}px`,
        fontWeight: T.type.display.w, letterSpacing: T.type.display.ls, color: T.color.textHigh, maxWidth: 900 }}>
        Bleu nuit lisible, turquoise rare, typo Geist — un carnet sérieux, pas un cockpit.
      </div>
      <div style={{ fontFamily: T.font.sans, fontSize: 15, lineHeight: 1.55, color: T.color.textMed,
        marginTop: 16, maxWidth: 760 }}>
        Dark mode construit comme une stratification de bleus profonds (pas de gris neutre). L&apos;accent turquoise
        est réservé aux actions et aux états actifs. Les chiffres passent en <em style={{ fontStyle: 'normal', color: T.color.textHigh }}>
        Geist Mono tabulaire</em> pour garder l&apos;alignement des KPI, graphes et popovers carte.
      </div>
    </div>

    <Section label="01 · COULEUR" title="Surfaces & texte">
      <div style={{ marginBottom: 14 }}>
        <Overline>Surfaces — du plus profond au plus élevé</Overline>
      </div>
      <SurfaceStack />
      <div style={{ height: 24 }} />
      <Overline>Texte — hiérarchie par emphase</Overline>
      <div style={{ height: 12 }} />
      <TextStack />
      <div style={{ height: 24 }} />
      <Overline>Accent &amp; sémantique</Overline>
      <div style={{ height: 12 }} />
      <AccentStack />
    </Section>

    <Section label="02 · TYPOGRAPHIE" title="Geist Sans + Geist Mono">
      <div style={{ fontFamily: T.font.sans, fontSize: 14, color: T.color.textMed, marginBottom: 16, maxWidth: 640, lineHeight: 1.55 }}>
        Geist pour l&apos;interface (formes nettes, contre-poinçons ouverts, excellent à petite taille). Geist Mono
        pour tout ce qui est chiffres, coordonnées, timestamps et overlines — stabilise les colonnes de KPI.
      </div>
      <TypeScale />
    </Section>

    <Section label="03 · ESPACE &amp; FORME" title="Échelle 4px · rayons">
      <SpacingScale />
      <div style={{ height: 20 }} />
      <RadiusScale />
    </Section>

    <Section label="04 · COMPOSANTS" title="Briques du dashboard">
      <Components />
    </Section>

    <Section label="05 · LAWS OF UX" title="Comment on les applique" style={{ marginBottom: 0 }}>
      <Laws />
    </Section>
  </div>
);

window.VisualDirection = VisualDirection;
