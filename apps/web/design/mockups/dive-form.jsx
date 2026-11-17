// "Nouvelle plongée" — formulaire de saisie manuelle (V1), aligné sur la page détail.
// Sections = cartes du détail : L'essentiel · Déroulé · Palanquée · Équipement & gaz · Conditions · Notes.
// Desktop 1440 (prérempli depuis #127) · mobile 375 (erreurs à l'enregistrement) · combobox Site.
// IIFE: no global name collisions with the other mockup scripts.

(function () {
const T = window.DL_TOKENS;
const { Icon, Icons, Overline, Btn, Card } = window;

/* ── Icons ───────────────────────────────────────────────── */
const Ix = {
  chevronLeft: (p) => <Icon {...p} d="M15 6l-6 6 6 6" />,
  x: (p) => <Icon {...p} d="M6 6l12 12M18 6 6 18" />,
  check: (p) => <Icon {...p} d="m5 12 5 5 9-10" />,
  alert: (p) => <Icon {...p}><path d="M12 3 2 20h20L12 3z" /><path d="M12 10v4" /><path d="M12 17v.5" /></Icon>,
  info: (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8v.5" /></Icon>,
  copy: (p) => <Icon {...p}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></Icon>,
  cloud: (p) => <Icon {...p}><path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.4 1.5A3.5 3.5 0 0 0 7 18z" /><path d="m9.5 13.5 2 2 3.5-4" /></Icon>,
  calendar: (p) => <Icon {...p}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></Icon>,
  link: (p) => <Icon {...p}><path d="M9 7H7a5 5 0 0 0 0 10h2" /><path d="M15 7h2a5 5 0 0 1 0 10h-2" /><path d="M8 12h8" /></Icon>,
  minus: (p) => <Icon {...p} d="M5 12h14" />,
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
    neutral: ['rgba(154,186,224,0.08)', T.color.textLow],
    success: ['rgba(91,211,145,0.12)', T.color.success],
    warning: ['rgba(231,178,74,0.12)', T.color.warning],
    danger: ['rgba(224,106,112,0.12)', T.color.danger],
    accent: [T.color.accentSoft, T.color.accent],
  };
  const [bg, fg] = tones[tone];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: T.radius.pill,
      background: bg, whiteSpace: 'nowrap', ...mono(11, fg, { letterSpacing: 0.2 }) }}>{children}</span>
  );
};

/* ── Form primitives ────────────────────────────────────── */
const STATE_RING = {
  default: `inset 0 0 0 1px ${T.color.lineStrong}`,
  focus: `inset 0 0 0 1px ${T.color.accent}, 0 0 0 3px rgba(79,214,201,0.18)`,
  warning: `inset 0 0 0 1px ${T.color.warning}`,
  error: `inset 0 0 0 1px ${T.color.danger}`,
  locked: `inset 0 0 0 1px ${T.color.line}`,
};

// Field = label (au-dessus) + contrôle + aide / message.
const Field = ({ label, req, hint, msg, state = 'default', children, style }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, ...style }}>
    {label && (
      <label style={sans(13, T.color.textMed, { fontWeight: 500 })}>
        {label}{req && <span aria-hidden="true" style={{ color: T.color.accent }}> *</span>}
      </label>
    )}
    {children}
    {msg && (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6,
        ...sans(12, state === 'error' ? T.color.danger : T.color.warning, { lineHeight: 1.45 }) }}>
        {state === 'error' ? <Ix.alert size={14} style={{ marginTop: 1 }} /> : <Ix.info size={14} style={{ marginTop: 1 }} />}
        <span>{msg}</span>
      </div>
    )}
    {hint && !msg && <div style={sans(12, T.color.textLow, { lineHeight: 1.45 })}>{hint}</div>}
  </div>
);

