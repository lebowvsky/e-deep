// Coordinates typed or pasted in the site panel: decimal degrees (4 decimals shown), or a pasted
// pair, decimal (« 42.5794, 8.7262 ») or in degrees and minutes (« 42°34.76'N 8°43.57'E »).
import type { GeoPoint } from '@/shared/model/geo';

export type CoordinateAxis = 'latitude' | 'longitude';

const LIMITS: Record<CoordinateAxis, number> = { latitude: 90, longitude: 180 };

/** Shown with 4 decimals (≈ 10 m), a dot as on GPS devices: 42.5794. */
export function formatCoordinate(value: number): string {
  return value.toFixed(4);
}

/** « 42.5794 » or « 42,5794 » (French comma), within the range of the axis; `null` otherwise. */
export function parseCoordinate(text: string, axis: CoordinateAxis): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^-?\d{1,3}(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Math.abs(value) <= LIMITS[axis] ? value : null;
}

// One coordinate in degrees, optional minutes (decimal) and seconds, optional hemisphere.
const DMS = String.raw`(-?\d{1,3}(?:[.,]\d+)?)\s*°?\s*(?:(\d{1,2}(?:[.,]\d+)?)\s*['′]\s*)?(?:(\d{1,2}(?:[.,]\d+)?)\s*["″]\s*)?([NSEWO])?`;
const PAIR = new RegExp(String.raw`^\s*${DMS}\s*[,;\s]\s*${DMS}\s*$`, 'i');

const num = (text: string | undefined): number => (text ? Number(text.replace(',', '.')) : 0);

function toDegrees(
  degrees: string | undefined,
  minutes: string | undefined,
  seconds: string | undefined,
  hemisphere: string | undefined,
): number {
  const absolute = Math.abs(num(degrees)) + num(minutes) / 60 + num(seconds) / 3600;
  const negative = (degrees?.startsWith('-') ?? false) || /^[SWO]$/i.test(hemisphere ?? '');
  return negative ? -absolute : absolute;
}

/**
 * A pasted pair: « 42.5794, 8.7262 », « 42,5794 ; 8,7262 », « 42°34.76'N 8°43.57'E »,
 * « 42°34'45.8"N 8°43'34.3"E ». Latitude first. `null` when it is not one, or out of range.
 */
export function parseCoordinatePair(text: string): GeoPoint | null {
  // « 42,5794, 8,7262 »: French decimals separated by a comma and a space.
  const french = /^\s*(-?\d{1,3},\d+)\s*[,;]\s+(-?\d{1,3},\d+)\s*$/.exec(text);
  const match = french ? null : PAIR.exec(text);
  let latitude: number;
  let longitude: number;
  if (french) {
    latitude = num(french[1]);
    longitude = num(french[2]);
  } else if (match) {
    latitude = toDegrees(match[1], match[2], match[3], match[4]);
    longitude = toDegrees(match[5], match[6], match[7], match[8]);
  } else {
    return null;
  }
  if (Math.abs(latitude) > LIMITS.latitude || Math.abs(longitude) > LIMITS.longitude) return null;
  return { latitude, longitude };
}

/** The two fields, as typed. */
export interface CoordinateFields {
  latitude: string;
  longitude: string;
}

export function toCoordinateFields(position: GeoPoint | null): CoordinateFields {
  return position
    ? {
        latitude: formatCoordinate(position.latitude),
        longitude: formatCoordinate(position.longitude),
      }
    : { latitude: '', longitude: '' };
}

/** Both fields valid: a position; both blank: none; anything else: `invalid`. */
export function readCoordinateFields(fields: CoordinateFields): GeoPoint | null | 'invalid' {
  if (fields.latitude.trim() === '' && fields.longitude.trim() === '') return null;
  const latitude = parseCoordinate(fields.latitude, 'latitude');
  const longitude = parseCoordinate(fields.longitude, 'longitude');
  return latitude === null || longitude === null ? 'invalid' : { latitude, longitude };
}

/** « 42.5794° N · 8.7262° E »: the position as GPS devices print it. */
export function formatPosition({ latitude, longitude }: GeoPoint): string {
  const lat = `${formatCoordinate(Math.abs(latitude))}° ${latitude < 0 ? 'S' : 'N'}`;
  const lon = `${formatCoordinate(Math.abs(longitude))}° ${longitude < 0 ? 'W' : 'E'}`;
  return `${lat} · ${lon}`;
}
