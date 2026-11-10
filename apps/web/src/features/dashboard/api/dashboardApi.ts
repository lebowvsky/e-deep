import type {
  DashboardBuddy,
  DashboardDive,
  DashboardResponse,
  DashboardSite,
  DashboardUser,
  Federation,
  GasMix,
  UserLevel,
} from '@e-deep/shared';
import type { ApiClient, RequestOptions } from '@/shared/lib/apiClient';
import { formatInitials, formatMonthLabel } from '@/shared/lib/format';
import { isOneOf, isRecord } from '@/shared/lib/guards';
import type { DiveMember } from '@/shared/model/dive';
import type { Buddy, DashboardState, Dive, User } from '../types';

const USER_LEVELS = ['N1', 'N2', 'N3', 'N4'] as const satisfies readonly UserLevel[];
const FEDERATIONS = ['FFESSM', 'CMAS', 'OTHER'] as const satisfies readonly Federation[];
const GAS_MIXES = ['AIR', 'NITROX32', 'NITROX36', 'OTHER'] as const satisfies readonly GasMix[];

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isDate = (value: unknown): value is string =>
  isString(value) && !Number.isNaN(Date.parse(value));
const isNullable =
  <T>(guard: (value: unknown) => value is T) =>
  (value: unknown): value is T | null =>
    value === null || guard(value);
const isArrayOf =
  <T>(guard: (value: unknown) => value is T) =>
  (value: unknown): value is T[] =>
    Array.isArray(value) && value.every(guard);

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

function isSite(value: unknown): value is DashboardSite {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isString(value.region) &&
    isNumber(value.latitude) &&
    isNumber(value.longitude) &&
    isNumber(value.diveCount) &&
    isNumber(value.maxDepthM)
  );
}

function isDive(value: unknown): value is DashboardDive {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isDate(value.date) &&
    isNumber(value.utcOffsetMinutes) &&
    isRecord(value.site) &&
    isString(value.site.id) &&
    isString(value.site.name) &&
    isString(value.site.region) &&
    isNumber(value.depthMaxM) &&
    isNumber(value.durationMin) &&
    isNullable(isNumber)(value.temperatureC) &&
    isNullable(isNumber)(value.visibilityM) &&
    isOneOf(value.gasMix, GAS_MIXES) &&
    typeof value.hadDecompression === 'boolean' &&
    typeof value.stopsOk === 'boolean' &&
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
    isRecord(value) && isNumber(value.depthM) && isString(value.siteName) && isDate(value.date)
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
    isArrayOf(isSite)(value.sites) &&
    isArrayOf(isBuddy)(value.frequentBuddies)
  );
}

export function fetchDashboard(
  client: ApiClient,
  options?: RequestOptions,
): Promise<DashboardResponse> {
  return client.get('dashboard', isDashboardResponse, options);
}

function toUser(user: DashboardUser): User {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    level: user.level,
    federation: user.federation,
    ...(user.avatarUrl === null ? {} : { avatarUrl: user.avatarUrl }),
  };
}

function toBuddy(buddy: DashboardBuddy): Buddy {
  return {
    id: buddy.id,
    initials: formatInitials(buddy.firstName, buddy.lastName),
    firstName: buddy.firstName,
    lastName: buddy.lastName,
    sharedDives: buddy.sharedDives,
  };
}

function toMember(person: DashboardUser | DashboardBuddy, isSelf: boolean): DiveMember {
  return {
    id: person.id,
    firstName: person.firstName,
    lastName: person.lastName,
    initials: formatInitials(person.firstName, person.lastName),
    isSelf,
  };
}

/** The contract lists the buddies of the dive; the view model holds the whole team, user first. */
function toDive(dive: DashboardDive, user: DashboardUser): Dive {
  return {
    id: dive.id,
    date: dive.date,
    site: dive.site,
    depthMaxM: dive.depthMaxM,
    durationMin: dive.durationMin,
    temperatureC: dive.temperatureC,
    visibilityM: dive.visibilityM,
    gasMix: dive.gasMix,
    hadDecompression: dive.hadDecompression,
    stopsOk: dive.stopsOk,
    team: [toMember(user, true), ...dive.buddies.map((buddy) => toMember(buddy, false))],
    ...(dive.notes === null ? {} : { notes: dive.notes }),
  };
}

/**
 * Maps the API response to the dashboard state: `empty` when the diver has no live dive yet,
 * `ready` with the view model otherwise.
 */
export function toDashboardState(response: DashboardResponse): DashboardState {
  const { stats } = response;
  const user = toUser(response.user);
  if (stats.totalDives === 0 || stats.maxDepthEver === null || stats.mainRegion === null) {
    return { status: 'empty', user };
  }

  return {
    status: 'ready',
    data: {
      user,
      stats: {
        totalDives: stats.totalDives,
        totalUnderwaterMinutes: stats.totalUnderwaterMinutes,
        maxDepthEver: {
          depthM: stats.maxDepthEver.depthM,
          site: stats.maxDepthEver.siteName,
          date: stats.maxDepthEver.date,
        },
        sitesVisited: stats.sitesVisited,
        divesPerMonth: stats.divesPerMonth.map(({ month, count }) => ({
          month: formatMonthLabel(month),
          count,
        })),
        recentMonthDelta: stats.divesThisMonth,
        mainArea: { name: stats.mainRegion, mapTitle: stats.mainRegion },
      },
      lastDive: response.lastDive === null ? null : toDive(response.lastDive, response.user),
      sites: response.sites,
      frequentBuddies: response.frequentBuddies.map(toBuddy),
    },
  };
}
