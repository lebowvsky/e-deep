import type { MouseEvent } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { FIELD_LABELS, type DiveFormField } from '../../../form/model';
import { fieldId } from '../fieldBinding';
import styles from './ErrorSummary.module.scss';

export interface ErrorSummaryProps {
  /** Fields to fix, in the order of the form. */
  fields: readonly DiveFormField[];
}

const countLabel = (count: number) =>
  `${count} ${count > 1 ? 'champs à corriger' : 'champ à corriger'}`;

/** Moves to the control itself: the link target is an input, focusing it also scrolls to it. */
function focusField(event: MouseEvent<HTMLAnchorElement>, field: DiveFormField) {
  const control = document.getElementById(fieldId(field));
  if (!control) return;
  event.preventDefault();
  control.focus();
}

/**
 * « 2 champs à corriger » and a link per field (dive-form.jsx · résumé d'erreurs), announced at
 * once (`role="alert"`). Shown after a save blocked by errors.
 */
export function ErrorSummary({ fields }: ErrorSummaryProps) {
  return (
    <div role="alert" className={styles.summary}>
      <p className={styles.title}>
        <Icon name="alert" size="md" className={styles.icon} />
        {countLabel(fields.length)}
      </p>
      <ul className={styles.links}>
        {fields.map((field) => (
          <li key={field}>
            <a
              href={`#${fieldId(field)}`}
              className={styles.link}
              onClick={(event) => focusField(event, field)}
            >
              {FIELD_LABELS[field]}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
