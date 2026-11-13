// Region keys: the region name, as entered, turned into a stable URL-safe key.
import type { RegionKey } from '../types';
import { normalizeText } from './text';

const REGION_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** « Côte d’Azur » → `cote-d-azur` · « Bretagne » → `bretagne`. */
export function toRegionKey(name: string): RegionKey {
  return normalizeText(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Shape check for the URL: an unknown but well-formed key is kept (it simply matches nothing). */
export function isRegionKey(value: string): value is RegionKey {
  return REGION_KEY.test(value);
}
