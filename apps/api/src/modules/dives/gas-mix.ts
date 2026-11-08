/** Closed list stored as `text` + `CHECK` (D-06). */
export const GAS_MIXES = ['AIR', 'NITROX32', 'NITROX36', 'OTHER'] as const;

export type GasMix = (typeof GAS_MIXES)[number];
