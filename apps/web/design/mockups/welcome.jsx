// Accueil public — présentation de l'app + connexion / inscription.
// Desktop 1440 (connexion dans le hero) · carte « Créer un compte » · mobile 375 (présentation + écran de connexion).
// Réutilise DashboardDesktop / MobileNominal (aperçus produit réels). IIFE : pas de collision de noms.

(function () {
const T = window.DL_TOKENS;
const { Icon, Icons, Overline, Btn, Card } = window;

/* ── Icons ───────────────────────────────────────────────── */
const Ix = {
  chevronLeft: (p) => <Icon {...p} d="M15 6l-6 6 6 6" />,
  check: (p) => <Icon {...p} d="m5 12 5 5 9-10" />,
  x: (p) => <Icon {...p} d="M6 6l12 12M18 6 6 18" />,
  eye: (p) => <Icon {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Icon>,
  eyeOff: (p) => <Icon {...p}><path d="M3 3l18 18" /><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></Icon>,
  alert: (p) => <Icon {...p}><path d="M12 3 2 20h20L12 3z" /><path d="M12 10v4" /><path d="M12 17v.5" /></Icon>,
  book: (p) => <Icon {...p}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z" /><path d="M4 19a2 2 0 0 1 2-2h13" /><path d="M9 7h6" /></Icon>,
  users: (p) => <Icon {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7" /><path d="M18 14a6.5 6.5 0 0 1 3.5 6" /></Icon>,
  offline: (p) => <Icon {...p}><path d="M2 8.5a15 15 0 0 1 20 0" /><path d="M5.5 12a10 10 0 0 1 13 0" /><path d="M9 15.5a5 5 0 0 1 6 0" /><path d="M12 19h.01" /></Icon>,
  lock: (p) => <Icon {...p}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></Icon>,
  file: (p) => <Icon {...p}><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /><path d="M9 12h6M9 16h6" /></Icon>,
  edit: (p) => <Icon {...p}><path d="M4 20h4L19 9l-4-4L4 16v4z" /></Icon>,
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

const Brand = ({ size = 28 }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    <Logo size={size} /><span style={sans(size * 0.56, T.color.textHigh, { fontWeight: 600, letterSpacing: -0.2 })}>DiveLog</span>
  </div>
);

const RING = {
  default: `inset 0 0 0 1px ${T.color.lineStrong}`,
  focus: `inset 0 0 0 1px ${T.color.accent}, 0 0 0 3px rgba(79,214,201,0.18)`,
  error: `inset 0 0 0 1px ${T.color.danger}`,
};

const Field = ({ label, aside, children, msg, hint }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <label style={sans(13, T.color.textMed, { fontWeight: 500 })}>{label}</label>{aside}
    </div>
    {children}
    {msg && <div style={{ display: 'flex', gap: 6, ...sans(12, T.color.danger, { lineHeight: 1.45 }) }}><Ix.alert size={14} style={{ marginTop: 1, flexShrink: 0 }} />{msg}</div>}
    {hint && !msg && <div style={sans(12, T.color.textLow, { lineHeight: 1.45 })}>{hint}</div>}
  </div>
);

const Input = ({ value, ph, state = 'default', caret, right, secret }) => (
  <div style={{ height: 48, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', borderRadius: T.radius.md,
    background: T.color.surface0, boxShadow: RING[state] }}>
    <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden',
      ...(value ? sans(15, T.color.textHigh, secret ? { letterSpacing: 3 } : {}) : sans(15, T.color.textMuted)) }}>
      {value || ph}
      {caret && <span style={{ display: 'inline-block', width: 1.5, height: 18, background: T.color.accent, marginLeft: 1, verticalAlign: -3 }} />}
    </span>
    {right}
  </div>
);

const EyeBtn = ({ shown }) => (
  <span role="button" aria-label={shown ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
    style={{ display: 'flex', color: T.color.textLow, padding: 4 }}>{shown ? <Ix.eyeOff size={18} /> : <Ix.eye size={18} />}</span>
);

const LinkText = ({ children, size = 13 }) => (
  <span style={{ ...sans(size, T.color.accent, { fontWeight: 500 }), cursor: 'pointer' }}>{children}</span>
);

/* ── Carte d'authentification (onglets) ─────────────────── */
const Tabs = ({ value }) => (
  <div role="tablist" style={{ display: 'flex', padding: 4, borderRadius: T.radius.md, background: T.color.abyss,
    boxShadow: `inset 0 0 0 1px ${T.color.line}` }}>
    {['Se connecter', 'Créer un compte'].map((t) => {
      const on = t === value;
      return (
        <span key={t} role="tab" aria-selected={on} style={{ flex: 1, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 8, background: on ? T.color.surface2 : 'transparent', boxShadow: on ? `inset 0 0 0 1px ${T.color.lineStrong}` : 'none',
          ...sans(14, on ? T.color.textHigh : T.color.textLow, { fontWeight: on ? 500 : 400 }) }}>{t}</span>
      );
    })}
  </div>
);

const LoginForm = ({ error }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    {error && (
      <div role="alert" style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: T.radius.md, background: 'rgba(224,106,112,0.10)',
        boxShadow: 'inset 0 0 0 1px rgba(224,106,112,0.45)', ...sans(13, T.color.textHigh, { lineHeight: 1.45 }) }}>
        <Ix.alert size={16} style={{ color: T.color.danger, flexShrink: 0, marginTop: 1 }} />
        <span>E-mail ou mot de passe incorrect. Vérifie ta saisie ou réinitialise ton mot de passe.</span>
      </div>
    )}
    <Field label="E-mail"><Input value="marine.rousseau@mail.fr" state={error ? 'error' : 'default'} /></Field>
    <Field label="Mot de passe" aside={<LinkText size={12}>Mot de passe oublié ?</LinkText>}>
      <Input value="••••••••••" secret state={error ? 'error' : 'focus'} caret={!error} right={<EyeBtn />} />
    </Field>
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, ...sans(13, T.color.textMed) }}>
      <span style={{ width: 18, height: 18, borderRadius: 5, background: T.color.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Ix.check size={12} stroke={T.color.accentInk} sw={2.6} /></span>
      Rester connecté sur cet appareil
    </label>
    <Btn kind="primary" style={{ height: 48, justifyContent: 'center', fontSize: 15 }}>Se connecter</Btn>
  </div>
);

const Criterion = ({ ok, children }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...sans(12, ok ? T.color.success : T.color.textLow) }}>
    {ok ? <Ix.check size={13} sw={2.4} /> : <span style={{ width: 13, display: 'inline-flex', justifyContent: 'center' }}>·</span>}{children}
  </span>
);

