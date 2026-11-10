import { useId } from 'react';
import { Button, ButtonLink } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import styles from './DivesEmpty.module.scss';

export interface DivesEmptyProps {
  onImport: () => void;
}

/** Ghost logbook lines behind the message (dives-list.jsx · DivesEmpty). */
const GHOST_LINES = 8;

/** Blank dive log (capture 12): no toolbar nor summary, one primary CTA and the import. */
export function DivesEmpty({ onImport }: DivesEmptyProps) {
  const titleId = useId();
  return (
    <Card as="section" padding="none" className={styles.card} aria-labelledby={titleId}>
      <div className={styles.lines} aria-hidden="true">
        {Array.from({ length: GHOST_LINES }, (_unused, index) => (
          <span key={index} className={styles.line} />
        ))}
      </div>
      <div className={styles.content}>
        <span className={styles.icon} aria-hidden="true">
          <Icon name="book" size="xxl" />
        </span>
        <h2 id={titleId} className={styles.title}>
          Ton carnet est vierge
        </h2>
        <p className={styles.text}>
          Chaque plongée enregistrée prendra son numéro, à la suite de ton carnet papier si tu en as
          un.
        </p>
        <div className={styles.actions}>
          <ButtonLink to="/dives/new" variant="primary" size="lg" icon="plus">
            Enregistrer ma première plongée
          </ButtonLink>
          <Button size="lg" icon="upload" onClick={onImport}>
            Importer (UDDF, CSV)
          </Button>
        </div>
        <p className={styles.note}>
          Déjà des plongées sur papier ? Tu pourras démarrer la numérotation à la suite.
        </p>
      </div>
    </Card>
  );
}
