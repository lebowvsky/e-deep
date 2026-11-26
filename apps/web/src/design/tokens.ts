// DiveLog — Design tokens · SOURCE OF TRUTH
// ------------------------------------------------------------
// Edit values HERE only. Then run `pnpm --filter web run tokens` to regenerate:
//   - src/styles/tokens/_tokens.scss   (SCSS variables)
//   - src/styles/tokens/_vars.scss     (:root CSS custom properties)
// Never hardcode a hex / px value in a component: go through the tokens.
// Reference: design/mockups/tokens.jsx · design/screenshots/00-visual-direction.png

export const color = {
  // Surfaces — deepest → elevated (navy stratification, never neutral grey)
  abyss: '#060C18', // page background
  surface0: '#0B1A2E', // sidebar, inset surfaces
  surface1: '#122544', // primary card surface
  surface2: '#1B3156', // popover / hovered / elevated
  surface3: '#24406D', // marker rings, chips, hover on surface2
  line: 'rgba(154, 186, 224, 0.10)', // hairline divider
  lineStrong: 'rgba(154, 186, 224, 0.18)',
  // a11y (form review): ring of a form field, ≥ 3:1 on surface0 and surface1 (SC 1.4.11). The
  // mockup's lineStrong (≈ 1.3:1) left an empty field without a visible edge.
  lineField: 'rgba(154, 186, 224, 0.6)',

  // Text emphasis scale
  textHigh: '#EAF2FB', // AAA on surface0 (~16:1) — titles + KPI
  textMed: '#AFC1D6', // AA on surface0 (7.4:1) — body copy
  // a11y (phase 5): #6E819A → #889BB2 so small text passes AA on every surface (≥ 4.5:1 on surface2).
  textLow: '#889BB2', // meta, captions, overlines
  textMuted: '#43556F', // disabled / decorative only

  // Accent — cold turquoise, used SPARINGLY (CTA, active state, peak datapoint)
  accent: '#4FD6C9',
  accentSoft: 'rgba(79, 214, 201, 0.14)',
  accentLine: 'rgba(79, 214, 201, 0.35)',
  accentInk: '#062A27', // text on accent fill

  // Semantic — desaturated, legible on dark. `*Soft` = badge background (colour at 12 %).
  success: '#5BD391',
  successSoft: 'rgba(91, 211, 145, 0.12)',
  warning: '#E7B24A',
  warningSoft: 'rgba(231, 178, 74, 0.12)',
  danger: '#E47C81', // a11y (phase 5): was #E06A70, 4.1:1 on its soft background
  dangerSoft: 'rgba(228, 124, 129, 0.12)',
  dangerLine: 'rgba(228, 124, 129, 0.45)', // ring of the error summary (dive-form.jsx · mobile)

  // Controls — secondary button fill (atoms.jsx · Btn secondary)
  controlFill: 'rgba(154, 186, 224, 0.06)',
  chipFill: 'rgba(154, 186, 224, 0.08)', // neutral chip (visual-direction · Chips & badges)
  ringSubtle: 'rgba(255, 255, 255, 0.08)', // inset ring on avatars

  // Overlays — mobile top bar glass and drawer scrim
  abyssGlass: 'rgba(6, 12, 24, 0.85)',
  scrim: 'rgba(6, 12, 24, 0.6)',

  // Data viz
  chart: '#4FD6C9',
  chartDim: 'rgba(79, 214, 201, 0.22)',
  chartBar: 'rgba(154, 186, 224, 0.22)', // non-peak bars
  gridline: 'rgba(154, 186, 224, 0.08)',

  // Map (MapLibre style) — coastlines, then borders and roads
  coast: 'rgba(154, 186, 224, 0.14)',
  coastDim: 'rgba(154, 186, 224, 0.09)',
  skeletonDot: 'rgba(154, 186, 224, 0.12)', // marker placeholders while loading

  // Dive log (dives-list.jsx)
  depthBar: 'rgba(154, 186, 224, 0.35)', // depth mini-bar, non-peak
  trackFill: 'rgba(154, 186, 224, 0.14)', // range slider rail
  groupHeader: 'rgba(11, 26, 46, 0.55)', // month header row of the dive table

  // Dive detail (dive-detail.jsx)
  runStopFill: 'rgba(91, 211, 145, 0.75)', // safety stop segment of the time bar (success × 0.75)

  // Sites (sites.jsx): glass over the map (surface0), « À compléter » filter ring
  mapOverlay: 'rgba(11, 26, 46, 0.85)', // zone chips
  mapOverlayStrong: 'rgba(11, 26, 46, 0.9)', // coordinates, placing hint, mini map links
  warningLine: 'rgba(231, 178, 74, 0.35)',

  // Landing (welcome.jsx): bezel of the phone frame around the product preview
  deviceBezel: '#0A1424',
} as const;

