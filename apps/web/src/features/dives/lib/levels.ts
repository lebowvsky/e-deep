// Certification levels offered in the dive team, and their reference as the API serves it.
import type { CertificationLevelRef } from '@e-deep/shared';

/** Levels offered for a member of the dive team (FFESSM). */
export const TEAM_LEVELS = [
  { code: 'N1', label: 'Niveau 1' },
  { code: 'N2', label: 'Niveau 2' },
  { code: 'N3', label: 'Niveau 3' },
  { code: 'N4', label: 'Niveau 4' },
  { code: 'PA20', label: 'Plongeur autonome 20 m' },
  { code: 'PA40', label: 'Plongeur autonome 40 m' },
  { code: 'PA60', label: 'Plongeur autonome 60 m' },
  { code: 'PE20', label: 'Plongeur encadré 20 m' },
  { code: 'PE40', label: 'Plongeur encadré 40 m' },
  { code: 'PE60', label: 'Plongeur encadré 60 m' },
] as const;

/** `N3` → `{ agency, code: 'N3', label: 'Niveau 3' }`; an unknown code is its own label. */
export function toCertificationLevelRef(code: string, agency: string): CertificationLevelRef {
  const label = TEAM_LEVELS.find((level) => level.code === code)?.label ?? code;
  return { agency, code, label };
}
