import { describe, expect, it } from 'vitest';
import { color } from '@/design/tokens';
import { tintStyle, type MapStyle } from './mapStyle';

const style: MapStyle = {
  version: 8,
  sources: {},
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#000' } },
    { id: 'water', type: 'fill', source: 'carto', 'source-layer': 'water', paint: {} },
    { id: 'landcover', type: 'fill', source: 'carto', 'source-layer': 'landcover' },
    { id: 'boundary', type: 'line', source: 'carto', 'source-layer': 'boundary' },
    { id: 'place_city', type: 'symbol', source: 'carto', 'source-layer': 'place' },
  ],
};

describe('tintStyle', () => {
  it('paints water, land, lines and labels with the tokens', () => {
    const [background, water, land, line, label] = tintStyle(undefined, style).layers;
    expect(background).toMatchObject({ paint: { 'background-color': color.surface1 } });
    expect(water).toMatchObject({ paint: { 'fill-color': color.surface0 } });
    expect(land).toMatchObject({ paint: { 'fill-color': color.surface1 } });
    expect(line).toMatchObject({ paint: { 'line-color': color.coastDim } });
    expect(label).toMatchObject({ paint: { 'text-color': color.textLow } });
  });
});
