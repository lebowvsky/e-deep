import type { CertificationLevelOption } from '@e-deep/shared';
import type { CertificationLevel } from './certification-level.entity';

export function toCertificationLevelOption({
  id,
  agency,
  code,
  label,
}: CertificationLevel): CertificationLevelOption {
  return { id, agency, code, label };
}
