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
    site: { ...summary.site, ...COORDINATES },
    visibilityM: 25,
    hadDecompression: false,
    stopsOk: true,
    ...overrides,
  };
}
