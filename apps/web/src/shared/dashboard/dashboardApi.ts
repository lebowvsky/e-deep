// The dashboard (`GET /dashboard`): read by the dashboard page. Its cache key is shared: the
// writes on the sites mark it stale (`useSiteCommands`), without importing the dashboard feature.
import { queryOptions } from '@tanstack/react-query';
import type {
  DashboardBuddy,
  DashboardDive,
  DashboardResponse,
  DashboardSite,
  DashboardUser,
  Federation,
  UserLevel,
} from '@e-deep/shared';
import type { ApiClient, RequestOptions } from '@/shared/lib/apiClient';
import {
  isArrayOf,
  isBoolean,
  isDateString,
  isNullable,
  isNumber,
  isOneOf,
  isPositionPair,
  isRecord,
  isString,
} from '@/shared/lib/guards';
import { GAS_MIXES } from '@/shared/model/gasMix';

/** A site of `GET /dashboard`. */
function isDashboardSite(value: unknown): value is DashboardSite {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isNullable(isString)(value.region) &&
    isPositionPair(value.latitude, value.longitude) &&
    isNumber(value.diveCount) &&
    isNumber(value.maxDepthM)
  );
}

const USER_LEVELS = ['N1', 'N2', 'N3', 'N4'] as const satisfies readonly UserLevel[];
const FEDERATIONS = ['FFESSM', 'CMAS', 'OTHER'] as const satisfies readonly Federation[];

function isUser(value: unknown): value is DashboardUser {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.firstName) &&
    isString(value.lastName) &&
    isOneOf(value.level, USER_LEVELS) &&
    isOneOf(value.federation, FEDERATIONS) &&
    isNullable(isString)(value.avatarUrl)
  );
}

function isBuddy(value: unknown): value is DashboardBuddy {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.firstName) &&
    isString(value.lastName) &&
    isNumber(value.sharedDives)
  );
}

function isDive(value: unknown): value is DashboardDive {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isDateString(value.date) &&
    isNumber(value.utcOffsetMinutes) &&
    isRecord(value.site) &&
    isString(value.site.id) &&
    isString(value.site.name) &&
    isNullable(isString)(value.site.region) &&
    isNumber(value.depthMaxM) &&
    isNumber(value.durationMin) &&
    isNullable(isNumber)(value.temperatureC) &&
    isNullable(isNumber)(value.visibilityM) &&
    isOneOf(value.gasMix, GAS_MIXES) &&
    isBoolean(value.hadDecompression) &&
    isBoolean(value.stopsOk) &&
    isNullable(isString)(value.notes) &&
    isArrayOf(isBuddy)(value.buddies)
  );
}

function isMonthCount(value: unknown): value is { month: string; count: number } {
  return (
    isRecord(value) &&
    isString(value.month) &&
    /^\d{4}-\d{2}$/.test(value.month) &&
    isNumber(value.count)
  );
}

function isMaxDepth(value: unknown): value is { depthM: number; siteName: string; date: string } {
  return (
    isRecord(value) &&
    isNumber(value.depthM) &&
    isString(value.siteName) &&
    isDateString(value.date)
  );
}

/** Validates the body of `GET /dashboard` against the shared contract. */
export function isDashboardResponse(value: unknown): value is DashboardResponse {
  if (!isRecord(value) || !isRecord(value.stats)) return false;
  const { stats } = value;
  return (
    isUser(value.user) &&
    isNumber(stats.totalDives) &&
    isNumber(stats.totalUnderwaterMinutes) &&
    isNullable(isMaxDepth)(stats.maxDepthEver) &&
    isNumber(stats.sitesVisited) &&
    isArrayOf(isMonthCount)(stats.divesPerMonth) &&
    isNumber(stats.divesThisMonth) &&
    isNullable(isString)(stats.mainRegion) &&
    isNullable(isDive)(value.lastDive) &&
    isArrayOf(isDashboardSite)(value.sites) &&
    isArrayOf(isBuddy)(value.frequentBuddies)
  );
}

export function fetchDashboard(
  client: ApiClient,
  options?: RequestOptions,
): Promise<DashboardResponse> {
  return client.get('dashboard', isDashboardResponse, options);
}

/** Cache key of the dashboard (`dashboardKeys.all` of the dashboard feature). */
export const DASHBOARD_QUERY_KEY = ['dashboard'] as const;

/** The one way to query the dashboard: every reader shares the cache entry. */
export function dashboardQueryOptions(client: ApiClient) {
  return queryOptions({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: ({ signal }) => fetchDashboard(client, { signal }),
  });
}