const SignupForm = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <Field label="Prénom" hint="Affiché dans ton carnet et ta palanquée."><Input value="Marine" /></Field>
    <Field label="E-mail"><Input value="marine.rousseau@mail.fr" /></Field>
    <Field label="Mot de passe">
      <Input value="Plongee2026" state="focus" caret right={<EyeBtn shown />} />
      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
        {[1, 2, 3, 4].map((i) => <span key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= 3 ? T.color.success : 'rgba(154,186,224,0.14)' }} />)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: 4 }}>
        <Criterion ok>10 caractères min.</Criterion><Criterion ok>Une majuscule</Criterion>
        <Criterion ok>Un chiffre</Criterion><Criterion>Un caractère spécial (conseillé)</Criterion>
      </div>
    </Field>
    <Btn kind="primary" style={{ height: 48, justifyContent: 'center', fontSize: 15 }}>Créer mon carnet</Btn>
    <div style={sans(12, T.color.textLow, { lineHeight: 1.5, textAlign: 'center' })}>
      En créant un compte, tu acceptes les <span style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>conditions d'utilisation</span> et
      la <span style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>politique de confidentialité</span>.
    </div>
  </div>
);

const AuthCard = ({ tab = 'Se connecter', width = 440 }) => (
  <Card elev={2} pad={28} style={{ width, boxShadow: `inset 0 0 0 1px ${T.color.lineStrong}, ${T.shadow.raised}` }}>
    <div style={{ marginBottom: 20 }}>
      <div style={sans(22, T.color.textHigh, { fontWeight: 600, letterSpacing: -0.3 })}>
        {tab === 'Se connecter' ? 'Content de te revoir' : 'Ouvre ton carnet'}
      </div>
      <div style={{ ...sans(14, T.color.textMed), marginTop: 4 }}>
        {tab === 'Se connecter' ? 'Reprends ton carnet là où tu l\'as laissé.' : 'Une minute, et ton carnet est prêt.'}
      </div>
    </div>
    <div style={{ marginBottom: 20 }}><Tabs value={tab} /></div>
    {tab === 'Se connecter' ? <LoginForm /> : <SignupForm />}
  </Card>
);

