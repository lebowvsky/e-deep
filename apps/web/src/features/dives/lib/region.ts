// Region keys: the region name, as entered, turned into a stable URL-safe key.
import { hashOf } from '@/shared/lib/hash';
import type { RegionKey } from '../types';
import { normalizeText } from './text';

const REGION_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * « Côte d’Azur » → `cote-d-azur` · « Bretagne » → `bretagne`.
 *
 * A name the slug cannot spell (« Ελλάδα », « مصر », « 🐠 », « Ísafjörður ») gets `r-` and a hash
 * of the name instead: distinct names keep distinct keys rather than all collapsing into `''`.
 */
export function toRegionKey(name: string): RegionKey {
  const text = normalizeText(name).trim().replace(/\s+/g, ' ');
  const slug = text.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  // « Ελλάδα 2 » and « مصر 2 » would both slug to `2`: a lost letter or digit calls for the hash.
  const losesLetters = /[\p{L}\p{N}]/u.test(text.replace(/[a-z0-9]/g, ''));
  return slug === '' || losesLetters ? `r-${hashOf(text).toString(36)}` : slug;
}

/** Shape check for the URL: an unknown but well-formed key is kept (it simply matches nothing). */
export function isRegionKey(value: string): value is RegionKey {
  return REGION_KEY.test(value);
}
