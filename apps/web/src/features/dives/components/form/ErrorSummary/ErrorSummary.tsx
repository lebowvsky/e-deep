import { Icon } from '@/shared/ui/Icon';
import { FIELD_LABELS, type DiveFormField } from '../../../form/model';
import { fieldId } from '../fieldBinding';
import styles from './ErrorSummary.module.scss';

export interface ErrorSummaryProps {
  /** Fields to fix, in the order of the form. */
  fields: readonly DiveFormField[];
  /** A link was followed: show the field (open its section), scroll to it and focus it. */
  onSelect: (field: DiveFormField) => void;
}

const countLabel = (count: number) =>
  `${count} ${count > 1 ? 'champs à corriger' : 'champ à corriger'}`;

/**
 * « 2 champs à corriger » and a link per field (dive-form.jsx · résumé d'erreurs), announced at
 * once (`role="alert"`). Shown after a save blocked by errors.
 */
export function ErrorSummary({ fields, onSelect }: ErrorSummaryProps) {
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
              onClick={(event) => {
                // The anchor alone would not open a folded section nor focus the control.
                event.preventDefault();
                onSelect(field);
              }}
            >
              {FIELD_LABELS[field]}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
