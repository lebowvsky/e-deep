import type { ConsentPurpose } from '@e-deep/shared';

/**
 * Purposes of a consent, stored as `text` + `CHECK` (`ck_consents__purpose`, D38). The `CHECK` of
 * `Consent` and the `ConsentPurpose` union of `@e-deep/shared` list the same values.
 */
export const CONSENT_PURPOSES = [
  'health_data_processing',
] as const satisfies readonly ConsentPurpose[];
