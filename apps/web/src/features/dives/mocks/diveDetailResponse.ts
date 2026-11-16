// A dive of the mocked log as `GET /dives/:id` serves it, for the tests that go through the client.
import type { DiveDetail } from '@e-deep/shared';
import { mockDiveLogResponse } from './diveLogResponse';

/** Pointe de la Revellata (the mocked sites carry no coordinates). */
const COORDINATES = { latitude: 42.58, longitude: 8.725 };

/** The detail of the mocked dive `id`: its summary plus the detail-only fields. */
export function mockDiveDetail(id: string, overrides: Partial<DiveDetail> = {}): DiveDetail {
  const summary = mockDiveLogResponse.dives.find((dive) => dive.id === id);
  if (!summary) throw new Error(`No mocked dive ${id}`);
  return {
    ...summary,
    site: { ...summary.site, ...COORDINATES, area: null },
    buddies: summary.buddies.map((buddy) => ({ ...buddy, level: null })),
    visibilityM: 25,
    hadDecompression: false,
    stopsOk: true,
    diverLevel: { agency: 'FFESSM', code: 'N2', label: 'Niveau 2' },
    entryType: null,
    timeOfDay: null,
    weather: null,
    airTemperatureC: null,
    seaState: null,
    currentStrength: null,
    diveCenter: null,
    surfaceTemperatureC: null,
    safetyStopDurationMin: null,
    safetyStopDepthM: null,
    isRepetitive: null,
    o2Percent: null,
    tankVolumeL: null,
    tankMaterial: null,
    startPressureBar: null,
    endPressureBar: null,
    suitType: null,
    suitThicknessMm: null,
    weightKg: null,
    observations: [],
    createdAt: '2026-04-08T18:00:00.000Z',
    updatedAt: '2026-04-08T18:00:00.000Z',
    ...overrides,
  };
}

/**
 * The detail fields of the mockup (dive-detail.jsx, #127 Pointe de la Revellata), ballast left
 * empty. The site area and the buddy levels depend on the dive: see `mockFilledDiveDetail`.
 */
export const MOCKUP_DETAIL_FIELDS = {
  visibilityM: 25,
  hadDecompression: false,
  stopsOk: true,
  diverLevel: { agency: 'FFESSM', code: 'N2', label: 'Niveau 2' },
  entryType: 'BOAT',
  timeOfDay: 'DAY',
  weather: 'SUNNY',
  airTemperatureC: 19,
  seaState: 'CALM',
  currentStrength: 'WEAK',
  diveCenter: 'Calvi Plongée',
  surfaceTemperatureC: 16,
  safetyStopDurationMin: 3,
  safetyStopDepthM: 5,
  isRepetitive: false,
  o2Percent: null,
  tankVolumeL: 12,
  tankMaterial: 'STEEL',
  startPressureBar: 200,
  endPressureBar: 60,
  suitType: 'SEMI_DRY',
  suitThicknessMm: 7,
  weightKg: null,
  observations: [
    { label: 'Mérou brun', count: 2 },
    { label: 'Barracudas', count: null },
    { label: 'Gorgones rouges', count: null },
    { label: 'Corb', count: null },
    { label: 'Murène', count: null },
  ],
  createdAt: '2026-04-08T18:00:00.000Z',
  updatedAt: '2026-04-09T07:30:00.000Z',
} as const satisfies Partial<DiveDetail>;

/** Mockup levels of the buddies (Lucas N3, Thao N2); any other buddy has no declared level. */
const MOCKUP_BUDDY_LEVELS: Readonly<Record<string, string>> = { Lucas: 'N3', Thao: 'N2' };

/** The mocked dive `id` filled with the mockup values: area, levels and every detail field. */
export function mockFilledDiveDetail(id: string): DiveDetail {
  const dive = mockDiveDetail(id, structuredClone(MOCKUP_DETAIL_FIELDS));
  return {
    ...dive,
    site: { ...dive.site, area: 'Méditerranée' },
    buddies: dive.buddies.map((buddy) => {
      const code = MOCKUP_BUDDY_LEVELS[buddy.firstName];
      return {
        ...buddy,
        level:
          code === undefined ? null : { agency: 'FFESSM', code, label: `Niveau ${code.slice(1)}` },
      };
    }),
  };
}
