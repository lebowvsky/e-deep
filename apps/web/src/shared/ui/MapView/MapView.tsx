import type { GeoJSONSource, Map as MapLibreMap, Marker } from 'maplibre-gl';
import {
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react';
import { createPortal } from 'react-dom';
import { layout, space } from '@/design/tokens';
import { cx } from '@/shared/lib/classNames';
import { prefersReducedMotion } from '@/shared/lib/focus';
import { isNumber, isRecord } from '@/shared/lib/guards';
import type { GeoPoint } from '@/shared/model/geo';
import { BASEMAP_STYLES, tintStyle, type MapBasemap } from './mapStyle';
import {
  arrowStep,
  clusterLabel,
  clusterSize,
  createMarkerButton,
  markerSize,
  siteMarkerLabel,
} from './markers';
import styles from './MapView.module.scss';

/** A placed site, as the map draws it. */
export interface MapSite {
  id: string;
  name: string;
  position: GeoPoint;
  diveCount: number;
}

/** Where to look: the camera frames `points` each time `key` changes. */
export interface MapViewport {
  key: string;
  points: readonly GeoPoint[];
  /** Share of the map height covered at the bottom (a bottom sheet): framed above it. */
  bottomCover?: number;
}

/**
 * Placing a site. `click` (default): a click puts the marker, which can be dragged or moved with
 * the arrows. `center` (phones): the marker stays in the middle, the map moves under it (finger,
 * or arrows on the focused map).
 */
export interface MapPick {
  position: GeoPoint | null;
  onPick: (position: GeoPoint) => void;
  mode?: 'click' | 'center';
}

export interface MapViewHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  flyTo: (position: GeoPoint) => void;
}

export interface MapViewProps {
  ref?: Ref<MapViewHandle>;
  /** Accessible name of the map (« Carte de tes sites de plongée »). */
  label: string;
  sites: readonly MapSite[];
  selectedId: string | null;
  /** Hovered in the list: its marker stands out. */
  highlightedId?: string | null;
  onSelect: (id: string) => void;
  viewport: MapViewport;
  /** Placing mode (cross cursor); `null` to browse. The sites stay visible, not clickable. */
  pick?: MapPick | null;
  basemap?: MapBasemap;
  /** Shown beside the selected marker (preview of the site). */
  popover?: ReactNode;
  /** `left` of the marker (default, as in the mockup) or `above` it (narrow screens). */
  popoverPlacement?: 'left' | 'above';
  /** The map could not start (WebGL, style or network): the page says so and keeps the list. */
  onError?: () => void;
  className?: string | undefined;
}

const MARKER_CLASSES = { marker: styles.marker ?? '', cluster: styles.cluster ?? '' };

const SOURCE = 'sites';
/** Zoom when the camera goes to a single site. */
const SITE_ZOOM = 12;
/** Beyond, every site has its own marker. */
const CLUSTER_MAX_ZOOM = 11;
/** France and Corsica, before the sites are known. */
const START = { center: [3.5, 46] as [number, number], zoom: 4.5 };

type MapLibre = typeof import('maplibre-gl');

/** The GeoJSON of our source (MapLibre's own GeoJSON types are not resolvable from here). */
interface SitesFeatureCollection {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: { id: string; name: string; count: number };
  }[];
}

function toFeatures(sites: readonly MapSite[]): SitesFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: sites.map((site) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [site.position.longitude, site.position.latitude] },
      properties: { id: site.id, name: site.name, count: site.diveCount },
    })),
  };
}

const toLngLat = ({ latitude, longitude }: GeoPoint): [number, number] => [longitude, latitude];

/** `[lng, lat]` of a point geometry read back from the source. */
function pointOf(geometry: unknown): [number, number] | null {
  if (!isRecord(geometry) || geometry.type !== 'Point' || !Array.isArray(geometry.coordinates)) {
    return null;
  }
  const coordinates: unknown[] = geometry.coordinates;
  const [lng, lat] = coordinates;
  return isNumber(lng) && isNumber(lat) ? [lng, lat] : null;
}

function pickLabel(position: GeoPoint | null): string {
  const where = position
    ? `latitude ${position.latitude.toFixed(4)}, longitude ${position.longitude.toFixed(4)}`
    : 'pas encore posé';
  return `Repère du site, ${where}. Flèches pour le déplacer, Maj pour aller plus vite.`;
}

