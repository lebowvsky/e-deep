import type {
  CertificationLevelRef,
  DiveBuddyRef,
  DiveDetail,
  DiveDetailBuddy,
  DiveLogResponse,
  DiveObservation,
  DiveSiteRef as DiveSiteContract,
  DiveSummary,
} from '@e-deep/shared';
import { ApiError, type ApiClient, type RequestOptions } from '@/shared/lib/apiClient';
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
import type { DiveMember } from '@/shared/model/dive';
import { avatarColorOf } from '../lib/avatarColor';
import { oxygenPercent, placeLabel } from '../lib/labels';
import { toRegionKey } from '../lib/region';
import {
  CURRENT_STRENGTHS,
  ENTRY_TYPES,
  GAS_MIXES,
  SEA_STATES,
  SUIT_TYPES,
  TANK_MATERIALS,
  TIMES_OF_DAY,
  WEATHERS,
} from '../lib/unions';
import type {
  DiveDetailMember,
  DiveDetailView,
  DiveSiteRef,
  GeoPoint,
  LoggedDive,
  SafetyStop,
} from '../types';

// ── Guards (the contract is checked at the boundary, `invalid-response` otherwise) ─────────────

function isSiteRef(value: unknown): value is DiveSiteContract {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isNullable(isString)(value.locality) &&
    isNullable(isString)(value.region)
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

/** One of `options`, or `null`. */
function isNullableOneOf<const T extends string>(options: readonly T[]) {
  return (value: unknown): value is T | null => value === null || isOneOf(value, options);
}

export function isCertificationLevelRef(value: unknown): value is CertificationLevelRef {
  return isRecord(value) && isString(value.agency) && isString(value.code) && isString(value.label);
}

export function isDiveObservation(value: unknown): value is DiveObservation {
  return isRecord(value) && isString(value.label) && isNullable(isNumber)(value.count);
}

/** A buddy of the detail: the list's buddy plus the level of their contact card. */
function isDiveDetailBuddy(value: unknown): value is DiveDetailBuddy {
  return isRecord(value) && isNullable(isCertificationLevelRef)(value.level) && isBuddyRef(value);
}

/** Latitude and longitude come both set or both `null` (D-23): a lone half is a broken body. */
function isPositionPair(latitude: unknown, longitude: unknown): boolean {
  return (latitude === null && longitude === null) || (isNumber(latitude) && isNumber(longitude));
}

const isNullableNumber = isNullable(isNumber);
const isNullableString = isNullable(isString);

export function isDiveDetail(value: unknown): value is DiveDetail {
  return (
    isRecord(value) &&
    isRecord(value.site) &&
    isPositionPair(value.site.latitude, value.site.longitude) &&
    isNullableString(value.site.area) &&
    isArrayOf(isDiveDetailBuddy)(value.buddies) &&
    isNullableNumber(value.visibilityM) &&
    isBoolean(value.hadDecompression) &&
    isBoolean(value.stopsOk) &&
    isCertificationLevelRef(value.diverLevel) &&
    isNullableOneOf(ENTRY_TYPES)(value.entryType) &&
    isNullableOneOf(TIMES_OF_DAY)(value.timeOfDay) &&
    isNullableOneOf(WEATHERS)(value.weather) &&
    isNullableNumber(value.airTemperatureC) &&
    isNullableOneOf(SEA_STATES)(value.seaState) &&
    isNullableOneOf(CURRENT_STRENGTHS)(value.currentStrength) &&
    isNullableString(value.diveCenter) &&
    isNullableNumber(value.surfaceTemperatureC) &&
    isNullableNumber(value.safetyStopDurationMin) &&
    isNullableNumber(value.safetyStopDepthM) &&
    isNullable(isBoolean)(value.isRepetitive) &&
    isNullableNumber(value.o2Percent) &&
    isNullableNumber(value.tankVolumeL) &&
    isNullableOneOf(TANK_MATERIALS)(value.tankMaterial) &&
    isNullableNumber(value.startPressureBar) &&
    isNullableNumber(value.endPressureBar) &&
    isNullableOneOf(SUIT_TYPES)(value.suitType) &&
    isNullableNumber(value.suitThicknessMm) &&
    isNullableNumber(value.weightKg) &&
    isArrayOf(isDiveObservation)(value.observations) &&
    isDateString(value.createdAt) &&
    isDateString(value.updatedAt) &&
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

/**
 * HTTP statuses of `GET /dives/:id` that mean « no such dive for this diver »: 404 (unknown, deleted
 * or another diver's dive, deliberately indistinguishable) and 400 (malformed id, e.g. a URL typed
 * by hand). Neither will change on a retry.
 */
const DIVE_NOT_FOUND_STATUSES: readonly number[] = [400, 404];

export function isDiveNotFound(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.kind === 'http' &&
    error.status !== undefined &&
    DIVE_NOT_FOUND_STATUSES.includes(error.status)
  );
}

// ── Contract → view model ─────────────────────────────────────────────────────────────────────

/** Who the user is: the contract leaves them out of the dive teams. */
export type DiveLogOwner = Pick<DiveMember, 'id' | 'firstName' | 'lastName'>;

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

/** « Calvi · Corse », or whichever of the locality and the region was entered. */
function toSiteRef(site: DiveSiteContract): DiveSiteRef {
  return {
    id: site.id,
    name: site.name,
    place: placeLabel(site.locality, site.region),
    region: site.region === null ? null : toRegionKey(site.region),
    regionName: site.region,
  };
}

/** The contract lists the buddies; the view model holds the whole team, the user first. */
export function toLoggedDive(summary: DiveSummary, self: DiveMember): LoggedDive {
  return {
    id: summary.id,
    number: summary.number,
    date: summary.date,
    utcOffsetMinutes: summary.utcOffsetMinutes,
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

/** The contract pairs both coordinates (D-23): no position rather than half of one. */
function toGeoPoint(latitude: number | null, longitude: number | null): GeoPoint | null {
  return latitude === null || longitude === null ? null : { latitude, longitude };
}

/** The contract pairs both values (D-16); a lone half is not shown rather than guessed. */
function toSafetyStop(durationMin: number | null, depthM: number | null): SafetyStop | null {
  return durationMin === null || depthM === null ? null : { durationMin, depthM };
}

/**
 * The detail adds the event and participation fields, the site coordinates and area, and a level
 * to each member: the user's at the time of the dive, each buddy's declared one.
 */
export function toDiveDetailView(detail: DiveDetail, self: DiveMember): DiveDetailView {
  const dive = toLoggedDive(detail, self);
  const team: DiveDetailMember[] = [
    { ...self, level: detail.diverLevel },
    ...detail.buddies.map((buddy) => ({ ...toBuddyMember(buddy), level: buddy.level })),
  ];
  return {
    ...dive,
    site: {
      ...dive.site,
      position: toGeoPoint(detail.site.latitude, detail.site.longitude),
      area: detail.site.area,
    },
    team,
    visibilityM: detail.visibilityM,
    hadDecompression: detail.hadDecompression,
    stopsOk: detail.stopsOk,
    surfaceTemperatureC: detail.surfaceTemperatureC,
    safetyStop: toSafetyStop(detail.safetyStopDurationMin, detail.safetyStopDepthM),
    isRepetitive: detail.isRepetitive,
    conditions: {
      entryType: detail.entryType,
      timeOfDay: detail.timeOfDay,
      weather: detail.weather,
      airTemperatureC: detail.airTemperatureC,
      seaState: detail.seaState,
      currentStrength: detail.currentStrength,
      diveCenter: detail.diveCenter,
    },
    equipment: {
      o2Percent: oxygenPercent(detail.gasMix, detail.o2Percent),
      tankVolumeL: detail.tankVolumeL,
      tankMaterial: detail.tankMaterial,
      startPressureBar: detail.startPressureBar,
      endPressureBar: detail.endPressureBar,
      suitType: detail.suitType,
      suitThicknessMm: detail.suitThicknessMm,
      weightKg: detail.weightKg,
    },
    observations: detail.observations,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
  };
}