// Input box (valeur, placeholder, unité, icône, état)
const Input = ({ value, ph, unit, icon, state = 'default', monoValue = true, caret, right, h = 44 }) => (
  <div style={{ height: h, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', borderRadius: T.radius.md,
    background: state === 'locked' ? 'transparent' : T.color.surface0, boxShadow: STATE_RING[state] }}>
    {icon && <span style={{ color: T.color.textLow, display: 'flex' }}>{icon}</span>}
    <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      ...(value ? (monoValue ? mono(15, T.color.textHigh) : sans(14, T.color.textHigh)) : sans(14, T.color.textMuted)) }}>
      {value || ph}
      {caret && <span style={{ display: 'inline-block', width: 1.5, height: 18, background: T.color.accent, marginLeft: 1, verticalAlign: -3 }} />}
    </span>
    {unit && <span style={mono(12, T.color.textLow)}>{unit}</span>}
    {state === 'error' && <span style={{ color: T.color.danger, display: 'flex' }}><Ix.alert size={16} /></span>}
    {right}
  </div>
);

const Segmented = ({ options, value, h = 40 }) => (
  <div role="radiogroup" style={{ display: 'flex', padding: 3, gap: 2, borderRadius: T.radius.md, background: T.color.abyss,
    boxShadow: `inset 0 0 0 1px ${T.color.line}` }}>
    {options.map((o) => {
      const on = o === value;
      return (
        <span key={o} role="radio" aria-checked={on} style={{ flex: 1, height: h - 6, display: 'flex', alignItems: 'center',
          justifyContent: 'center', borderRadius: 8, padding: '0 8px', whiteSpace: 'nowrap',
          background: on ? T.color.surface2 : 'transparent', boxShadow: on ? `inset 0 0 0 1px ${T.color.lineStrong}` : 'none',
          ...sans(13, on ? T.color.textHigh : T.color.textLow, { fontWeight: on ? 500 : 400 }) }}>{o}</span>
      );
    })}
  </div>
);

const Switch = ({ on }) => (
  <span role="switch" aria-checked={on} style={{ width: 44, height: 26, borderRadius: 13, position: 'relative', flexShrink: 0,
    background: on ? T.color.accent : 'rgba(154,186,224,0.18)' }}>
    <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: 10,
      background: on ? T.color.accentInk : T.color.textMed }} />
  </span>
);

const SwitchRow = ({ label, hint, on, children }) => (
  <div style={{ padding: '14px 0', borderTop: `1px solid ${T.color.line}` }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <div>
        <div style={sans(14, T.color.textHigh, { fontWeight: 500 })}>{label}</div>
        {hint && <div style={sans(12, T.color.textLow)}>{hint}</div>}
      </div>
      <Switch on={on} />
    </div>
    {children && <div style={{ marginTop: 12 }}>{children}</div>}
  </div>
);

const Row = ({ children, gap = 12, cols }) => (
  <div style={{ display: 'grid', gridTemplateColumns: cols || `repeat(${React.Children.count(children)}, minmax(0, 1fr))`, gap }}>{children}</div>
);

// Section = carte numérotée, ancre de la navigation latérale.
const Section = ({ n, title, optional, aside, children, pad = 24 }) => (
  <Card elev={1} pad={pad}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 26, height: 26, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: T.color.surface0, boxShadow: `inset 0 0 0 1px ${T.color.lineStrong}`, ...mono(12, T.color.textMed) }}>{n}</span>
        <h2 style={{ margin: 0, ...sans(T.type.h3.size, T.color.textHigh), fontWeight: 600, letterSpacing: -0.1 }}>{title}</h2>
        {optional && <Tag>facultatif</Tag>}
      </div>
      {aside}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
  </Card>
);

const Chip = ({ children, removable = true }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: removable ? '0 6px 0 12px' : '0 12px',
    borderRadius: T.radius.pill, background: 'rgba(154,186,224,0.08)', boxShadow: `inset 0 0 0 1px ${T.color.line}`,
    ...sans(13, T.color.textMed) }}>
    {children}
    {removable && <span style={{ width: 20, height: 20, borderRadius: 10, display: 'flex', alignItems: 'center',
      justifyContent: 'center', color: T.color.textLow }}><Ix.x size={12} sw={2} /></span>}
  </span>
);

