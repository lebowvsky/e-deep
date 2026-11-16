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
