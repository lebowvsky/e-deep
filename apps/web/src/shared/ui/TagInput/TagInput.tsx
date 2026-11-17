import { useRef, useState, type KeyboardEvent } from 'react';
import { cx } from '@/shared/lib/classNames';
import { findTextMatch, isSameText } from '@/shared/lib/textMatch';
import { fieldBoxState, fieldControlProps, useFormField } from '@/shared/ui/FormField';
import { Chip, RemovableChip } from '@/shared/ui/Chip';
import { Icon } from '@/shared/ui/Icon';
import styles from './TagInput.module.scss';

export interface TagInputProps {
  values: readonly string[];
  onValuesChange: (values: string[]) => void;
  /** Values entered before (species already seen), offered under the field. */
  suggestions?: readonly string[];
  /** Number of suggestions shown at once. Default 5. */
  maxSuggestions?: number;
  /** Example text of the field. Default « Ajouter… ». */
  placeholder?: string;
  /** Accessible name of a remove button. Default « Retirer <nom> ». */
  removeLabel?: (value: string) => string;
  /** Accessible name outside a `FormField`. */
  label?: string;
  className?: string | undefined;
}

const SEPARATOR = ',';

/** Adds the new non-blank values that are not there yet (ignoring case and accents). */
function withAdded(values: readonly string[], candidates: readonly string[]): string[] {
  const next = [...values];
  for (const candidate of candidates) {
    const value = candidate.trim();
    if (value !== '' && !next.some((existing) => isSameText(existing, value))) next.push(value);
  }
  return next;
}

/**
 * Free values as tags (dive-form.jsx · Espèces observées): Entrée or a comma adds the text typed,
 * each tag has its « Retirer » button, Retour arrière in an empty field removes the last one.
 */
export function TagInput({
  values,
  onValuesChange,
  suggestions = [],
  maxSuggestions = 5,
  placeholder = 'Ajouter…',
  removeLabel = (value) => `Retirer ${value}`,
  label,
  className,
}: TagInputProps) {
  const field = useFormField();
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const isLocked = Boolean(field?.locked);

  const offered = suggestions
    .filter((suggestion) => !values.some((value) => isSameText(value, suggestion)))
    .filter((suggestion) => draft.trim() === '' || findTextMatch(suggestion, draft))
    .slice(0, maxSuggestions);

  const add = (candidates: readonly string[]) => {
    const next = withAdded(values, candidates);
    if (next.length > values.length) {
      onValuesChange(next);
      setAnnouncement(`Ajouté : ${next.slice(values.length).join(', ')}`);
    }
  };

  const remove = (value: string) => {
    onValuesChange(values.filter((existing) => existing !== value));
    setAnnouncement(`Retiré : ${value}`);
  };

  const onChange = (text: string) => {
    if (!text.includes(SEPARATOR)) {
      setDraft(text);
      return;
    }
    // A comma typed or pasted: everything before the last one becomes tags.
    const parts = text.split(SEPARATOR);
    setDraft(parts.pop() ?? '');
    add(parts);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      // Never submits the form from here, even with an empty field.
      event.preventDefault();
      add([draft]);
      setDraft('');
    } else if (event.key === 'Backspace' && draft === '' && !isLocked) {
      const last = values.at(-1);
      if (last !== undefined) remove(last);
    }
  };

  return (
    <div className={cx(styles.root, className)}>
      <div
        className={styles.box}
        {...fieldBoxState(field?.status ?? 'default', isLocked)}
        onClick={(event) => {
          if (event.target === event.currentTarget) inputRef.current?.focus();
        }}
      >
        {values.length > 0 && (
          <ul className={styles.tags}>
            {values.map((value) => (
              <li key={value}>
                <RemovableChip
                  tone="neutral"
                  removeLabel={removeLabel(value)}
                  onRemove={() => {
                    remove(value);
                    inputRef.current?.focus();
                  }}
                >
                  {value}
                </RemovableChip>
              </li>
            ))}
          </ul>
        )}
        <input
          ref={inputRef}
          type="text"
          enterKeyHint="enter"
          autoComplete="off"
          className={styles.input}
          aria-label={field ? undefined : label}
          readOnly={isLocked}
          placeholder={placeholder}
          value={draft}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          {...fieldControlProps(field)}
        />
      </div>
      {offered.length > 0 && !isLocked && (
        <ul className={styles.suggestions} aria-label="Suggestions">
          {offered.map((suggestion) => (
            <li key={suggestion}>
              <Chip
                className={styles.suggestion}
                icon={<Icon name="plus" size="xs" />}
                aria-label={`Ajouter ${suggestion}`}
                onClick={() => {
                  add([suggestion]);
                  setDraft('');
                  inputRef.current?.focus();
                }}
              >
                {suggestion}
              </Chip>
            </li>
          ))}
        </ul>
      )}
      <span className={styles.srOnly} role="status">
        {announcement}
      </span>
    </div>
  );
}
