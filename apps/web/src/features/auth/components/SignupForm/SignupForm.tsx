import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { FormField } from '@/shared/ui/FormField';
import { TextInput } from '@/shared/ui/TextInput';
import { textOf, useAuthAction } from '../../hooks/useAuthAction';
import { useSignup } from '../../hooks/useSignup';
import { bannerMessage, serverFieldError, type AuthField } from '../../lib/authErrors';
import { emailError, firstNameError, newPasswordError } from '../../lib/authValidation';
import { AuthSubmitButton } from '../AuthSubmitButton';
import { FormBanner } from '../FormBanner';
import { PasswordField } from '../PasswordField';
import { PasswordStrength } from '../PasswordStrength';
import styles from './SignupForm.module.scss';

export interface SignupFormProps {
  /** Kept by the page: the same e-mail on the sign-in tab or screen. */
  email: string;
  onEmailChange: (email: string) => void;
  /** Focus the first name at once (`/signup` reached on desktop). */
  autoFocus?: boolean;
}

/** Where a new account goes: the first launch (level, health consent, D38). */
const AFTER_SIGNUP_PATH = '/welcome';

const FIELD_ORDER: readonly AuthField[] = ['firstName', 'email', 'password'];

/**
 * Minimal sign-up (accueil.md · Inscription, D35, D36): first name, e-mail, password, checked on
 * blur then on submit, sent as a React Action; then to `/welcome`.
 */
export function SignupForm({ email, onEmailChange, autoFocus = false }: SignupFormProps) {
  const signup = useSignup();
  const navigate = useNavigate();
  const { search } = useLocation();
  const [firstName, setFirstName] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState<Partial<Record<AuthField, true>>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const criteriaId = useId();
  const firstNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const focusField = (field: AuthField) => {
    const refs = { firstName: firstNameRef, email: emailRef, password: passwordRef };
    refs[field].current?.focus();
  };

  const { attempt, submit, isPending, retryLeft } = useAuthAction({
    read: (data) => ({
      firstName: textOf(data, 'firstName').trim(),
      email: textOf(data, 'email').trim(),
      password: textOf(data, 'password'),
    }),
    run: async (values) => {
      await signup({ firstName: values.firstName, email: values.email, password: values.password });
      await navigate(AFTER_SIGNUP_PATH, { replace: true });
    },
  });
  const { failure } = attempt;
  const banner = bannerMessage(failure, retryLeft);

  const sent: Record<AuthField, string> = {
    firstName: firstName.trim(),
    email: email.trim(),
    password,
  };
  const localErrors: Record<AuthField, string | null> = {
    firstName: firstNameError(firstName),
    email: emailError(email),
    password: newPasswordError(password),
  };
  const shows = (field: AuthField) => isSubmitted || touched[field] === true;
  const messageOf = (field: AuthField) =>
    (shows(field) ? localErrors[field] : null) ?? serverFieldError(failure, field, sent[field]);
  const isEmailTaken = failure?.code === 'email-taken' && failure.email === sent.email;
  const isCompromised = failure?.code === 'invalid-fields' && failure.compromised === password;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Sending, or asked to wait: a second submit sends nothing.
    if (isPending || retryLeft > 0) return;
    setIsSubmitted(true);
    const firstInvalid = FIELD_ORDER.find((field) => localErrors[field] !== null);
    if (firstInvalid === undefined) submit(event.currentTarget);
    else focusField(firstInvalid);
  };

  // After a refusal, the focus goes to the first field the API refused (DOM focus).
  useEffect(() => {
    const refused = attempt.failure;
    const refs = { firstName: firstNameRef, email: emailRef, password: passwordRef };
    if (refused?.code === 'email-taken') emailRef.current?.focus();
    if (refused?.code === 'invalid-fields') {
      const first = FIELD_ORDER.find((field) => refused.fields[field] !== undefined);
      if (first !== undefined) refs[first].current?.focus();
    }
  }, [attempt]);

  const touch = (field: AuthField) => () =>
    setTouched((current) => ({ ...current, [field]: true }));

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {banner !== null && <FormBanner key={attempt.count}>{banner}</FormBanner>}
      <FormField
        label="Prénom"
        hint="Affiché dans ton carnet et ta palanquée."
        error={messageOf('firstName')}
      >
        <TextInput
          ref={firstNameRef}
          size="lg"
          name="firstName"
          autoComplete="given-name"
          autoFocus={autoFocus}
          value={firstName}
          readOnly={isPending}
          onChange={(event) => setFirstName(event.target.value)}
          onBlur={touch('firstName')}
        />
      </FormField>
      <FormField
        label="E-mail"
        error={
          isEmailTaken ? (
            <>
              Un compte existe déjà avec cet e-mail.{' '}
              <Link to={`/login${search}`} className={styles.inlineLink}>
                Se connecter
              </Link>
            </>
          ) : (
            messageOf('email')
          )
        }
      >
        <TextInput
          ref={emailRef}
          size="lg"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={email}
          readOnly={isPending}
          onChange={(event) => onEmailChange(event.target.value)}
          onBlur={touch('email')}
        />
      </FormField>
      <FormField label="Mot de passe" error={messageOf('password')}>
        <PasswordField
          ref={passwordRef}
          size="lg"
          name="password"
          autoComplete="new-password"
          value={password}
          readOnly={isPending}
          aria-describedby={criteriaId}
          onChange={(event) => setPassword(event.target.value)}
          onBlur={touch('password')}
        />
      </FormField>
      <PasswordStrength
        id={criteriaId}
        password={password}
        common={isCompromised ? 'failed' : 'on-submit'}
      />
      <AuthSubmitButton isPending={isPending} pendingLabel="Création…" retryLeft={retryLeft}>
        Créer mon carnet
      </AuthSubmitButton>
      <p className={styles.legal}>
        En créant un compte, tu acceptes les{' '}
        <Link to="/terms" className={styles.legalLink}>
          conditions d’utilisation
        </Link>{' '}
        et la{' '}
        <Link to="/privacy" className={styles.legalLink}>
          politique de confidentialité
        </Link>
        .
      </p>
    </form>
  );
}
