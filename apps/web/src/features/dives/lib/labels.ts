// Dive log — French labels of the filters, sorts and gases.
import type { GasMix } from '@e-deep/shared';
import { formatDiveCount } from '@/shared/lib/format';
import type {
  DivesFacets,
  DivesFilterKey,
  DivesPeriod,
  DivesQuery,
  DivesSort,
  DivesState,
  DiveDetailState,
  GasFamily,
} from '../types';

export const GAS_FAMILY_LABELS: Record<GasFamily, string> = {
  air: 'Air',
  nitrox: 'Nitrox',
  other: 'Autre',
};

const GAS_MIX_SHORT: Record<GasMix, string> = {
  AIR: 'Air',
  NITROX32: 'Nx 32',
  NITROX36: 'Nx 36',
  OTHER: 'Autre',
};

const GAS_MIX_SPOKEN: Record<GasMix, string> = {
  AIR: 'Air',
  NITROX32: 'Nitrox 32',
  NITROX36: 'Nitrox 36',
  OTHER: 'Autre mélange',
};

/** Table cell: « Nx 32 ». */
export function gasMixShort(gasMix: GasMix): string {
  return GAS_MIX_SHORT[gasMix];
}

/** Screen readers: « Nitrox 32 ». */
export function gasMixSpoken(gasMix: GasMix): string {
  return GAS_MIX_SPOKEN[gasMix];
}

/** Oxygen fraction of each mix (%); unknown for `OTHER`, whose mix is not entered. */
const GAS_MIX_OXYGEN: Record<GasMix, number | null> = {
  AIR: 21,
  NITROX32: 32,
  NITROX36: 36,
  OTHER: null,
};

/** « 21 % O₂ », or `null` when the fraction is unknown. */
export function oxygenLabel(gasMix: GasMix): string | null {
  const percent = GAS_MIX_OXYGEN[gasMix];
  return percent === null ? null : `${percent} % O₂`;
}

/** Dive run « Paliers »: « Respectés » / « À vérifier » (the header badge says « Palier OK »). */
export function stopsLabel(stopsOk: boolean): string {
  return stopsOk ? 'Respectés' : 'À vérifier';
}

/** « Oui » / « Non » for the decompression stops. */
export function decompressionLabel(hadDecompression: boolean): string {
  return hadDecompression ? 'Oui' : 'Non';
}

export const SORT_OPTIONS: { value: DivesSort; label: string }[] = [
  { value: '-date', label: 'Plus récentes' },
  { value: 'date', label: 'Plus anciennes' },
  { value: '-depth', label: 'Plus profondes' },
  { value: '-duration', label: 'Plus longues' },
];

/** 12 months, the current year, the previous one, everything. */
export function periodOptions(now: Date): { value: DivesPeriod; label: string }[] {
  const year = now.getFullYear();
  return [
    { value: '12m', label: '12 mois' },
    { value: `${year}`, label: `${year}` },
    { value: `${year - 1}`, label: `${year - 1}` },
    { value: 'all', label: 'Tout' },
  ];
}

/** 20–40 → « 20 – 40 m » · 40–∅ → « ≥ 40 m » · ∅–30 → « ≤ 30 m » · ∅–∅ → null */
export function depthRangeLabel(min: number | null, max: number | null): string | null {
  if (min !== null && max !== null) return `${min} – ${max} m`;
  if (min !== null) return `≥ ${min} m`;
  if (max !== null) return `≤ ${max} m`;
  return null;
}

export const FILTER_TITLES: Record<DivesFilterKey, string> = {
  q: 'Recherche',
  period: 'Période',
  regions: 'Région',
  depth: 'Profondeur',
  gases: 'Gaz',
  with: 'Palanquée',
};

export interface FilterDescription {
  key: DivesFilterKey;
  /** Short value: « Bretagne », « ≥ 40 m », « « épave » ». */
  value: string;
  /** Chip text: « Région : Bretagne », « Recherche « épave » ». */
  label: string;
}

/** The names behind the region and member ids of the query. */
export type FilterNames = Pick<DivesFacets, 'regions' | 'members'>;

function filterValue(query: DivesQuery, key: DivesFilterKey, names: FilterNames): string {
  switch (key) {
    case 'q':
      return `« ${query.q} »`;
    case 'period':
      return query.period === '12m' ? '12 derniers mois' : query.period;
    case 'regions':
      // A key from a shared link may be absent from this log: shown as is.
      return query.regions
        .map((key) => names.regions.find((region) => region.key === key)?.name ?? key)
        .join(', ');
    case 'depth':
      return depthRangeLabel(query.depthMin, query.depthMax) ?? '';
    case 'gases':
      return query.gases.map((gas) => GAS_FAMILY_LABELS[gas]).join(', ');
    case 'with':
      return query.with
        .map((id) => names.members.find(({ member }) => member.id === id)?.member)
        .filter((member) => member !== undefined)
        .map((member) => `${member.firstName} ${member.lastName}`)
        .join(', ');
  }
}

export function describeFilter(
  query: DivesQuery,
  key: DivesFilterKey,
  names: FilterNames,
): FilterDescription {
  const value = filterValue(query, key, names);
  const label = key === 'q' ? `Recherche ${value}` : `${FILTER_TITLES[key]} : ${value}`;
  return { key, value, label };
}

/** What the page live region says for each state (the selection size once loaded). */
export function stateAnnouncement(state: DivesState): string {
  switch (state.status) {
    case 'loading':
      return 'Chargement du carnet';
    case 'error':
      return 'Impossible de charger tes plongées pour l’instant.';
    case 'empty':
      return 'Ton carnet est vierge';
    case 'ready':
      return `${formatDiveCount(state.total)} dans la sélection`;
  }
}

export const DIVE_NOT_FOUND_MESSAGE = 'Cette plongée n’existe pas ou a été supprimée.';
export const DIVE_LOAD_ERROR_MESSAGE = 'Impossible de charger cette plongée pour l’instant.';

/** What the detail page live region says for each state (never the id from the URL). */
export function diveDetailAnnouncement(state: DiveDetailState): string {
  switch (state.status) {
    case 'loading':
      return 'Chargement de la plongée';
    case 'not-found':
      return DIVE_NOT_FOUND_MESSAGE;
    case 'error':
      return DIVE_LOAD_ERROR_MESSAGE;
    case 'ready':
      return `Plongée n° ${state.dive.number}, ${state.dive.site.name}`;
  }
}

/** « 1 plongée ensemble » · « 24 plongées ensemble » */
export function sharedDivesLabel(count: number): string {
  return `${formatDiveCount(count)} ensemble`;
}

/** « 1 plongeur » · « 3 plongeurs » */
export function teamSizeLabel(count: number): string {
  return `${count} ${count > 1 ? 'plongeurs' : 'plongeur'}`;
}
