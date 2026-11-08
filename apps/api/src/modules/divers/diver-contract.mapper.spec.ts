import { UnsupportedContractValueError } from '../../common/errors/domain-errors';
import { toFederation, toUserLevel } from './diver-contract.mapper';

describe('toUserLevel', () => {
  it.each(['N1', 'N2', 'N3', 'N4'])('maps the FFESSM level %s to its code', (code) => {
    expect(toUserLevel({ agency: 'FFESSM', code })).toBe(code);
  });

  it('refuses a level the contract cannot express', () => {
    expect(() => toUserLevel({ agency: 'CMAS', code: '2*' })).toThrow(
      UnsupportedContractValueError,
    );
    expect(() => toUserLevel({ agency: 'FFESSM', code: 'MF1' })).toThrow(
      UnsupportedContractValueError,
    );
    // Same code from another agency: not an FFESSM level.
    expect(() => toUserLevel({ agency: 'OTHER', code: 'N2' })).toThrow(
      UnsupportedContractValueError,
    );
  });
});

describe('toFederation', () => {
  it('keeps FFESSM and CMAS', () => {
    expect(toFederation({ agency: 'FFESSM' })).toBe('FFESSM');
    expect(toFederation({ agency: 'CMAS' })).toBe('CMAS');
  });

  it('maps any other agency to OTHER', () => {
    expect(toFederation({ agency: 'PADI' })).toBe('OTHER');
    expect(toFederation({ agency: 'SSI' })).toBe('OTHER');
  });
});
