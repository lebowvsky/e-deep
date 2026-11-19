import { completeTargetDetails, type SiteDetails } from './site-merge';

const EMPTY: SiteDetails = {
  locality: null,
  region: null,
  area: null,
  type: null,
  accessNotes: null,
  latitude: null,
  longitude: null,
  depthMinM: null,
  depthMaxM: null,
};

const FULL: SiteDetails = {
  locality: 'Calvi',
  region: 'Corse',
  area: 'Méditerranée',
  type: 'grotte',
  accessNotes: 'Entrée à 12 m.',
  latitude: 42.58,
  longitude: 8.72,
  depthMinM: 5,
  depthMaxM: 20,
};

describe('completeTargetDetails (RG-35)', () => {
  it('fills every empty field of the target from the source', () => {
    expect(completeTargetDetails(EMPTY, FULL)).toStrictEqual(FULL);
  });

  it('keeps every field the target already has', () => {
    const target: SiteDetails = {
      ...FULL,
      locality: 'Lumio',
      type: 'tombant',
      latitude: 42.6,
      longitude: 8.8,
      depthMinM: 10,
      depthMaxM: 40,
    };
    expect(completeTargetDetails(target, { ...FULL, depthMinM: 1, depthMaxM: 2 })).toStrictEqual(
      target,
    );
  });

  it('keeps empty what neither has', () => {
    expect(completeTargetDetails(EMPTY, EMPTY)).toStrictEqual(EMPTY);
  });

  it('takes the position as a pair (D-23)', () => {
    expect(completeTargetDetails(EMPTY, FULL)).toMatchObject({ latitude: 42.58, longitude: 8.72 });
    expect(completeTargetDetails({ ...EMPTY, latitude: 43, longitude: 6 }, FULL)).toMatchObject({
      latitude: 43,
      longitude: 6,
    });
  });

  it('completes the depths one by one when they stay ordered', () => {
    expect(completeTargetDetails({ ...EMPTY, depthMinM: 3 }, FULL)).toMatchObject({
      depthMinM: 3,
      depthMaxM: 20,
    });
    expect(completeTargetDetails({ ...EMPTY, depthMaxM: 50 }, FULL)).toMatchObject({
      depthMinM: 5,
      depthMaxM: 50,
    });
  });

  it('keeps the depths of the target when completing them would break min ≤ max', () => {
    expect(completeTargetDetails({ ...EMPTY, depthMinM: 30 }, FULL)).toMatchObject({
      depthMinM: 30,
      depthMaxM: null,
    });
    expect(completeTargetDetails({ ...EMPTY, depthMaxM: 4 }, FULL)).toMatchObject({
      depthMinM: null,
      depthMaxM: 4,
    });
  });
});