/* ── Aperçu produit : dashboard réel, mis à l'échelle ───── */
const BrowserFrame = ({ scale = 0.5, children, w = 1440, h = 900 }) => (
  <div style={{ width: w * scale, borderRadius: 14, overflow: 'hidden', background: T.color.surface0,
    boxShadow: `inset 0 0 0 1px ${T.color.lineStrong}, 0 40px 80px rgba(0,0,0,0.55)` }}>
    <div style={{ height: 30, display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', borderBottom: `1px solid ${T.color.line}` }}>
      {[0, 1, 2].map((i) => <span key={i} style={{ width: 9, height: 9, borderRadius: 5, background: 'rgba(154,186,224,0.18)' }} />)}
    </div>
    <div style={{ width: w * scale, height: h * scale, overflow: 'hidden', position: 'relative' }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: '0 0', width: w, pointerEvents: 'none' }}>{children}</div>
    </div>
  </div>
);

const PhoneFrame = ({ scale = 0.62, children, h = 760 }) => (
  <div style={{ width: 375 * scale + 16, padding: 8, borderRadius: 30, background: '#0a1424',
    boxShadow: `inset 0 0 0 1px ${T.color.lineStrong}, 0 30px 60px rgba(0,0,0,0.55)` }}>
    <div style={{ width: 375 * scale, height: h * scale, borderRadius: 22, overflow: 'hidden' }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: '0 0', width: 375, pointerEvents: 'none' }}>{children}</div>
    </div>
  </div>
);

const Dash = () => { const D = window.DashboardDesktop; return D ? <D /> : null; };
const DashM = () => { const D = window.MobileNominal; return D ? <D /> : null; };

/* ── Contenus de présentation ───────────────────────────── */
const STEPS = [
  ['01', 'Saisis ta plongée', 'Site, heures, profondeur : l\'essentiel en une minute après la sortie. Le reste se complète plus tard.', Ix.edit],
  ['02', 'Retrouve-la en deux clics', 'Carnet numéroté comme ton carnet papier, filtres par région, profondeur, palanquée.', Ix.book],
  ['03', 'Vois ta progression', 'Temps sous l\'eau, profondeur max, sites explorés : ton parcours de plongeur d\'un coup d\'œil.', Icons.stats],
];

const FEATURES = [
  [Ix.book, 'Un vrai carnet', 'Numérotation qui suit ton carnet papier, déroulé, paliers, équipement et conditions.'],
  [Ix.users, 'Ta palanquée', 'Retrouve avec qui tu as plongé, et combien de fois.'],
  [Icons.map, 'Tes sites sur la carte', 'Tes sites restent privés. Crée-les en pleine saisie, place-les plus tard.'],
  [Icons.stats, 'Ton tableau de bord', 'Plongées par mois, record de profondeur, dernière sortie.'],
  [Ix.offline, 'Même sans réseau', 'Installe l\'app sur ton téléphone ; ta saisie est gardée sur le bateau.'],
  [Ix.lock, 'Tes données restent à toi', 'Aucune donnée de santé demandée. Ton carnet et tes sites ne sont visibles que par toi.'],
];

/* ──────────────────────────────────────────────
   DESKTOP 1440
   ────────────────────────────────────────────── */
const SectionTitle = ({ over, title, sub, center }) => (
  <div style={{ textAlign: center ? 'center' : 'left', marginBottom: 40 }}>
    <Overline style={{ color: T.color.accent }}>{over}</Overline>
    <h2 style={{ margin: '10px 0 0', ...sans(32, T.color.textHigh), lineHeight: '38px', fontWeight: 600, letterSpacing: -0.6 }}>{title}</h2>
    {sub && <p style={{ margin: center ? '10px auto 0' : '10px 0 0', maxWidth: 560, ...sans(16, T.color.textMed, { lineHeight: 1.55 }) }}>{sub}</p>}
  </div>
);