interface MarkerEntry {
  marker: Marker;
  element: HTMLButtonElement;
}

/**
 * The map of the sites (MapLibre GL, the only module that loads it, on demand): CARTO Dark Matter
 * in the tokens' colours, HTML markers sized by the dives, clusters when zoomed out, a preview
 * beside the selected site, and a placing mode. MapLibre needs WebGL: tests replace this module.
 */
export function MapView({
  ref,
  label,
  sites,
  selectedId,
  highlightedId = null,
  onSelect,
  viewport,
  pick = null,
  basemap = 'labels',
  popover,
  popoverPlacement = 'left',
  onError,
  className,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const libRef = useRef<MapLibre | null>(null);
  const markersRef = useRef(new Map<string, MarkerEntry>());
  /** Style URL the map shows, so that a basemap switch only reloads what changed. */
  const styleRef = useRef<string | null>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [popoverHost, setPopoverHost] = useState<HTMLDivElement | null>(null);
  const isPicking = pick !== null;
  const isCenterPick = pick?.mode === 'center';
  const isClickPick = isPicking && !isCenterPick;
  const pickPosition = pick?.position ?? null;
  const pickLat = pickPosition?.latitude ?? null;
  const pickLng = pickPosition?.longitude ?? null;
  const selected = sites.find((site) => site.id === selectedId) ?? null;

  const select = useEffectEvent((id: string) => onSelect(id));
  const reportError = useEffectEvent(() => onError?.());
  const place = useEffectEvent((position: GeoPoint) => pick?.onPick(position));

  const zoomInto = useEffectEvent(async (clusterId: number, center: [number, number]) => {
    const source = map?.getSource<GeoJSONSource>(SOURCE);
    if (!map || !source) return;
    const zoom = await source.getClusterExpansionZoom(clusterId);
    map.easeTo({ center, zoom, animate: !prefersReducedMotion() });
  });

  /** Markers of the sites and clusters in view, from the clustered source. */
  const syncMarkers = useEffectEvent(() => {
    const lib = libRef.current;
    if (!map || !lib || !map.getSource(SOURCE)) return;
    const seen = new Set<string>();
    for (const feature of map.querySourceFeatures(SOURCE)) {
      const geometry: unknown = feature.geometry;
      const point = pointOf(geometry);
      if (!point) continue;
      const [lng, lat] = point;
      const props = feature.properties;
      const isCluster = props.cluster === true;
      const key = isCluster ? `cluster-${String(props.cluster_id)}` : `site-${String(props.id)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      let entry = markersRef.current.get(key);
      if (!entry) {
        const count = Number(isCluster ? props.point_count : props.count);
        const element = isCluster
          ? createMarkerButton(MARKER_CLASSES, 'cluster', {
              label: clusterLabel(count),
              text: String(count),
              size: clusterSize(count),
            })
          : createMarkerButton(MARKER_CLASSES, 'site', {
              label: siteMarkerLabel(String(props.name), count),
              text: String(count),
              size: markerSize(count),
            });
        const clusterId = Number(props.cluster_id);
        const siteId = String(props.id);
        element.addEventListener('click', (event) => {
          event.stopPropagation();
          if (isCluster) void zoomInto(clusterId, [lng, lat]);
          else select(siteId);
        });
        entry = { element, marker: new lib.Marker({ element }).setLngLat([lng, lat]).addTo(map) };
        markersRef.current.set(key, entry);
      }
      if (!isCluster) {
        const id = String(props.id);
        entry.element.toggleAttribute('data-selected', id === selectedId);
        entry.element.toggleAttribute('data-highlighted', id === highlightedId);
        entry.element.setAttribute('aria-pressed', String(id === selectedId));
      }
      entry.element.tabIndex = isPicking ? -1 : 0;
    }
    for (const [key, entry] of markersRef.current) {
      if (seen.has(key)) continue;
      entry.marker.remove();
      markersRef.current.delete(key);
    }
  });

  /** Our source and its invisible layer (MapLibre only clusters a source that a layer uses). */
  const installSites = useEffectEvent((instance: MapLibreMap) => {
    if (instance.getSource(SOURCE)) return;
    instance.addSource(SOURCE, {
      type: 'geojson',
      data: toFeatures(sites),
      cluster: true,
      clusterRadius: layout.siteMarkerMax,
      clusterMaxZoom: CLUSTER_MAX_ZOOM,
    });
    instance.addLayer({
      id: `${SOURCE}-anchor`,
      type: 'circle',
      source: SOURCE,
      paint: { 'circle-opacity': 0, 'circle-radius': 1 },
    });
  });

  /** What the map starts with; later changes go through their own effects. */
  const startOptions = useEffectEvent(() => ({ style: BASEMAP_STYLES[basemap], label }));

  const frame = useEffectEvent(() => {
    const lib = libRef.current;
    const [first, ...others] = viewport.points;
    if (!map || !lib || !first) return;
    const animate = !prefersReducedMotion();
    const covered = (viewport.bottomCover ?? 0) * map.getContainer().clientHeight;
    const padding = {
      top: space[10],
      right: space[10],
      bottom: space[10] + covered,
      left: space[10],
    };
    if (others.length === 0) {
      map.flyTo({
        center: toLngLat(first),
        zoom: Math.max(map.getZoom(), SITE_ZOOM),
        padding: { top: 0, right: 0, bottom: covered, left: 0 },
        animate,
      });
      return;
    }
    const bounds = new lib.LngLatBounds(toLngLat(first), toLngLat(first));
    for (const point of others) bounds.extend(toLngLat(point));
    map.fitBounds(bounds, { padding, maxZoom: CLUSTER_MAX_ZOOM, animate });
  });

  // The map itself: MapLibre and its stylesheet are loaded with the first map shown.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let isCurrent = true;
    let instance: MapLibreMap | null = null;
    const markers = markersRef.current;
    const host = document.createElement('div');
    setPopoverHost(host);

    void (async () => {
      try {
        const [lib, worker] = await Promise.all([
          import('maplibre-gl'),
          // The worker as its own file: the bundler cannot inline it (MapLibre 5+, ESM).
          import('maplibre-gl/dist/maplibre-gl-worker.mjs?url'),
          import('maplibre-gl/dist/maplibre-gl.css'),
        ]);
        if (!isCurrent) return;
        lib.setWorkerUrl(worker.default);
        libRef.current = lib;
        let isLoaded = false;
        const start = startOptions();
        styleRef.current = start.style;
        instance = new lib.Map({
          container,
          style: start.style,
          transformStyle: tintStyle,
          attributionControl: { compact: true },
          center: START.center,
          zoom: START.zoom,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
        });
        instance.getCanvas().setAttribute('aria-label', start.label);
        instance.addControl(new lib.ScaleControl({ unit: 'metric', maxWidth: layout.scaleBar }));
        const loaded = instance;
        loaded.on('style.load', () => installSites(loaded));
        loaded.on('load', () => {
          isLoaded = true;
          setMap(loaded);
        });
        // Before the first load: the style, its sprites or WebGL failed. Later tile errors pass.
        loaded.on('error', () => {
          if (!isLoaded) reportError();
        });
      } catch {
        if (isCurrent) reportError();
      }
    })();

    return () => {
      isCurrent = false;
      for (const entry of markers.values()) entry.marker.remove();
      markers.clear();
      instance?.remove();
      setMap(null);
      setPopoverHost(null);
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => map?.zoomIn({ animate: !prefersReducedMotion() }),
      zoomOut: () => map?.zoomOut({ animate: !prefersReducedMotion() }),
      flyTo: (position) =>
        map?.flyTo({
          center: toLngLat(position),
          zoom: SITE_ZOOM,
          animate: !prefersReducedMotion(),
        }),
    }),
    [map],
  );

  // Basemap switch: the new style drops our source, put back on `style.load`.
  useEffect(() => {
    const style = BASEMAP_STYLES[basemap];
    if (!map || styleRef.current === style) return;
    styleRef.current = style;
    map.setStyle(style, { transformStyle: tintStyle });
  }, [map, basemap]);

  useEffect(() => {
    map?.getCanvas().setAttribute('aria-label', label);
  }, [map, label]);

  // Data: the clustered source; the markers follow what is rendered, frame after frame (the
  // tiles of the source change with the zoom, and with them the clusters).
  useEffect(() => {
    if (!map) return;
    // Settles when the worker has indexed it; the `render` events below follow.
    void map.getSource<GeoJSONSource>(SOURCE)?.setData(toFeatures(sites));
    const onRender = () => {
      if (map.getSource(SOURCE) && map.isSourceLoaded(SOURCE)) syncMarkers();
    };
    map.on('render', onRender);
    return () => {
      map.off('render', onRender);
    };
  }, [map, sites]);

  // Selection, hover and mode change the look of the markers, not the data.
  useEffect(() => {
    syncMarkers();
  }, [map, selectedId, highlightedId, isPicking]);

  useEffect(() => {
    frame();
  }, [map, viewport.key]);

  // Placing: cross cursor and a click puts the marker.
  useEffect(() => {
    if (!map || !isClickPick) return;
    const onClick = (event: { lngLat: { lat: number; lng: number } }) =>
      place({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  }, [map, isClickPick]);

  // Placing under a fixed marker: the centre is the position once the diver has moved the map.
  useEffect(() => {
    if (!map || !isCenterPick) return;
    const onMoveEnd = (event: { originalEvent?: unknown }) => {
      // Programmatic moves (typed coordinates, framing) have no original event.
      if (event.originalEvent === undefined) return;
      const { lat, lng } = map.getCenter();
      place({ latitude: lat, longitude: lng });
    };
    map.on('moveend', onMoveEnd);
    return () => {
      map.off('moveend', onMoveEnd);
    };
  }, [map, isCenterPick]);

  // Typed coordinates bring the map under the fixed marker.
  useEffect(() => {
    if (!map || !isCenterPick || pickLat === null || pickLng === null) return;
    const center = map.getCenter();
    if (Math.abs(center.lat - pickLat) > 1e-6 || Math.abs(center.lng - pickLng) > 1e-6) {
      map.jumpTo({ center: [pickLng, pickLat] });
    }
  }, [map, isCenterPick, pickLat, pickLng]);

  // The marker being placed: dragged with the pointer, moved with the arrows when focused.
  useEffect(() => {
    const lib = libRef.current;
    if (!map || !lib || !isClickPick || pickPosition === null) return;
    const element = document.createElement('button');
    element.type = 'button';
    element.className = styles.pickMarker ?? '';
    element.setAttribute('aria-label', pickLabel(pickPosition));
    const marker = new lib.Marker({ element, draggable: true })
      .setLngLat(toLngLat(pickPosition))
      .addTo(map);
    marker.on('dragend', () => {
      const { lat, lng } = marker.getLngLat();
      place({ latitude: lat, longitude: lng });
    });
    element.addEventListener('keydown', (event) => {
      const move = arrowStep(event.key, event.shiftKey);
      if (!move) return;
      event.preventDefault();
      const point = map.project(marker.getLngLat());
      const moved = map.unproject([point.x + move[0], point.y + move[1]]);
      place({ latitude: moved.lat, longitude: moved.lng });
    });
    const hadFocus = document.activeElement?.getAttribute('data-pick-marker') === 'true';
    element.setAttribute('data-pick-marker', 'true');
    // Moved with the keyboard: the new marker keeps the focus of the old one.
    if (hadFocus) element.focus();
    return () => {
      marker.remove();
    };
  }, [map, isClickPick, pickPosition]);

  // The preview, beside the selected marker (on its left as in the mockup, or above it).
  const selectedLng = selected?.position.longitude ?? null;
  const selectedLat = selected?.position.latitude ?? null;
  const selectedSize = selected ? markerSize(selected.diveCount) : 0;
  const hasPopover = popover !== undefined && popover !== null;
  useEffect(() => {
    const lib = libRef.current;
    if (!map || !lib || !popoverHost || !hasPopover || isPicking) return;
    if (selectedLng === null || selectedLat === null) return;
    const gap = selectedSize / 2 + space[3];
    const marker = new lib.Marker({
      element: popoverHost,
      ...(popoverPlacement === 'left'
        ? { anchor: 'right', offset: [-gap, 0] }
        : { anchor: 'bottom', offset: [0, -gap] }),
    })
      .setLngLat([selectedLng, selectedLat])
      .addTo(map);
    return () => {
      marker.remove();
    };
  }, [
    map,
    popoverHost,
    hasPopover,
    selectedLng,
    selectedLat,
    selectedSize,
    isPicking,
    popoverPlacement,
  ]);

  return (
    <div className={cx(styles.root, isPicking && styles.picking, className)}>
      <div ref={containerRef} className={styles.map} />
      {isCenterPick && (
        <span className={cx(styles.pickMarker, styles.centered)} aria-hidden="true" />
      )}
      {popoverHost && hasPopover && createPortal(popover, popoverHost)}
    </div>
  );
}
