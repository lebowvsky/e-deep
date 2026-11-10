// Dive log mocks — 127 realistic, deterministic dives (fixed seed).
//
// #118 → #127 copy the rows of the mockup (10-dives-desktop.png). #1 → #117 are generated from
// June 2019 to December 2025, then calibrated so that the log matches the mockups:
//   127 dives · 84 h 23 · 24,6 m on average · 42 m max · 23 sites · 14 divers
//   Corse 31 · Var 48 · Marseille 22 · Esterel 9 · Bretagne 17   (14-dives-mobile-filters.png)
//   Lucas 24 · Thao 18 · Élise 11, others ≤ 10                   (idem)
//   Corse + 20–40 m + Lucas = 9 dives                            (idem, « Afficher 9 plongées »)
//   3 wreck dives in Bretagne, none deeper than 40 m             (11-dives-no-results.png)
import type { GasMix } from '@e-deep/shared';
import type { DiveMember } from '@/shared/model/dive';
import type { DiveSiteRef, LoggedDive, RegionKey } from '../types';
import { createRandom, type Random } from './random';
import { BUDDIES, SELF, type BuddyKey } from './roster';
import { SITES, type MockSite, type SiteKey } from './sites';

const SEED = 20190615;

const TARGET = {
  totalMinutes: 84 * 60 + 23,
  /** 24,6 m on average over 127 dives. */
  depthSum: 3124,
  /** Old dives stay above 40 m: the 42 m of #127 is the record. */
  maxGeneratedDepth: 39,
  /** Dives in Corse, between 20 and 40 m, with Lucas. */
  corseWithLucasInRange: 9,
} as const;

// ── The 10 dives of the mockup ────────────────────────────────────────────────────────────────

interface FixedDive {
  number: number;
  date: string;
  site: SiteKey;
  depth: number;
  duration: number;
  temperature: number;
  gas: GasMix;
  team: BuddyKey[];
  notes?: string;
}

const FIXED: FixedDive[] = [
  {
    number: 127,
    date: '2026-04-08T10:30:00+02:00',
    site: 'revellata',
    depth: 42,
    duration: 38,
    temperature: 14,
    gas: 'AIR',
    team: ['LB', 'TN'],
    notes: 'Gorgones rouges et mérou au tombant.',
  },
  {
    number: 126,
    date: '2026-04-07T14:30:00+02:00',
    site: 'bibliotheque',
    depth: 28,
    duration: 46,
    temperature: 14,
    gas: 'NITROX32',
    team: ['LB', 'TN', 'EM', 'RP'],
  },
  {
    number: 125,
    date: '2026-04-06T10:00:00+02:00',
    site: 'b17',
    depth: 27,
    duration: 41,
    temperature: 14,
    gas: 'NITROX32',
    team: ['LB', 'TN', 'CL'],
  },
  {
    number: 124,
    date: '2026-04-05T15:00:00+02:00',
    site: 'puntaBianca',
    depth: 18,
    duration: 52,
    temperature: 15,
    gas: 'AIR',
    team: ['TN'],
  },
  {
    number: 123,
    date: '2026-03-22T09:30:00+01:00',
    site: 'moyades',
    depth: 35,
    duration: 40,
    temperature: 13,
    gas: 'AIR',
    team: ['EM', 'HD', 'NF'],
  },
  {
    number: 122,
    date: '2026-03-21T14:00:00+01:00',
    site: 'liban',
    depth: 32,
    duration: 35,
    temperature: 13,
    gas: 'AIR',
    team: ['EM', 'RP'],
  },
  {
    number: 121,
    date: '2026-03-08T10:00:00+01:00',
    site: 'secCroix',
    depth: 30,
    duration: 42,
    temperature: 13,
    gas: 'NITROX32',
    team: ['RP', 'CL', 'MA', 'HD', 'NF'],
  },
  {
    number: 120,
    date: '2026-02-15T10:30:00+01:00',
    site: 'gabiniere',
    depth: 38,
    duration: 37,
    temperature: 13,
    gas: 'AIR',
    team: ['SB'],
  },
  {
    number: 119,
    date: '2026-02-14T14:30:00+01:00',
    site: 'donator',
    depth: 39,
    duration: 32,
    temperature: 13,
    gas: 'AIR',
    team: ['SB', 'JK', 'MA'],
  },
  {
    number: 118,
    date: '2025-12-28T11:00:00+01:00',
    site: 'capRoux',
    depth: 24,
    duration: 44,
    temperature: 14,
    gas: 'AIR',
    team: ['JK'],
  },
];

