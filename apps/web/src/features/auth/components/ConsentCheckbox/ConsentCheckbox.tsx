import type { HealthPolicyVersion } from '@e-deep/shared';
import { useId, type Ref } from 'react';
import { Link } from 'react-router';
import { HEALTH_CONSENT_TEXT } from '@/shared/config/consent';
import { Checkbox } from '@/shared/ui/Checkbox';
import { Icon } from '@/shared/ui/Icon';
import styles from './ConsentCheckbox.module.scss';

export interface ConsentCheckboxProps {
  /** The policy the diver consents to: its text is the label. */
  policyVersion: HealthPolicyVersion;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Why the form cannot go on without it, once it was asked for. */
  error: string | null;
  /** Not to be changed while the form is being sent. */
  disabled?: boolean;
  ref?: Ref<HTMLInputElement>;
}

/**
 * The health data consent (D38, docs/plans/auth-screens.md §5), the same on `/welcome` and
 * `/consent`: a dedicated box, never ticked by default, its text per policy version, and the
 * privacy page in a new tab so that what was typed stays.
 */
export function ConsentCheckbox({
  policyVersion,
  checked,
  onChange,
  error,
  disabled = false,
  ref,
}: ConsentCheckboxProps) {
  const errorId = useId();
  return (
    <div className={styles.consent}>
      <Checkbox
        ref={ref}
        name="healthDataConsent"
        className={styles.row}
        label={HEALTH_CONSENT_TEXT[policyVersion]}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        aria-required="true"
        aria-invalid={error === null ? undefined : true}
        aria-describedby={error === null ? undefined : errorId}
      />
      {error !== null && (
        <p id={errorId} className={styles.error}>
          <Icon name="alert" size="sm" className={styles.icon} />
          <span>{error}</span>
        </p>
      )}
      <Link to="/privacy" target="_blank" rel="noopener" className={styles.more}>
        En savoir plus
        <span className={styles.srOnly}> (nouvel onglet)</span>
      </Link>
    </div>
  );
}