const GhostAdd = ({ children }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 14px', borderRadius: T.radius.md,
    boxShadow: `inset 0 0 0 1px ${T.color.line}`, border: 'none', cursor: 'pointer', alignSelf: 'flex-start',
    background: 'transparent', ...sans(13, T.color.accent, { fontWeight: 500 }) }}>
    <Icons.plus size={15} stroke={T.color.accent} sw={2} />{children}
  </span>
);

/* ── Palanquée editor ───────────────────────────────────── */
const TEAM = [
  { id: 'MR', n: 'Marine Rousseau', lvl: 'N2', self: true },
  { id: 'LB', n: 'Lucas Bernard', lvl: 'N3', c: '#3a5a82' },
  { id: 'TN', n: 'Thao Nguyen', lvl: 'N2', c: '#2a6a6a' },
];

const Avatar = ({ m, size = 32 }) => (
  <div style={{ width: size, height: size, borderRadius: size / 2, flexShrink: 0,
    background: m.self ? T.color.surface0 : m.c, boxShadow: m.self ? `inset 0 0 0 1px ${T.color.lineStrong}` : 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    ...sans(size * 0.36, m.self ? T.color.textMed : T.color.textHigh, { fontWeight: 600 }) }}>{m.id}</div>
);

const PalanqueeEditor = ({ compact }) => (
  <>
    <div style={{ display: 'flex', flexDirection: 'column', borderRadius: T.radius.md, boxShadow: `inset 0 0 0 1px ${T.color.line}` }}>
      {TEAM.map((m, i) => (
        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
          borderTop: i ? `1px solid ${T.color.line}` : 'none' }}>
          <Avatar m={m} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={sans(14, T.color.textHigh, { fontWeight: 500 })}>{m.n}{m.self && <span style={sans(12, T.color.textLow)}> · toi</span>}</div>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 10px', borderRadius: T.radius.sm,
            boxShadow: `inset 0 0 0 1px ${T.color.lineStrong}`, ...mono(12, T.color.textMed) }}>{m.lvl}<Icons.chevronDown size={12} /></span>
          {m.self
            ? <span style={{ width: 32 }} />
            : <span aria-label={`Retirer ${m.n}`} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: T.color.textLow, borderRadius: T.radius.sm }}><Ix.x size={14} /></span>}
        </div>
      ))}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <GhostAdd>Ajouter un plongeur</GhostAdd>
      {!compact && <span style={sans(12, T.color.textLow)}>Fréquents :</span>}
      {!compact && ['Élise Marchand', 'Rémi Pascal'].map((n) => (
        <span key={n} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px',
          borderRadius: T.radius.pill, boxShadow: `inset 0 0 0 1px ${T.color.line}`, ...sans(12, T.color.textMed) }}>
          <Icons.plus size={12} />{n}
        </span>
      ))}
    </div>
  </>
);