// ── Quotas of the generated dives (#1 → #117) ─────────────────────────────────────────────────

/** Number of generated dives per site: 27 Corse, 20 Marseille, 45 Var, 8 Esterel, 17 Bretagne. */
const SITE_QUOTAS: Record<SiteKey, number> = {
  revellata: 6,
  bibliotheque: 5,
  b17: 4,
  puntaBianca: 5,
  scandola: 7,
  moyades: 6,
  liban: 5,
  chaouen: 5,
  imperial: 4,
  secCroix: 9,
  gabiniere: 10,
  donator: 4,
  sarranier: 8,
  vaisseau: 8,
  fourmigue: 6,
  capRoux: 5,
  lionDeMer: 3,
  amoco: 2,
  kleber: 1,
  pierresNoires: 4,
  basseJaune: 4,
  toulinguet: 3,
  septIles: 3,
};

/** Appearances of each diver in the generated dives (totals with the mockup rows: §header). */
const BUDDY_QUOTAS: Record<BuddyKey, number> = {
  LB: 21,
  TN: 14,
  EM: 8,
  RP: 7,
  SB: 8,
  JK: 8,
  CL: 8,
  MA: 8,
  HD: 8,
  NF: 8,
  YL: 10,
  GM: 10,
  PF: 10,
  IC: 10,
};

/** Number of buddies per generated dive beyond the first one: 138 slots over 117 dives. */
const EXTRA_BUDDIES = [4, 3, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];

/** Where each diver usually dives (weight per region, 1 = neutral). */
const AFFINITY: Partial<Record<BuddyKey, Partial<Record<RegionKey, number>>>> = {
  LB: { corse: 4 },
  TN: { corse: 2 },
  JK: { bretagne: 6 },
  YL: { bretagne: 12 },
  GM: { bretagne: 12 },
  EM: { marseille: 3 },
  HD: { marseille: 2 },
  NF: { marseille: 2 },
  SB: { var: 2 },
  MA: { var: 2 },
  PF: { var: 2, esterel: 3 },
  IC: { var: 2 },
};

const MONTH_WEIGHTS = [0.2, 0.3, 0.5, 0.7, 1, 1.3, 1.6, 1.6, 1.3, 0.8, 0.4, 0.2];
const MED_TEMPERATURE = [13, 13, 13, 14, 17, 20, 23, 24, 22, 19, 16, 14];
const BRITTANY_TEMPERATURE = [11, 10, 10, 11, 13, 15, 16, 17, 16, 15, 13, 12];

const NOTES = [
  'Mérou curieux sur le tombant.',
  'Courant fort au retour, remontée au parachute.',
  'Corail rouge sous les surplombs.',
  'Visibilité réduite, beaucoup de plancton.',
  'Banc de barracudas à la pointe.',
  'Murène dans la faille, poulpe sur le sable.',
  'Gorgones jaunes magnifiques.',
  'Exercices de remontée assistée avec le moniteur.',
  'Raie torpille posée dans l’herbier.',
  'Homards dans les éboulis.',
];

// ── Dates ─────────────────────────────────────────────────────────────────────────────────────

interface Slot {
  year: number;
  /** 0-based */
  month: number;
  day: number;
  hour: string;
}

/** Last Sunday of a month (EU daylight saving switches). */
function lastSunday(year: number, month: number): number {
  const last = new Date(Date.UTC(year, month + 1, 0));
  return last.getUTCDate() - last.getUTCDay();
}

/** Paris offset of a calendar day: +02:00 between the last Sundays of March and October. */
function parisOffset({ year, month, day }: Slot): string {
  const afterSpring = month > 2 || (month === 2 && day >= lastSunday(year, 2));
  const beforeAutumn = month < 9 || (month === 9 && day < lastSunday(year, 9));
  return afterSpring && beforeAutumn ? '+02:00' : '+01:00';
}

