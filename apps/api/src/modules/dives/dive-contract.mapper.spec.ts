import type { DiveDetail } from '@e-deep/shared';
import {
  groupDiveTeams,
  toDiveDetail,
  toDiveDetailBuddies,
  toDiveObservations,
  toDiveSummary,
  toLocalDateTime,
  type DiveDetailRow,
  type DiveSummaryRow,
} from './dive-contract.mapper';

const SUMMARY_ROW: DiveSummaryRow = {
  id: 'event-1',
  participation_id: 'participation-1',
  number: 7,
  started_at: new Date('2026-03-01T02:30:00.000Z'),
  utc_offset_minutes: -300,
  max_depth_m: '40.00',
  duration_min: 38,
  water_temperature_c: '7.5',
  gas_mix: 'OTHER',
  notes: 'Épave',
  site_id: 'site-1',
  site_name: 'Le Donator',
  site_locality: null,
  site_region: 'Var',
  entry_type: 'SHORE',
  dive_center: 'Porquerolles Plongée',
};

/** A dive entered before the detail fields existed: every new column is `NULL`. */
const DETAIL_ROW: DiveDetailRow = {
  ...SUMMARY_ROW,
  visibility_m: null,
  has_decompression: false,
  stops_ok: true,
  site_latitude: '-12.500000',
  site_longitude: '0',
  site_area: null,
  level_agency: 'FFESSM',
  level_code: 'N2',
  level_label: 'Niveau 2',
  entry_type: null,
  dive_center: null,
  time_of_day: null,
  weather: null,
  air_temperature_c: null,
  sea_state: null,
  current_strength: null,
  surface_water_temperature_c: null,
  safety_stop_duration_min: null,
  safety_stop_depth_m: null,
  is_repetitive: null,
  o2_percent: null,
  tank_volume_l: null,
  tank_material: null,
  start_pressure_bar: null,
  end_pressure_bar: null,
  suit_type: null,
  suit_thickness_mm: null,
  weight_kg: null,
  created_at: new Date('2026-03-02T08:00:00.123Z'),
  updated_at: new Date('2026-03-05T10:15:00.456Z'),
};

/** Every detail field entered; `numeric` columns arrive as strings. */
const FULL_DETAIL_ROW: DiveDetailRow = {
  ...DETAIL_ROW,
  site_area: 'Méditerranée',
  entry_type: 'BOAT',
  time_of_day: 'NIGHT',
  weather: 'OVERCAST',
  air_temperature_c: '-2.5',
  sea_state: 'SLIGHT',
  current_strength: 'STRONG',
  dive_center: 'Calvi Plongée',
  surface_water_temperature_c: '16.0',
  safety_stop_duration_min: 3,
  safety_stop_depth_m: '4.5',
  is_repetitive: false,
  o2_percent: '28.0',
  tank_volume_l: '12.0',
  tank_material: 'ALUMINIUM',
  start_pressure_bar: 200,
  end_pressure_bar: 0,
  suit_type: 'SEMI_DRY',
  suit_thickness_mm: '7.0',
  weight_kg: '0.0',
};

const BUDDY = { id: 'buddy-1', firstName: 'Camille', lastName: 'Bernard' };

describe('toLocalDateTime', () => {
  it('shows the local time of the dive with its offset', () => {
    // 21:00 in the Red Sea (UTC+3) is 18:00 UTC.
    expect(toLocalDateTime(new Date('2026-07-14T18:00:00.000Z'), 180)).toBe(
      '2026-07-14T21:00:00+03:00',
    );
  });

  it('handles negative and non-whole-hour offsets', () => {
    expect(toLocalDateTime(new Date('2026-03-01T02:30:00.000Z'), -300)).toBe(
      '2026-02-28T21:30:00-05:00',
    );
    expect(toLocalDateTime(new Date('2026-03-01T00:00:00.000Z'), 345)).toBe(
      '2026-03-01T05:45:00+05:45',
    );
    expect(toLocalDateTime(new Date('2026-03-01T10:00:00.000Z'), -570)).toBe(
      '2026-03-01T00:30:00-09:30',
    );
  });

  it('keeps the instant: parsing the result gives back startedAt', () => {
    const startedAt = new Date('2026-07-14T18:07:42.000Z');
    expect(new Date(toLocalDateTime(startedAt, 840)).getTime()).toBe(startedAt.getTime());
    expect(toLocalDateTime(startedAt, 0)).toBe('2026-07-14T18:07:42+00:00');
  });
});

describe('toDiveSummary', () => {
  it('maps a row to the contract with a local date and numeric values', () => {
    expect(toDiveSummary(SUMMARY_ROW, [BUDDY])).toStrictEqual({
      id: 'event-1',
      number: 7,
      date: '2026-02-28T21:30:00-05:00',
      utcOffsetMinutes: -300,
      site: { id: 'site-1', name: 'Le Donator', locality: null, region: 'Var' },
      depthMaxM: 40,
      durationMin: 38,
      temperatureC: 7.5,
      gasMix: 'OTHER',
      notes: 'Épave',
      buddies: [BUDDY],
      entryType: 'SHORE',
      diveCenter: 'Porquerolles Plongée',
    });
  });

  it('keeps missing values as null and a set locality as is', () => {
    const summary = toDiveSummary(
      {
        ...SUMMARY_ROW,
        water_temperature_c: null,
        entry_type: null,
        dive_center: null,
        site_locality: 'Porquerolles',
      },
      [],
    );
    expect(summary.temperatureC).toBeNull();
    expect(summary.entryType).toBeNull();
    expect(summary.diveCenter).toBeNull();
    expect(summary.site.locality).toBe('Porquerolles');
    expect(summary.buddies).toStrictEqual([]);
  });
});

