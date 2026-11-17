import { Link } from 'react-router';
import { Icon } from '@/shared/ui/Icon';
import styles from './DiveFormHeader.module.scss';

export interface DiveFormHeaderProps {
  /** `edit`: « Modifier la plongée #127 »; otherwise « Nouvelle plongée ». */
  isEdit: boolean;
  /** Logbook number of the dive: the next one, or the edited one. */
  number: number;
  /** Id of the h1, which names the form. */
  titleId: string;
  /** Detail of the edited dive (second crumb), `null` for a new dive. */
  diveHref: string | null;
}

/** Breadcrumb, overline, h1 and subtitle of the dive form (dive-form.jsx · DiveFormDesktop). */
export function DiveFormHeader({ isEdit, number, titleId, diveHref }: DiveFormHeaderProps) {
  const title = isEdit ? `Modifier la plongée #${number}` : 'Nouvelle plongée';

  return (
    <header className={styles.header}>
      <nav aria-label="Fil d’Ariane">
        <ol className={styles.crumbs}>
          <li>
            <Link to="/dives" className={styles.back}>
              <Icon name="chevronLeft" size="md" />
              Mes plongées
            </Link>
          </li>
          {diveHref !== null && (
            <li className={styles.crumb}>
              <Link to={diveHref} className={styles.link}>
                #{number}
              </Link>
            </li>
          )}
          <li className={styles.crumb} aria-current="page">
            {isEdit ? 'Modifier' : 'Nouvelle plongée'}
          </li>
        </ol>
      </nav>
      <div className={styles.titles}>
        <p className={styles.overline}>Carnet · plongée #{number}</p>
        <h1 id={titleId} className={styles.title}>
          {title}
        </h1>
        <p className={styles.subtitle}>
          Seule « L’essentiel » est obligatoire.{' '}
          <span className={styles.subtitleLow}>Le reste se complète maintenant ou plus tard.</span>
        </p>
      </div>
    </header>
  );
}