/* ── Sections (contenu partagé desktop / mobile) ────────── */
const SecEssentiel = ({ compact, errors }) => (
  <Section n="1" title="L'essentiel" pad={compact ? 16 : 24}
    aside={!compact && <span style={sans(12, T.color.textLow)}><span style={{ color: T.color.accent }}>*</span> obligatoire</span>}>
    <Row cols={compact ? '1fr' : 'minmax(0, 1fr) 140px'}>
      <Field label="Site" req state={errors ? 'error' : 'default'}
        msg={errors && 'Choisis un site ou crée-en un nouveau pour enregistrer la plongée.'}
        hint={!errors && 'Tes sites, ou un nouveau site créé à la volée.'}>
        <Input value={errors ? '' : 'La Bibliothèque'} ph="Rechercher un site…" monoValue={false}
          icon={<Icons.pin size={16} />} state={errors ? 'error' : 'default'}
          right={!errors && <span style={sans(12, T.color.textLow)}>Calvi · Corse</span>} />
      </Field>
      {!compact && (
        <Field label="N° de plongée" hint="Suit ton carnet.">
          <Input value="128" unit="#" />
        </Field>
      )}
    </Row>
    <Row cols={compact ? '1fr 1fr' : 'minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 1fr)'}>
      <Field label="Date" req style={compact ? { gridColumn: 'span 2' } : undefined}>
        <Input value={compact ? '09/04/2026' : 'jeu. 09/04/2026'} icon={<Ix.calendar size={16} />} />
      </Field>
      <Field label="Immersion" req><Input value="10:05" /></Field>
      <Field label="Sortie" req state={errors ? 'error' : 'default'}
        msg={errors && 'La sortie doit être après l\'immersion (10:05).'}>
        <Input value={errors ? '09:49' : '10:49'} state={errors ? 'error' : 'default'} />
      </Field>
    </Row>
    <Row cols={compact ? '1fr 1fr' : 'repeat(3, minmax(0, 1fr))'}>
      <Field label="Durée" hint={compact ? 'Calculée' : 'Calculée depuis les heures — modifiable.'}>
        <Input value="44" unit="min" icon={<Ix.link size={14} />} />
      </Field>
      <Field label="Profondeur max" req state="warning"
        msg={!compact && 'Au-delà de 40 m, limite d\'un N2 encadré. Vérifie la valeur.'}>
        <Input value="41" unit="m" state={compact ? 'default' : 'warning'} />
      </Field>
      {!compact && <span />}
    </Row>
    {compact && (
      <div style={{ display: 'flex', gap: 6, ...sans(12, T.color.warning, { lineHeight: 1.45 }) }}>
        <Ix.info size={14} style={{ marginTop: 1, flexShrink: 0 }} />Au-delà de 40 m, limite d'un N2 encadré.
      </div>
    )}
  </Section>
);

const SecDeroule = ({ compact }) => (
  <Section n="2" title="Déroulé" optional pad={compact ? 16 : 24}>
    <div>
      <SwitchRow label="Palier de sécurité" hint="Fait pendant la remontée" on>
        <Row cols={compact ? '1fr 1fr' : '160px 160px'}>
          <Field label="Durée"><Input value="3" unit="min" /></Field>
          <Field label="Profondeur"><Input value="5" unit="m" /></Field>
        </Row>
      </SwitchRow>
      <SwitchRow label="Paliers de décompression" hint="Imposés par ton ordinateur ou tes tables" on={false} />
      <SwitchRow label="Plongée successive" hint="Moins de 12 h après la précédente" on={false} />
    </div>
  </Section>
);

const SecPalanquee = ({ compact }) => (
  <Section n="3" title="Palanquée" optional pad={compact ? 16 : 24}
    aside={<span style={mono(12, T.color.textLow)}>3 plongeurs</span>}>
    <PalanqueeEditor compact={compact} />
  </Section>
);

const SecEquipement = ({ compact }) => (
  <Section n="4" title="Équipement & gaz" optional pad={compact ? 16 : 24}>
    <Row cols={compact ? '1fr' : '240px minmax(0, 1fr)'}>
      <Field label="Gaz"><Segmented options={['Air', 'Nitrox']} value="Air" /></Field>
      {!compact && <Field label="% O₂" hint="Air = 21 %"><Input value="21" unit="%" state="locked" /></Field>}
    </Row>
    <Row cols="1fr 1fr">
      <Field label="Bloc"><Input value="12" unit="L" /></Field>
      <Field label="Matériau"><Segmented options={['Acier', 'Alu']} value="Acier" /></Field>
    </Row>
    <Row cols="1fr 1fr">
      <Field label="Pression début"><Input value="200" unit="bar" /></Field>
      <Field label="Pression fin" state="focus" hint={!compact && '→ bar consommés calculés à l\'enregistrement'}>
        <Input value="5" unit="bar" state="focus" caret />
      </Field>
    </Row>
    <Row cols={compact ? '1fr 1fr' : '120px minmax(0, 1fr) 140px'}>
      <Field label="Combinaison"><Input value="7" unit="mm" /></Field>
      {!compact && <Field label="Type"><Segmented options={['Humide', 'Semi-étanche', 'Étanche']} value="Semi-étanche" /></Field>}
      <Field label="Lest"><Input value="6" unit="kg" /></Field>
    </Row>
    {compact && <Field label="Type de combinaison"><Segmented options={['Humide', 'Semi', 'Étanche']} value="Semi" /></Field>}
  </Section>
);