export const font = {
  sans: '"Geist Variable", "Geist", -apple-system, system-ui, sans-serif',
  mono: '"Geist Mono Variable", "Geist Mono", "JetBrains Mono", ui-monospace, monospace',
} as const;

// size / line-height / weight / letter-spacing (px)
export const type = {
  display: { size: 40, lh: 44, w: 600, ls: -1.0 },
  h1: { size: 28, lh: 34, w: 600, ls: -0.6 },
  h2: { size: 20, lh: 26, w: 600, ls: -0.3 },
  h3: { size: 16, lh: 22, w: 600, ls: -0.1 },
  body: { size: 14, lh: 20, w: 400, ls: 0 },
  bodyMed: { size: 14, lh: 20, w: 500, ls: 0 },
  button: { size: 14, lh: 20, w: 500, ls: -0.1 },
  buttonLg: { size: 15, lh: 20, w: 500, ls: -0.1 },
  buttonXl: { size: 16, lh: 20, w: 500, ls: -0.1 }, // full-width calls to action on phones (welcome.jsx)
  bodyLoose: { size: 14, lh: 22, w: 400, ls: 0 }, // empty-state explanations
  bodyXl: { size: 16, lh: 24, w: 400, ls: 0 },
  bodySm: { size: 13, lh: 18, w: 500, ls: 0 }, // compact labels (buddy names, avatar initials)
  caption: { size: 12, lh: 16, w: 500, ls: 0.1 },
  overline: { size: 11, lh: 14, w: 600, ls: 0.8 }, // mono + uppercase
  kpi: { size: 44, lh: 48, w: 600, ls: -1.2 }, // mono + tabular-nums
  chip: { size: 11, lh: 14, w: 400, ls: 0.2 }, // mono — badges / chips
  overlineSm: { size: 10, lh: 14, w: 600, ls: 0.8 }, // mono + uppercase — mobile labels
  captionSm: { size: 11, lh: 15, w: 400, ls: 0 }, // mobile KPI captions
  kpiSm: { size: 28, lh: 28, w: 600, ls: -0.6 }, // mono — mobile KPI tiles
  metric: { size: 26, lh: 30, w: 600, ls: -0.6 }, // mono — last dive metrics
  metricSm: { size: 18, lh: 22, w: 600, ls: -0.4 },
  figure: { size: 20, lh: 24, w: 600, ls: -0.4 }, // mono — chart total
  unit: { size: 16, lh: 20, w: 400, ls: 0 }, // mono — KPI units
  unitSm: { size: 12, lh: 16, w: 400, ls: 0 },
  unitXs: { size: 10, lh: 14, w: 400, ls: 0 },
  meta: { size: 10, lh: 14, w: 400, ls: 0.3 }, // mono — user level, footnotes
  bodyLg: { size: 15, lh: 22, w: 400, ls: 0 }, // drawer nav, header subtitle
  brand: { size: 15, lh: 20, w: 600, ls: -0.2 },
  brandSm: { size: 14, lh: 20, w: 600, ls: -0.1 },
  summary: { size: 24, lh: 28, w: 600, ls: -0.5 }, // mono — dive log summary band
  data: { size: 13, lh: 18, w: 400, ls: 0 }, // mono — table numbers, dates, pagination
  label: { size: 13, lh: 18, w: 600, ls: 0 }, // month group label
  title: { size: 24, lh: 30, w: 600, ls: -0.4 }, // empty dive log title
  measure: { size: 15, lh: 20, w: 500, ls: 0 }, // mono — mobile dive card measures
  runTime: { size: 22, lh: 26, w: 600, ls: -0.4 }, // mono — dive run immersion / exit (dive-detail.jsx)
  fieldValue: { size: 15, lh: 20, w: 400, ls: 0 }, // mono — numbers typed in a form field (dive-form.jsx)
  fieldHint: { size: 12, lh: 17, w: 400, ls: 0 }, // field help and messages (dive-form.jsx · Field)
  // Sites (sites.jsx)
  markerCount: { size: 11, lh: 14, w: 600, ls: 0 }, // mono — dive count inside a map marker
  markerCountSm: { size: 10, lh: 12, w: 600, ls: 0 }, // mono — small markers (mockup: 9, unreadable)
  titleSm: { size: 15, lh: 20, w: 600, ls: -0.1 }, // site name in the map preview
  panelTitle: { size: 18, lh: 24, w: 600, ls: -0.2 }, // title of the site panel
  metricXs: { size: 16, lh: 20, w: 600, ls: -0.2 }, // mono — figures of the map preview
  // Auth (welcome.jsx)
  cardTitle: { size: 22, lh: 28, w: 600, ls: -0.3 }, // title of the auth card
  bodyCompact: { size: 13, lh: 19, w: 400, ls: 0 }, // error banner, « Rester connecté »
  // Landing (welcome.jsx)
  hero: { size: 56, lh: 60, w: 600, ls: -1.6 }, // h1 of the landing page
  heroSm: { size: 34, lh: 38, w: 600, ls: -1 }, // the same on phones
  lead: { size: 18, lh: 28, w: 400, ls: 0 }, // paragraph under it
  sectionTitle: { size: 32, lh: 38, w: 600, ls: -0.6 },
  featureTitle: { size: 17, lh: 22, w: 600, ls: 0 },
  bodyLgLoose: { size: 15, lh: 24, w: 400, ls: 0 }, // text of the steps
  stepIndex: { size: 13, lh: 18, w: 500, ls: 1 }, // mono — « 01 », « 02 », « 03 »
} as const;

