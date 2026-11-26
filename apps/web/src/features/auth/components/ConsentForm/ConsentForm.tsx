import type { HealthPolicyVersion } from '@e-deep/shared';
import { useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { safeNext } from '@/shared/session/lib/safeNext';
import { useAuthAction } from '../../hooks/useAuthAction';
import { useFocusAfterRefusal } from '../../hooks/useFocusAfterRefusal';
import { useGrantConsent } from '../../hooks/useGrantConsent';
import { bannerMessage } from '../../lib/authErrors';
import { healthConsentError } from '../../lib/authValidation';
import { AuthSubmitButton } from '../AuthSubmitButton';
import { ConsentCheckbox } from '../ConsentCheckbox';
import { FormBanner } from '../FormBanner';
import styles from './ConsentForm.module.scss';

export interface ConsentFormProps {
  /** The new policy (`currentPolicyVersion` of `/me`). */
  policyVersion: HealthPolicyVersion;
}

/**
 * Re-consent to a new policy version (docs/plans/auth-screens.md §3, D38): the same box as the
 * first launch, unticked, mandatory; then to `next` or the dashboard.
 */
export function ConsentForm({ policyVersion }: ConsentFormProps) {
  const grantConsent = useGrantConsent().mutateAsync;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [hasConsented, setHasConsented] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const consentRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  const { attempt, submit, isPending, retryLeft } = useAuthAction({
    read: () => ({}),
    run: async () => {
      await grantConsent({ purpose: 'health_data_processing', policyVersion });
      await navigate(safeNext(searchParams.get('next')), { replace: true });
    },
  });
  const banner = bannerMessage(attempt.failure, retryLeft);
  const consentError = healthConsentError(hasConsented);

  // No field of this form can be refused by the API: any refusal is said by the banner.
  useFocusAfterRefusal(attempt, () => bannerRef.current);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending || retryLeft > 0) return;
    setIsSubmitted(true);
    if (consentError === null) submit(event.currentTarget);
    else consentRef.current?.focus();
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {banner !== null && (
        <FormBanner key={attempt.count} ref={bannerRef}>
          {banner}
        </FormBanner>
      )}
      <ConsentCheckbox
        ref={consentRef}
        policyVersion={policyVersion}
        checked={hasConsented}
        onChange={setHasConsented}
        error={isSubmitted ? consentError : null}
        disabled={isPending}
      />
      <AuthSubmitButton isPending={isPending} pendingLabel="Enregistrement…" retryLeft={retryLeft}>
        Continuer
      </AuthSubmitButton>
    </form>
  );
}