describe('toDiveDetail', () => {
  it('keeps every detail field of an older dive as null, observations empty', () => {
    expect(toDiveDetail(DETAIL_ROW, [], [])).toStrictEqual({
      ...toDiveSummary(DETAIL_ROW, []),
      site: {
        id: 'site-1',
        name: 'Le Donator',
        locality: null,
        region: 'Var',
        latitude: -12.5,
        longitude: 0,
        area: null,
      },
      buddies: [],
      visibilityM: null,
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
      createdAt: '2026-03-02T08:00:00.123Z',
      updatedAt: '2026-03-05T10:15:00.456Z',
    } satisfies DiveDetail);
  });

  it('converts the numeric columns to numbers, zeros included, and keeps the other values', () => {
    const buddies = [{ ...BUDDY, level: { agency: 'FFESSM', code: 'N3', label: 'Niveau 3' } }];

    const detail = toDiveDetail(FULL_DETAIL_ROW, buddies, [
      { position: 1, label: 'Barracudas', count: null },
      { position: 0, label: 'Mérou brun', count: 2 },
    ]);

    expect(detail).toMatchObject({
      site: { area: 'Méditerranée' },
      buddies,
      entryType: 'BOAT',
      timeOfDay: 'NIGHT',
      weather: 'OVERCAST',
      airTemperatureC: -2.5,
      seaState: 'SLIGHT',
      currentStrength: 'STRONG',
      diveCenter: 'Calvi Plongée',
      surfaceTemperatureC: 16,
      safetyStopDurationMin: 3,
      safetyStopDepthM: 4.5,
      isRepetitive: false,
      o2Percent: 28,
      tankVolumeL: 12,
      tankMaterial: 'ALUMINIUM',
      startPressureBar: 200,
      endPressureBar: 0,
      suitType: 'SEMI_DRY',
      suitThicknessMm: 7,
      weightKg: 0,
      observations: [
        { label: 'Mérou brun', count: 2 },
        { label: 'Barracudas', count: null },
      ],
    });
    // `temperatureC` stays the bottom temperature.
    expect(detail.temperatureC).toBe(7.5);
  });

  it('serves updatedAt as given by the query (latest of the event and the participation)', () => {
    const detail = toDiveDetail(
      { ...DETAIL_ROW, updated_at: new Date('2026-04-01T00:00:00.000Z') },
      [],
      [],
    );
    expect(detail.updatedAt).toBe('2026-04-01T00:00:00.000Z');
    expect(detail.createdAt).toBe('2026-03-02T08:00:00.123Z');
  });
});

describe('toDiveObservations', () => {
  it('orders by position whatever the row order', () => {
    expect(
      toDiveObservations([
        { position: 2, label: 'Corb', count: null },
        { position: 0, label: 'Mérou brun', count: 2 },
        { position: 1, label: 'Murène', count: 1 },
      ]),
    ).toStrictEqual([
      { label: 'Mérou brun', count: 2 },
      { label: 'Murène', count: 1 },
      { label: 'Corb', count: null },
    ]);
  });
});

describe('toDiveDetailBuddies', () => {
  it('gives each buddy its level, or null without one', () => {
    expect(
      toDiveDetailBuddies([
        {
          participation_id: 'p1',
          id: 'b1',
          first_name: 'Lucas',
          last_name: 'Bernard',
          level_agency: 'FFESSM',
          level_code: 'N3',
          level_label: 'Niveau 3',
        },
        {
          participation_id: 'p1',
          id: 'b2',
          first_name: 'Yann',
          last_name: 'Le Goff',
          level_agency: null,
          level_code: null,
          level_label: null,
        },
      ]),
    ).toStrictEqual([
      {
        id: 'b1',
        firstName: 'Lucas',
        lastName: 'Bernard',
        level: { agency: 'FFESSM', code: 'N3', label: 'Niveau 3' },
      },
      { id: 'b2', firstName: 'Yann', lastName: 'Le Goff', level: null },
    ]);
  });
});

describe('groupDiveTeams', () => {
  it('groups the buddies by participation, in the query order', () => {
    const teams = groupDiveTeams([
      { participation_id: 'p1', id: 'b1', first_name: 'Lucas', last_name: 'Moreau' },
      { participation_id: 'p2', id: 'b2', first_name: 'Thao', last_name: 'Nguyen' },
      { participation_id: 'p1', id: 'b3', first_name: 'Inès', last_name: 'Petit' },
    ]);

    expect([...teams.entries()]).toStrictEqual([
      [
        'p1',
        [
          { id: 'b1', firstName: 'Lucas', lastName: 'Moreau' },
          { id: 'b3', firstName: 'Inès', lastName: 'Petit' },
        ],
      ],
      ['p2', [{ id: 'b2', firstName: 'Thao', lastName: 'Nguyen' }]],
    ]);
  });

  it('returns an empty map without rows', () => {
    expect(groupDiveTeams([]).size).toBe(0);
  });
});