// 4px scale
export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 32,
  8: 40,
  9: 48,
  10: 64,
  11: 80,
} as const;

// segment: option of a form segmented control (dive-form.jsx · Segmented).
export const radius = {
  xxs: 2,
  xs: 4,
  sm: 6,
  segment: 8,
  screen: 22, // screen inside the phone frame (landing preview)
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
  device: 30, // phone frame of the landing preview
} as const;

export const shadow = {
  card: 'inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 6px 24px rgba(0, 0, 0, 0.35)',
  raised: 'inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 12px 40px rgba(0, 0, 0, 0.45)',
  focus: '0 0 0 2px rgba(79, 214, 201, 0.55)',
  accentGlow: '0 0 0 1px rgba(79, 214, 201, 0.2), 0 6px 20px rgba(79, 214, 201, 0.12)',
  navIndicator: '0 0 10px #4FD6C9',
  drawer: '10px 0 40px rgba(0, 0, 0, 0.5)',
  fab: '0 0 0 4px rgba(79, 214, 201, 0.15), 0 10px 28px rgba(79, 214, 201, 0.4)',
  dotRing: '0 0 0 2px #060C18', // notification dot cut out of the page background
  ringSurface: '0 0 0 2px #122544', // overlapping avatars on a surface1 card
  marker: 'inset 0 0 0 1px rgba(79, 214, 201, 0.35), 0 4px 12px rgba(0, 0, 0, 0.4)',
  popover: 'inset 0 0 0 1px rgba(154, 186, 224, 0.18), 0 12px 32px rgba(0, 0, 0, 0.5)',
  peak: '0 0 16px rgba(79, 214, 201, 0.3)',
  ringSurface2: '0 0 0 2px #1B3156', // overlapping avatars on a hovered row (surface2)
  thumb: '0 0 0 4px rgba(79, 214, 201, 0.14)', // range slider handle
  sheet: 'inset 0 1px 0 rgba(154, 186, 224, 0.18), 0 -20px 50px rgba(0, 0, 0, 0.5)',
  // Landing preview frames (welcome.jsx · BrowserFrame, PhoneFrame)
  browserFrame: '0 40px 80px rgba(0, 0, 0, 0.55)',
  phoneFrame: '0 30px 60px rgba(0, 0, 0, 0.55)',
} as const;