const SecConditions = ({ compact }) => (
  <Section n="5" title="Conditions" optional pad={compact ? 16 : 24}>
    <Row cols={compact ? '1fr 1fr' : '1fr 1fr'}>
      <Field label="Mise à l'eau"><Segmented options={['Bateau', 'Bord']} value="Bateau" /></Field>
      <Field label="Moment"><Segmented options={['Jour', 'Nuit']} value="Jour" /></Field>
    </Row>
    <Field label="Structure" hint="Club ou centre de plongée">
      <Input value="Calvi Plongée" monoValue={false} />
    </Field>
    <Row cols={compact ? '1fr 1fr' : 'minmax(0, 1fr) 140px'}>
      <Field label="Météo"><Input value="Ensoleillé" monoValue={false} right={<Icons.chevronDown size={14} style={{ color: T.color.textLow }} />} /></Field>
      <Field label="Air"><Input value="18" unit="°C" /></Field>
    </Row>
    <Field label="Mer"><Segmented options={['Calme', 'Belle', 'Agitée', 'Forte']} value="Belle" /></Field>
    <Field label="Courant"><Segmented options={['Nul', 'Faible', 'Moyen', 'Fort']} value="Faible" /></Field>
    <Row cols={compact ? '1fr 1fr' : 'repeat(3, minmax(0, 1fr))'}>
      <Field label="Eau surface"><Input value="16" unit="°C" /></Field>
      <Field label="Eau fond"><Input value="14" unit="°C" /></Field>
      <Field label="Visibilité" style={compact ? { gridColumn: 'span 2' } : undefined}><Input ph="—" unit="m" /></Field>
    </Row>
  </Section>
);

const SecNotes = ({ compact }) => (
  <Section n="6" title="Notes & observations" optional pad={compact ? 16 : 24}>
    <Field label="Notes">
      <div style={{ minHeight: compact ? 110 : 120, padding: 12, borderRadius: T.radius.md, background: T.color.surface0,
        boxShadow: STATE_RING.default, ...sans(14, T.color.textMuted, { lineHeight: 1.55 }) }}>
        Ce que tu as vu, ressenti, ce que tu veux retenir…
      </div>
    </Field>
    <Field label="Espèces observées" hint="Entrée pour ajouter · suggestions depuis tes plongées précédentes">
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, minHeight: 44, padding: '6px 8px',
        borderRadius: T.radius.md, background: T.color.surface0, boxShadow: STATE_RING.default }}>
        <Chip>Mérou brun</Chip><Chip>Gorgones rouges</Chip>
        <span style={{ ...sans(14, T.color.textMuted), padding: '0 4px' }}>Ajouter…</span>
      </div>
    </Field>
  </Section>
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

/* ── Aside : aperçu + navigation des sections + enregistrement ── */
const SECTIONS = [
  ['1', "L'essentiel", 'done', '5 / 5'],
  ['2', 'Déroulé', 'done', 'Palier 3 min'],
  ['3', 'Palanquée', 'done', '3 plongeurs'],
  ['4', 'Équipement & gaz', 'partial', 'Pression fin'],
  ['5', 'Conditions', 'partial', 'Visibilité'],
  ['6', 'Notes & observations', 'partial', 'Notes'],
];

