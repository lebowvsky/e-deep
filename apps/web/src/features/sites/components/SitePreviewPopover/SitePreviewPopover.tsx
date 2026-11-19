import { Link } from 'react-router';
import { formatDiveDayMonth, formatMeasure } from '@/shared/lib/format';
import type { SiteEntry } from '@/shared/model/site';
import { SITE_TYPE_LABELS } from '@/shared/sites/lib/labels';
import { siteHrefOf } from '@/shared/sites/lib/siteHref';
import { Icon } from '@/shared/ui/Icon';
import styles from './SitePreviewPopover.module.scss';

export interface SitePreviewPopoverProps {
  entry: SiteEntry;
  /** Échap: the selection is dropped. */
  onClose: () => void;
}

/** « Tombant · Calvi »: the type and the most local part of the region. */
function eyebrowOf({ site }: SiteEntry): string | null {
  const place = site.region?.split('·')[0]?.trim() || null;
  const parts = [site.type && SITE_TYPE_LABELS[site.type], place].filter(Boolean);
  return parts.length === 0 ? null : parts.join(' · ');
}

/**
 * Preview of the selected site beside its marker (sites.jsx · SitePopover): dives, the user's
 * deepest dive, latest dive, link to the site page.
 */
export function SitePreviewPopover({ entry, onClose }: SitePreviewPopoverProps) {
  const { site, stats } = entry;
  const eyebrow = eyebrowOf(entry);
  return (
    <section
      className={styles.popover}
      aria-label={`Aperçu : ${site.name}`}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
      <h2 className={styles.name}>{site.name}</h2>
      <dl className={styles.figures}>
        <div>
          <dt className={styles.label}>plongées</dt>
          <dd className={styles.dives}>{stats.diveCount}</dd>
        </div>
        <div>
          <dt className={styles.label}>ta prof. max</dt>
          <dd className={styles.value}>
            {stats.maxDepth ? `${formatMeasure(stats.maxDepth.depthM)} m` : '—'}
          </dd>
        </div>
        <div>
          <dt className={styles.label}>dernière</dt>
          <dd className={styles.date}>
            {stats.lastDive ? formatDiveDayMonth(stats.lastDive.date) : '—'}
          </dd>
        </div>
      </dl>
      <Link to={siteHrefOf(site.id)} className={styles.link}>
        Voir la fiche <Icon name="arrowRight" size="sm" />
      </Link>
    </section>
  );
}
