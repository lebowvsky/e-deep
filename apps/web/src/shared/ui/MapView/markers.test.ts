import { describe, expect, it } from 'vitest';
import { layout } from '@/design/tokens';
import {
  arrowStep,
  clusterLabel,
  createMarkerButton,
  markerSize,
  siteMarkerLabel,
} from './markers';

describe('map markers', () => {
  it('grow with the dives, capped', () => {
    expect(markerSize(0)).toBe(layout.siteMarkerMin);
    expect(markerSize(5)).toBeCloseTo(layout.siteMarkerMin + 5 * layout.siteMarkerStep);
    expect(markerSize(500)).toBe(layout.siteMarkerMax);
  });

  it('are buttons named after the site, or the cluster', () => {
    const button = createMarkerButton({ marker: 'm', cluster: 'c' }, 'site', {
      label: siteMarkerLabel('Pointe de la Revellata', 8),
      text: '8',
      size: 30,
    });
    expect(button.type).toBe('button');
    expect(button.getAttribute('aria-label')).toBe('Pointe de la Revellata, 8 plongées');
    expect(button.textContent).toBe('8');
    expect(button.style.getPropertyValue('--marker-size')).toBe('30px');
    expect(clusterLabel(5)).toBe('5 sites ici. Zoomer pour les voir');
  });
});

describe('placing marker with the keyboard', () => {
  it('moves 1 px with an arrow, 10 px with Maj', () => {
    expect(arrowStep('ArrowUp', false)).toEqual([0, -1]);
    expect(arrowStep('ArrowRight', false)).toEqual([1, 0]);
    expect(arrowStep('ArrowDown', true)).toEqual([0, 10]);
    expect(arrowStep('ArrowLeft', true)).toEqual([-10, 0]);
    expect(arrowStep('Enter', false)).toBeNull();
  });
});
