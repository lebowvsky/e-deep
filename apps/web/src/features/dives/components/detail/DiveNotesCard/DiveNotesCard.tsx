import { DetailSection } from '../DetailSection';
import styles from './DiveNotesCard.module.scss';

export interface DiveNotesCardProps {
  notes: string | null;
  className?: string | undefined;
}

/** « Notes & observations »: the free text of the diver, or a plain « not entered ». */
export function DiveNotesCard({ notes, className }: DiveNotesCardProps) {
  return (
    <DetailSection title="Notes & observations" icon="book" className={className}>
      {notes ? (
        <p className={styles.text}>{notes}</p>
      ) : (
        <p className={styles.missing}>Non renseignées</p>
      )}
    </DetailSection>
  );
}
