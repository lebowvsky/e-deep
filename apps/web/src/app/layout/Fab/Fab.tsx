import { Link } from 'react-router';
import { Icon } from '@/shared/ui/Icon';
import styles from './Fab.module.scss';

export interface FabProps {
  /** Out of reach while the drawer is open. */
  inert?: boolean;
}

/** Mobile floating action: « Nouvelle plongée » (56px, Fitts). */
export function Fab({ inert = false }: FabProps) {
  return (
    <Link to="/dives/new" className={styles.fab} aria-label="Nouvelle plongée" inert={inert}>
      <Icon name="plus" size="xxl" weight="bold" />
    </Link>
  );
}
