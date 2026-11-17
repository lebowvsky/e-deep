// Every value of the unions of the dive contract: the guards of the API module, the draft guard
// and the choices of the form read them here (domain values, not HTTP).
import type {
  CurrentStrength,
  EntryType,
  GasMix,
  SeaState,
  SuitType,
  TankMaterial,
  TimeOfDay,
  Weather,
} from '@e-deep/shared';

// Every value of each union: a value the front does not know breaks the contract (D-14, deployed
// front first).
export const GAS_MIXES = [
  'AIR',
  'NITROX32',
  'NITROX36',
  'OTHER',
] as const satisfies readonly GasMix[];
export const ENTRY_TYPES = ['BOAT', 'SHORE'] as const satisfies readonly EntryType[];
export const TIMES_OF_DAY = ['DAY', 'NIGHT'] as const satisfies readonly TimeOfDay[];
export const WEATHERS = [
  'SUNNY',
  'CLOUDY',
  'OVERCAST',
  'RAIN',
] as const satisfies readonly Weather[];
export const SEA_STATES = [
  'CALM',
  'SLIGHT',
  'MODERATE',
  'ROUGH',
] as const satisfies readonly SeaState[];
export const CURRENT_STRENGTHS = [
  'NONE',
  'WEAK',
  'MODERATE',
  'STRONG',
] as const satisfies readonly CurrentStrength[];
export const TANK_MATERIALS = ['STEEL', 'ALUMINIUM'] as const satisfies readonly TankMaterial[];
export const SUIT_TYPES = ['WET', 'SEMI_DRY', 'DRY'] as const satisfies readonly SuitType[];
