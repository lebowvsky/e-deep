import type { Site } from '@/shared/model/site';
import { SITE_TYPE_LABELS } from '@/shared/sites/lib/labels';

/** Id of the row of a site in the list: target of the focus and of the scroll. */
export const siteItemId = (id: string) => `site-item-${id}`;

/**
 * Gives the focus back after the panel or the preview closes: the row of the site, else the
 * « Ajouter un site » (`data-add-site`: header, phone sheet) shown at this width. After the next
 * paint, once the list is back.
 */
export function focusAfterClose(siteId: string | null): void {
  requestAnimationFrame(() => {
    const row = siteId ? document.getElementById(siteItemId(siteId)) : null;
    const add = Array.from(document.querySelectorAll<HTMLElement>('[data-add-site]')).find(
      (button) => button.getClientRects().length > 0,
    );
    (row ?? add)?.focus();
  });
}

/** « Calvi · Corse · Tombant »: what is known of the region and the type. */
export function siteMeta(site: Pick<Site, 'region' | 'type'>): string | null {
  const parts = [site.region, site.type && SITE_TYPE_LABELS[site.type]].filter(
    (part): part is string => Boolean(part),
  );
  return parts.length === 0 ? null : parts.join(' · ');
}

/** « 1 site attend sa position. » · « 3 sites attendent leur position. » */
export function waitingPositionLabel(count: number): string {
  return count > 1
    ? `${count} sites attendent leur position.`
    : `${count} site attend sa position.`;
}

/** « 1 site » · « 23 sites » */
export function formatSiteCount(count: number): string {
  return `${count} ${count > 1 ? 'sites' : 'site'}`;
}

/** « 1 région » · « 6 régions » */
export function formatRegionCount(count: number): string {
  return `${count} ${count > 1 ? 'régions' : 'région'}`;
}

/** Where the site page links: the map with the site selected. */
export const mapHrefOf = (id: string) => `/map?site=${encodeURIComponent(id)}`;
export const editHrefOf = (id: string) => `/map?panel=edit&id=${encodeURIComponent(id)}`;
export const placeHrefOf = (id: string) => `/map?panel=place&id=${encodeURIComponent(id)}`;
export const newDiveHrefOf = (id: string) => `/dives/new?site=${encodeURIComponent(id)}`;
export const divesHrefOf = (id: string) => `/dives?site=${encodeURIComponent(id)}`;
