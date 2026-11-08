import type { Federation, UserLevel } from '@e-deep/shared';
import { UnsupportedContractValueError } from '../../common/errors/domain-errors';
import type { CertificationLevel } from '../certification-levels/certification-level.entity';

/*
 * Values of the front contract (`@e-deep/shared`), derived from the certification level reference
 * data now that `level` and `federation` are no longer columns.
 *
 * `UserLevel` only knows the FFESSM levels: it must be widened as soon as a non-FFESSM level is
 * inserted in `certification_levels` (D-09 complementary list).
 */

const USER_LEVELS: ReadonlySet<string> = new Set<UserLevel>(['N1', 'N2', 'N3', 'N4']);

type LevelKey = Pick<CertificationLevel, 'agency' | 'code'>;

/**
 * `level` of the front contract = `certification_levels.code`, FFESSM N1–N4 only.
 *
 * @throws {UnsupportedContractValueError} for a level the contract cannot express yet.
 */
export function toUserLevel(level: LevelKey): UserLevel {
  if (level.agency !== 'FFESSM' || !isUserLevel(level.code)) {
    throw new UnsupportedContractValueError();
  }
  return level.code;
}

/** `federation` of the front contract = the agency when FFESSM or CMAS, otherwise `OTHER`. */
export function toFederation(level: Pick<CertificationLevel, 'agency'>): Federation {
  return level.agency === 'FFESSM' || level.agency === 'CMAS' ? level.agency : 'OTHER';
}

function isUserLevel(code: string): code is UserLevel {
  return USER_LEVELS.has(code);
}