// Page backgrounds: abyss + two discreet radial glows (dashboard mockups).
export const gradient = {
  pageMobile:
    'radial-gradient(500px 320px at 80% -10%, rgba(79, 214, 201, 0.05), transparent 60%), radial-gradient(400px 250px at -10% 20%, rgba(27, 49, 86, 0.35), transparent 60%)',
  pageDesktop:
    'radial-gradient(1200px 600px at 80% -10%, rgba(79, 214, 201, 0.04), transparent 60%), radial-gradient(900px 500px at 10% 30%, rgba(27, 49, 86, 0.35), transparent 60%)',
  mapEmpty: 'radial-gradient(900px 400px at 50% 60%, rgba(27, 49, 86, 0.35), transparent 70%)',
  // Landing (welcome.jsx · WelcomeDesktop, WelcomeMobile, final call to action)
  publicDesktop:
    'radial-gradient(1100px 700px at 75% 5%, rgba(79, 214, 201, 0.07), transparent 60%), radial-gradient(900px 600px at 5% 20%, rgba(27, 49, 86, 0.45), transparent 60%)',
  publicMobile: 'radial-gradient(500px 420px at 85% 0%, rgba(79, 214, 201, 0.08), transparent 60%)',
  ctaPanel: 'radial-gradient(600px 300px at 90% 0%, rgba(79, 214, 201, 0.12), transparent 70%)',
} as const;

export const motion = {
  ease: {
    out: 'cubic-bezier(.2, .7, .3, 1)',
    in: 'cubic-bezier(.5, 0, .75, 0)',
    std: 'cubic-bezier(.4, 0, .2, 1)',
  },
  // ms (toast: time on screen; announce: quiet time before a live region speaks, e.g. the
  // password criteria, so that a screen reader is not interrupted at every keystroke)
  dur: { fast: 120, base: 180, slow: 280, toast: 4000, announce: 1000 },
} as const;

// Content dimmed while a refresh is in flight.
export const opacity = {
  busy: 0.6,
  mapGridEmpty: 0.4,
  spark: 0.7,
  ghost: 0.5, // ghost logbook lines of the empty dive log
  disabled: 0.45, // missing previous / next dive tile (dive-detail.jsx)
} as const;

// Stacking levels (unitless). The app's bars (10) and drawer (20) still hold their own values.
export const zIndex = {
  skipLink: 30, // above everything once focused
} as const;

export const breakpoint = {
  mobile: 375, // baseline
  tablet: 768, // sidebar appears
  desktop: 1024,
  large: 1280, // 4 KPI columns and paired cards (too tight at 1024 with the sidebar)
  wide: 1440, // primary desktop target
} as const;

