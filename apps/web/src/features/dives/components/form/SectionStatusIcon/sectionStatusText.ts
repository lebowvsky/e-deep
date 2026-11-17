import type { SectionStatus } from '../../../form/derived';

/** Spoken state: « complète », « partielle, il manque Pression fin », « vide ». */
export function sectionStatusText(status: SectionStatus): string {
  switch (status.status) {
    case 'complete':
      return 'complète';
    case 'partial':
      return `partielle, il manque ${status.missing}`;
    case 'empty':
      return 'vide';
  }
}
