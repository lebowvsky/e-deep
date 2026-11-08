/**
 * Fictitious development data, consistent with the dashboard mocks
 * (`apps/web/src/features/dashboard/mocks/dashboard.ts`). Deterministic: a fixed-seed PRNG drives
 * the measures, and dates are relative to the day the seed runs (so the last 12 months are filled).
 */
import type { GasMix } from '../../modules/dives/gas-mix';

export type LevelCode = 'N1' | 'N2' | 'N3' | 'N4';

export interface SeedSite {
  readonly key: string;
  readonly name: string;
  readonly region: string;
  readonly latitude: number;
  readonly longitude: number;
}

export interface SeedBuddy {
  readonly key: string;
  readonly firstName: string;
  readonly lastName: string;
  /** Key of the seeded diver account this contact is linked to. */
  readonly linkedDiverKey?: string;
}

export interface SeedDive {
  readonly siteKey: string;
  readonly daysAgo: number;
  /** Local wall-clock hour of the dive (France: UTC+1 in winter, UTC+2 in summer). */
  readonly localHour: number;
  readonly maxDepthM: number;
  readonly durationMin: number;
  readonly waterTemperatureC: number | null;
  readonly visibilityM: number | null;
  readonly gasMix: GasMix;
  readonly hasDecompression: boolean;
  readonly stopsOk: boolean;
  readonly notes: string | null;
  readonly buddyKeys: readonly string[];
  /** Level snapshot sent by the client; omitted → the diver's current level is copied. */
  readonly levelCode?: LevelCode;
  /** Deleted afterwards, to leave a tombstone. */
  readonly deleted?: boolean;
}

export interface SeedDiver {
  readonly key: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly levelCode: LevelCode;
  readonly sites: readonly SeedSite[];
  readonly buddies: readonly SeedBuddy[];
  readonly dives: readonly SeedDive[];
}

const SITES = {
  revellata: {
    key: 'revellata',
    name: 'Pointe de la Revellata',
    region: 'Corse',
    latitude: 42.583,
    longitude: 8.725,
  },
  gabiniere: {
    key: 'gabiniere',
    name: 'Port-Cros — La Gabinière',
    region: 'Var',
    latitude: 42.991,
    longitude: 6.401,
  },
  donator: {
    key: 'donator',
    name: 'Épave du Donator',
    region: 'Var',
    latitude: 42.979,
    longitude: 6.223,
  },
  taillat: {
    key: 'taillat',
    name: 'Cap Taillat',
    region: 'Var',
    latitude: 43.172,
    longitude: 6.641,
  },
  riou: {
    key: 'riou',
    name: 'Grotte à Corail — Riou',
    region: 'Marseille',
    latitude: 43.176,
    longitude: 5.39,
  },
  planier: {
    key: 'planier',
    name: 'Planier — Le Chaouen',
    region: 'Marseille',
    latitude: 43.199,
    longitude: 5.232,
  },
  vesse: {
    key: 'vesse',
    name: 'La Vesse',
    region: 'Côte Bleue',
    latitude: 43.33,
    longitude: 5.255,
  },
  fourmigue: {
    key: 'fourmigue',
    name: 'Sec de la Fourmigue',
    region: 'Alpes-Maritimes',
    latitude: 43.541,
    longitude: 7.08,
  },
  rederis: {
    key: 'rederis',
    name: 'Cap Rédéris',
    region: 'Pyrénées-Orientales',
    latitude: 42.477,
    longitude: 3.163,
  },
  lavezzi: {
    key: 'lavezzi',
    name: 'Îles Lavezzi — Le Mérouville',
    region: 'Corse',
    latitude: 41.335,
    longitude: 9.256,
  },
  rubis: {
    key: 'rubis',
    name: 'Épave du Rubis',
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
  readonly levelFor?: (daysAgo: number) => LevelCode;
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

/** Dives spread evenly over the last 12 months (the dashboard histogram is never empty). */
const DAYS_AGO_BY_DIVE = (index: number, count: number, random: () => number): number =>
  Math.round(((index + random()) / count) * 360) + 3;

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
    const levelCode = profile.levelFor?.(daysAgo);
    // N1: autonomous dives limited to 20 m.
    const depthLimit = levelCode === 'N1' ? 20 : profile.maxDepthM;
    const maxDepthM = Math.round((8 + random() * (depthLimit - 8)) * 10) / 10;
    const deep = maxDepthM > 30;
    return {
      siteKey: pick(profile.sites),
      daysAgo,
      localHour: pick([9, 10, 11, 14, 15]),
      maxDepthM,
      durationMin: Math.round(deep ? 30 + random() * 15 : 40 + random() * 25),
      waterTemperatureC: Math.round((summer ? 20 + random() * 5 : 13 + random() * 2) * 10) / 10,
      visibilityM: Math.round(8 + random() * 22),
      gasMix: deep || random() < 0.7 ? 'AIR' : 'NITROX32',
      hasDecompression: deep && random() < 0.4,
      stopsOk: random() > 0.05,
      notes: pick(NOTES),
      buddyKeys: profile.buddyKeys.filter(() => random() < 0.4).slice(0, 2),
      ...(levelCode === undefined ? {} : { levelCode }),
    };
  });
}

