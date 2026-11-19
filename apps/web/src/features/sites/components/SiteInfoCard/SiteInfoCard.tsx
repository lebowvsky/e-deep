import type { EntryType } from '@e-deep/shared';
import { Link } from 'react-router';
import { formatMeasure } from '@/shared/lib/format';
import type { Site, SiteStats } from '@/shared/model/site';
import { SITE_TYPE_LABELS } from '@/shared/sites/lib/labels';
import { editHrefOf } from '../../lib/labels';
import styles from './SiteInfoCard.module.scss';

export interface SiteInfoCardProps {
  site: Site;
  stats: SiteStats;
}

const ENTRY_LABELS: Record<EntryType, string> = { BOAT: 'Bateau', SHORE: 'Du bord' };

/** « 15 – 60 m », « dès 15 m », « jusqu’à 60 m »; `null` when neither is known. */
function depthRange({ depthMinM, depthMaxM }: Site): string | null {
  if (depthMinM !== null && depthMaxM !== null) {
    return `${formatMeasure(depthMinM)} – ${formatMeasure(depthMaxM)} m`;
  }
  if (depthMinM !== null) return `dès ${formatMeasure(depthMinM)} m`;
  if (depthMaxM !== null) return `jusqu’à ${formatMeasure(depthMaxM)} m`;
  return null;
}

/** « — · Compléter » (to the panel) for what the diver enters; « — » for what the dives tell. */
function Missing({ siteId, canComplete }: { siteId: string; canComplete: boolean }) {
  return (
    <>
      <span aria-hidden="true">—</span>
      {canComplete ? (
        <>
          <span aria-hidden="true"> · </span>
          <Link to={editHrefOf(siteId)} className={styles.complete}>
            Compléter
          </Link>
        </>
      ) : (
        <span className={styles.srOnly}>Non renseigné</span>
      )}
    </>
  );
}

/** « Infos du site » (sites.jsx · InfosCard): a description list. */
export function SiteInfoCard({ site, stats }: SiteInfoCardProps) {
  const facts: { term: string; value: string | null; canComplete: boolean; mono?: boolean }[] = [
    { term: 'Type', value: site.type && SITE_TYPE_LABELS[site.type], canComplete: true },
    { term: 'Profondeur', value: depthRange(site), canComplete: true, mono: true },
    {
      term: 'Mise à l’eau',
      value: stats.usualEntryType && ENTRY_LABELS[stats.usualEntryType],
      canComplete: false,
    },
    { term: 'Structure habituelle', value: stats.usualDiveCenter, canComplete: false },
    { term: 'Région', value: site.region, canComplete: true },
  ];
  return (
    <section className={styles.card} aria-labelledby={`${site.id}-infos`}>
      <h2 id={`${site.id}-infos`} className={styles.title}>
        Infos du site
      </h2>
      <dl className={styles.facts}>
        {facts.map(({ term, value, canComplete, mono }) => (
          <div key={term} className={styles.fact}>
            <dt className={styles.term}>{term}</dt>
            <dd className={mono && value ? styles.mono : styles.value}>
              {value ?? <Missing siteId={site.id} canComplete={canComplete} />}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