const WelcomeDesktop = () => (
  <div style={{ width: 1440, minHeight: 2760, background: T.color.abyss, fontFamily: T.font.sans, color: T.color.textHigh,
    backgroundImage: `radial-gradient(1100px 700px at 75% 5%, rgba(79,214,201,0.07), transparent 60%),
                      radial-gradient(900px 600px at 5% 20%, rgba(27,49,86,0.45), transparent 60%)` }}>
    {/* Header */}
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 80px' }}>
      <Brand />
      <nav style={{ display: 'flex', alignItems: 'center', gap: 32, ...sans(14, T.color.textMed) }}>
        <span>Comment ça marche</span><span>Fonctionnalités</span><span>Confidentialité</span>
      </nav>
    </header>

    {/* Hero */}
    <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 440px', gap: 80, alignItems: 'center', padding: '56px 80px 72px' }}>
      <div>
        <Overline style={{ color: T.color.accent }}>Carnet de plongée numérique · FFESSM · CMAS</Overline>
        <h1 style={{ margin: '16px 0 0', ...sans(56, T.color.textHigh), lineHeight: '60px', fontWeight: 600, letterSpacing: -1.6, maxWidth: 640 }}>
          Toutes tes plongées, dans un seul carnet.
        </h1>
        <p style={{ margin: '20px 0 0', maxWidth: 560, ...sans(18, T.color.textMed, { lineHeight: 1.55 }) }}>
          DiveLog remplace le carnet papier : saisis ta plongée en une minute après la sortie,
          retrouve-la en deux clics, et suis ta progression plongée après plongée.
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: '28px 0 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {['Numérotation qui suit ton carnet papier', 'Ta palanquée, ton équipement, tes conditions', 'Fonctionne même sans réseau, sur le bateau'].map((t) => (
            <li key={t} style={{ display: 'flex', alignItems: 'center', gap: 12, ...sans(15, T.color.textHigh) }}>
              <span style={{ width: 22, height: 22, borderRadius: 11, background: T.color.accentSoft, color: T.color.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ix.check size={13} sw={2.4} /></span>{t}
            </li>
          ))}
        </ul>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 32, ...sans(14, T.color.textLow) }}>
          <span style={{ width: 24, height: 1, background: T.color.lineStrong }} />
          Découvre l'app plus bas
          <Icons.chevronDown size={16} />
        </div>
      </div>
      <AuthCard />
    </section>

    {/* Aperçu produit */}
    <section style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 0, padding: '24px 80px 96px', position: 'relative' }}>
      <BrowserFrame scale={0.66} h={860}><Dash /></BrowserFrame>
      <div style={{ marginLeft: -110, marginBottom: -40 }}><PhoneFrame scale={0.6} h={720}><DashM /></PhoneFrame></div>
    </section>

    {/* Comment ça marche */}
    <section style={{ padding: '24px 80px 96px' }}>
      <SectionTitle center over="Comment ça marche" title="Trois gestes, un carnet toujours à jour" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        {STEPS.map(([n, t, d, Ic]) => (
          <Card key={n} elev={1} pad={28}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={mono(13, T.color.accent, { letterSpacing: 1 })}>{n}</span>
              <span style={{ color: T.color.textLow }}><Ic size={20} /></span>
            </div>
            <div style={sans(20, T.color.textHigh, { fontWeight: 600, letterSpacing: -0.3 })}>{t}</div>
            <p style={{ margin: '10px 0 0', ...sans(15, T.color.textMed, { lineHeight: 1.6 }) }}>{d}</p>
          </Card>
        ))}
      </div>
    </section>

    {/* Fonctionnalités */}
    <section style={{ padding: '24px 80px 96px' }}>
      <SectionTitle over="Fonctionnalités" title="Pensé par et pour des plongeurs" sub="Pas de gadget : ce qu'on note dans un carnet, en plus lisible." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, borderRadius: T.radius.lg, overflow: 'hidden',
        background: T.color.line, boxShadow: `inset 0 0 0 1px ${T.color.line}` }}>
        {FEATURES.map(([Ic, t, d]) => (
          <div key={t} style={{ background: T.color.surface0, padding: 28 }}>
            <span style={{ width: 40, height: 40, borderRadius: T.radius.md, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: T.color.surface2, boxShadow: `inset 0 0 0 1px ${T.color.lineStrong}`, color: T.color.textHigh }}><Ic size={18} /></span>
            <div style={{ ...sans(17, T.color.textHigh, { fontWeight: 600 }), marginTop: 16 }}>{t}</div>
            <p style={{ margin: '8px 0 0', ...sans(14, T.color.textMed, { lineHeight: 1.6 }) }}>{d}</p>
          </div>
        ))}
      </div>
    </section>

    {/* CTA final */}
    <section style={{ padding: '0 80px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40, padding: '40px 48px', borderRadius: T.radius.xl,
        background: `radial-gradient(600px 300px at 90% 0%, rgba(79,214,201,0.12), transparent 70%), ${T.color.surface1}`,
        boxShadow: `inset 0 0 0 1px ${T.color.lineStrong}` }}>
        <div>
          <div style={sans(28, T.color.textHigh, { fontWeight: 600, letterSpacing: -0.5 })}>Ta prochaine plongée mérite mieux qu'un post-it.</div>
          <div style={{ ...sans(16, T.color.textMed), marginTop: 8 }}>Crée ton carnet, et reporte tes anciennes plongées à ton rythme.</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          <Btn kind="secondary" style={{ height: 48, padding: '0 20px' }}>Se connecter</Btn>
          <Btn kind="primary" style={{ height: 48, padding: '0 22px', fontSize: 15 }}>Créer mon carnet</Btn>
        </div>
      </div>
    </section>

    <footer style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '28px 80px 40px',
      borderTop: `1px solid ${T.color.line}` }}>
      <Brand size={22} />
      <div style={{ display: 'flex', gap: 28, ...sans(13, T.color.textLow) }}>
        <span>Mentions légales</span><span>Confidentialité</span><span>Conditions d'utilisation</span><span>Contact</span>
      </div>
    </footer>
  </div>
);

