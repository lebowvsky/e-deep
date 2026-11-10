import { useId } from 'react';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import styles from './DivesNoResults.module.scss';

export interface DivesNoResultsProps {
  /** Most restrictive filter, already quoted (« « ≥ 40 m » »), with the dives its removal gives. */
  relaxation: { label: string; total: number } | null;
  onRelax: () => void;
  onReset: () => void;
}

const results = (count: number) => `${count} ${count > 1 ? 'résultats' : 'résultat'}`;

/** No dive matches the filters (capture 11): suggest removing the most restrictive one. */
export function DivesNoResults({ relaxation, onRelax, onReset }: DivesNoResultsProps) {
  const titleId = useId();
  return (
    <section className={styles.noResults} aria-labelledby={titleId}>
      <span className={styles.icon} aria-hidden="true">
        <Icon name="search" size="xl" />
      </span>
      <h2 id={titleId} className={styles.title}>
        Aucune plongée ne correspond
      </h2>
      <p className={styles.text}>
        {relaxation
          ? `En retirant ${relaxation.label}, tu retrouves ${results(relaxation.total)}.`
          : 'Aucun filtre ne suffit à lui seul : élargis la recherche ou repars de zéro.'}
      </p>
      <div className={styles.actions}>
        {relaxation && (
          <Button onClick={onRelax}>
            Retirer {relaxation.label} · {results(relaxation.total)}
          </Button>
        )}
        <Button variant="ghost" onClick={onReset}>
          Tout réinitialiser
        </Button>
      </div>
    </section>
  );
}
