// Writes on the sites: what the front checks and prepares here (names, texts), the rest (merge,
// deletion refused) by the `SitesRepository`, that is the API.
import type { Site, SiteDraft, SiteEntry, SiteOrigin } from '@/shared/model/site';
import type { SitesRepository } from '../repository/sitesRepository';

/** Blank text is « not entered ». */
function entered(text: string | null): string | null {
  const trimmed = text?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

/** The draft as stored: trimmed texts. A site cannot exist without a name. */
function normalized(draft: SiteDraft): SiteDraft {
  const name = draft.name.trim();
  if (name === '') throw new Error('A site needs a name.');
  return {
    ...draft,
    name,
    region: entered(draft.region),
    accessNotes: entered(draft.accessNotes),
  };
}

export interface CreateSiteOptions {
  id: string;
  createdVia: SiteOrigin;
}

export async function createSite(
  repository: SitesRepository,
  draft: SiteDraft,
  { id, createdVia }: CreateSiteOptions,
): Promise<Site> {
  return repository.create({ id, createdVia, ...normalized(draft) });
}

export async function updateSite(
  repository: SitesRepository,
  site: Site,
  draft: SiteDraft,
): Promise<Site> {
  return repository.update(site, normalized(draft));
}

/**
 * Merges `source` into `target`: the dives of the source go to the target, the empty fields of
 * the target are completed by the source, the source is deleted. Irreversible.
 */
export async function mergeSites(
  repository: SitesRepository,
  source: Site,
  target: Site,
): Promise<Site> {
  if (source.id === target.id) throw new Error('A site cannot be merged into itself.');
  return repository.merge(source.id, target.id);
}

/** A site with dives is never deleted: they would be lost. Merging it is the way out. */
export type DeleteSiteResult = { status: 'deleted' } | { status: 'refused'; diveCount: number };

export async function deleteSite(
  repository: SitesRepository,
  { site, stats }: SiteEntry,
): Promise<DeleteSiteResult> {
  if (stats.diveCount > 0) return { status: 'refused', diveCount: stats.diveCount };
  const outcome = await repository.remove(site.id);
  // Refused while the log read here had no dive on the site: dives were added meanwhile (another
  // device). At least one; the counts are read again with the sites.
  return outcome === 'deleted' ? { status: 'deleted' } : { status: 'refused', diveCount: 1 };
}
