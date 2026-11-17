import { IconLink } from '@/shared/ui/IconButton';
import styles from './DiveFormTopBar.module.scss';

export interface DiveFormTopBarProps {
  /** « Nouvelle plongée » or « Modifier la plongée ». */
  title: string;
  /** Logbook number (« #128 »), `null` while it is not known yet. */
  number: number | null;
  /** Where ✕ goes (« Annuler »). */
  cancelHref: string;
}

/**
 * Top bar of the dive form on phones (dive-form.jsx · DiveFormMobile): ✕, title and number, in
 * place of the app top bar (route `handle`). Hidden from 768px, where the page header shows.
 * The title repeats the h1 (visually hidden on phones): hidden from screen readers.
 */
export function DiveFormTopBar({ title, number, cancelHref }: DiveFormTopBarProps) {
  return (
    <div className={styles.topBar}>
      <IconLink
        to={cancelHref}
        icon="close"
        iconSize="xl"
        label="Annuler"
        className={styles.close}
      />
      <p className={styles.title} aria-hidden="true">
        {title}
      </p>
      <p className={styles.number} aria-hidden="true">
        {number !== null && `#${number}`}
      </p>
    </div>
  );
}