export const layout = {
  sidebarWidth: 240,
  hitTarget: 44, // Fitts — min touch target
  fabSize: 56,
  contentMaxWidth: 640, // single-column pages (no sidebar yet)
  controlHeight: 40, // buttons (atoms.jsx · Btn)
  avatarSm: 32,
  avatarMd: 36,
  avatarLg: 40,
  badgePadX: 10,
  badgePadY: 6,
  badgeGap: 6,
  badgeDot: 6,
  sidebarPadY: 28,
  navPadX: 14,
  navIndicatorWidth: 3,
  topBarPadY: 14,
  drawerWidth: 296,
  brandMark: 28,
  brandMarkSm: 24,
  brandGlyph: 16,
  brandGlyphSm: 13,
  brandRadius: 8,
  blurGlass: 12,
  blurScrim: 6,
  hairline: 2, // map scale bar, empty chart bar
  avatarXs: 26,
  kpiMinHeight: 148,
  tileMinHeight: 96,
  tilePad: 14,
  sparkHeight: 30,
  mapHeight: 440,
  mapHeightSm: 280,
  mapHeaderScrim: 120, // dashboard map: veil under its header, over the tiles
  mapHeaderScrimSm: 64,
  mapGrid: 60,
  mapGridSm: 40,
  markerMd: 28,
  popoverWidth: 200,
  popoverTail: 12,
  filterHeight: 30,
  scaleBar: 60,
  chartHeight: 120,
  chartHeightSm: 80,
  barMaxWidth: 24,
  buddyCard: 180,
  buddyCardSm: 140,
  emptyCardMinHeight: 260,
  emptyIcon: 48,
  emptyTextMax: 420,
  emptyCardTextMax: 300,
  skelText: 10,
  skelTitle: 22,
  skelKpi: 36,
  skelFilterWidth: 38,
  skelFilterHeight: 28,
  // Dive log (dives-list.jsx)
  rowHeight: 60,
  tableHeadHeight: 44,
  groupHeaderHeight: 40,
  colNumber: 64,
  colDate: 100,
  colDepth: 132,
  colDuration: 84,
  colTemp: 76,
  colGas: 84,
  colTeam: 168,
  colChevron: 24,
  depthBarWidth: 64,
  depthBarHeight: 4,
  depthValueWidth: 44,
  searchWidth: 340,
  kbdPadY: 2,
  pageButton: 36,
  selectHeightSm: 32,
  chipHeight: 36,
  avatarXxs: 24,
  sheetTop: 56,
  sheetHandle: 36,
  sliderThumb: 24,
  segmentHeight: 36,
  filterPopoverWidth: 320,
  emptyLogMinHeight: 560,
  emptyIconLg: 56,
  emptyTextMaxLg: 460,
  // Dive detail (dive-detail.jsx)
  detailAsideWidth: 360, // side column (site, dive team) from 1280px
  miniMapHeight: 170,
  miniMapHeightSm: 150,
  runBarHeight: 10, // dive run time bar
  pagerTileMinHeight: 64, // previous / next tiles on phones
  siteMarkerDot: 10, // dot inside the site marker of the mini map
  notesMaxWidth: 680, // reading width of the dive notes
  // Dive form (dive-form.jsx)
  fieldGap: 6, // label → control → message
  inputHeight: 44,
  inputGap: 10, // icon, value, unit inside a field
  controlInset: 3, // inner padding of the form segmented control and of the switch thumb
  switchWidth: 44,
  switchHeight: 26,
  switchThumb: 20,
  optionHeight: 52, // combobox option (two lines)
  listboxPad: 6,
  listboxMaxHeight: 320,
  textareaMinHeight: 120,
  dialogWidth: 400,
  formAsideWidth: 340, // sticky side column: preview, section summary, actions
  // Room kept clear of the sticky bars of the form when a field scrolls into view (SC 2.4.11): the
  // phone top bar (44 + 2 × 14 + 1) and the bottom save bar (12 + 48 + 8 + 15 + 24), rounded up.
  formTopBarClearance: 80,
  formBottomBarClearance: 120,
  stepBadge: 26, // numbered circle of a form section
  statusDot: 18, // section state (complete · partial · empty)
  statusRing: 1.5, // outline of the partial / empty section state
  listRowPadY: 10, // dive team rows, preview tiles
  formFieldSm: 120, // suit thickness
  formFieldMd: 140, // dive number, air temperature, weight
  formFieldLg: 160, // safety stop duration / depth
  formFieldXl: 240, // gas
  // Sites (sites.jsx)
  siteListWidth: 380, // list next to the map
  sitePanelWidth: 420, // add / place / edit panel, replaces the list
  mapPageMinHeight: 640,
  // Room above and below the map grid on desktop: page padding (32 + 48) and the header (~120).
  mapPageChrome: 200,
  sitePopoverWidth: 250, // preview of a marker
  siteMarkerMin: 18, // marker diameter for 1 dive…
  siteMarkerMax: 40, // …capped here
  siteMarkerStep: 2.2, // diameter added per dive
  siteMarkerHalo: 18, // halo of the selected marker = diameter + 18
  pickMarker: 24, // marker being placed (accent, dashed ring around it)
  pickMarkerRing: 52,
  blurMap: 8, // glass of the zone chips
  menuWidth: 230, // « … » menu of the site page
  siteMiniMapHeight: 300, // map of the site page
  siteMiniMapHeightSm: 240,
  siteSheetPeek: 96, // phone bottom sheet folded: its header only
  textareaMinHeightSm: 76, // « Accès & conseils » in the site panel
  rowHeightSm: 56, // « Tes plongées ici » rows
  colNumberSm: 52,
  colMeasure: 90, // depth, duration columns of « Tes plongées ici »
  colTeamSm: 110,
  // Auth (welcome.jsx)
  inputHeightLg: 48, // fields of the sign-in and sign-up forms
  authCardWidth: 440,
  cardPadLg: 28, // auth card (and, later, the landing cards)
  checkbox: 18,
  strengthBarHeight: 4, // segments of the password gauge
  brandMarkLg: 40, // logo of the auth screens
  brandGlyphLg: 22,
  // Landing (welcome.jsx)
  heroPadTop: 56,
  heroPadBottom: 72,
  heroTitleMax: 640,
  heroTextMax: 560, // hero paragraph, section subtitles
  sectionPadBottom: 96,
  checkBullet: 22, // ticked circle of the hero list
  featureIcon: 40,
  browserBarHeight: 30,
  browserDot: 9,
  previewDesktopWidth: 950, // 1440 × 0.66
  previewPhoneWidth: 225, // 375 × 0.6, overlapping the browser frame
  previewPhoneWidthSm: 270, // 375 × 0.72, alone on phones
  previewPhoneOverlapX: 110,
  previewPhoneOverlapY: 40,
  ctaHeightXl: 52, // full-width calls to action of the landing page on phones
  // Account (docs/plans/auth-screens.md · /settings, no mockup)
  settingsMaxWidth: 640, // reading width of the column of section cards
  settingsTermWidth: 140, // « Prénom et nom », « E-mail », « Niveau » beside their value
} as const;

// Icon sizes (px) — TS only: used as SVG width/height attributes.
export const iconSize = { xs: 12, sm: 14, md: 16, lg: 18, xl: 20, xxl: 22 } as const;

// Icon stroke widths — TS only (SVG attribute). `bold` = FAB plus.
export const iconStroke = { regular: 1.5, bold: 2.2, brand: 1.6 } as const;

// Buddy avatar backgrounds (dives-list.jsx · BUDDY) — TS only: picked per buddy at runtime, from
// the buddy id, since the colour is not stored. Muted navy-family tones under white initials.
export const avatarPalette = [
  '#3A5A82',
  '#2A6A6A',
  '#5A3A7A',
  '#3A7A5A',
  '#7A5A3A',
  '#3A4A7A',
  '#6A4A3A',
  '#2F5A6E',
  '#4A5A2F',
  '#6A3A52',
  '#3A6A7A',
  '#4A3A6E',
  '#5A6A3A',
  '#7A3A4A',
] as const;

export const tokens = {
  color,
  font,
  type,
  space,
  radius,
  shadow,
  gradient,
  motion,
  opacity,
  zIndex,
  breakpoint,
  layout,
  iconSize,
  iconStroke,
  avatarPalette,
};
export type Tokens = typeof tokens;
