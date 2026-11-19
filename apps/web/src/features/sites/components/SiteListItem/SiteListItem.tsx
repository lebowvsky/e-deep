import { cx } from '@/shared/lib/classNames';
import { formatDiveDayMonth, formatMeasure } from '@/shared/lib/format';
import type { SiteEntry } from '@/shared/model/site';
import { siteHrefOf } from '@/shared/sites/lib/siteHref';
import { Button } from '@/shared/ui/Button';
import { IconLink } from '@/shared/ui/IconButton';
import { siteItemId, siteMeta } from '../../lib/labels';
import { PositionTag } from '../PositionTag';
import styles from './SiteListItem.module.scss';

export interface SiteListItemProps {
  entry: SiteEntry;
  isSelected: boolean;
  onSelect: (id: string) => void;
  /** Hover or focus: the marker stands out on the map; `null` when it ends. */
  onHighlight: (id: string | null) => void;
  /** « Placer sur la carte », offered on a selected site without position. */
  onPlace: (id: string) => void;
}

/**
 * A row of « Mes sites » (sites.jsx · SiteRow): dive count, name, region and type (or « Position à
 * préciser »), the user's deepest dive and latest dive here; once selected, « Placer sur la
 * carte » (no position) and the link to its page. Fixed height (virtualised list).
 */
export function SiteListItem({
  entry,
  isSelected,
  onSelect,
  onHighlight,
  onPlace,
}: SiteListItemProps) {
  const { site, stats } = entry;
  const meta = siteMeta(site);
  const canPlace = isSelected && site.position === null;

  return (
    <li className={cx(styles.item, isSelected && styles.selected)}>
      <button
        type="button"
        id={siteItemId(site.id)}
        className={styles.select}
        aria-pressed={isSelected}
        onClick={() => onSelect(site.id)}
        onMouseEnter={() => onHighlight(site.id)}
        onMouseLeave={() => onHighlight(null)}
        onFocus={() => onHighlight(site.id)}
        onBlur={() => onHighlight(null)}
      >
        <span className={styles.count}>
          {stats.diveCount}
          <span className={styles.srOnly}> {stats.diveCount > 1 ? 'plongées' : 'plongée'},</span>
        </span>
        <span className={styles.body}>
          <span className={styles.name}>{site.name}</span>
          <span className={styles.meta}>{site.position === null ? <PositionTag /> : meta}</span>
        </span>
        {!canPlace && (
          <span className={styles.figures}>
            {stats.maxDepth ? (
              <span className={styles.depth}>
                {formatMeasure(stats.maxDepth.depthM)}
                <span className={styles.unit}> m</span>
              </span>
            ) : (
              <span className={styles.depth}>
                <span aria-hidden="true">—</span>
                <span className={styles.srOnly}>aucune plongée</span>
              </span>
            )}
            {stats.lastDive && (
              <span className={styles.date}>{formatDiveDayMonth(stats.lastDive.date)}</span>
            )}
          </span>
        )}
      </button>
      {canPlace && (
        <Button
          variant="ghost"
          icon="crosshair"
          className={styles.place}
          onClick={() => onPlace(site.id)}
        >
          Placer sur la carte
        </Button>
      )}
      {/* The list reaches everything the map does (spec § Accessibilité): the site page too. */}
      {isSelected && (
        <IconLink
          to={siteHrefOf(site.id)}
          icon="arrowRight"
          iconSize="md"
          label={`Voir la fiche de ${site.name}`}
          className={styles.open}
        />
      )}
    </li>
  );
}
