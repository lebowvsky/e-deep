import type { HealthPolicyVersion } from '@e-deep/shared';
import { APP_NAME } from './app';

/**
 * Label of the health data consent box (`/welcome`, `/consent`, D38), per policy version: a new
 * version added to the contract does not compile until its text is written here. Wording
 * validated by the product owner (docs/plans/auth-screens.md §5).
 */
export const HEALTH_CONSENT_TEXT = {
  '2026-11': `J’accepte que ${APP_NAME} enregistre mes données de plongée, dont certaines sont des données de santé (profondeurs, durées, paliers, incidents), pour tenir mon carnet. Elles ne sont visibles que par moi. Je peux retirer cet accord à tout moment en supprimant mon compte.`,
} as const satisfies Record<HealthPolicyVersion, string>;
