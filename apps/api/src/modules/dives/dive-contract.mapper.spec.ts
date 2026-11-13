import {
  groupDiveTeams,
  toDiveDetail,
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
};

const DETAIL_ROW: DiveDetailRow = {
  ...SUMMARY_ROW,
  visibility_m: null,
  has_decompression: false,
  stops_ok: true,
  site_latitude: '-12.500000',
  site_longitude: '0',
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
    });
  });

  it('keeps a missing temperature as null and a set locality as is', () => {
    const summary = toDiveSummary(
      { ...SUMMARY_ROW, water_temperature_c: null, site_locality: 'Porquerolles' },
      [],
    );
    expect(summary.temperatureC).toBeNull();
    expect(summary.site.locality).toBe('Porquerolles');
    expect(summary.buddies).toStrictEqual([]);
  });
});

describe('toDiveDetail', () => {
  it('adds the site coordinates as numbers and the participation fields', () => {
    expect(toDiveDetail(DETAIL_ROW, [])).toStrictEqual({
      ...toDiveSummary(SUMMARY_ROW, []),
      site: {
        id: 'site-1',
        name: 'Le Donator',
        locality: null,
        region: 'Var',
        latitude: -12.5,
        longitude: 0,
      },
      visibilityM: null,
      hadDecompression: false,
      stopsOk: true,
    });
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
