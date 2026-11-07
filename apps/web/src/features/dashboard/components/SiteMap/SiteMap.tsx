import { useId, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { cx } from '@/shared/lib/classNames';
import { Overline } from '@/shared/ui/Overline';
import { TextLink } from '@/shared/ui/TextLink';
import { projectToMap } from '../../lib/mapProjection';
import type { DiveSite } from '../../types';
import styles from './SiteMap.module.scss';

const MAP_PERIODS = ['1M', '3M', '1A', 'Tout'] as const;
type MapPeriod = (typeof MAP_PERIODS)[number];

export interface SiteMapProps {
  sites: readonly DiveSite[];
  /** Total of visited sites (stats), which can exceed the plotted ones. */
  siteCount: number;
  areaName: string;
  mapTitle: string;
  /** Site highlighted on load (last dive). */
  initialActiveSiteId?: string | undefined;
}

/** Sites with many dives get the larger marker (mockup: 6, 8 and 11 dives). */
const BIG_MARKER_MIN_DIVES = 6;

/** Marker / popover anchor, as CSS custom properties read by the stylesheet. */
const anchor = (site: DiveSite): CSSProperties => {
  const { x, y } = projectToMap(site.latitude, site.longitude);
  return { '--x': `${x * 100}%`, '--y': `${y * 100}%` } as CSSProperties;
};

/** Near an edge the popover opens towards the centre so it stays inside the card. */
const popoverAlign = (site: DiveSite): 'start' | 'center' | 'end' => {
  const { x } = projectToMap(site.latitude, site.longitude);
  if (x < 0.2) return 'start';
  return x > 0.8 ? 'end' : 'center';
};

/**
 * Dive-site map — SVG placeholder (no MapLibre in V1). Markers are buttons that select a site;
 * the desktop popover shows the selected one. Period filters are visual only in V1.
 */
export function SiteMap({
  sites,
  siteCount,
  areaName,
  mapTitle,
  initialActiveSiteId,
}: SiteMapProps) {
  const [activeId, setActiveId] = useState(initialActiveSiteId ?? sites[0]?.id);
  const [period, setPeriod] = useState<MapPeriod>('3M');
  const titleId = useId();
  const active = sites.find((site) => site.id === activeId);

  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <div className={styles.phoneHead}>
        <h2 className={styles.phoneTitle}>Carte</h2>
        <TextLink to="/map">Tous les sites</TextLink>
      </div>

      <div className={styles.map}>
        <div className={styles.canvas} aria-hidden="true">
          <div className={styles.grid} />
          <svg
            className={styles.coasts}
            viewBox="0 0 1000 440"
            preserveAspectRatio="none"
            focusable="false"
          >
            <path
              className={styles.coast}
              vectorEffect="non-scaling-stroke"
              d="M0 150 Q 120 130, 220 170 T 420 180 Q 480 190, 560 170 T 760 200 Q 840 220, 1000 210"
            />
            <path
              className={styles.coastDim}
              vectorEffect="non-scaling-stroke"
              d="M0 230 Q 160 210, 260 240 T 500 260 Q 600 270, 700 250 T 1000 280"
            />
            <path
              className={styles.coastFaint}
              vectorEffect="non-scaling-stroke"
              d="M150 340 Q 280 320, 380 350 T 620 360 Q 720 370, 820 350"
            />
          </svg>
        </div>

        <div className={styles.overlay}>
          <div className={styles.heading}>
            <Overline className={styles.desktopOnly}>Carte · {siteCount} sites</Overline>
            <Overline className={styles.phoneOnly}>
              {siteCount} sites · {areaName}
            </Overline>
            <h2 id={titleId} className={styles.title}>
              {mapTitle}
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

        <ul className={styles.markers} aria-label="Sites de plongée">
          {sites.map((site) => {
            const isActive = site.id === activeId;
            return (
              <li key={site.id} className={styles.markerItem} style={anchor(site)}>
                <button
                  type="button"
                  className={cx(
                    styles.marker,
                    site.diveCount >= BIG_MARKER_MIN_DIVES && styles.big,
                    isActive && styles.active,
                  )}
                  aria-pressed={isActive}
                  aria-label={`${site.name}, ${site.diveCount} plongées, ${site.maxDepthM} mètres maximum`}
                  onClick={() => setActiveId(site.id)}
                >
                  {site.diveCount}
                </button>
              </li>
            );
          })}
        </ul>

        {active && (
          <div
            className={styles.popover}
            style={anchor(active)}
            data-align={popoverAlign(active)}
            aria-hidden="true"
          >
            <span className={styles.popoverLabel}>Site</span>
            <span className={styles.popoverName}>{active.name}</span>
            <span className={styles.popoverStats}>
              <span>
                <span className={cx(styles.popoverValue, styles.accent)}>{active.diveCount}</span>
                <span className={styles.popoverKey}>Plongées</span>
              </span>
              <span>
                <span className={styles.popoverValue}>-{active.maxDepthM}m</span>
                <span className={styles.popoverKey}>Prof. max</span>
              </span>
            </span>
          </div>
        )}

        <div className={styles.scale} aria-hidden="true">
          <span className={styles.scaleBar} />
          50 km
        </div>
      </div>
    </section>
  );
}
