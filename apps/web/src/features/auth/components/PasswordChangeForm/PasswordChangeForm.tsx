import { useId, useRef, useState, type FormEvent } from 'react';
import { FormField } from '@/shared/ui/FormField';
import { useToast } from '@/shared/ui/Toast';
import { textOf, useAuthAction } from '../../hooks/useAuthAction';
import { useChangePassword } from '../../hooks/useChangePassword';
import { firstRefusedField, useFocusAfterRefusal } from '../../hooks/useFocusAfterRefusal';
import { bannerMessage, serverFieldError } from '../../lib/authErrors';
import { currentPasswordError, newPasswordError } from '../../lib/authValidation';
import { AuthSubmitButton } from '../AuthSubmitButton';
import { FormBanner } from '../FormBanner';
import { PasswordField } from '../PasswordField';
import { PasswordStrength } from '../PasswordStrength';
import styles from './PasswordChangeForm.module.scss';

export interface PasswordChangeFormProps {
  /** The account's e-mail: the username password managers file the new password under. */
  email: string;
}

type Field = 'currentPassword' | 'newPassword';

const FIELD_ORDER = ['currentPassword', 'newPassword'] as const;

const PASSWORD_CHANGED_MESSAGE = 'Mot de passe modifié. Tes autres appareils ont été déconnectés.';

/**
 * Change of password (docs/plans/auth-screens.md §4.2, D35): the current one, the new one and its
 * gauge, checked on blur then on submit. Once changed, the fields are emptied and a toast says the
 * other devices are signed out; this session goes on (the API set its new cookie).
 */
export function PasswordChangeForm({ email }: PasswordChangeFormProps) {
  const changePassword = useChangePassword();
  const { notify } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [touched, setTouched] = useState<Partial<Record<Field, true>>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const criteriaId = useId();
  const currentRef = useRef<HTMLInputElement>(null);
  const newRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const refs = { currentPassword: currentRef, newPassword: newRef };

  /** A fresh form: nothing typed is « missing » until it is left empty again. */
  const restart = () => {
    setIsSubmitted(false);
    setTouched({});
  };

  const { attempt, submit, isPending, retryLeft } = useAuthAction({
    read: (data) => ({
      currentPassword: textOf(data, 'currentPassword'),
      newPassword: textOf(data, 'newPassword'),
    }),
    run: async (values) => {
      await changePassword(values);
      setCurrentPassword('');
      setNewPassword('');
      restart();
      notify(PASSWORD_CHANGED_MESSAGE);
    },
    onFailure: (failure) => {
      if (failure.code !== 'invalid-credentials') return;
      setCurrentPassword('');
      restart();
    },
  });
  const { failure } = attempt;
  const isWrongCurrent = failure?.code === 'invalid-credentials';
  // The wrong password is said under its field, not as the sign-in's banner.
  const banner = isWrongCurrent ? null : bannerMessage(failure, retryLeft);
  const isCompromised = failure?.code === 'invalid-fields' && failure.compromised === newPassword;

  const localErrors: Record<Field, string | null> = {
    currentPassword: currentPasswordError(currentPassword),
    newPassword: newPasswordError(newPassword),
  };
  const shows = (field: Field) => isSubmitted || touched[field] === true;
  const currentMessage =
    (shows('currentPassword') ? localErrors.currentPassword : null) ??
    (isWrongCurrent && currentPassword === '' ? 'Mot de passe actuel incorrect.' : null) ??
    serverFieldError(failure, 'currentPassword', currentPassword);
  const newMessage =
    (shows('newPassword') ? localErrors.newPassword : null) ??
    serverFieldError(failure, 'newPassword', newPassword);
  const touch = (field: Field) => () => setTouched((current) => ({ ...current, [field]: true }));

  useFocusAfterRefusal(attempt, (refused) => {
    if (refused.code === 'invalid-credentials') return currentRef.current;
    const field = firstRefusedField(refused, FIELD_ORDER);
    return field === null ? bannerRef.current : refs[field].current;
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending || retryLeft > 0) return;
    setIsSubmitted(true);
    const firstInvalid = FIELD_ORDER.find((field) => localErrors[field] !== null);
    if (firstInvalid === undefined) submit(event.currentTarget);
    else refs[firstInvalid].current?.focus();
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {/* For the password managers: whose password this is. Not sent. */}
      <input type="email" autoComplete="username" value={email} readOnly hidden />
      {banner !== null && (
        <FormBanner key={attempt.count} ref={bannerRef}>
          {banner}
        </FormBanner>
      )}
      <FormField label="Mot de passe actuel" error={currentMessage}>
        <PasswordField
          ref={currentRef}
          name="currentPassword"
          autoComplete="current-password"
          value={currentPassword}
          readOnly={isPending}
          onChange={(event) => setCurrentPassword(event.target.value)}
          onBlur={touch('currentPassword')}
        />
      </FormField>
      <FormField label="Nouveau mot de passe" error={newMessage}>
        <PasswordField
          ref={newRef}
          name="newPassword"
          autoComplete="new-password"
          value={newPassword}
          readOnly={isPending}
          aria-describedby={criteriaId}
          onChange={(event) => setNewPassword(event.target.value)}
          onBlur={touch('newPassword')}
        />
      </FormField>
      <PasswordStrength
        id={criteriaId}
        password={newPassword}
        common={isCompromised ? 'failed' : 'on-submit'}
      />
      <AuthSubmitButton isPending={isPending} pendingLabel="Changement…" retryLeft={retryLeft}>
        Changer le mot de passe
      </AuthSubmitButton>
    </form>
  );
}
