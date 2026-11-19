import type { SiteType } from '@/shared/model/site';

/** Chip labels of the site types (sites.jsx). */
export const SITE_TYPE_LABELS: Record<SiteType, string> = {
  tombant: 'Tombant',
  epave: 'Épave',
  sec: 'Sec',
  grotte: 'Grotte',
  herbier: 'Herbier',
  autre: 'Autre',
};
