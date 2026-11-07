import { describe, expect, it } from 'vitest';
import { projectToMap } from './mapProjection';

const bounds = { west: 0, east: 10, north: 50, south: 40 };

describe('projectToMap', () => {
  it('maps the box corners and centre', () => {
    expect(projectToMap(50, 0, bounds)).toEqual({ x: 0, y: 0 });
    expect(projectToMap(40, 10, bounds)).toEqual({ x: 1, y: 1 });
    expect(projectToMap(45, 5, bounds)).toEqual({ x: 0.5, y: 0.5 });
  });

  it('clamps points outside the box', () => {
    expect(projectToMap(60, -5, bounds)).toEqual({ x: 0, y: 0 });
  });
});
