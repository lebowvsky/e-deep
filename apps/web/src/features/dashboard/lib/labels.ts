import type { Dive } from '../types';

const GAS_LABELS = {
  AIR: 'Air',
  NITROX32: 'Nitrox 32',
  NITROX36: 'Nitrox 36',
  OTHER: 'Autre',
} as const satisfies Record<Dive['gasMix'], string>;

export function gasLabel(gasMix: Dive['gasMix']): string {
  return GAS_LABELS[gasMix];
}