const StatusDot = ({ s }) => {
  if (s === 'done') return <span style={{ width: 18, height: 18, borderRadius: 9, background: 'rgba(91,211,145,0.14)', color: T.color.success,
    display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ix.check size={11} sw={2.4} /></span>;
  if (s === 'partial') return <span style={{ width: 18, height: 18, borderRadius: 9, boxShadow: `inset 0 0 0 1.5px ${T.color.textLow}`,
    background: `linear-gradient(90deg, ${T.color.textLow} 50%, transparent 50%)`, opacity: 0.8 }} />;
  return <span style={{ width: 18, height: 18, borderRadius: 9, boxShadow: `inset 0 0 0 1.5px ${T.color.textMuted}` }} />;
};

const FormAside = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 28 }}>
    <Card elev={1} pad={20}>
      <Overline>Aperçu</Overline>
      <div style={{ marginTop: 10 }}>
        <div style={mono(11, T.color.textLow)}>#128 · jeu. 09 avr. 2026 · 10:05</div>
        <div style={sans(17, T.color.textHigh, { fontWeight: 600, marginTop: 4 })}>La Bibliothèque</div>
        <div style={sans(12, T.color.textLow)}>Calvi · Corse</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
        {[['Prof. max', '41', 'm', true], ['Durée', '44', 'min'], ['Temp. fond', '14', '°C'], ['Visibilité', '—', '']].map(([k, v, u, a]) => (
          <div key={k} style={{ padding: '10px 12px', borderRadius: T.radius.md, background: T.color.surface0,
            boxShadow: `inset 0 0 0 1px ${T.color.line}` }}>
            <div style={sans(11, T.color.textLow)}>{k}</div>
            <div><span style={mono(20, a ? T.color.accent : v === '—' ? T.color.textMuted : T.color.textHigh, { fontWeight: 600 })}>{v}</span>
              {u && <span style={mono(11, T.color.textLow)}> {u}</span>}</div>
          </div>
        ))}
      </div>
    </Card>

    <Card elev={1} pad={8}>
      <nav aria-label="Sections du formulaire">
        {SECTIONS.map(([n, label, s, sub], i) => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 12, height: 48, padding: '0 12px', borderRadius: T.radius.md,
            background: i === 3 ? T.color.surface2 : 'transparent', cursor: 'pointer' }}>
            <StatusDot s={s} />
            <span style={{ flex: 1, ...sans(13, i === 3 ? T.color.textHigh : T.color.textMed, { fontWeight: i === 3 ? 500 : 400 }) }}>{label}</span>
            <span style={mono(11, s === 'partial' ? T.color.textLow : T.color.textMuted)}>{s === 'partial' ? `− ${sub}` : sub}</span>
          </div>
        ))}
      </nav>
    </Card>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Btn kind="primary" icon={<Ix.check size={16} stroke={T.color.accentInk} sw={2.2} />}
        style={{ height: 48, justifyContent: 'center', fontSize: 15 }}>Enregistrer la plongée</Btn>
      <Btn kind="ghost" style={{ justifyContent: 'center' }}>Annuler</Btn>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, ...sans(12, T.color.textLow) }}>
        <Ix.cloud size={14} /> Brouillon enregistré sur l'appareil · 10:52
      </div>
    </div>
  </div>
);

/* ──────────────────────────────────────────────
   DESKTOP 1440 — Nouvelle plongée (préremplie depuis #127)
   ────────────────────────────────────────────── */
