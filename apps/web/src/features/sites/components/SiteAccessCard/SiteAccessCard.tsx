import { Link } from 'react-router';
import type { Site } from '@/shared/model/site';
import { editHrefOf } from '../../lib/labels';
import styles from './SiteAccessCard.module.scss';

export interface SiteAccessCardProps {
  site: Pick<Site, 'id' | 'accessNotes'>;
}

/** « Accès & conseils » (sites.jsx · NotesCard), or « — · Compléter ». */
export function SiteAccessCard({ site }: SiteAccessCardProps) {
  return (
    <section className={styles.card} aria-labelledby={`${site.id}-access`}>
      <h2 id={`${site.id}-access`} className={styles.title}>
        Accès & conseils
      </h2>
      {site.accessNotes ? (
        <p className={styles.notes}>{site.accessNotes}</p>
      ) : (
        <p className={styles.missing}>
          <span aria-hidden="true">— · </span>
          <Link to={editHrefOf(site.id)} className={styles.complete}>
            Compléter
          </Link>
        </p>
      )}
    </section>
  );
}
