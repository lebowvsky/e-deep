import { useId, useRef } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { useSlashShortcut } from '../../hooks/useSlashShortcut';
import styles from './SearchField.module.scss';

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
}

/** Search of the dive log; « / » focuses it from anywhere on the page. */
export function SearchField({ value, onChange }: SearchFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const labelId = useId();
  useSlashShortcut(inputRef);

  return (
    <div className={styles.field}>
      <Icon name="search" size="md" className={styles.icon} />
      <span id={labelId} className={styles.srOnly}>
        Rechercher dans le carnet
      </span>
      <input
        ref={inputRef}
        type="search"
        className={styles.input}
        value={value}
        placeholder="Site, plongeur, note…"
        aria-labelledby={labelId}
        aria-keyshortcuts="/"
        onChange={(event) => onChange(event.target.value)}
      />
      <kbd className={styles.kbd} aria-hidden="true">
        /
      </kbd>
    </div>
  );
}
