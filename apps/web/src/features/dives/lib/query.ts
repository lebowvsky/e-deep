// DivesQuery ⇄ URL search params. Defaults are left out of the URL; invalid values are ignored.
import { isOneOf } from '@/shared/lib/guards';
import {
  DEPTH_SCALE_MAX,
  DIVES_SORTS,
  GAS_FAMILIES,
  PAGE_SIZES,
  type DivesFilterKey,
  type DivesPeriod,
  type DivesQuery,
  type PageSize,
  type RegionKey,
} from '../types';
import { isRegionKey } from './region';

export const DEFAULT_QUERY: DivesQuery = {
  q: '',
  period: 'all',
  regions: [],
  depthMin: null,
  depthMax: null,
  gases: [],
  with: [],
  sort: '-date',
  page: 1,
  size: 10,
};

const LIST_SEPARATOR = ',';

/** Every search param the dive log owns (others, such as `state`, are kept untouched). */
const OWN_PARAMS = [
  'q',
  'period',
  'region',
  'depthMin',
  'depthMax',
  'gas',
  'with',
  'sort',
  'page',
  'size',
] as const;

function parseList<const T extends string>(value: string | null, options: readonly T[]): T[] {
  if (!value) return [];
  const items = value.split(LIST_SEPARATOR).filter((item) => isOneOf(item, options));
  return [...new Set(items)];
}

function parseIds(value: string | null): string[] {
  if (!value) return [];
  return [...new Set(value.split(LIST_SEPARATOR).filter(Boolean))];
}

/** Regions come from the data: any well-formed key is kept, an unknown one matches nothing. */
function parseRegions(value: string | null): RegionKey[] {
  return parseIds(value).filter(isRegionKey);
}

function parseInteger(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  return Number(value);
}

function parsePeriod(value: string | null): DivesPeriod {
  if (value === '12m') return value;
  if (value !== null && /^(19|20)\d{2}$/.test(value)) return value as `${number}`;
  return 'all';
}

function parsePageSize(value: string | null): PageSize {
  const size = parseInteger(value);
  return PAGE_SIZES.find((option) => option === size) ?? DEFAULT_QUERY.size;
}

/** Bounds at the ends of the scale mean « no bound »; reversed bounds are swapped. */
function normalizeDepth(min: number | null, max: number | null): [number | null, number | null] {
  const low = min !== null && min > 0 ? Math.min(min, DEPTH_SCALE_MAX) : null;
  const high = max !== null && max < DEPTH_SCALE_MAX ? max : null;
  if (low !== null && high !== null && low > high) return [high, low];
  return [low, high];
}

export function parseDivesQuery(params: URLSearchParams): DivesQuery {
  const [depthMin, depthMax] = normalizeDepth(
    parseInteger(params.get('depthMin')),
    parseInteger(params.get('depthMax')),
  );
  const sort = params.get('sort');
  return {
    // Not trimmed: the search field writes every keystroke, trailing space included.
    q: params.get('q') ?? '',
    period: parsePeriod(params.get('period')),
    regions: parseRegions(params.get('region')),
    depthMin,
    depthMax,
    gases: parseList(params.get('gas'), GAS_FAMILIES),
    with: parseIds(params.get('with')),
    sort: isOneOf(sort, DIVES_SORTS) ? sort : DEFAULT_QUERY.sort,
    page: Math.max(1, parseInteger(params.get('page')) ?? 1),
    size: parsePageSize(params.get('size')),
  };
}

/**
 * Writes the query into `base` (a copy): own params are replaced, defaults left out, other params
 * (`state` in dev) kept.
 */
export function serializeDivesQuery(
  query: DivesQuery,
  base: URLSearchParams = new URLSearchParams(),
): URLSearchParams {
  const params = new URLSearchParams(base);
  for (const name of OWN_PARAMS) params.delete(name);

  const set = (name: string, value: string, isDefault: boolean) => {
    if (!isDefault) params.set(name, value);
  };
  set('q', query.q, query.q === '');
  set('period', query.period, query.period === DEFAULT_QUERY.period);
  set('region', query.regions.join(LIST_SEPARATOR), query.regions.length === 0);
  set('depthMin', String(query.depthMin), query.depthMin === null);
  set('depthMax', String(query.depthMax), query.depthMax === null);
  set('gas', query.gases.join(LIST_SEPARATOR), query.gases.length === 0);
  set('with', query.with.join(LIST_SEPARATOR), query.with.length === 0);
  set('sort', query.sort, query.sort === DEFAULT_QUERY.sort);
  set('page', String(query.page), query.page === 1);
  set('size', String(query.size), query.size === DEFAULT_QUERY.size);
  return params;
}

/**
 * Applies a change to the query. Any change other than the page itself sends back to page 1: the
 * selection changed, the old page number means nothing any more.
 */
export function updateDivesQuery(query: DivesQuery, patch: Partial<DivesQuery>): DivesQuery {
  const next = { ...query, ...patch };
  const onlyPage = Object.keys(patch).every((key) => key === 'page');
  return onlyPage ? next : { ...next, page: 1 };
}

/** Filters currently applied, in display order. */
export function activeFilterKeys(query: DivesQuery): DivesFilterKey[] {
  const active: Record<DivesFilterKey, boolean> = {
    q: query.q.trim() !== '',
    period: query.period !== 'all',
    regions: query.regions.length > 0,
    depth: query.depthMin !== null || query.depthMax !== null,
    gases: query.gases.length > 0,
    with: query.with.length > 0,
  };
  return (Object.keys(active) as DivesFilterKey[]).filter((key) => active[key]);
}

/** The query without one filter (sort and page size kept, back to page 1). */
export function withoutFilter(query: DivesQuery, key: DivesFilterKey): DivesQuery {
  const reset: Record<DivesFilterKey, Partial<DivesQuery>> = {
    q: { q: '' },
    period: { period: 'all' },
    regions: { regions: [] },
    depth: { depthMin: null, depthMax: null },
    gases: { gases: [] },
    with: { with: [] },
  };
  return updateDivesQuery(query, reset[key]);
}

/** The query without any filter (« Tout réinitialiser »): sort and page size kept. */
export function withoutFilters(query: DivesQuery): DivesQuery {
  return { ...DEFAULT_QUERY, sort: query.sort, size: query.size };
}
