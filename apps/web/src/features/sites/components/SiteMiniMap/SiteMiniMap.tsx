import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import type { Site, SiteEntry } from '@/shared/model/site';
import { ButtonLink } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { MapView } from '@/shared/ui/MapView';
import { formatPosition } from '../../lib/coordinates';
import { mapHrefOf, placeHrefOf, siteHrefOf } from '../../lib/labels';
import { toMapSites } from '../../lib/siteList';
import styles from './SiteMiniMap.module.scss';

export interface SiteMiniMapProps {
  site: Site;
  /** The user's sites: the neighbours show around this one. */
  entries: readonly SiteEntry[];
}

/**
 * The site on the map (sites.jsx · SiteMiniMap): centred on it, with its neighbours (each leads to
 * its own page), its coordinates and « Ouvrir sur la carte ». Without position: « Position à
 * préciser » and « Placer sur la carte ».
 */
export function SiteMiniMap({ site, entries }: SiteMiniMapProps) {
  const navigate = useNavigate();
  // Same array while the sites are the same: no new GeoJSON for the map on every render.
  const sites = useMemo(() => toMapSites(entries), [entries]);
  const { position } = site;

  if (position === null) {
    return (
      <section className={styles.missing} aria-label="Position du site">
        <Icon name="crosshair" size="xl" className={styles.missingIcon} />
        <p className={styles.missingTitle}>Position à préciser</p>
        <p className={styles.missingText}>
          Place le site sur la carte pour le retrouver et suggérer sa région aux sites voisins.
        </p>
        <ButtonLink to={placeHrefOf(site.id)} icon="crosshair">
          Placer sur la carte
        </ButtonLink>
      </section>
    );
  }

  return (
    <section className={styles.map} aria-label="Position du site">
      <MapView
        label={`Carte autour de ${site.name}`}
        sites={sites}
        selectedId={site.id}
        onSelect={(id) => {
          if (id !== site.id) void navigate(siteHrefOf(id));
        }}
        viewport={{ key: site.id, points: [position] }}
      />
      <p className={styles.coordinates}>{formatPosition(position)}</p>
      <Link to={mapHrefOf(site.id)} className={styles.open}>
        Ouvrir sur la carte
      </Link>
    </section>
  );
}
