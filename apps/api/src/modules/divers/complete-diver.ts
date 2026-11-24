import type { Relation } from 'typeorm';
import type { CertificationLevel } from '../certification-levels/certification-level.entity';
import type { Diver } from './diver.entity';

/**
 * A diver past onboarding (`/welcome`, D36, D38): the current level is set, and so is its relation
 * once loaded. The last name stays optional.
 */
export interface CompleteDiver extends Diver {
  certificationLevelId: string;
  certificationLevel?: Relation<CertificationLevel>;
}

/**
 * Narrows the current diver to a complete profile, for the readers of the dive log.
 *
 * Invariant rather than a domain error: the `SessionGuard` answers `403 onboarding-required` on
 * every dive log route to an incomplete profile, so this never throws there. Should a route ever
 * skip that check (`@AllowIncompleteProfile()`), a plain `Error` ends in a generic 500. Its message
 * carries neither id nor name (GDPR, ARCHITECTURE §9).
 *
 * @throws {Error} when the diver has no certification level.
 */
export function assertCompleteDiver(diver: Diver): asserts diver is CompleteDiver {
  if (diver.certificationLevelId === null || diver.certificationLevel === null) {
    throw new Error('Incomplete diver profile: no certification level');
  }
}
