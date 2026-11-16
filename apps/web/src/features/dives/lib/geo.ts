// Dive detail — site coordinates, as printed on the mini map.

const DECIMALS = { minimumFractionDigits: 3, maximumFractionDigits: 3 } as const;
/** Printed form, as GPS devices and maps write it: decimal point (« 42.580° N »). */
const coordinate = new Intl.NumberFormat('en-US', DECIMALS);
/** Spoken form, read by a French voice: decimal comma, or « 42.580 » would be read 42 580. */
const spokenCoordinate = new Intl.NumberFormat('fr-FR', DECIMALS);

/** (42.58, 8.725) → "42.580° N · 8.725° E" · (-8.1, -34.9) → "8.100° S · 34.900° W" */
export function formatCoordinates(latitude: number, longitude: number): string {
  const lat = `${coordinate.format(Math.abs(latitude))}° ${latitude < 0 ? 'S' : 'N'}`;
  const lon = `${coordinate.format(Math.abs(longitude))}° ${longitude < 0 ? 'W' : 'E'}`;
  return `${lat} · ${lon}`;
}

/** Spoken form: "Latitude 42,580 nord, longitude 8,725 est" */
export function spokenCoordinates(latitude: number, longitude: number): string {
  const lat = `${spokenCoordinate.format(Math.abs(latitude))} ${latitude < 0 ? 'sud' : 'nord'}`;
  const lon = `${spokenCoordinate.format(Math.abs(longitude))} ${longitude < 0 ? 'ouest' : 'est'}`;
  return `Latitude ${lat}, longitude ${lon}`;
}