const DiveFormDesktop = () => (
  <div style={{ width: 1440, minHeight: 2880, background: T.color.abyss, display: 'flex', fontFamily: T.font.sans,
    color: T.color.textHigh,
    backgroundImage: `radial-gradient(1200px 600px at 80% -10%, rgba(79,214,201,0.04), transparent 60%),
                      radial-gradient(900px 500px at 10% 30%, rgba(27,49,86,0.35), transparent 60%)` }}>
    <Sidebar />
    <main style={{ flex: 1, padding: '28px 48px 48px', minWidth: 0 }}>
      <nav aria-label="Fil d'Ariane" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, ...sans(13, T.color.textLow) }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: T.color.textMed }}><Ix.chevronLeft size={16} /> Mes plongées</span>
        <span style={{ color: T.color.textMuted }}>/</span><span>Nouvelle plongée</span>
      </nav>
      <header style={{ marginBottom: 20 }}>
        <Overline style={{ color: T.color.accent }}>Carnet · plongée #128</Overline>
        <h1 style={{ margin: '8px 0 0', ...sans(T.type.display.size, T.color.textHigh), lineHeight: `${T.type.display.lh}px`,
          fontWeight: T.type.display.w, letterSpacing: T.type.display.ls }}>Nouvelle plongée</h1>
        <div style={{ ...sans(15, T.color.textMed), marginTop: 8 }}>
          Seule « L'essentiel » est obligatoire. <span style={{ color: T.color.textLow }}>Le reste se complète maintenant ou plus tard.</span>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 24, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Bandeau préremplissage */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: T.radius.md,
            background: T.color.accentSoft, boxShadow: `inset 0 0 0 1px ${T.color.accentLine}` }}>
            <Ix.copy size={16} style={{ color: T.color.accent }} />
            <span style={{ flex: 1, ...sans(13, T.color.textHigh) }}>
              Prérempli depuis <span style={mono(13, T.color.accent)}>#127</span> · Pointe de la Revellata
              <span style={{ color: T.color.textMed }}> — palanquée, équipement et conditions repris.</span>
            </span>
            <span style={{ ...sans(13, T.color.textMed, { fontWeight: 500 }), textDecoration: 'underline', textUnderlineOffset: 3 }}>Repartir de zéro</span>
          </div>
          <SecEssentiel />
          <SecDeroule />
          <SecPalanquee />
          <SecEquipement />
          <SecConditions />
          <SecNotes />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 8 }}>
            <Btn kind="ghost">Annuler</Btn>
            <Btn kind="primary" icon={<Ix.check size={16} stroke={T.color.accentInk} sw={2.2} />}>Enregistrer la plongée</Btn>
          </div>
        </div>
        <FormAside />
      </div>
    </main>
  </div>
);

/* ──────────────────────────────────────────────
   MOBILE 375 — erreurs à l'enregistrement, sections facultatives repliées
   ────────────────────────────────────────────── */
