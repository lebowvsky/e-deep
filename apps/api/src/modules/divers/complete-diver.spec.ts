import { CertificationLevel } from '../certification-levels/certification-level.entity';
import { assertCompleteDiver } from './complete-diver';
import { Diver } from './diver.entity';

const LEVEL = Object.assign(new CertificationLevel(), {
  id: 'level-n2',
  agency: 'FFESSM',
  code: 'N2',
});

function diver(values: Partial<Diver> = {}): Diver {
  return Object.assign(new Diver(), {
    id: '0190a0b4-0000-7000-8000-000000000001',
    firstName: 'Marine',
    lastName: 'Rousseau',
    certificationLevelId: LEVEL.id,
    avatarUrl: null,
    ...values,
  });
}

describe('assertCompleteDiver', () => {
  it('accepts a diver with a level, loaded or not', () => {
    expect(() => assertCompleteDiver(diver())).not.toThrow();
    expect(() => assertCompleteDiver(diver({ certificationLevel: LEVEL }))).not.toThrow();
  });

  it('accepts a diver without last name (optional, D36)', () => {
    const complete = diver({ lastName: null });
    assertCompleteDiver(complete);
    expect(complete.certificationLevelId).toBe(LEVEL.id);
  });

  it('throws a plain invariant error, without id nor name, when the level is missing', () => {
    expect(() =>
      assertCompleteDiver(diver({ certificationLevelId: null, certificationLevel: null })),
    ).toThrow(new Error('Incomplete diver profile: no certification level'));
  });

  it('throws when the loaded level relation is null', () => {
    expect(() => assertCompleteDiver(diver({ certificationLevel: null }))).toThrow(Error);
  });
});
