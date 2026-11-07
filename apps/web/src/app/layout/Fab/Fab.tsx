import { Link } from 'react-router';
import { Icon } from '@/shared/ui/Icon';
import styles from './Fab.module.scss';

/** Mobile floating action: « Nouvelle plongée » (56px, Fitts). */
export function Fab() {
  return (
    <Link to="/dives/new" className={styles.fab} aria-label="Nouvelle plongée">
      <Icon name="plus" size="xxl" weight="bold" />
    </Link>
  );
}
