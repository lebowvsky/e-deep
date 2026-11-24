import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { safeNext } from '@/shared/session/lib/safeNext';
import { Checkbox } from '@/shared/ui/Checkbox';
import { FormField } from '@/shared/ui/FormField';
import { TextInput } from '@/shared/ui/TextInput';
import { textOf, useAuthAction } from '../../hooks/useAuthAction';
import { useLogin } from '../../hooks/useLogin';
import { bannerMessage, serverFieldError } from '../../lib/authErrors';
import { currentPasswordError, emailError } from '../../lib/authValidation';
import { AuthSubmitButton } from '../AuthSubmitButton';
import { FormBanner } from '../FormBanner';
import { PasswordField } from '../PasswordField';
import styles from './LoginForm.module.scss';

export interface LoginFormProps {
  /** Kept by the page: the same e-mail on the sign-up tab or screen. */
  email: string;
  onEmailChange: (email: string) => void;
  /** Focus the e-mail at once (`/login` reached on desktop). */
  autoFocus?: boolean;
}

type Field = 'email' | 'password';

/**
 * Sign-in (accueil.md · Connexion): checked on blur then on submit, sent as a React Action. A
 * refusal says nothing of which field is wrong; once signed in, to `next` (internal pages only).
 */
export function LoginForm({ email, onEmailChange, autoFocus = false }: LoginFormProps) {
  const login = useLogin();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [touched, setTouched] = useState<Partial<Record<Field, true>>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const bannerId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const { attempt, submit, isPending, retryLeft } = useAuthAction({
    read: (data) => ({ email: textOf(data, 'email').trim(), password: textOf(data, 'password') }),
    run: async (values) => {
      await login({ ...values, rememberMe });
      await navigate(safeNext(searchParams.get('next')), { replace: true });
    },
    onFailure: (failure) => {
      if (failure.code !== 'invalid-credentials') return;
      // A fresh try: the emptied password is not « missing » until it is left empty again.
      setPassword('');
      setIsSubmitted(false);
      setTouched(({ email: emailTouched }) => (emailTouched ? { email: emailTouched } : {}));
    },
  });
  const { failure } = attempt;
  const banner = bannerMessage(failure, retryLeft);
  const isRefused = failure?.code === 'invalid-credentials';

  const shows = (field: Field) => isSubmitted || touched[field] === true;
  const errors: Record<Field, string | null> = {
    email: shows('email') ? emailError(email) : null,
    password: shows('password') ? currentPasswordError(password) : null,
  };
  const emailMessage = errors.email ?? serverFieldError(failure, 'email', email.trim());
  const passwordMessage = errors.password ?? serverFieldError(failure, 'password', password);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Sending, or asked to wait: a second submit sends nothing.
    if (isPending || retryLeft > 0) return;
    setIsSubmitted(true);
    if (emailError(email) !== null) {
      emailRef.current?.focus();
    } else if (currentPasswordError(password) !== null) {
      passwordRef.current?.focus();
    } else {
      submit(event.currentTarget);
    }
  };

  // After a refusal, the focus goes where the diver acts next (DOM focus: an external system).
  useEffect(() => {
    if (attempt.failure?.code === 'invalid-credentials') passwordRef.current?.focus();
    if (attempt.failure?.code === 'invalid-fields') {
      (attempt.failure.fields.email ? emailRef : passwordRef).current?.focus();
    }
  }, [attempt]);

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {banner !== null && (
        <FormBanner key={attempt.count} id={bannerId}>
          {banner}
        </FormBanner>
      )}
      <FormField label="E-mail" error={emailMessage} invalid={isRefused}>
        <TextInput
          ref={emailRef}
          size="lg"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          value={email}
          readOnly={isPending}
          aria-describedby={isRefused ? bannerId : undefined}
          onChange={(event) => onEmailChange(event.target.value)}
          onBlur={() => setTouched((current) => ({ ...current, email: true }))}
        />
      </FormField>
      <FormField
        label="Mot de passe"
        aside={
          <Link to="/forgot-password" className={styles.forgot}>
            Mot de passe oublié ?
          </Link>
        }
        error={passwordMessage}
        invalid={isRefused}
      >
        <PasswordField
          ref={passwordRef}
          size="lg"
          name="password"
          autoComplete="current-password"
          value={password}
          readOnly={isPending}
          aria-describedby={isRefused ? bannerId : undefined}
          onChange={(event) => setPassword(event.target.value)}
          onBlur={() => setTouched((current) => ({ ...current, password: true }))}
        />
      </FormField>
      <Checkbox
        name="rememberMe"
        label="Rester connecté sur cet appareil"
        checked={rememberMe}
        onChange={(event) => setRememberMe(event.target.checked)}
      />
      <AuthSubmitButton isPending={isPending} pendingLabel="Connexion…" retryLeft={retryLeft}>
        Se connecter
      </AuthSubmitButton>
    </form>
  );
}