/* ──────────────────────────────────────────────
   CARTE « Créer un compte » (état de l'onglet)
   ────────────────────────────────────────────── */
const SignupCard = () => (
  <div style={{ width: 520, padding: 40, background: T.color.abyss, fontFamily: T.font.sans,
    backgroundImage: 'radial-gradient(500px 400px at 80% 0%, rgba(79,214,201,0.07), transparent 60%)' }}>
    <AuthCard tab="Créer un compte" />
  </div>
);

/* ──────────────────────────────────────────────
   MOBILE 375 — présentation
   ────────────────────────────────────────────── */
const WelcomeMobile = () => (
  <div style={{ width: 375, minHeight: 2470, background: T.color.abyss, fontFamily: T.font.sans, color: T.color.textHigh, position: 'relative',
    backgroundImage: `radial-gradient(500px 420px at 85% 0%, rgba(79,214,201,0.08), transparent 60%)` }}>
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 14px 20px' }}>
      <Brand size={26} />
      <span style={{ height: 44, display: 'flex', alignItems: 'center', padding: '0 4px', ...sans(14, T.color.accent, { fontWeight: 500 }) }}>Se connecter</span>
    </header>
    <section style={{ padding: '28px 20px 0' }}>
      <Overline style={{ color: T.color.accent }}>Carnet de plongée numérique</Overline>
      <h1 style={{ margin: '12px 0 0', ...sans(34, T.color.textHigh), lineHeight: '38px', fontWeight: 600, letterSpacing: -1 }}>
        Toutes tes plongées, dans un seul carnet.
      </h1>
      <p style={{ margin: '14px 0 0', ...sans(16, T.color.textMed, { lineHeight: 1.55 }) }}>
        Saisis ta plongée en une minute après la sortie, retrouve-la en deux clics, suis ta progression.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
        <Btn kind="primary" style={{ height: 52, justifyContent: 'center', fontSize: 16 }}>Créer mon carnet</Btn>
        <Btn kind="secondary" style={{ height: 52, justifyContent: 'center', fontSize: 15 }}>J'ai déjà un compte</Btn>
      </div>
    </section>
    <section style={{ display: 'flex', justifyContent: 'center', padding: '40px 0 8px' }}>
      <PhoneFrame scale={0.72} h={720}><DashM /></PhoneFrame>
    </section>
    <section style={{ padding: '40px 20px 0' }}>
      <Overline style={{ color: T.color.accent }}>Comment ça marche</Overline>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 16 }}>
        {STEPS.map(([n, t, d], i) => (
          <div key={n} style={{ display: 'flex', gap: 16, padding: '16px 0', borderTop: i ? `1px solid ${T.color.line}` : 'none' }}>
            <span style={mono(13, T.color.accent, { letterSpacing: 1, marginTop: 3 })}>{n}</span>
            <div>
              <div style={sans(17, T.color.textHigh, { fontWeight: 600 })}>{t}</div>
              <p style={{ margin: '6px 0 0', ...sans(14, T.color.textMed, { lineHeight: 1.55 }) }}>{d}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
    <section style={{ padding: '32px 20px 0' }}>
      <Overline style={{ color: T.color.accent }}>Fonctionnalités</Overline>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
        {FEATURES.map(([Ic, t, d]) => (
          <Card key={t} elev={1} pad={16} style={{ display: 'flex', gap: 14, borderRadius: T.radius.md }}>
            <span style={{ width: 36, height: 36, flexShrink: 0, borderRadius: T.radius.md, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: T.color.surface2, color: T.color.textHigh }}><Ic size={17} /></span>
            <div>
              <div style={sans(15, T.color.textHigh, { fontWeight: 600 })}>{t}</div>
              <div style={{ ...sans(13, T.color.textMed, { lineHeight: 1.5 }), marginTop: 3 }}>{d}</div>
            </div>
          </Card>
        ))}
      </div>
    </section>
    <section style={{ padding: '36px 20px 0' }}>
      <div style={{ padding: 24, borderRadius: T.radius.lg, background: T.color.surface1, boxShadow: `inset 0 0 0 1px ${T.color.lineStrong}` }}>
        <div style={sans(22, T.color.textHigh, { fontWeight: 600, letterSpacing: -0.3, lineHeight: 1.25 })}>Ta prochaine plongée mérite mieux qu'un post-it.</div>
        <Btn kind="primary" style={{ width: '100%', height: 52, justifyContent: 'center', fontSize: 16, marginTop: 18 }}>Créer mon carnet</Btn>
      </div>
    </section>
    <footer style={{ padding: '32px 20px 40px', display: 'flex', flexWrap: 'wrap', gap: '10px 20px', ...sans(13, T.color.textLow) }}>
      <span>Mentions légales</span><span>Confidentialité</span><span>Conditions</span><span>Contact</span>
    </footer>
  </div>
);

/* ──────────────────────────────────────────────
   MOBILE 375 — écran de connexion (erreur)
   ────────────────────────────────────────────── */
const LoginMobile = () => (
  <div style={{ width: 375, height: 812, background: T.color.abyss, fontFamily: T.font.sans, position: 'relative',
    backgroundImage: `radial-gradient(500px 400px at 85% 0%, rgba(79,214,201,0.07), transparent 60%)` }}>
    <header style={{ display: 'flex', alignItems: 'center', padding: '14px 12px 14px 10px' }}>
      <span style={{ height: 44, display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px', ...sans(14, T.color.textHigh, { fontWeight: 500 }) }}>
        <Ix.chevronLeft size={20} /> Accueil</span>
    </header>
    <div style={{ padding: '16px 20px 0' }}>
      <Logo size={40} />
      <h1 style={{ margin: '20px 0 6px', ...sans(28, T.color.textHigh), lineHeight: '34px', fontWeight: 600, letterSpacing: -0.6 }}>Content de te revoir</h1>
      <div style={sans(15, T.color.textMed)}>Reprends ton carnet là où tu l'as laissé.</div>
      <div style={{ marginTop: 28 }}><LoginForm error /></div>
      <div style={{ marginTop: 24, textAlign: 'center', ...sans(14, T.color.textMed) }}>
        Pas encore de compte ? <LinkText size={14}>Créer mon carnet</LinkText>
      </div>
    </div>
  </div>
);

Object.assign(window, { WelcomeDesktop, SignupCard, WelcomeMobile, LoginMobile });
})();
