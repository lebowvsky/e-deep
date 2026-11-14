import type {
  DiveBuddyRef,
  DiveDetail,
  DiveLogResponse,
  DiveSiteRef as DiveSiteContract,
  DiveSummary,
  GasMix,
} from '@e-deep/shared';
import { avatarPalette } from '@/design/tokens';
import type { ApiClient, RequestOptions } from '@/shared/lib/apiClient';
import { formatInitials } from '@/shared/lib/format';
import {
  isArrayOf,
  isBoolean,
  isDateString,
  isNullable,
  isNumber,
  isOneOf,
  isRecord,
  isString,
} from '@/shared/lib/guards';
import { hashOf } from '@/shared/lib/hash';
import type { DiveMember } from '@/shared/model/dive';
import { toRegionKey } from '../lib/region';
import type { DiveSiteRef, LoggedDive } from '../types';

const GAS_MIXES = ['AIR', 'NITROX32', 'NITROX36', 'OTHER'] as const satisfies readonly GasMix[];

// ── Guards (the contract is checked at the boundary, `invalid-response` otherwise) ─────────────

function isSiteRef(value: unknown): value is DiveSiteContract {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isNullable(isString)(value.locality) &&
    isString(value.region)
  );
}

function isBuddyRef(value: unknown): value is DiveBuddyRef {
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
    isArrayOf(isBuddyRef)(value.buddies)
  );
}

export function isDiveDetail(value: unknown): value is DiveDetail {
  return (
    isRecord(value) &&
    isRecord(value.site) &&
    isNumber(value.site.latitude) &&
    isNumber(value.site.longitude) &&
    isNullable(isNumber)(value.visibilityM) &&
    isBoolean(value.hadDecompression) &&
    isBoolean(value.stopsOk) &&
    isDiveSummary(value)
  );
}

export function isDiveLogResponse(value: unknown): value is DiveLogResponse {
  return isRecord(value) && isArrayOf(isDiveSummary)(value.dives);
}

// ── Requests ──────────────────────────────────────────────────────────────────────────────────

/** `GET /dives`: the whole live log of the current diver, latest first. */
export function fetchDiveLog(
  client: ApiClient,
  options?: RequestOptions,
): Promise<DiveLogResponse> {
  return client.get('dives', isDiveLogResponse, options);
}

/** `GET /dives/:id`: 404 (`http` error) when the dive is not the current diver's. */
export function fetchDive(
  client: ApiClient,
  id: string,
  options?: RequestOptions,
): Promise<DiveDetail> {
  return client.get(`dives/${encodeURIComponent(id)}`, isDiveDetail, options);
}

// ── Contract → view model ─────────────────────────────────────────────────────────────────────

/** Who the user is: the contract leaves them out of the dive teams. */
export type DiveLogOwner = Pick<DiveMember, 'id' | 'firstName' | 'lastName'>;

/**
 * Buddy colours are not stored: one is derived from the id, among the avatar palette (a stable
 * hash, so that a buddy keeps the same colour on every screen).
 */
export function avatarColorOf(id: string): string {
  return avatarPalette[hashOf(id) % avatarPalette.length] ?? avatarPalette[0];
}

/** The user: neutral avatar, no colour (`Palanquee`). */
export function toSelfMember(owner: DiveLogOwner): DiveMember {
  return {
    id: owner.id,
    firstName: owner.firstName,
    lastName: owner.lastName,
    initials: formatInitials(owner.firstName, owner.lastName),
    isSelf: true,
  };
}

function toBuddyMember(buddy: DiveBuddyRef): DiveMember {
  return {
    id: buddy.id,
    firstName: buddy.firstName,
    lastName: buddy.lastName,
    initials: formatInitials(buddy.firstName, buddy.lastName),
    color: avatarColorOf(buddy.id),
    isSelf: false,
  };
}

/** « Calvi · Corse », or « Corse » alone when the locality was not entered. */
function toSiteRef(site: DiveSiteContract): DiveSiteRef {
  return {
    id: site.id,
    name: site.name,
    place: site.locality === null ? site.region : `${site.locality} · ${site.region}`,
    region: toRegionKey(site.region),
    regionName: site.region,
  };
}

/** The contract lists the buddies; the view model holds the whole team, the user first. */
export function toLoggedDive(summary: DiveSummary, self: DiveMember): LoggedDive {
  return {
    id: summary.id,
    number: summary.number,
    date: summary.date,
    site: toSiteRef(summary.site),
    team: [self, ...summary.buddies.map(toBuddyMember)],
    depthMaxM: summary.depthMaxM,
    durationMin: summary.durationMin,
    temperatureC: summary.temperatureC,
    gasMix: summary.gasMix,
    notes: summary.notes,
  };
}

export function toDiveLog(response: DiveLogResponse, owner: DiveLogOwner): LoggedDive[] {
  const self = toSelfMember(owner);
  return response.dives.map((summary) => toLoggedDive(summary, self));
}