const Collapsed = ({ n, title, summary, status }) => (
  <Card elev={1} pad={0}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 60, padding: '0 16px' }}>
      <span style={{ width: 26, height: 26, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: T.color.surface0, boxShadow: `inset 0 0 0 1px ${T.color.lineStrong}`, ...mono(12, T.color.textMed) }}>{n}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={sans(15, T.color.textHigh, { fontWeight: 600 })}>{title}</div>
        <div style={sans(12, status === 'empty' ? T.color.textMuted : T.color.textLow, { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' })}>{summary}</div>
      </div>
      <StatusDot s={status} />
      <Icons.chevronDown size={16} style={{ color: T.color.textLow }} />
    </div>
  </Card>
);

const DiveFormMobile = () => (
  <div style={{ width: 375, minHeight: 1200, position: 'relative', background: T.color.abyss, fontFamily: T.font.sans,
    color: T.color.textHigh,
    backgroundImage: `radial-gradient(500px 320px at 80% -10%, rgba(79,214,201,0.05), transparent 60%)` }}>
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 12px',
      background: 'rgba(6,12,24,0.85)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${T.color.line}` }}>
      <button aria-label="Annuler" style={{ width: 44, height: 44, background: 'transparent', border: 'none', color: T.color.textHigh,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ix.x size={20} /></button>
      <span style={sans(15, T.color.textHigh, { fontWeight: 600 })}>Nouvelle plongée</span>
      <span style={{ width: 44, ...mono(12, T.color.textLow), textAlign: 'center' }}>#128</span>
    </header>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 16px 120px' }}>
      {/* Résumé d'erreurs */}
      <div role="alert" style={{ padding: '12px 14px', borderRadius: T.radius.md, background: 'rgba(224,106,112,0.10)',
        boxShadow: `inset 0 0 0 1px rgba(224,106,112,0.45)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...sans(14, T.color.textHigh, { fontWeight: 600 }) }}>
          <Ix.alert size={16} style={{ color: T.color.danger }} /> 2 champs à corriger
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 6, paddingLeft: 24 }}>
          {['Site', 'Sortie'].map((f) => (
            <span key={f} style={{ ...sans(13, T.color.danger, { fontWeight: 500 }), textDecoration: 'underline', textUnderlineOffset: 3 }}>{f}</span>
          ))}
        </div>
      </div>
      <SecEssentiel compact errors />
      <Collapsed n="2" title="Déroulé" summary="Palier de sécurité 3 min à 5 m" status="done" />
      <Collapsed n="3" title="Palanquée" summary="Toi, Lucas Bernard, Thao Nguyen" status="done" />
      <Collapsed n="4" title="Équipement & gaz" summary="Air · 12 L · 200 bar · 7 mm" status="partial" />
      <Collapsed n="5" title="Conditions" summary="Bateau · Belle · Faible · 16 → 14 °C" status="partial" />
      <Collapsed n="6" title="Notes & observations" summary="Rien pour l'instant" status="empty" />
    </div>

    {/* Barre d'action collante */}
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '12px 16px 24px',
      background: 'rgba(6,12,24,0.92)', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.color.line}` }}>
      <Btn kind="primary" icon={<Ix.check size={16} stroke={T.color.accentInk} sw={2.2} />}
        style={{ width: '100%', height: 48, justifyContent: 'center', fontSize: 15 }}>Enregistrer la plongée</Btn>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8, ...sans(11, T.color.textLow) }}>
        <Ix.cloud size={13} /> Brouillon enregistré sur l'appareil
      </div>
    </div>
  </div>
);

/* ──────────────────────────────────────────────
   COMBOBOX SITE (ouverte)
   ────────────────────────────────────────────── */
const SiteCombobox = () => (
  <div style={{ width: 600, padding: 24, background: T.color.abyss, fontFamily: T.font.sans }}>
    <Field label="Site" req>
      <Input value="revel" monoValue={false} icon={<Icons.search size={16} />} state="focus" caret />
    </Field>
    <div role="listbox" style={{ marginTop: 6, padding: 6, borderRadius: T.radius.lg, background: T.color.surface2,
      boxShadow: `inset 0 0 0 1px ${T.color.lineStrong}, ${T.shadow.raised}` }}>
      <div style={{ padding: '8px 10px 6px' }}><Overline>Mes sites</Overline></div>
      {[
        ['Pointe de la Revellata', 'Calvi · Corse', '8 plongées', true],
        ['Revellata — Grotte aux Corbs', 'Calvi · Corse', '1 plongée'],
      ].map(([n, r, c, on]) => (
        <div key={n} role="option" aria-selected={!!on} style={{ display: 'flex', alignItems: 'center', gap: 12, height: 52, padding: '0 10px',
          borderRadius: T.radius.md, background: on ? 'rgba(154,186,224,0.08)' : 'transparent' }}>
          <Icons.pin size={16} style={{ color: on ? T.color.accent : T.color.textLow }} />
          <div style={{ flex: 1 }}>
            <div style={sans(14, T.color.textHigh, { fontWeight: 500 })}>
              {n.slice(0, n.indexOf('Revel'))}
              <mark style={{ background: 'transparent', color: T.color.accent }}>Revel</mark>
              {n.slice(n.indexOf('Revel') + 5)}
            </div>
            <div style={sans(12, T.color.textLow)}>{r}</div>
          </div>
          <span style={mono(11, T.color.textLow)}>{c}</span>
        </div>
      ))}
      <div style={{ height: 1, background: T.color.line, margin: '6px 4px' }} />
      <div role="option" style={{ display: 'flex', alignItems: 'center', gap: 12, height: 52, padding: '0 10px', borderRadius: T.radius.md }}>
        <span style={{ width: 16, display: 'flex', color: T.color.accent }}><Icons.plus size={16} stroke={T.color.accent} sw={2} /></span>
        <div style={{ flex: 1 }}>
          <div style={sans(14, T.color.accent, { fontWeight: 500 })}>Créer le site « revel »</div>
          <div style={sans(12, T.color.textLow)}>Nom, région et position à préciser ensuite</div>
        </div>
      </div>
    </div>
    <div style={{ ...mono(10, T.color.textMuted), marginTop: 10, letterSpacing: 0.3 }}>↑↓ pour naviguer · Entrée pour choisir · Échap pour fermer</div>
  </div>
);

Object.assign(window, { DiveFormDesktop, DiveFormMobile, SiteCombobox });
})();
