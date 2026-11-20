import type { ConsentPurpose } from '@e-deep/shared';
import { CONSENT_PURPOSES } from './consent-purposes';

// `Record<ConsentPurpose, …>` does not compile if a purpose of the shared union is missing here.
const EVERY_PURPOSE: Record<ConsentPurpose, true> = { health_data_processing: true };

describe('CONSENT_PURPOSES', () => {
  it('lists every ConsentPurpose of the shared contract', () => {
    expect([...CONSENT_PURPOSES].sort()).toEqual(Object.keys(EVERY_PURPOSE).sort());
  });
});
