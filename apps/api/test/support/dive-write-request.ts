import { randomUUID } from 'node:crypto';
import type { DiveWriteEvent, DiveWriteParticipation, DiveWriteRequest } from '@e-deep/shared';

/** Overrides of a request, each part merged into the valid default. */
export interface DiveWriteRequestOverrides {
  readonly event?: Partial<DiveWriteEvent>;
  readonly participation?: Partial<DiveWriteParticipation>;
  readonly site?: Partial<DiveWriteRequest['site']>;
  readonly buddies?: DiveWriteRequest['buddies'];
  readonly observations?: DiveWriteRequest['observations'];
  readonly baseUpdatedAt?: string | null;
}

/**
 * A valid write request for an existing site, without buddy nor observation, every optional field
 * `null`. `site.id` follows `event.siteId` unless overridden.
 */
export function diveWriteRequest(overrides: DiveWriteRequestOverrides = {}): DiveWriteRequest {
  const siteId = overrides.event?.siteId ?? overrides.site?.id ?? randomUUID();
  return {
    event: {
      id: randomUUID(),
      siteId,
      startedAt: '2026-04-09T10:05:00+02:00',
      utcOffsetMinutes: 120,
      entryType: null,
      timeOfDay: null,
      weather: null,
      airTemperatureC: null,
      seaState: null,
      currentStrength: null,
      diveCenter: null,
      ...overrides.event,
    },
    participation: {
      maxDepthM: 32.5,
      durationMin: 52,
      waterTemperatureC: 19,
      visibilityM: 20,
      gasMix: 'NITROX32',
      hasDecompression: false,
      stopsOk: true,
      notes: null,
      surfaceWaterTemperatureC: null,
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
      ...overrides.participation,
    },
    observations: overrides.observations ?? [],
    site: { id: siteId, name: 'La Vesse', isNew: false, ...overrides.site },
    buddies: overrides.buddies ?? [],
    baseUpdatedAt: overrides.baseUpdatedAt ?? null,
  };
}
