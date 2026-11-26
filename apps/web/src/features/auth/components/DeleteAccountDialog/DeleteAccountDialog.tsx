import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { formatCountdown } from '@/shared/lib/format';
import { isAuthFailure } from '@/shared/session/authClient';
import { useEndSession } from '@/shared/session/hooks/useEndSession';
import { ACCOUNT_DELETED_STATE } from '@/shared/session/lib/landingNotice';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { FormField } from '@/shared/ui/FormField';
import { textOf, useAuthAction } from '../../hooks/useAuthAction';
import { useFocusAfterRefusal } from '../../hooks/useFocusAfterRefusal';
import { bannerMessage, serverFieldError } from '../../lib/authErrors';
import { FormBanner } from '../FormBanner';
import { PasswordField } from '../PasswordField';
import styles from './DeleteAccountDialog.module.scss';

export interface DeleteAccountDialogProps {
  /** Closes the dialog (« Annuler », Échap, the scrim). Mount the dialog only while it is open. */
  onCancel: () => void;
}

/** Where the diver lands once the account is gone: the landing page, which says so. */
const AFTER_DELETION_PATH = '/';

/**
 * Deletion of the account (docs/plans/auth-screens.md §4.4, D38), from `/settings` and `/consent`:
 * the password typed again, then `DELETE /api/me`, the end of the session on this device and the
 * landing page. A wrong password keeps the dialog open; a `429` counts down on the button.
 */
export function DeleteAccountDialog({ onCancel }: DeleteAccountDialogProps) {
  const endSession = useEndSession();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  const { attempt, submit, isPending, retryLeft } = useAuthAction({
    read: (data) => ({ password: textOf(data, 'password') }),
    run: async (values) => {
      try {
        await endSession({ kind: 'delete-account', request: { password: values.password } });
      } catch (error) {
        // The session was already over: `endSession` has cleared the cache and is taking the
        // diver to the login page, where this dialog goes. Nothing to say here.
        if (isAuthFailure(error, 'unauthenticated')) return;
        throw error;
      }
      await navigate(AFTER_DELETION_PATH, { replace: true, state: ACCOUNT_DELETED_STATE });
    },
    onFailure: (failure) => {
      if (failure.code === 'invalid-credentials') setPassword('');
    },
    // The account's own password: a refusal is never the policy of a new one.
    passwordRole: 'current',
  });
  const { failure } = attempt;
  const isWrongPassword = failure?.code === 'invalid-credentials';
  // The wrong password is said under the field, not as the sign-in's banner; so are the fields
  // refused by the API (`bannerMessage` is null for them).
  const banner = isWrongPassword ? null : bannerMessage(failure, retryLeft);
  const passwordMessage =
    (isWrongPassword && password === '' ? 'Mot de passe incorrect.' : null) ??
    serverFieldError(failure, 'password', password);
  const isWaiting = retryLeft > 0;

  useFocusAfterRefusal(attempt, (refused) =>
    refused.code === 'invalid-credentials' || refused.code === 'invalid-fields'
      ? passwordRef.current
      : bannerRef.current,
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending || isWaiting || password === '') return;
    submit(event.currentTarget);
  };

  return (
    <ConfirmDialog
      open
      title="Supprimer ton compte ?"
      description="C’est définitif : rien ne pourra être récupéré. Saisis ton mot de passe pour confirmer."
      cancelLabel="Annuler"
      confirmLabel={
        isPending ? (
          'Suppression…'
        ) : (
          <>
            Supprimer définitivement
            {isWaiting && <span className={styles.countdown}>{formatCountdown(retryLeft)}</span>}
          </>
        )
      }
      confirmVariant="danger"
      confirmDisabled={password === '' || isWaiting}
      confirmBusy={isPending}
      onCancel={onCancel}
      onConfirm={() => formRef.current?.requestSubmit()}
    >
      <form ref={formRef} className={styles.form} onSubmit={handleSubmit} noValidate>
        {banner !== null && (
          <FormBanner key={attempt.count} ref={bannerRef}>
            {banner}
          </FormBanner>
        )}
        <FormField label="Mot de passe" error={passwordMessage}>
          <PasswordField
            ref={passwordRef}
            name="password"
            autoComplete="current-password"
            value={password}
            readOnly={isPending}
            onChange={(event) => setPassword(event.target.value)}
          />
        </FormField>
      </form>
    </ConfirmDialog>
  );
}
