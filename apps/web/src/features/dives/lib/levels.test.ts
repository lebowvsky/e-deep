import { describe, expect, it } from 'vitest';
import { toCertificationLevelRef } from './levels';

describe('toCertificationLevelRef', () => {
  it('labels a known code, and keeps an unknown one as its own label', () => {
    expect(toCertificationLevelRef('PA40', 'FFESSM')).toEqual({
      agency: 'FFESSM',
      code: 'PA40',
      label: 'Plongeur autonome 40 m',
    });
    expect(toCertificationLevelRef('AOWD', 'PADI')).toEqual({
      agency: 'PADI',
      code: 'AOWD',
      label: 'AOWD',
    });
  });
});
