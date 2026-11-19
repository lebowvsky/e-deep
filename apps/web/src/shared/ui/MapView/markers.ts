// HTML markers of the map: plain DOM (MapLibre positions them), built here so that they stay
// focusable buttons with a name, and testable without WebGL.
import { layout } from '@/design/tokens';
import { formatDiveCount } from '@/shared/lib/format';

/** Diameter (px) of a site marker: grows with the dives, capped (sites.jsx · Marker). */
export function markerSize(diveCount: number): number {
  return Math.min(layout.siteMarkerMin + layout.siteMarkerStep * diveCount, layout.siteMarkerMax);
}

/** Diameter of a cluster bubble: grows with the sites it holds, capped. */
export function clusterSize(siteCount: number): number {
  return Math.min(
    layout.siteMarkerMin + layout.siteMarkerStep * 2 * siteCount,
    layout.siteMarkerMax,
  );
}

/** « Pointe de la Revellata, 8 plongées » */
export function siteMarkerLabel(name: string, diveCount: number): string {
  return `${name}, ${formatDiveCount(diveCount)}`;
}

/** « 5 sites ici. Zoomer pour les voir » */
export function clusterLabel(siteCount: number): string {
  return `${siteCount} sites ici. Zoomer pour les voir`;
}

export interface MarkerClasses {
  marker: string;
  cluster: string;
}

/** A round button with the count in it; its size in `--marker-size`. */
export function createMarkerButton(
  classes: MarkerClasses,
  kind: 'site' | 'cluster',
  { label, text, size }: { label: string; text: string; size: number },
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = kind === 'site' ? classes.marker : `${classes.marker} ${classes.cluster}`;
  button.setAttribute('aria-label', label);
  button.textContent = text;
  button.style.setProperty('--marker-size', `${size}px`);
  return button;
}
