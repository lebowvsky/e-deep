/**
 * Fictitious development data. Marine Rousseau (the diver of the `DEV_AUTH_STUB`) has the dive log
 * of the "Mes plongées" mocks (`dive-log.data.ts`, absolute dates); the two other accounts, linked
 * to two of her buddies, get a few generated dives. Deterministic: a fixed-seed PRNG drives their
 * measures, and their dates are relative to the day the seed runs.
 */
import { toLocalDateTime } from '../../modules/dives/dive-contract.mapper';
import { DIVE_LOG_BUDDIES, DIVE_LOG_DIVES, DIVE_LOG_SITES } from './dive-log.data';
import type { SeedDive, SeedDiver, SeedSite } from './dev-seed.types';

const MS_PER_DAY = 86_400_000;
const MS_PER_MINUTE = 60_000;

const SITES = {
  riou: {
    key: 'riou',
    name: 'Grotte à Corail — Riou',
    locality: null,
    region: 'Marseille',
    latitude: 43.176,
    longitude: 5.39,
  },
  planier: {
    key: 'planier',
    name: 'Planier — Le Chaouen',
    locality: null,
    region: 'Marseille',
    latitude: 43.199,
    longitude: 5.232,
  },
  vesse: {
    key: 'vesse',
    name: 'La Vesse',
    locality: null,
    region: 'Côte Bleue',
    latitude: 43.33,
    longitude: 5.255,
  },
  taillat: {
    key: 'taillat',
    name: 'Cap Taillat',
    locality: null,
    region: 'Var',
    latitude: 43.172,
    longitude: 6.641,
  },
  rubis: {
    key: 'rubis',
    name: 'Épave du Rubis',
    locality: null,
    region: 'Var',
    latitude: 43.183,
    longitude: 6.715,
  },
} as const satisfies Record<string, SeedSite>;

type SiteKey = keyof typeof SITES;

/** mulberry32: tiny deterministic PRNG, same data at every run. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

interface DiveProfile {
  readonly sites: readonly SiteKey[];
  readonly buddyKeys: readonly string[];
  readonly maxDepthM: number;
}

const NOTES = [
  'Mérous curieux au tombant.',
  'Courant léger en surface, calme au fond.',
  'Belle visibilité, gorgonies rouges.',
  'Poulpe dans les éboulis, murène sous la roche.',
  'Thermocline marquée vers 15 m.',
  null,
  null,
  null,
] as const;

/** Dives spread evenly over the last 12 months. */
const DAYS_AGO_BY_DIVE = (index: number, count: number, random: () => number): number =>
  Math.round(((index + random()) / count) * 360) + 3;

/** Local date of a dive held `daysAgo` days ago at `localHour`, French local time. */
function frenchLocalDate(daysAgo: number, localHour: number): string {
  const today = new Date();
  const day =
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) -
    daysAgo * MS_PER_DAY;
  const month = new Date(day).getUTCMonth();
  // Approximation of the French summer time (end of March to end of October).
  const utcOffsetMinutes = month >= 3 && month <= 9 ? 120 : 60;
  const startedAt = new Date(day + (localHour * 60 - utcOffsetMinutes) * MS_PER_MINUTE);
  return toLocalDateTime(startedAt, utcOffsetMinutes);
}

function generateDives(seed: number, count: number, profile: DiveProfile): SeedDive[] {
  const random = createRandom(seed);
  const pick = <T>(items: readonly T[]): T => {
    const item = items[Math.floor(random() * items.length)];
    if (item === undefined) {
      throw new Error('Empty seed list');
    }
    return item;
  };

  return Array.from({ length: count }, (_unused, index) => {
    const daysAgo = DAYS_AGO_BY_DIVE(index, count, random);
    const month = new Date(Date.now() - daysAgo * 86_400_000).getUTCMonth();
    const summer = month >= 5 && month <= 9;
    const maxDepthM = Math.round((8 + random() * (profile.maxDepthM - 8)) * 10) / 10;
    const deep = maxDepthM > 30;
    return {
      siteKey: pick(profile.sites),
      date: frenchLocalDate(daysAgo, pick([9, 10, 11, 14, 15])),
      maxDepthM,
      durationMin: Math.round(deep ? 30 + random() * 15 : 40 + random() * 25),
      waterTemperatureC: Math.round((summer ? 20 + random() * 5 : 13 + random() * 2) * 10) / 10,
      visibilityM: Math.round(8 + random() * 22),
      gasMix: deep || random() < 0.7 ? 'AIR' : 'NITROX32',
      hasDecompression: deep && random() < 0.4,
      stopsOk: random() > 0.05,
      notes: pick(NOTES),
      buddyKeys: profile.buddyKeys.filter(() => random() < 0.4).slice(0, 2),
    };
  });
}

/** Deleted on another device: leaves a tombstone for the sync pull, absent from the dive log. */
const DELETED_DIVE: SeedDive = {
  date: '2026-04-07T18:00:00+02:00',
  siteKey: 'vaisseau',
  maxDepthM: 18,
  durationMin: 50,
  waterTemperatureC: 14,
  visibilityM: 12,
  gasMix: 'NITROX32',
  hasDecompression: false,
  stopsOk: true,
  notes: 'Saisie en double, supprimée.',
  buddyKeys: ['EM'],
  deleted: true,
};

export const SEED_DIVERS: readonly SeedDiver[] = [
  {
    key: 'marine',
    firstName: 'Marine',
    lastName: 'Rousseau',
    levelCode: 'N2',
    sites: DIVE_LOG_SITES,
    buddies: DIVE_LOG_BUDDIES,
    dives: [...DIVE_LOG_DIVES, DELETED_DIVE],
  },
  {
    key: 'lucas',
    firstName: 'Lucas',
    lastName: 'Bernard',
    levelCode: 'N3',
    sites: [SITES.riou, SITES.taillat, SITES.rubis],
    buddies: [
      { key: 'marine', firstName: 'Marine', lastName: 'Rousseau', linkedDiverKey: 'marine' },
    ],
    dives: generateDives(42, 8, {
      sites: ['riou', 'taillat', 'rubis'],
      buddyKeys: ['marine'],
      maxDepthM: 55,
    }),
  },
  {
    key: 'thao',
    firstName: 'Thao',
    lastName: 'Nguyen',
    levelCode: 'N1',
    sites: [SITES.vesse, SITES.planier],
    buddies: [
      { key: 'marine', firstName: 'Marine', lastName: 'Rousseau', linkedDiverKey: 'marine' },
      { key: 'sofia', firstName: 'Sofia', lastName: 'Barros' },
    ],
    dives: generateDives(7, 5, {
      sites: ['vesse', 'planier'],
      buddyKeys: ['marine', 'sofia'],
      maxDepthM: 20,
    }),
  },
];
