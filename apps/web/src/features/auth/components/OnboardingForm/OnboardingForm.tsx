import type { CertificationLevelOption, HealthPolicyVersion } from '@e-deep/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { formatDiverLevel } from '@/shared/lib/format';
import { meQueryOptions } from '@/shared/session/api/meApi';
import { isAuthFailure } from '@/shared/session/authClient';
import { useAuthServices } from '@/shared/session/hooks/useAuthServices';
import { safeNext } from '@/shared/session/lib/safeNext';
import { onboardingPath } from '@/shared/session/lib/sessionPaths';
import { Button } from '@/shared/ui/Button';
import { FormField } from '@/shared/ui/FormField';
import { Select, type SelectOption } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { textOf, useAuthAction } from '../../hooks/useAuthAction';
import { useCertificationLevels } from '../../hooks/useCertificationLevels';
import { useCompleteOnboarding } from '../../hooks/useCompleteOnboarding';
import { firstRefusedField, useFocusAfterRefusal } from '../../hooks/useFocusAfterRefusal';
import { bannerMessage, serverFieldError } from '../../lib/authErrors';
import {
  certificationLevelError,
  healthConsentError,
  lastNameError,
} from '../../lib/authValidation';
import { AuthSubmitButton } from '../AuthSubmitButton';
import { ConsentCheckbox } from '../ConsentCheckbox';
import { FormBanner } from '../FormBanner';
import styles from './OnboardingForm.module.scss';

export interface OnboardingFormProps {
  /** The policy the diver consents to (`currentPolicyVersion` of `/me`). */
  policyVersion: HealthPolicyVersion;
}

type Field = 'certificationLevelId' | 'lastName' | 'healthDataConsent';

const FIELD_ORDER = ['certificationLevelId', 'lastName', 'healthDataConsent'] as const;

/** `''`: the placeholder, an invalid choice (no level is preselected). */
const NO_LEVEL = '';

const levelOptions = (levels: readonly CertificationLevelOption[]): SelectOption<string>[] => [
  { value: NO_LEVEL, label: 'Choisis ton niveau' },
  ...levels.map(({ id, label, agency }) => ({ value: id, label: formatDiverLevel(label, agency) })),
];

/**
 * The first launch (docs/plans/auth-screens.md §2, D38): the level, an optional last name and the
 * health data consent, checked on blur then on submit, sent as a React Action; then to `next` or
 * the dashboard. Nothing is sent while the levels are not loaded.
 */
export function OnboardingForm({ policyVersion }: OnboardingFormProps) {
  const completeOnboarding = useCompleteOnboarding().mutateAsync;
  const levels = useCertificationLevels();
  const { authClient } = useAuthServices();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [levelId, setLevelId] = useState(NO_LEVEL);
  const [lastName, setLastName] = useState('');
  const [hasConsented, setHasConsented] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<Field, true>>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const levelRef = useRef<HTMLSelectElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const levelsBannerRef = useRef<HTMLDivElement>(null);
  const refs = {
    certificationLevelId: levelRef,
    lastName: lastNameRef,
    healthDataConsent: consentRef,
  };
  const next = safeNext(searchParams.get('next'));

  const { attempt, submit, isPending, retryLeft } = useAuthAction({
    read: (data) => ({
      certificationLevelId: textOf(data, 'certificationLevelId'),
      lastName: textOf(data, 'lastName').trim(),
    }),
    run: async (values) => {
      try {
        await completeOnboarding({
          lastName: values.lastName === '' ? null : values.lastName,
          certificationLevelId: values.certificationLevelId,
          healthDataConsent: true,
          policyVersion,
        });
      } catch (error) {
        if (!isAuthFailure(error, 'onboarding-complete')) throw error;
        // Done meanwhile in another tab: follow the status of a fresh `/me`.
        const me = await queryClient.fetchQuery({ ...meQueryOptions(authClient), staleTime: 0 });
        await navigate(onboardingPath(me.onboarding, next), { replace: true });
        return;
      }
      await navigate(next, { replace: true });
    },
  });
  const { failure } = attempt;
  const banner = bannerMessage(failure, retryLeft);

  const localErrors: Record<Field, string | null> = {
    certificationLevelId: certificationLevelError(levelId),
    lastName: lastNameError(lastName),
    healthDataConsent: healthConsentError(hasConsented),
  };
  const shows = (field: Field) => isSubmitted || touched[field] === true;
  const levelMessage =
    (shows('certificationLevelId') ? localErrors.certificationLevelId : null) ??
    serverFieldError(failure, 'certificationLevelId', levelId);
  const lastNameMessage =
    (shows('lastName') ? localErrors.lastName : null) ??
    serverFieldError(failure, 'lastName', lastName.trim());
  const touch = (field: Field) => () => setTouched((current) => ({ ...current, [field]: true }));

  useFocusAfterRefusal(attempt, (refused) => {
    const field = firstRefusedField(refused, FIELD_ORDER);
    return field === null ? bannerRef.current : refs[field].current;
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Sending, asked to wait, or the levels unknown: a submit sends nothing.
    if (isPending || retryLeft > 0) return;
    if (!levels.isSuccess) {
      // The banner says the failure; while loading, the level field says it is busy.
      (levels.isError ? levelsBannerRef : levelRef).current?.focus();
      return;
    }
    setIsSubmitted(true);
    const firstInvalid = FIELD_ORDER.find((field) => localErrors[field] !== null);
    if (firstInvalid === undefined) submit(event.currentTarget);
    else refs[firstInvalid].current?.focus();
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {levels.isError && (
        <FormBanner
          ref={levelsBannerRef}
          action={
            <Button
              onClick={() => void levels.refetch()}
              aria-busy={levels.isFetching || undefined}
            >
              Réessayer
            </Button>
          }
        >
          Impossible de charger les niveaux.
        </FormBanner>
      )}
      {banner !== null && (
        <FormBanner key={attempt.count} ref={bannerRef}>
          {banner}
        </FormBanner>
      )}
      <FormField label="Niveau de plongée" required error={levelMessage}>
        <Select
          ref={levelRef}
          variant="field"
          name="certificationLevelId"
          options={levelOptions(levels.data?.levels ?? [])}
          value={levelId}
          onChange={setLevelId}
          onBlur={touch('certificationLevelId')}
          aria-busy={levels.isPending || undefined}
          // Locked while sending, like the name: the values sent were read at the submit.
          disabled={isPending}
        />
      </FormField>
      <FormField label="Nom" hint="Facultatif. Il apparaît sur ton carnet." error={lastNameMessage}>
        <TextInput
          ref={lastNameRef}
          name="lastName"
          autoComplete="family-name"
          value={lastName}
          readOnly={isPending}
          onChange={(event) => setLastName(event.target.value)}
          onBlur={touch('lastName')}
        />
      </FormField>
      <ConsentCheckbox
        ref={consentRef}
        policyVersion={policyVersion}
        checked={hasConsented}
        onChange={setHasConsented}
        error={shows('healthDataConsent') ? localErrors.healthDataConsent : null}
        disabled={isPending}
      />
      <AuthSubmitButton
        isPending={isPending}
        pendingLabel="Enregistrement…"
        retryLeft={retryLeft}
        isBlocked={!levels.isSuccess}
      >
        Ouvrir mon carnet
      </AuthSubmitButton>
    </form>
  );
}
