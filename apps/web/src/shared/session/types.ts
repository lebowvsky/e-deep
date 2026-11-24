import type { CertificationLevelRef } from '@e-deep/shared';

/**
 * The signed-in diver as the app screens show them, once onboarding is done: the level is known
 * (`requireSession` lets no incomplete profile into the app), the last name stays optional (D36).
 */
export interface CurrentDiver {
  id: string;
  firstName: string;
  lastName: string | null;
  level: CertificationLevelRef;
  avatarUrl?: string;
}
