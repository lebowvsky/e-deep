import { useEffect, useId, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from '@/shared/lib/classNames';
import { findTextMatch, foldText, isSameText, matchesText } from '@/shared/lib/textMatch';
import { useFormField } from '@/shared/ui/FormField';
import { Icon, type IconName } from '@/shared/ui/Icon';
import { TextInput } from '@/shared/ui/TextInput';
import styles from './Combobox.module.scss';

export interface ComboboxOption {
  id: string;
  label: string;
  /** Second line (« Calvi · Corse »). */
  description?: string | undefined;
  /** Mono detail on the right (« 12 plongées »). */
  meta?: string | undefined;
}

export interface ComboboxCreate {
  /** Text of the creation option: (« revel ») → « Créer le site « revel » ». */
  label: (query: string) => string;
  /** Second line of the creation option. */
  description?: string;
  /** Whether `query` may become an entry (« Lucas » alone is not a diver). Default: any text. */
  accepts?: (query: string) => boolean;
  onCreate: (query: string) => void;
}

export interface ComboboxProps<T extends ComboboxOption> {
  options: readonly T[];
  /** Text typed in the field (controlled): the caller sets it after a choice. */
  inputValue: string;
  onInputChange: (value: string) => void;
  onSelect: (option: T) => void;
  /** Offers to create an entry from the text typed when no option has exactly this name. */
  create?: ComboboxCreate;
  /** Overline above the options (« Mes sites »). */
  groupLabel?: string;
  /** Icon of the field. Default `search`. */
  icon?: IconName;
  /** Icon in front of each option (`pin` for a site). */
  optionIcon?: IconName;
  placeholder?: string;
  /** Extra content at the end of the field (region of the chosen site). */
  end?: ReactNode;
  /** Shown when nothing matches and nothing can be created. */
  emptyMessage?: string;
  /** Accessible name outside a `FormField`. */
  label?: string;
  /** The field loses the focus (validation at blur). */
  onBlur?: () => void;
  className?: string | undefined;
}

type Item<T> = { kind: 'option'; option: T } | { kind: 'create'; query: string };

const KEYBOARD_HINT = '↑↓ pour naviguer · Entrée pour choisir · Échap pour fermer';

interface HighlightProps {
  text: string;
  query: string;
}

/** The part of `text` that matches the query, in accent. */
function Highlight({ text, query }: HighlightProps) {
  const match = findTextMatch(text, query);
  if (!match) return text;
  return (
    <>
      {text.slice(0, match.start)}
      <mark className={styles.mark}>{text.slice(match.start, match.end)}</mark>
      {text.slice(match.end)}
    </>
  );
}

/**
 * Searchable choice with on-the-fly creation (dive-form.jsx · SiteCombobox), ARIA 1.2 combobox
 * pattern: the focus stays in the field, ↑ ↓ move the active option, Entrée picks it, Échap closes.
 */
export function Combobox<T extends ComboboxOption>({
  options,
  inputValue,
  onInputChange,
  onSelect,
  create,
  groupLabel,
  icon = 'search',
  optionIcon,
  placeholder,
  end,
  emptyMessage,
  label,
  onBlur,
  className,
}: ComboboxProps<T>) {
  const field = useFormField();
  const baseId = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const query = inputValue.trim();
  // Each label folded once: the field re-renders with every key typed in the form around it.
  const foldedLabels = useMemo(() => options.map((option) => foldText(option.label)), [options]);
  const matches = useMemo(
    () =>
      query ? options.filter((_, index) => matchesText(foldedLabels[index] ?? '', query)) : options,
    [options, foldedLabels, query],
  );
  const exists = useMemo(
    () => options.some((option) => isSameText(option.label, query)),
    [options, query],
  );
  const accepts = create?.accepts ?? (() => true);
  const creation = query !== '' && !exists && accepts(query) ? create : undefined;
  const items: Item<T>[] = matches.map((option) => ({ kind: 'option', option }));
  if (creation) items.push({ kind: 'create', query });

  const isLocked = Boolean(field?.locked);
  const listboxId = `${baseId}-listbox`;
  const groupLabelId = `${baseId}-group`;
  const optionId = (index: number) => `${baseId}-option-${index}`;
  const showList = open && items.length > 0;
  const showEmpty = open && items.length === 0 && emptyMessage !== undefined;
  const active = Math.min(activeIndex, items.length - 1);
  const activeId = showList && active >= 0 ? optionId(active) : undefined;

  const openAt = (index: number) => {
    setOpen(true);
    setActiveIndex(index);
  };

  const choose = (item: Item<T>) => {
    setOpen(false);
    if (item.kind === 'option') onSelect(item.option);
    else create?.onCreate(item.query);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (isLocked) return;
    const last = items.length - 1;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!showList) openAt(0);
        else setActiveIndex(active >= last ? 0 : active + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!showList) openAt(last);
        else setActiveIndex(active <= 0 ? last : active - 1);
        break;
      case 'Enter': {
        const item = items[active];
        if (!showList || !item) return;
        event.preventDefault();
        choose(item);
        break;
      }
      case 'Escape':
        if (!open) return;
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        break;
    }
  };

  // Keeps the active option visible when the list scrolls (DOM sync only).
  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView?.({ block: 'nearest' });
  }, [activeId]);

  return (
    <div className={cx(styles.root, className)}>
      <TextInput
        role="combobox"
        aria-label={field ? undefined : label}
        aria-expanded={showList}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        autoComplete="off"
        icon={icon}
        end={end}
        placeholder={placeholder}
        value={inputValue}
        onChange={(event) => {
          onInputChange(event.target.value);
          openAt(0);
        }}
        onClick={() => {
          if (!isLocked) setOpen((current) => !current);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          setOpen(false);
          onBlur?.();
        }}
      />
      {/* Kept in the DOM so `aria-controls` always points to an element. */}
      <div className={styles.popup} hidden={!showList && !showEmpty}>
        <div
          id={listboxId}
          role="listbox"
          aria-labelledby={field ? field.labelId : undefined}
          aria-label={field ? undefined : label}
          className={styles.listbox}
          // Keeps the focus in the field when an option is clicked.
          onPointerDown={(event) => event.preventDefault()}
        >
          {matches.length > 0 && (
            <div role="group" aria-labelledby={groupLabel ? groupLabelId : undefined}>
              {groupLabel && (
                <div id={groupLabelId} className={styles.groupLabel}>
                  {groupLabel}
                </div>
              )}
              {matches.map((option, index) => (
                <div
                  key={option.id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === active}
                  className={cx(styles.option, index === active && styles.active)}
                  onClick={() => choose({ kind: 'option', option })}
                >
                  {optionIcon && <Icon name={optionIcon} size="md" className={styles.optionIcon} />}
                  <span className={styles.text}>
                    <span className={styles.label}>
                      <Highlight text={option.label} query={query} />
                    </span>
                    {option.description && (
                      <span className={styles.description}>{option.description}</span>
                    )}
                  </span>
                  {option.meta && <span className={styles.meta}>{option.meta}</span>}
                </div>
              ))}
            </div>
          )}
          {creation && (
            <div
              id={optionId(matches.length)}
              role="option"
              aria-selected={matches.length === active}
              className={cx(
                styles.option,
                styles.create,
                matches.length > 0 && styles.separated,
                matches.length === active && styles.active,
              )}
              onClick={() => choose({ kind: 'create', query })}
            >
              <Icon name="plus" size="md" weight="bold" className={styles.optionIcon} />
              <span className={styles.text}>
                <span className={styles.label}>{creation.label(query)}</span>
                {creation.description && (
                  <span className={styles.description}>{creation.description}</span>
                )}
              </span>
            </div>
          )}
        </div>
        {showEmpty && <p className={styles.empty}>{emptyMessage}</p>}
        {showList && (
          <p className={styles.keyboardHint} aria-hidden="true">
            {KEYBOARD_HINT}
          </p>
        )}
      </div>
    </div>
  );
}
