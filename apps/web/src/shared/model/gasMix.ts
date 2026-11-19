import type { GasMix } from '@e-deep/shared';

/**
 * Every gas mix of the contract: a value the front does not know breaks it (D-14, deployed front
 * first). Read by the guards of the dive log and of the dashboard, and by the form choices.
 */
export const GAS_MIXES = [
  'AIR',
  'NITROX32',
  'NITROX36',
  'OTHER',
] as const satisfies readonly GasMix[];
