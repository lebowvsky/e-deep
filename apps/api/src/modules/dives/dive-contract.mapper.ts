const MS_PER_MINUTE = 60_000;

/**
 * Local time of a dive, as the single `date` field of the front contract: ISO 8601 with the dive's
 * own offset, e.g. `2026-07-14T21:00:00+03:00`. A 21:00 dive in the Red Sea reads 21:00 whatever the
 * time zone of the device displaying it (D-10). The instant is preserved.
 *
 * The `Dive` contract should also expose `utcOffsetMinutes`, so the creator can correct it.
 */
export function toLocalDateTime(startedAt: Date, utcOffsetMinutes: number): string {
  const local = new Date(startedAt.getTime() + utcOffsetMinutes * MS_PER_MINUTE);
  // `toISOString` prints the shifted instant as if it were UTC: keep the wall-clock part only.
  const wallClock = local.toISOString().slice(0, 19);
  return `${wallClock}${formatOffset(utcOffsetMinutes)}`;
}

function formatOffset(utcOffsetMinutes: number): string {
  const sign = utcOffsetMinutes < 0 ? '-' : '+';
  const absolute = Math.abs(utcOffsetMinutes);
  const hours = String(Math.trunc(absolute / 60)).padStart(2, '0');
  const minutes = String(absolute % 60).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
}
