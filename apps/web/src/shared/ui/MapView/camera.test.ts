import { describe, expect, it } from 'vitest';
import { space } from '@/design/tokens';
import { cameraFor } from './camera';

const calvi = { latitude: 42.583, longitude: 8.725 };
const brest = { latitude: 48.28, longitude: -4.629 };
const marseille = { latitude: 43.199, longitude: 5.232 };

describe('cameraFor', () => {
  it('has nothing to frame without points', () => {
    expect(cameraFor({ key: 'none', points: [] }, 400)).toBeNull();
  });

  it('centres on a single point, below and above what covers the map', () => {
    expect(
      cameraFor({ key: 'calvi', points: [calvi], topCover: 0.25, bottomCover: 0.5 }, 400),
    ).toEqual({
      kind: 'point',
      center: [8.725, 42.583],
      padding: { top: 100, right: 0, bottom: 200, left: 0 },
    });
  });

  it('frames the bounding box of several points, with a margin', () => {
    expect(
      cameraFor({ key: 'all', points: [calvi, brest, marseille], topCover: 0.2 }, 400),
    ).toEqual({
      kind: 'bounds',
      bounds: [
        [-4.629, 42.583],
        [8.725, 48.28],
      ],
      padding: { top: space[10] + 80, right: space[10], bottom: space[10], left: space[10] },
    });
  });
});
