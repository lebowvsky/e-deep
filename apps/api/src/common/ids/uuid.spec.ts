import { canonicalUuids, isSameUuid, normalizeUuid } from './uuid';

const ID = '01900000-0000-7000-8000-0000000000ab';

describe('normalizeUuid', () => {
  it('spells a UUID in lowercase, the form PostgreSQL returns', () => {
    expect(normalizeUuid(ID.toUpperCase())).toBe(ID);
    expect(normalizeUuid(ID)).toBe(ID);
  });
});

describe('isSameUuid', () => {
  it('compares two UUIDs whatever their case', () => {
    expect(isSameUuid(ID, ID.toUpperCase())).toBe(true);
    expect(isSameUuid(ID, '01900000-0000-7000-8000-0000000000ac')).toBe(false);
  });
});

describe('canonicalUuids', () => {
  it('normalises, deduplicates and sorts the ids', () => {
    const second = '01900000-0000-7000-8000-0000000000b1';
    expect(canonicalUuids([second.toUpperCase(), ID, second, ID.toUpperCase()])).toEqual([
      ID,
      second,
    ]);
  });
});
