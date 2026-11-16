import type { DiveObservation } from '@e-deep/shared';
import { DetailSection } from '../DetailSection';
import { ObservationTags } from '../ObservationTags';
import styles from './DiveNotesCard.module.scss';

export interface DiveNotesCardProps {
  notes: string | null;
  observations: readonly DiveObservation[];
  className?: string | undefined;
}

/**
 * « Notes & observations »: the free text of the diver, then the species seen. Empty only when
 * both are.
 */
export function DiveNotesCard({ notes, observations, className }: DiveNotesCardProps) {
  const hasObservations = observations.length > 0;
  return (
    <DetailSection
      title="Notes & observations"
      icon="book"
      className={className}
      empty={!notes && !hasObservations}
    >
      {notes && <p className={styles.text}>{notes}</p>}
      {hasObservations && <ObservationTags observations={observations} />}
    </DetailSection>
  );
}
