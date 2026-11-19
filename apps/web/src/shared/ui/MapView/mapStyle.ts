// The CARTO Dark Matter basemap, recoloured with the tokens when it loads: water `surface0`, land
// `surface1`, lines `coast`, labels `textLow`. Types only from maplibre: this module stays light.
import type { TransformStyleFunction } from 'maplibre-gl';
import { color } from '@/design/tokens';

export type MapStyle = Parameters<TransformStyleFunction>[1];
type MapLayer = MapStyle['layers'][number];

/** `labels`: towns and places named (default) · `plain`: the coastline alone. */
export type MapBasemap = 'labels' | 'plain';

/** Vector styles, no API key. Attribution « © OpenStreetMap contributors © CARTO » comes with it. */
export const BASEMAP_STYLES: Record<MapBasemap, string> = {
  labels: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  plain: 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json',
};

const isWater = (id: string) => /water|ocean|sea|river|lake/i.test(id);

function tintLayer(layer: MapLayer): MapLayer {
  switch (layer.type) {
    case 'background':
      return { ...layer, paint: { ...layer.paint, 'background-color': color.surface1 } };
    case 'fill':
      return {
        ...layer,
        paint: {
          ...layer.paint,
          'fill-color': isWater(layer.id) ? color.surface0 : color.surface1,
          'fill-outline-color': isWater(layer.id) ? color.coast : color.surface1,
        },
      };
    case 'line':
      return {
        ...layer,
        paint: {
          ...layer.paint,
          'line-color': isWater(layer.id) ? color.surface0 : color.coastDim,
        },
      };
    case 'symbol':
      return {
        ...layer,
        paint: {
          ...layer.paint,
          'text-color': color.textLow,
          'text-halo-color': color.surface1,
          'icon-opacity': 0,
        },
      };
    default:
      return layer;
  }
}

/** Every layer of the basemap in the colours of the design system. */
export const tintStyle: TransformStyleFunction = (_previous, next) => ({
  ...next,
  layers: next.layers.map(tintLayer),
});
