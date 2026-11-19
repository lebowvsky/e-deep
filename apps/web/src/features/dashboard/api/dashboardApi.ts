// The dashboard response (fetched and checked in `@/shared/dashboard`) → view model.
import type {
  DashboardBuddy,
  DashboardDive,
  DashboardResponse,
  DashboardSite,
  DashboardUser,
} from '@e-deep/shared';
import { formatInitials, formatMonthLabel } from '@/shared/lib/format';
import type { DiveMember } from '@/shared/model/dive';
import { toGeoPoint } from '@/shared/model/geo';
import type { Buddy, DashboardState, Dive, DiveSite, User } from '../types';

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

function toSite({ latitude, longitude, ...site }: DashboardSite): DiveSite {
  return { ...site, position: toGeoPoint(latitude, longitude) };
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
  if (stats.totalDives === 0 || stats.maxDepthEver === null) {
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
        mainArea:
          stats.mainRegion === null ? null : { name: stats.mainRegion, mapTitle: stats.mainRegion },
      },
      lastDive: response.lastDive === null ? null : toDive(response.lastDive, response.user),
      sites: response.sites.map(toSite),
      frequentBuddies: response.frequentBuddies.map(toBuddy),
    },
  };
}
