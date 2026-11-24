import { useRef, type KeyboardEvent } from 'react';
import { cx } from '@/shared/lib/classNames';
import { authTabId as tabId, type AuthTab } from '../../types';
import styles from './AuthTabs.module.scss';

export interface AuthTabsProps {
  tab: AuthTab;
  onSelect: (tab: AuthTab) => void;
  /** Id of the tab panel the tabs control. */
  panelId: string;
  /** Prefix of the tabs' ids (`<prefix>-login`, `<prefix>-signup`), for `aria-labelledby`. */
  idPrefix: string;
}

const TABS = [
  { value: 'login', label: 'Se connecter' },
  { value: 'signup', label: 'Créer un compte' },
] as const satisfies readonly { value: AuthTab; label: string }[];

const STEP: Partial<Record<string, number>> = { ArrowRight: 1, ArrowLeft: -1 };

/**
 * « Se connecter » / « Créer un compte » (welcome.jsx · Tabs): the ARIA Tabs pattern, automatic
 * activation. One tab stop; the arrows (wrapping), Home and End move and select.
 */
export function AuthTabs({ tab, onSelect, panelId, idPrefix }: AuthTabsProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const index = TABS.findIndex((item) => item.value === tab);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = STEP[event.key];
    let target: number | null = null;
    if (step !== undefined) target = (index + step + TABS.length) % TABS.length;
    if (event.key === 'Home') target = 0;
    if (event.key === 'End') target = TABS.length - 1;
    const next = target === null ? undefined : TABS[target];
    if (next === undefined) return;
    event.preventDefault();
    listRef.current
      ?.querySelector<HTMLButtonElement>(`#${CSS.escape(tabId(idPrefix, next.value))}`)
      ?.focus();
    if (next.value !== tab) onSelect(next.value);
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label="Connexion ou création de compte"
      className={styles.list}
      onKeyDown={onKeyDown}
    >
      {TABS.map((item) => {
        const isSelected = item.value === tab;
        return (
          <button
            key={item.value}
            id={tabId(idPrefix, item.value)}
            type="button"
            role="tab"
            aria-selected={isSelected}
            aria-controls={panelId}
            tabIndex={isSelected ? 0 : -1}
            className={cx(styles.tab, isSelected && styles.selected)}
            onClick={() => {
              if (!isSelected) onSelect(item.value);
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
