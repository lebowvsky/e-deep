// The dive log (`GET /dives`), read by the dive pages and by the sites: one contract check, one
// cache entry.
import { queryOptions } from '@tanstack/react-query';
import type { DiveBuddyRef, DiveLogResponse, DiveSiteRef, DiveSummary } from '@e-deep/shared';
import type { ApiClient, RequestOptions } from '@/shared/lib/apiClient';
import {
  isArrayOf,
  isDateString,
  isNullable,
  isNullableOneOf,
  isNumber,
  isOneOf,
  isRecord,
  isString,
} from '@/shared/lib/guards';
import { ENTRY_TYPES } from '@/shared/model/entryType';
import { GAS_MIXES } from '@/shared/model/gasMix';

function isSiteRef(value: unknown): value is DiveSiteRef {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isNullable(isString)(value.locality) &&
    isNullable(isString)(value.region)
  );
}

export function isBuddyRef(value: unknown): value is DiveBuddyRef {
  return (
    isRecord(value) && isString(value.id) && isString(value.firstName) && isString(value.lastName)
  );
}

export function isDiveSummary(value: unknown): value is DiveSummary {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isNumber(value.number) &&
    isDateString(value.date) &&
    isNumber(value.utcOffsetMinutes) &&
    isSiteRef(value.site) &&
    isNumber(value.depthMaxM) &&
    isNumber(value.durationMin) &&
    isNullable(isNumber)(value.temperatureC) &&
    isOneOf(value.gasMix, GAS_MIXES) &&
    isNullable(isString)(value.notes) &&
    isArrayOf(isBuddyRef)(value.buddies) &&
    isNullableOneOf(ENTRY_TYPES)(value.entryType) &&
    isNullable(isString)(value.diveCenter)
  );
}

export function isDiveLogResponse(value: unknown): value is DiveLogResponse {
  return isRecord(value) && isArrayOf(isDiveSummary)(value.dives);
}

/** `GET /dives`: the whole live log of the current diver, latest first. */
export function fetchDiveLog(
  client: ApiClient,
  options?: RequestOptions,
): Promise<DiveLogResponse> {
  return client.get('dives', isDiveLogResponse, options);
}

/**
 * Root cache key of the dives (`divesKeys.all`): log and details. The writes on the sites
 * invalidate it (a site renamed or merged changes the site of its dives).
 */
export const DIVES_QUERY_KEY = ['dives'] as const;

/**
 * Cache key of the log, under the root key, so that invalidating the dives also refreshes what
 * the sites read from the log.
 */
export const DIVE_LOG_QUERY_KEY = [...DIVES_QUERY_KEY, 'log'] as const;

/** The one way to query the log: every reader shares the cache entry and its contract check. */
export function diveLogQueryOptions(client: ApiClient) {
  return queryOptions({
    queryKey: DIVE_LOG_QUERY_KEY,
    queryFn: ({ signal }) => fetchDiveLog(client, { signal }),
  });
}
