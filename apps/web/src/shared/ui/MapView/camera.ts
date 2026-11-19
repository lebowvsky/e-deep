// Where the camera looks for a viewport: plain numbers, computed without MapLibre (testable).
import { space } from '@/design/tokens';
import type { GeoPoint } from '@/shared/model/geo';

/** Where to look: the camera frames `points` each time `key` changes. */
export interface MapViewport {
  key: string;
  points: readonly GeoPoint[];
  /** Share of the map height covered at the top (a header over the map): framed below it. */
  topCover?: number;
  /** Share of the map height covered at the bottom (a bottom sheet): framed above it. */
  bottomCover?: number;
}

export interface CameraPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

type LngLat = [number, number];

/** One point: centred on it. Several: their bounding box, `[south-west, north-east]`. */
export type Camera =
  | { kind: 'point'; center: LngLat; padding: CameraPadding }
  | { kind: 'bounds'; bounds: [LngLat, LngLat]; padding: CameraPadding };

/** The camera of `viewport` on a map `height` px high; `null` without points. */
export function cameraFor(viewport: MapViewport, height: number): Camera | null {
  const [first, ...others] = viewport.points;
  if (!first) return null;
  const top = (viewport.topCover ?? 0) * height;
  const bottom = (viewport.bottomCover ?? 0) * height;
  if (others.length === 0) {
    return {
      kind: 'point',
      center: [first.longitude, first.latitude],
      padding: { top, right: 0, bottom, left: 0 },
    };
  }
  const longitudes = viewport.points.map((point) => point.longitude);
  const latitudes = viewport.points.map((point) => point.latitude);
  return {
    kind: 'bounds',
    bounds: [
      [Math.min(...longitudes), Math.min(...latitudes)],
      [Math.max(...longitudes), Math.max(...latitudes)],
    ],
    padding: {
      top: space[10] + top,
      right: space[10],
      bottom: space[10] + bottom,
      left: space[10],
    },
  };
}
