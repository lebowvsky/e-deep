import { describe, expect, it } from 'vitest';
import { decompressionLabel, gasMixSpoken, oxygenLabel, stopsLabel } from './labels';

describe('gas labels', () => {
  it('gives the oxygen fraction of the known mixes only', () => {
    expect(oxygenLabel('AIR')).toBe('21 % O₂');
    expect(oxygenLabel('NITROX32')).toBe('32 % O₂');
    expect(oxygenLabel('NITROX36')).toBe('36 % O₂');
    expect(oxygenLabel('OTHER')).toBeNull();
  });

  it('spells the mix out', () => {
    expect(gasMixSpoken('NITROX32')).toBe('Nitrox 32');
  });
});

describe('stop labels', () => {
  it('words the stops and the decompression', () => {
    expect(stopsLabel(true)).toBe('Respectés');
    expect(stopsLabel(false)).toBe('À vérifier');
    expect(decompressionLabel(true)).toBe('Oui');
    expect(decompressionLabel(false)).toBe('Non');
  });
});
