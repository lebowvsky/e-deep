import { ButtonLink } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Overline } from '@/shared/ui/Overline';
import { DIVE_NOT_FOUND_MESSAGE } from '../../../lib/labels';
import styles from './DiveNotFound.module.scss';

export interface DiveNotFoundProps {
  /** The list with the selection the user left, or `/dives`. */
  backHref: string;
}

/**
 * Unknown, deleted or someone else's dive (the API does not tell them apart): one neutral message
 * that never echoes the id of the URL. It is the page h1.
 */
export function DiveNotFound({ backHref }: DiveNotFoundProps) {
  return (
    <Card as="section" padding="lg" className={styles.card}>
      <Overline>Plongée introuvable</Overline>
      <h1 className={styles.message}>{DIVE_NOT_FOUND_MESSAGE}</h1>
      <ButtonLink to={backHref} icon="chevronLeft" className={styles.back}>
        Retour à mes plongées
      </ButtonLink>
    </Card>
  );
}
