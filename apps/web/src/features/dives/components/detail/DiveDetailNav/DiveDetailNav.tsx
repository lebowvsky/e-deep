import { Link } from 'react-router';
import { Icon } from '@/shared/ui/Icon';
import type { DiveDetailLinkState } from '../../../lib/backLink';
import type { DiveLogInsights } from '../../../types';
import { DivePager } from '../DivePager';
import styles from './DiveDetailNav.module.scss';

export interface DiveDetailNavProps {
  /** The list with the selection the user left (`/dives?…`), or `/dives`. */
  backHref: string;
  /** Last crumb, when the dive is known. */
  number: number | null;
  /** Previous / next buttons (tablet+), when the log is known. */
  neighbours: Pick<DiveLogInsights, 'previous' | 'next'> | null;
  linkState: DiveDetailLinkState;
}

/** « ‹ Mes plongées / #127 » and, from the tablet, the previous / next buttons. */
export function DiveDetailNav({ backHref, number, neighbours, linkState }: DiveDetailNavProps) {
  return (
    <div className={styles.bar}>
      <nav aria-label="Fil d’Ariane">
        <ol className={styles.crumbs}>
          <li>
            <Link to={backHref} className={styles.back}>
              <Icon name="chevronLeft" size="md" />
              Mes plongées
            </Link>
          </li>
          {number !== null && (
            <li className={styles.current} aria-current="page">
              #{number}
            </li>
          )}
        </ol>
      </nav>
      {neighbours && (
        <DivePager
          previous={neighbours.previous}
          next={neighbours.next}
          linkState={linkState}
          variant="buttons"
          className={styles.pager}
        />
      )}
    </div>
  );
}
