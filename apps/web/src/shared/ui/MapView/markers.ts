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

export interface MarkerContent {
  label: string;
  text: string;
  size: number;
}

/** A round button for a site or a cluster; its content comes from `applyMarkerContent`. */
export function createMarkerButton(
  classes: MarkerClasses,
  kind: 'site' | 'cluster',
  content: MarkerContent,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = kind === 'site' ? classes.marker : `${classes.marker} ${classes.cluster}`;
  applyMarkerContent(button, content);
  return button;
}

/**
 * Name, count and size (`--marker-size`) of a marker, written only when they changed: the markers
 * are synchronised on every rendered frame, and a site can be renamed, merged (more dives) or a
 * cluster id reused for other sites after new data.
 */
export function applyMarkerContent(
  button: HTMLButtonElement,
  { label, text, size }: MarkerContent,
) {
  if (button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label);
  if (button.textContent !== text) button.textContent = text;
  const sizePx = `${size}px`;
  if (button.style.getPropertyValue('--marker-size') !== sizePx) {
    button.style.setProperty('--marker-size', sizePx);
  }
}

/** Keyboard moves of the marker being placed (spec: 1 px, Maj 10 px). */
const STEP_PX = 1;
const FAST_STEP_PX = 10;
const ARROWS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

/** The screen move (px) of an arrow key, Maj for 10 px; `null` for any other key. */
export function arrowStep(key: string, isFast: boolean): [number, number] | null {
  const direction = ARROWS[key];
  if (!direction) return null;
  const step = isFast ? FAST_STEP_PX : STEP_PX;
  return [direction[0] * step, direction[1] * step];
}
