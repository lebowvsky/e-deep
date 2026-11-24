import { motion } from '@/design/tokens';
import { cx } from '@/shared/lib/classNames';
import { Icon } from '@/shared/ui/Icon';
import { useDelayedValue } from '../../hooks/useDelayedValue';
import {
  PASSWORD_MIN_LENGTH,
  passwordLength,
  strengthSegments,
  strengthTone,
} from '../../lib/passwordRules';
import styles from './PasswordStrength.module.scss';

/** « Pas un mot de passe courant »: only the API knows, on submit (D35). */
export type CommonPasswordCheck = 'on-submit' | 'failed';

export interface PasswordStrengthProps {
  password: string;
  common: CommonPasswordCheck;
  /** Id of the criteria list: the password input points to it (`aria-describedby`). */
  id: string;
}

const SEGMENTS = ['s1', 's2', 's3', 's4'] as const;

const LENGTH_CRITERION = `${PASSWORD_MIN_LENGTH} caractères minimum`;
const COMMON_CRITERION = 'Pas un mot de passe courant';

/**
 * Gauge and criteria of a new password (welcome.jsx · SignupForm, adapted to D35): the 4 segments
 * follow the length; the length criterion blocks and changes at every keystroke, the common
 * password one is checked by the API. A polite live region says the length criterion once the
 * typing pauses.
 */
export function PasswordStrength({ password, common, id }: PasswordStrengthProps) {
  const length = passwordLength(password);
  const lit = strengthSegments(length);
  const isLongEnough = length >= PASSWORD_MIN_LENGTH;
  const announcement = useDelayedValue(
    password === '' ? '' : `${LENGTH_CRITERION} : ${isLongEnough ? 'rempli' : 'non rempli'}.`,
    motion.dur.announce,
  );

  return (
    <div className={styles.strength}>
      <div className={styles.gauge} data-tone={strengthTone(length)} aria-hidden="true">
        {SEGMENTS.map((segment, index) => (
          <span key={segment} className={cx(styles.segment, index < lit && styles.lit)} />
        ))}
      </div>
      <ul id={id} className={styles.criteria}>
        <li className={styles.criterion} data-state={isLongEnough ? 'met' : 'pending'}>
          <Icon
            name={isLongEnough ? 'check' : 'dot'}
            size="sm"
            weight="bold"
            className={styles.icon}
          />
          {LENGTH_CRITERION}
          <span className={styles.srOnly}>{isLongEnough ? ' : rempli' : ' : non rempli'}</span>
        </li>
        <li className={styles.criterion} data-state={common === 'failed' ? 'failed' : 'pending'}>
          <Icon
            name={common === 'failed' ? 'close' : 'dot'}
            size="sm"
            weight="bold"
            className={styles.icon}
          />
          {COMMON_CRITERION}
          <span className={styles.srOnly}>
            {common === 'failed' ? ' : non rempli' : ' : vérifié à l’envoi'}
          </span>
        </li>
      </ul>
      <p className={styles.srOnly} aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
