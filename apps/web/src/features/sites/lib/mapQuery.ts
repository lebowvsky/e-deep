// State of the map page kept in the URL: selected site, zone, open panel (shareable, kept on back).
import { SITE_ZONES, type SiteZone } from '@/shared/model/site';

export type MapPanel = { kind: 'new' } | { kind: 'place' | 'edit'; id: string };

export interface MapQuery {
  /** `?site=` */
  siteId: string | null;
  /** `?zone=`; `null`: every zone (« Tous »). */
  zone: SiteZone | null;
  /** `?panel=new` · `?panel=place&id=` · `?panel=edit&id=` */
  panel: MapPanel | null;
}

const isZone = (value: string | null): value is SiteZone =>
  SITE_ZONES.some((zone) => zone === value);

function parsePanel(params: URLSearchParams): MapPanel | null {
  const kind = params.get('panel');
  const id = params.get('id');
  if (kind === 'new') return { kind };
  if ((kind === 'place' || kind === 'edit') && id) return { kind, id };
  return null;
}

export function parseMapQuery(params: URLSearchParams): MapQuery {
  const zone = params.get('zone');
  return {
    siteId: params.get('site') || null,
    zone: isZone(zone) ? zone : null,
    panel: parsePanel(params),
  };
}

/** `query` written over `current`, its other parameters kept (`?state=`…). */
export function serializeMapQuery(query: MapQuery, current: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(current);
  for (const key of ['site', 'zone', 'panel', 'id']) params.delete(key);
  if (query.siteId) params.set('site', query.siteId);
  if (query.zone) params.set('zone', query.zone);
  if (query.panel) {
    params.set('panel', query.panel.kind);
    if (query.panel.kind !== 'new') params.set('id', query.panel.id);
  }
  return params;
}

/** Same panel (kind and site): its form keeps its state. */
export function panelKey(panel: MapPanel | null): string | null {
  if (!panel) return null;
  return panel.kind === 'new' ? 'new' : `${panel.kind}:${panel.id}`;
}
