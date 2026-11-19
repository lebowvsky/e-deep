// Dive form — the lists the form offers, read from the log (`GET /dives`).
//
// The log summary carries sites, dive teams, numbers and times; it has neither the dive centres nor
// the species (detail-only fields): those suggestion lists stay empty until the API serves them.
import type { DiveMember } from '@/shared/model/dive';
import { EMPTY_SITES_OVERLAY, type SitesOverlay } from '@/shared/sites/repository/sitesRepository';
import { computeFacets } from '../lib/selectDives';
import type { LoggedDive } from '../types';
import { startedAtOf, type DiveFormTarget } from './convert';
import type { DiveFormValues } from './model';
import { parseClock } from './timeLink';

export interface DiveFormSiteOption {
  id: string;
  name: string;
  /** « Calvi · Corse »; `null` when neither the locality nor the region was entered. */
  place: string | null;
  diveCount: number;
  /**
   * In the log on the API. `false` for a site created on this device (quick creation): saving the
   * dive creates it (`toSaveDiveInput`).
   */
  isSaved: boolean;
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
  /** Regions (« Calvi · Corse ») of the sites, most dived first: choices of a new site. */
  regions: string[];
  /** Region of the site of the latest dive: what a new site most likely shares. */
  lastRegion: string | null;
}

/** Number of « Fréquents » chips. */
export const FREQUENT_DIVERS = 4;

const byDiveCount = (a: DiveFormSiteOption, b: DiveFormSiteOption): number =>
  b.diveCount - a.diveCount || a.name.localeCompare(b.name, 'fr');

/**
 * The sites of the log under the local changes (D30): a site edited here shows its new name and
 * region, a site created here joins the list without dive, a merged site lends its dives to the
 * target, a deleted one leaves.
 */
function withLocalChanges(
  logSites: ReadonlyMap<string, DiveFormSiteOption>,
  overlay: SitesOverlay,
): DiveFormSiteOption[] {
  const sites = new Map(logSites);
  for (const site of overlay.saved.values()) {
    const known = logSites.get(site.id);
    sites.set(site.id, {
      id: site.id,
      name: site.name,
      place: site.region,
      diveCount: known?.diveCount ?? 0,
      isSaved: known !== undefined,
    });
  }
  for (const [sourceId, targetId] of overlay.mergedInto) {
    const source = logSites.get(sourceId);
    const target = sites.get(targetId);
    if (source && target)
      sites.set(targetId, { ...target, diveCount: target.diveCount + source.diveCount });
  }
  return [...sites.values()].filter(({ id }) => !overlay.removed.has(id)).sort(byDiveCount);
}

/** Distinct regions, in the order of the sites (most dived first). */
function regionsOf(sites: readonly DiveFormSiteOption[]): string[] {
  return [...new Set(sites.flatMap(({ place }) => (place === null ? [] : [place])))];
}

/** `log`: the dive log, latest first; `overlay`: the local changes on the sites. */
export function buildDiveFormSources(
  log: readonly LoggedDive[],
  overlay: SitesOverlay = EMPTY_SITES_OVERLAY,
): DiveFormSources {
  const logSites = new Map<string, DiveFormSiteOption>();
  let maxNumber = 0;
  let latest: LoggedDive | null = null;
  for (const dive of log) {
    maxNumber = Math.max(maxNumber, dive.number);
    if (latest === null || dive.number > latest.number) latest = dive;
    const site = logSites.get(dive.site.id);
    if (site) site.diveCount += 1;
    else {
      logSites.set(dive.site.id, {
        id: dive.site.id,
        name: dive.site.name,
        place: dive.site.place,
        diveCount: 1,
        isSaved: true,
      });
    }
  }
  const sites = withLocalChanges(logSites, overlay);
  const latestSiteId = latest ? (overlay.mergedInto.get(latest.site.id) ?? latest.site.id) : null;
  const divers = computeFacets(log).members;
  return {
    sites,
    divers,
    frequentDivers: divers.slice(0, FREQUENT_DIVERS),
    diveCenters: [],
    species: [],
    maxNumber,
    regions: regionsOf(sites),
    lastRegion: sites.find(({ id }) => id === latestSiteId)?.place ?? null,
  };
}

/** Immersion assumed while none is typed: the dive counts as the last one of its day. */
const END_OF_DAY = '23:59';

/**
 * Logbook number the dive will have once saved (D26: computed, never stored): its rank by start,
 * ties broken by id, as the API numbers the log. The edited dive is left out of the others; a new
 * dive is ranked under `eventId`, the id it will be saved with. Without a valid date: last.
 */
export function diveNumberFor(
  log: readonly LoggedDive[],
  values: Pick<DiveFormValues, 'date' | 'entryTime'>,
  target: DiveFormTarget,
  eventId: string,
): number {
  const id = target.kind === 'update' ? target.diveId : eventId;
  const others = log.filter((dive) => dive.id !== id);
  const entryTime = parseClock(values.entryTime) === null ? END_OF_DAY : values.entryTime;
  const start = startedAtOf({ date: values.date, entryTime }, target);
  if (start === null) return others.length + 1;
  const instant = Date.parse(start.startedAt);
  const before = others.filter((dive) => {
    const other = Date.parse(dive.date);
    return other < instant || (other === instant && dive.id.localeCompare(id) < 0);
  });
  return before.length + 1;
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
  const start = startedAtOf(values, target);
  if (start === null) return null;
  return proposeSurfaceInterval(
    log,
    start.startedAt,
    target.kind === 'update' ? target.diveId : null,
  );
}
