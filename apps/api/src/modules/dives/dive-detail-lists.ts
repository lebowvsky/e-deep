/**
 * Closed lists of the dive detail, stored as `text` + `CHECK` (D-14, values H-18). The `CHECK`
 * constraints of the entities and the unions of `@e-deep/shared` list the same values: adding one
 * means a migration, the shared union and the front guard (front deployed first).
 */
export const ENTRY_TYPES = ['BOAT', 'SHORE'] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

export const TIMES_OF_DAY = ['DAY', 'NIGHT'] as const;
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

export const WEATHERS = ['SUNNY', 'CLOUDY', 'OVERCAST', 'RAIN'] as const;
export type Weather = (typeof WEATHERS)[number];

export const SEA_STATES = ['CALM', 'SLIGHT', 'MODERATE', 'ROUGH'] as const;
export type SeaState = (typeof SEA_STATES)[number];

export const CURRENT_STRENGTHS = ['NONE', 'WEAK', 'MODERATE', 'STRONG'] as const;
export type CurrentStrength = (typeof CURRENT_STRENGTHS)[number];

export const TANK_MATERIALS = ['STEEL', 'ALUMINIUM'] as const;
export type TankMaterial = (typeof TANK_MATERIALS)[number];

export const SUIT_TYPES = ['WET', 'SEMI_DRY', 'DRY'] as const;
export type SuitType = (typeof SUIT_TYPES)[number];
