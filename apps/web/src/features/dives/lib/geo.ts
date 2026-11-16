// Dive detail — site coordinates, as printed on the mini map.

const coordinate = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

/** (42.58, 8.725) → "42.580° N · 8.725° E" · (-8.1, -34.9) → "8.100° S · 34.900° W" */
export function formatCoordinates(latitude: number, longitude: number): string {
  const lat = `${coordinate.format(Math.abs(latitude))}° ${latitude < 0 ? 'S' : 'N'}`;
  const lon = `${coordinate.format(Math.abs(longitude))}° ${longitude < 0 ? 'W' : 'E'}`;
  return `${lat} · ${lon}`;
}

/** Spoken form: "Latitude 42.580 nord, longitude 8.725 est" */
export function spokenCoordinates(latitude: number, longitude: number): string {
  const lat = `${coordinate.format(Math.abs(latitude))} ${latitude < 0 ? 'sud' : 'nord'}`;
  const lon = `${coordinate.format(Math.abs(longitude))} ${longitude < 0 ? 'ouest' : 'est'}`;
  return `Latitude ${lat}, longitude ${lon}`;
}