/** Marine passed her N2 seven months ago: older dives keep the N1 snapshot. */
const marineLevel = (daysAgo: number): LevelCode => (daysAgo > 210 ? 'N1' : 'N2');

const MARINE_BUDDIES: readonly SeedBuddy[] = [
  { key: 'lucas', firstName: 'Lucas', lastName: 'Bernard', linkedDiverKey: 'lucas' },
  { key: 'thao', firstName: 'Thao', lastName: 'Nguyen', linkedDiverKey: 'thao' },
  { key: 'elise', firstName: 'Élise', lastName: 'Marchand' },
  { key: 'remi', firstName: 'Rémi', lastName: 'Pascal' },
  { key: 'sofia', firstName: 'Sofia', lastName: 'Barros' },
  { key: 'julien', firstName: 'Julien', lastName: 'Kervella' },
];

export const SEED_DIVERS: readonly SeedDiver[] = [
  {
    key: 'marine',
    firstName: 'Marine',
    lastName: 'Rousseau',
    levelCode: 'N2',
    sites: [
      SITES.revellata,
      SITES.gabiniere,
      SITES.donator,
      SITES.taillat,
      SITES.riou,
      SITES.planier,
      SITES.vesse,
      SITES.fourmigue,
      SITES.rederis,
      SITES.lavezzi,
    ],
    buddies: MARINE_BUDDIES,
    dives: [
      // Latest dive, shown on the dashboard "Dernière plongée" card.
      {
        siteKey: 'revellata',
        daysAgo: 1,
        localHour: 16,
        maxDepthM: 42,
        durationMin: 38,
        waterTemperatureC: 14,
        visibilityM: 25,
        gasMix: 'AIR',
        hasDecompression: false,
        stopsOk: true,
        notes: 'Tombant superbe, langoustes à 40 m.',
        buddyKeys: ['lucas', 'thao'],
        levelCode: 'N2',
      },
      {
        siteKey: 'gabiniere',
        daysAgo: 2,
        localHour: 10,
        maxDepthM: 38,
        durationMin: 41,
        waterTemperatureC: 16.5,
        visibilityM: 30,
        gasMix: 'AIR',
        hasDecompression: true,
        stopsOk: true,
        notes: 'Bancs de barracudas, mérous partout.',
        buddyKeys: ['lucas'],
        levelCode: 'N2',
      },
      // Deleted on another device: leaves a tombstone for the sync pull.
      {
        siteKey: 'vesse',
        daysAgo: 5,
        localHour: 11,
        maxDepthM: 18,
        durationMin: 50,
        waterTemperatureC: 17,
        visibilityM: 12,
        gasMix: 'NITROX32',
        hasDecompression: false,
        stopsOk: true,
        notes: 'Saisie en double, supprimée.',
        buddyKeys: ['elise'],
        levelCode: 'N2',
        deleted: true,
      },
      ...generateDives(20_261_108, 36, {
        sites: [
          'gabiniere',
          'donator',
          'taillat',
          'riou',
          'planier',
          'vesse',
          'fourmigue',
          'rederis',
          'lavezzi',
          'revellata',
        ],
        buddyKeys: MARINE_BUDDIES.map((buddy) => buddy.key),
        maxDepthM: 40,
        levelFor: marineLevel,
      }),
    ],
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
