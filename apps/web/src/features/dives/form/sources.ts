// Dive form — the lists the form offers, read from the log (`GET /dives`).
//
// The log summary carries sites, dive teams, numbers and times; it has neither the dive centres nor
// the species (detail-only fields): those suggestion lists stay empty until the API serves them.
import type { DiveMember } from '@/shared/model/dive';
import { computeFacets } from '../lib/selectDives';
import type { LoggedDive } from '../types';
import type { DiveFormTarget } from './convert';
import type { DiveFormValues } from './model';
import { deviceUtcOffsetMinutes, toLocalIso } from './timeLink';

export interface DiveFormSiteOption {
  id: string;
  name: string;
  /** « Calvi · Corse » */
  place: string;
  diveCount: number;
}

export interface DiveFormDiverOption {
  member: DiveMember;
  /** Dives together in the log. */
  count: number;
}

export interface DiveFormSources {
  /** « Mes sites », most dived first (ties: by name). */
  sites: DiveFormSiteOption[];
  /** Divers met, most frequent first. */
  divers: DiveFormDiverOption[];
  /** The first divers met, for the « Fréquents » chips. */
  frequentDivers: DiveFormDiverOption[];
  /** Dive centres already entered (not in the log summary: empty for now). */
  diveCenters: string[];
  /** Species already entered (not in the log summary: empty for now). */
  species: string[];
  /** Highest logbook number, 0 for an empty log. */
  maxNumber: number;
}

/** Number of « Fréquents » chips. */
export const FREQUENT_DIVERS = 4;

export function buildDiveFormSources(log: readonly LoggedDive[]): DiveFormSources {
  const sites = new Map<string, DiveFormSiteOption>();
  let maxNumber = 0;
  for (const dive of log) {
    maxNumber = Math.max(maxNumber, dive.number);
    const site = sites.get(dive.site.id);
    if (site) site.diveCount += 1;
    else {
      sites.set(dive.site.id, {
        id: dive.site.id,
        name: dive.site.name,
        place: dive.site.place,
        diveCount: 1,
      });
    }
  }
  const divers = computeFacets(log).members;
  return {
    sites: [...sites.values()].sort(
      (a, b) => b.diveCount - a.diveCount || a.name.localeCompare(b.name, 'fr'),
    ),
    divers,
    frequentDivers: divers.slice(0, FREQUENT_DIVERS),
    diveCenters: [],
    species: [],
    maxNumber,
  };
}

/** Logbook numbers of the log, but the edited dive's own. */
export function takenNumbers(log: readonly LoggedDive[], editedId: string | null): Set<number> {
  return new Set(log.filter(({ id }) => id !== editedId).map(({ number }) => number));
}

const MS_PER_MINUTE = 60_000;
const REPETITIVE_WINDOW_MIN = 12 * 60;

/**
 * Surface interval since the dive that ended last before `startedAt` (ISO with offset), when it is
 * under 12 h: the form proposes « Plongée successive » with it (D-17, the diver confirms). The
 * edited dive itself is skipped. `null` without such a dive.
 */
export function proposeSurfaceInterval(
  log: readonly LoggedDive[],
  startedAt: string,
  editedId: string | null,
): number | null {
  const start = Date.parse(startedAt);
  if (Number.isNaN(start)) return null;
  let latestEnd: number | null = null;
  for (const dive of log) {
    if (dive.id === editedId) continue;
    const end = Date.parse(dive.date) + dive.durationMin * MS_PER_MINUTE;
    if (end <= start && (latestEnd === null || end > latestEnd)) latestEnd = end;
  }
  if (latestEnd === null) return null;
  const interval = Math.round((start - latestEnd) / MS_PER_MINUTE);
  return interval > 0 && interval < REPETITIVE_WINDOW_MIN ? interval : null;
}

/**
 * `proposeSurfaceInterval` for the dive being entered: its start read from the form, in the offset
 * of the edited dive or else of the device; `null` until the date and the immersion are valid.
 */
export function proposeSurfaceIntervalFor(
  log: readonly LoggedDive[],
  values: Pick<DiveFormValues, 'date' | 'entryTime'>,
  target: DiveFormTarget,
): number | null {
  const offset =
    target.kind === 'update'
      ? target.utcOffsetMinutes
      : deviceUtcOffsetMinutes(values.date, values.entryTime);
  const startedAt = offset === null ? null : toLocalIso(values.date, values.entryTime, offset);
  if (startedAt === null) return null;
  return proposeSurfaceInterval(log, startedAt, target.kind === 'update' ? target.diveId : null);
}
