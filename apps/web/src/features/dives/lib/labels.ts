// Dive log — French labels of the filters, sorts, gases and dive detail values.
import type {
  CurrentStrength,
  DiveObservation,
  EntryType,
  GasMix,
  SeaState,
  SuitType,
  TankMaterial,
  TimeOfDay,
  Weather,
} from '@e-deep/shared';
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

/** Oxygen share implied by each mix (%); `OTHER` carries its own (`o2Percent`). */
const GAS_MIX_OXYGEN: Record<Exclude<GasMix, 'OTHER'>, number> = {
  AIR: 21,
  NITROX32: 32,
  NITROX36: 36,
};

/**
 * Oxygen share of the dive's mix: implied by AIR and NITROX (an entered `o2Percent` is ignored),
 * entered for `OTHER`, `null` when it was not.
 */
export function oxygenPercent(gasMix: GasMix, o2Percent: number | null): number | null {
  return gasMix === 'OTHER' ? o2Percent : GAS_MIX_OXYGEN[gasMix];
}

/** « 21 % O₂ », or `null` when the share is unknown (no line rather than a guess). */
export function oxygenLabel(percent: number | null): string | null {
  return percent === null ? null : `${percent} % O₂`;
}

/** Dive run « Paliers de déco. »: « Aucun » / « Oui ». */
export function decompressionLabel(hadDecompression: boolean): string {
  return hadDecompression ? 'Oui' : 'Aucun';
}

/** Dive run « Successive »: « Oui » / « Non ». */
export function repetitiveLabel(isRepetitive: boolean): string {
  return isRepetitive ? 'Oui' : 'Non';
}

// ── Dive detail: values of the unions (provisional wording, H-18 of the data model) ─────────

/** A field left empty, agreed with its name: « Lest : Non renseigné », « Mer : Non renseignée ». */
export const MISSING_LABELS = {
  masculine: 'Non renseigné',
  feminine: 'Non renseignée',
} as const;
export type MissingLabel = (typeof MISSING_LABELS)[keyof typeof MISSING_LABELS];

/** A card with no value at all. */
export const NOTHING_ENTERED = 'Rien de renseigné';

/** Header tag and « Type » of the conditions: « Bateau », « Bord ». */
export const ENTRY_TYPE_LABELS: Record<EntryType, string> = { BOAT: 'Bateau', SHORE: 'Bord' };

/** Lower case: it follows the entry type (« Bateau · jour »). */
export const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = { DAY: 'jour', NIGHT: 'nuit' };

export const WEATHER_LABELS: Record<Weather, string> = {
  SUNNY: 'Ensoleillé',
  CLOUDY: 'Nuageux',
  OVERCAST: 'Couvert',
  RAIN: 'Pluie',
};

export const SEA_STATE_LABELS: Record<SeaState, string> = {
  CALM: 'Calme',
  SLIGHT: 'Peu agitée',
  MODERATE: 'Agitée',
  ROUGH: 'Forte',
};

export const CURRENT_STRENGTH_LABELS: Record<CurrentStrength, string> = {
  NONE: 'Nul',
  WEAK: 'Faible',
  MODERATE: 'Moyen',
  STRONG: 'Fort',
};

/** Lower case: it follows the volume (« 12 L · acier »). */
export const TANK_MATERIAL_LABELS: Record<TankMaterial, string> = {
  STEEL: 'acier',
  ALUMINIUM: 'alu',
};

/** Lower case: it follows the thickness (« 7 mm · semi-étanche »). */
export const SUIT_TYPE_LABELS: Record<SuitType, string> = {
  WET: 'humide',
  SEMI_DRY: 'semi-étanche',
  DRY: 'étanche',
};

/** Species tag: « Mérou brun · 2 », or the species alone when not counted. */
export function observationLabel({ label, count }: DiveObservation): string {
  return count === null ? label : `${label} · ${count}`;
}

/** Screen readers: « Mérou brun, 2 individus » · « Murène, 1 individu » · « Corb ». */
export function observationSpoken({ label, count }: DiveObservation): string {
  if (count === null) return label;
  return `${label}, ${count} ${count > 1 ? 'individus' : 'individu'}`;
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
  site: 'Site',
};

export interface FilterDescription {
  key: DivesFilterKey;
  /** Short value: « Bretagne », « ≥ 40 m », « « épave » ». */
  value: string;
  /** Chip text: « Région : Bretagne », « Recherche « épave » ». */
  label: string;
}

/** The names behind the region and member ids of the query. */
export type FilterNames = Pick<DivesFacets, 'regions' | 'members' | 'sites'>;

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
    case 'site':
      // A site without dive in this log (merged, or another diver's link): « un site ».
      return names.sites.find(({ id }) => id === query.site)?.name ?? 'un site';
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
/** Neutral: the cause may be the network, the server or an unexpected answer. */
export const DIVE_LOAD_ERROR_HINT = 'Réessaie dans un instant.';

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
