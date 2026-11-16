import { Link } from 'react-router';
import { cx } from '@/shared/lib/classNames';
import { Icon } from '@/shared/ui/Icon';
import { diveDetailPath, type DiveDetailLinkState } from '../../../lib/backLink';
import type { DiveNeighbour } from '../../../types';
import styles from './DivePager.module.scss';

export interface DivePagerProps {
  previous: DiveNeighbour | null;
  next: DiveNeighbour | null;
  /** Keeps the way back to the list selection on the neighbour page. */
  linkState: DiveDetailLinkState;
  /** buttons: navigation bar (tablet+) · tiles: bottom of the page (phones) */
  variant: 'buttons' | 'tiles';
  className?: string | undefined;
}

type Direction = 'previous' | 'next';

const SPOKEN: Record<Direction, string> = {
  previous: 'Plongée précédente',
  next: 'Plongée suivante',
};
const NONE: Record<Direction, string> = {
  previous: 'Première plongée',
  next: 'Dernière plongée',
};

/** Leaf through the log: chronological neighbours, disabled at either end. */
export function DivePager({ previous, next, linkState, variant, className }: DivePagerProps) {
  return (
    <nav className={cx(styles.pager, styles[variant], className)} aria-label="Plongées voisines">
      <NeighbourLink direction="previous" neighbour={previous} linkState={linkState} />
      <NeighbourLink direction="next" neighbour={next} linkState={linkState} />
    </nav>
  );
}

interface NeighbourLinkProps {
  direction: Direction;
  neighbour: DiveNeighbour | null;
  linkState: DiveDetailLinkState;
}

function NeighbourLink({ direction, neighbour, linkState }: NeighbourLinkProps) {
  const chevron = (
    <Icon
      name={direction === 'previous' ? 'chevronLeft' : 'chevronRight'}
      size="sm"
      className={styles.chevron}
    />
  );
  const className = cx(styles.link, styles[direction]);
  const content = (
    <>
      {direction === 'previous' && chevron}
      {neighbour ? (
        <>
          <span className={styles.number}>#{neighbour.number}</span>
          <span className={styles.site}>{neighbour.siteName}</span>
        </>
      ) : (
        <span className={styles.none}>{NONE[direction]}</span>
      )}
      {direction === 'next' && chevron}
    </>
  );

  if (!neighbour) {
    // A disabled link: out of the tab order (no tabindex), still found and said dimmed by a
    // screen reader (`aria-disabled` needs the link role; an `<a>` without href has none).
    return (
      <span role="link" className={className} aria-disabled="true">
        {content}
      </span>
    );
  }

  return (
    <Link
      to={diveDetailPath(neighbour.id)}
      state={linkState}
      className={className}
      aria-label={`${SPOKEN[direction]} : #${neighbour.number}, ${neighbour.siteName}`}
    >
      {content}
    </Link>
  );
}
