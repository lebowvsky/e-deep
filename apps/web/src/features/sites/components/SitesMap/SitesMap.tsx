import { useRef, useState } from 'react';
import { cx } from '@/shared/lib/classNames';
import type { SiteEntry, SiteZone } from '@/shared/model/site';
import { Button } from '@/shared/ui/Button';
import {
  MapView,
  type MapPick,
  type MapSite,
  type MapViewHandle,
  type MapViewport,
} from '@/shared/ui/MapView';
import { useToast } from '@/shared/ui/Toast';
import { formatPosition } from '../../lib/coordinates';
import { zoneCounts } from '../../lib/siteList';
import { MapControls } from '../MapControls';
import { SitePreviewPopover } from '../SitePreviewPopover';
import { ZoneChips } from '../ZoneChips';
import styles from './SitesMap.module.scss';

export interface SitesMapProps {
  entries: readonly SiteEntry[];
  selectedId: string | null;
  highlightedId: string | null;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  viewport: MapViewport;
  zone: SiteZone | null;
  onZoneChange: (zone: SiteZone | null) => void;
  /** Placing a site (panel open): the zone chips and the preview leave room for the marker. */
  pick: MapPick | null;
  /** Narrow screen: the preview goes above the marker. */
  isNarrow: boolean;
}

const LOCATE_FAILED = 'Ta position n’est pas disponible.';

/**
 * The map card of « Mes sites » (sites.jsx · MapSitesDesktop): the map, the zone chips, the
 * controls, the preview of the selected site and, while placing, the position of the marker.
 * If the map cannot start, it says so: the list beside it keeps working.
 */
export function SitesMap({
  entries,
  selectedId,
  highlightedId,
  onSelect,
  onDeselect,
  viewport,
  zone,
  onZoneChange,
  pick,
  isNarrow,
}: SitesMapProps) {
  const mapRef = useRef<MapViewHandle>(null);
  const { notify } = useToast();
  const [showsLabels, setShowsLabels] = useState(true);
  const [failure, setFailure] = useState(false);
  // A new attempt mounts a new map.
  const [attempt, setAttempt] = useState(0);

  const sites: MapSite[] = entries.flatMap(({ site, stats }) =>
    site.position
      ? [{ id: site.id, name: site.name, position: site.position, diveCount: stats.diveCount }]
      : [],
  );
  const selected = entries.find(({ site }) => site.id === selectedId);

  const locate = () => {
    if (!('geolocation' in navigator)) {
      notify(LOCATE_FAILED);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        mapRef.current?.flyTo({ latitude: coords.latitude, longitude: coords.longitude }),
      () => notify(LOCATE_FAILED),
    );
  };

  return (
    <div className={cx(styles.card, pick && styles.picking)}>
      {failure ? (
        <div className={styles.failure} role="alert">
          <p className={styles.failureText}>La carte n’a pas pu se charger.</p>
          <p className={styles.failureHint}>Tes sites restent accessibles dans la liste.</p>
          <Button
            onClick={() => {
              setFailure(false);
              setAttempt((current) => current + 1);
            }}
          >
            Réessayer
          </Button>
        </div>
      ) : (
        <MapView
          key={attempt}
          ref={mapRef}
          label="Carte de tes sites de plongée"
          sites={sites}
          selectedId={selectedId}
          highlightedId={highlightedId}
          onSelect={onSelect}
          viewport={viewport}
          pick={pick}
          basemap={showsLabels ? 'labels' : 'plain'}
          popoverPlacement={isNarrow ? 'above' : 'left'}
          popover={
            selected && !pick ? <SitePreviewPopover entry={selected} onClose={onDeselect} /> : null
          }
          onError={() => setFailure(true)}
        />
      )}
      {!pick && (
        <div className={styles.zones}>
          <ZoneChips
            zones={zoneCounts(entries)}
            total={entries.length}
            value={zone}
            onChange={onZoneChange}
          />
        </div>
      )}
      {!failure && (
        <div className={styles.controls}>
          <MapControls
            onZoomIn={() => mapRef.current?.zoomIn()}
            onZoomOut={() => mapRef.current?.zoomOut()}
            onLocate={locate}
            showsLabels={showsLabels}
            onToggleLabels={() => setShowsLabels((current) => !current)}
          />
        </div>
      )}
      {pick && (
        <p className={styles.pickHint} role="status">
          {pick.position ? (
            <>
              {formatPosition(pick.position)} · <span className={styles.placed}>repère posé</span>
            </>
          ) : pick.mode === 'center' ? (
            'Déplace la carte sous le repère'
          ) : (
            'Clique sur la carte pour poser le repère'
          )}
        </p>
      )}
    </div>
  );
}
