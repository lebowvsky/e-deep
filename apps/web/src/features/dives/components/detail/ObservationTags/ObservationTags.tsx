import type { DiveObservation } from '@e-deep/shared';
import { cx } from '@/shared/lib/classNames';
import { Badge } from '@/shared/ui/Badge';
import { observationLabel, observationSpoken } from '../../../lib/labels';
import styles from './ObservationTags.module.scss';

export interface ObservationTagsProps {
  observations: readonly DiveObservation[];
  className?: string | undefined;
}

/**
 * Species seen, in the order entered (dive-detail.jsx · NotesCard tags): « Mérou brun · 2 » on
 * screen, « Mérou brun, 2 individus » for screen readers.
 */
export function ObservationTags({ observations, className }: ObservationTagsProps) {
  return (
    <ul className={cx(styles.tags, className)} aria-label="Espèces observées">
      {observations.map((observation, index) => (
        // Labels may repeat (two counts of one species): the position keeps the keys unique.
        <li key={`${index}-${observation.label}`}>
          <Badge>
            <span aria-hidden="true">{observationLabel(observation)}</span>
            <span className={styles.srOnly}>{observationSpoken(observation)}</span>
          </Badge>
        </li>
      ))}
    </ul>
  );
}
