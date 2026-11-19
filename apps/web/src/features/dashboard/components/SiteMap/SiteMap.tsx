import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { cx } from '@/shared/lib/classNames';
import { siteHrefOf } from '@/shared/sites/lib/siteHref';
import { MapView, type MapSite } from '@/shared/ui/MapView';
import { Overline } from '@/shared/ui/Overline';
import { TextLink } from '@/shared/ui/TextLink';
import type { DiveSite } from '../../types';
import styles from './SiteMap.module.scss';

const MAP_PERIODS = ['1M', '3M', '1A', 'Tout'] as const;
type MapPeriod = (typeof MAP_PERIODS)[number];

export interface SiteMapProps {
  sites: readonly DiveSite[];
  /** Total of visited sites (stats), which can exceed the plotted ones. */
  siteCount: number;
  /** `null` when no dived site has a region. */
  areaName: string | null;
  /** `null` when no dived site has a region: a generic title is shown. */
  mapTitle: string | null;
  /** Site highlighted on load (last dive). */
  initialActiveSiteId?: string | undefined;
}

const FALLBACK_TITLE = 'Mes sites';

/** Share of the map under its header (overline, title, periods): the sites are framed below. */
const HEADER_COVER = 0.2;

/** The sites the map can place: those whose position was entered. */
function toMapSites(sites: readonly DiveSite[]): MapSite[] {
  return sites.flatMap(({ id, name, position, diveCount }) =>
    position === null ? [] : [{ id, name, position, diveCount }],
  );
}

/**
 * Dive-site map (MapLibre, read only): the view frames every placed site, a marker selects its
 * site and the preview above it (tablet+) links to the site page. Period filters are visual only
 * in V1. A site whose position was not entered has no marker (it still counts in `siteCount`).
 */
export function SiteMap({
  sites,
  siteCount,
  areaName,
  mapTitle,
  initialActiveSiteId,
}: SiteMapProps) {
  // Same array while the sites are the same: no new GeoJSON for the map on every render.
  const mapSites = useMemo(() => toMapSites(sites), [sites]);
  const [activeId, setActiveId] = useState(initialActiveSiteId ?? mapSites[0]?.id ?? null);
  const [period, setPeriod] = useState<MapPeriod>('3M');
  const titleId = useId();
  const active = sites.find((site) => site.id === activeId && site.position !== null);

  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <div className={styles.phoneHead}>
        <h2 className={styles.phoneTitle}>Carte</h2>
        <TextLink to="/map">Tous les sites</TextLink>
      </div>

      <div className={styles.map}>
        <MapView
          label="Carte de tes sites de plongée"
          sites={mapSites}
          selectedId={activeId}
          onSelect={setActiveId}
          viewport={{
            key: mapSites.map((site) => site.id).join(),
            points: mapSites.map((site) => site.position),
            topCover: HEADER_COVER,
          }}
          readOnly
          popoverPlacement="above"
          popover={
            active && (
              <div className={styles.popover}>
                <span className={styles.popoverLabel}>Site</span>
                <Link to={siteHrefOf(active.id)} className={styles.popoverName}>
                  {active.name}
                </Link>
                <span className={styles.popoverStats}>
                  <span>
                    <span className={cx(styles.popoverValue, styles.accent)}>
                      {active.diveCount}
                    </span>
                    <span className={styles.popoverKey}>Plongées</span>
                  </span>
                  <span>
                    <span className={styles.popoverValue}>-{active.maxDepthM}m</span>
                    <span className={styles.popoverKey}>Prof. max</span>
                  </span>
                </span>
              </div>
            )
          }
        />

        <div className={styles.overlay}>
          <div className={styles.heading}>
            <Overline className={styles.desktopOnly}>Carte · {siteCount} sites</Overline>
            <Overline className={styles.phoneOnly}>
              {siteCount} sites{areaName !== null && ` · ${areaName}`}
            </Overline>
            <h2 id={titleId} className={styles.title}>
              {mapTitle ?? FALLBACK_TITLE}
            </h2>
          </div>
          <div className={styles.periods} role="group" aria-label="Période">
            {MAP_PERIODS.map((value) => (
              <button
                key={value}
                type="button"
                className={cx(styles.period, value === period && styles.periodActive)}
                aria-pressed={value === period}
                onClick={() => setPeriod(value)}
              >
                {value}
              </button>
            ))}
          </div>
          <Link to="/map" className={styles.expand}>
            Agrandir
          </Link>
        </div>
      </div>
    </section>
  );
}