function toIso(slot: Slot): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${slot.year}-${pad(slot.month + 1)}-${pad(slot.day)}T${slot.hour}:00${parisOffset(slot)}`;
}

/** `count` distinct dive slots from June 2019 to mid-December 2025, the first one in June 2019. */
function drawSlots(random: Random, count: number): Slot[] {
  const months: { year: number; month: number }[] = [];
  for (let year = 2019; year <= 2025; year += 1) {
    for (let month = year === 2019 ? 5 : 0; month < 12; month += 1) months.push({ year, month });
  }
  const totalWeight = months.reduce((sum, { month }) => sum + (MONTH_WEIGHTS[month] ?? 0), 0);

  const pickMonth = () => {
    let target = random.next() * totalWeight;
    for (const entry of months) {
      target -= MONTH_WEIGHTS[entry.month] ?? 0;
      if (target <= 0) return entry;
    }
    return months[months.length - 1] ?? { year: 2025, month: 5 };
  };

  const slots = new Map<string, Slot>();
  const first: Slot = { year: 2019, month: 5, day: 15, hour: '10:00' };
  slots.set(toIso(first), first);
  while (slots.size < count) {
    const { year, month } = pickMonth();
    const lastDay = year === 2025 && month === 11 ? 20 : 28;
    const slot: Slot = {
      year,
      month,
      day: random.int(1, lastDay),
      hour: random.next() < 0.6 ? '10:00' : '14:30',
    };
    slots.set(toIso(slot), slot);
  }
  return [...slots.values()].sort((a, b) => toIso(a).localeCompare(toIso(b)));
}

// ── Generation ────────────────────────────────────────────────────────────────────────────────

interface Draft {
  slot: Slot;
  site: MockSite;
  depth: number;
  duration: number;
  team: BuddyKey[];
}

const isSummer = (slot: Slot) => slot.month >= 5 && slot.month <= 8;

/** Brittany in summer; the other sites spread over the remaining dates. */
function assignSites(random: Random, slots: Slot[]): Draft[] {
  const siteList = (Object.keys(SITE_QUOTAS) as SiteKey[]).flatMap((key) =>
    Array.from({ length: SITE_QUOTAS[key] }, () => SITES[key]),
  );
  const brittany = random.shuffle(siteList.filter((site) => site.region === 'bretagne'));
  const others = random.shuffle(siteList.filter((site) => site.region !== 'bretagne'));
  const summerIndexes = random
    .shuffle(slots.map((slot, index) => (isSummer(slot) ? index : -1)).filter((i) => i >= 0))
    .slice(0, brittany.length);

  return slots.map((slot, index) => {
    const site = summerIndexes.includes(index) ? brittany.pop() : others.pop();
    if (!site) throw new Error('Site quotas do not match the number of dives');
    const depth = random.int(
      site.depthRange[0],
      Math.min(site.depthRange[1], TARGET.maxGeneratedDepth),
    );
    const duration = Math.round(60 - depth * 0.5 + random.int(-6, 6));
    return { slot, site, depth, duration, team: [] };
  });
}

/** Fills the dive teams with the exact quotas: biggest teams first, then one buddy per dive. */
function assignTeams(random: Random, drafts: Draft[]): void {
  const remaining = { ...BUDDY_QUOTAS };
  const sizes = random.shuffle(drafts.map((_draft, index) => index));
  const teamSize = new Map(
    sizes.map((draftIndex, rank) => [draftIndex, 1 + (EXTRA_BUDDIES[rank] ?? 0)]),
  );
  const order = [...drafts.keys()].sort((a, b) => (teamSize.get(b) ?? 1) - (teamSize.get(a) ?? 1));

  for (const index of order) {
    const draft = drafts[index];
    if (!draft) continue;
    for (let slot = 0; slot < (teamSize.get(index) ?? 1); slot += 1) {
      let best: BuddyKey | null = null;
      let bestScore = 0;
      for (const key of Object.keys(remaining) as BuddyKey[]) {
        if (remaining[key] === 0 || draft.team.includes(key)) continue;
        const affinity = AFFINITY[key]?.[draft.site.region] ?? 1;
        const score = remaining[key] * affinity * (0.5 + random.next());
        if (score > bestScore) [best, bestScore] = [key, score];
      }
      if (!best) throw new Error('Buddy quotas do not match the team sizes');
      draft.team.push(best);
      remaining[best] -= 1;
    }
  }
}

/** Exactly `corseWithLucasInRange` dives in Corse, 20–40 m, with Lucas (mockup row #126 & #125 included). */
function calibrateCorseWithLucas(drafts: Draft[]): void {
  const fixedInRange = FIXED.filter(
    (dive) =>
      SITES[dive.site].region === 'corse' &&
      dive.team.includes('LB') &&
      dive.depth >= 20 &&
      dive.depth <= 40,
  ).length;
  const wanted = TARGET.corseWithLucasInRange - fixedInRange;
  const candidates = drafts
    .filter((draft) => draft.site.region === 'corse' && draft.team.includes('LB'))
    .sort((a, b) => b.site.depthRange[1] - a.site.depthRange[1]);
  if (candidates.length < wanted) throw new Error('Not enough dives with Lucas in Corse');

  candidates.forEach((draft, rank) => {
    draft.depth = rank < wanted ? Math.max(draft.depth, 20) : Math.min(draft.depth, 19);
  });
}

/** Moves values one unit at a time, within bounds, until their sum reaches `target`. */
function calibrateSum(
  random: Random,
  items: Draft[],
  target: number,
  read: (draft: Draft) => number,
  write: (draft: Draft, value: number) => void,
  bounds: (draft: Draft) => [number, number],
): void {
  let gap = target - items.reduce((sum, draft) => sum + read(draft), 0);
  const order = random.shuffle(items);
  while (gap !== 0) {
    let moved = false;
    for (const draft of order) {
      if (gap === 0) break;
      const step = Math.sign(gap);
      const [min, max] = bounds(draft);
      const next = read(draft) + step;
      if (next < min || next > max) continue;
      write(draft, next);
      gap -= step;
      moved = true;
    }
    if (!moved) throw new Error('Calibration impossible within the bounds');
  }
}

function pickGas(random: Random, depth: number): GasMix {
  const draw = random.next();
  if (depth <= 28 && draw < 0.08) return 'NITROX36';
  if (depth <= 32 && draw < 0.35) return 'NITROX32';
  return 'AIR';
}

function temperatureOf(random: Random, draft: Draft): number {
  const table = draft.site.region === 'bretagne' ? BRITTANY_TEMPERATURE : MED_TEMPERATURE;
  return (table[draft.slot.month] ?? 15) + random.int(-1, 1);
}

const toSiteRef = ({ id, name, place, region }: MockSite): DiveSiteRef => ({
  id,
  name,
  place,
  region,
});

const toTeam = (keys: readonly BuddyKey[]): DiveMember[] => [
  SELF,
  ...keys.map((key) => BUDDIES[key]),
];

function fixedDive(dive: FixedDive): LoggedDive {
  return {
    id: `d${dive.number}`,
    number: dive.number,
    date: dive.date,
    site: toSiteRef(SITES[dive.site]),
    team: toTeam(dive.team),
    depthMaxM: dive.depth,
    durationMin: dive.duration,
    temperatureC: dive.temperature,
    gasMix: dive.gas,
    notes: dive.notes ?? null,
  };
}

export function generateDives(): LoggedDive[] {
  const random = createRandom(SEED);
  const generatedCount = Object.values(SITE_QUOTAS).reduce((sum, count) => sum + count, 0);
  const drafts = assignSites(random, drawSlots(random, generatedCount));
  assignTeams(random, drafts);
  calibrateCorseWithLucas(drafts);

  const fixedDepth = FIXED.reduce((sum, dive) => sum + dive.depth, 0);
  const fixedMinutes = FIXED.reduce((sum, dive) => sum + dive.duration, 0);
  const isCorseWithLucas = (draft: Draft) =>
    draft.site.region === 'corse' && draft.team.includes('LB');
  // Corse + Lucas depths are set by the previous step: they stay out of the calibration.
  const lockedDepth = drafts.filter(isCorseWithLucas).reduce((sum, draft) => sum + draft.depth, 0);
  calibrateSum(
    random,
    drafts.filter((draft) => !isCorseWithLucas(draft)),
    TARGET.depthSum - fixedDepth - lockedDepth,
    (draft) => draft.depth,
    (draft, value) => (draft.depth = value),
    (draft) => [
      draft.site.depthRange[0],
      Math.min(draft.site.depthRange[1], TARGET.maxGeneratedDepth),
    ],
  );
  calibrateSum(
    random,
    drafts,
    TARGET.totalMinutes - fixedMinutes,
    (draft) => draft.duration,
    (draft, value) => (draft.duration = value),
    () => [25, 65],
  );

  const otherGas = new Set(random.shuffle([...drafts.keys()]).slice(0, 2));
  const missingTemperature = new Set(random.shuffle([...drafts.keys()]).slice(0, 3));
  const withNotes = new Set(random.shuffle([...drafts.keys()]).slice(0, NOTES.length));
  let noteIndex = 0;

  const generated = drafts.map((draft, index): LoggedDive => {
    const number = index + 1;
    return {
      id: `d${number}`,
      number,
      date: toIso(draft.slot),
      site: toSiteRef(draft.site),
      team: toTeam(draft.team),
      depthMaxM: draft.depth,
      durationMin: draft.duration,
      temperatureC: missingTemperature.has(index) ? null : temperatureOf(random, draft),
      gasMix: otherGas.has(index) ? 'OTHER' : pickGas(random, draft.depth),
      notes: withNotes.has(index) ? (NOTES[noteIndex++] ?? null) : null,
    };
  });

  return [...generated, ...FIXED.map(fixedDive).reverse()];
}
