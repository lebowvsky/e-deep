// Writes on the sites: the rules (names, zone, merge, deletion) here, the storage behind the
// `SitesRepository` port.
import type { Site, SiteDraft, SiteEntry, SiteOrigin } from '@/shared/model/site';
import type { SitesRepository } from '../repository/sitesRepository';
import { deriveZone } from './zone';

/** Blank text is « not entered ». */
function entered(text: string | null): string | null {
  const trimmed = text?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

/** The draft as stored: trimmed texts, zone derived. A site cannot exist without a name. */
function normalized(draft: SiteDraft): SiteDraft & Pick<Site, 'zone'> {
  const name = draft.name.trim();
  if (name === '') throw new Error('A site needs a name.');
  const region = entered(draft.region);
  return {
    ...draft,
    name,
    region,
    accessNotes: entered(draft.accessNotes),
    zone: deriveZone(draft.position, region),
  };
}

export interface CreateSiteOptions {
  id: string;
  createdVia: SiteOrigin;
  now: Date;
}

export async function createSite(
  repository: SitesRepository,
  draft: SiteDraft,
  { id, createdVia, now }: CreateSiteOptions,
): Promise<Site> {
  const instant = now.toISOString();
  return repository.save({
    id,
    ...normalized(draft),
    createdVia,
    createdAt: instant,
    updatedAt: instant,
  });
}

export async function updateSite(
  repository: SitesRepository,
  site: Site,
  draft: SiteDraft,
  now: Date,
): Promise<Site> {
  return repository.save({ ...site, ...normalized(draft), updatedAt: now.toISOString() });
}

/** The fields of `target` left empty, completed with those of `source`; the rest is kept. */
export function completeSite(target: Site, source: Site): Site {
  const position = target.position ?? source.position;
  const region = target.region ?? source.region;
  return {
    ...target,
    region,
    type: target.type ?? source.type,
    depthMinM: target.depthMinM ?? source.depthMinM,
    depthMaxM: target.depthMaxM ?? source.depthMaxM,
    position,
    accessNotes: target.accessNotes ?? source.accessNotes,
    zone: deriveZone(position, region),
  };
}

/**
 * Merges `source` into `target`: the dives of the source go to the target, the empty fields of
 * the target are completed by the source, the source is deleted. Irreversible.
 */
export async function mergeSites(
  repository: SitesRepository,
  source: Site,
  target: Site,
  now: Date,
): Promise<Site> {
  if (source.id === target.id) throw new Error('A site cannot be merged into itself.');
  return repository.merge(source.id, {
    ...completeSite(target, source),
    updatedAt: now.toISOString(),
  });
}

/** A site with dives is never deleted: they would be lost. Merging it is the way out. */
export type DeleteSiteResult = { status: 'deleted' } | { status: 'refused'; diveCount: number };

export async function deleteSite(
  repository: SitesRepository,
  { site, stats }: SiteEntry,
): Promise<DeleteSiteResult> {
  if (stats.diveCount > 0) return { status: 'refused', diveCount: stats.diveCount };
  await repository.remove(site.id);
  return { status: 'deleted' };
}
