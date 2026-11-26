import { useRef, useState, type FormEvent } from 'react';
import { Form, useActionData, useNavigation } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCountdown } from '@/features/auth/hooks/useCountdown';
import { formatCountdown, loginBannerMessage } from '@/features/auth/lib/loginFailure';
import { FormAlert } from '@/shared/ui/FormAlert';
import { TextField } from '@/shared/ui/TextField';
import { readLoginForm, type LoginActionResult, type loginAction } from '../authRoutes';

type LoginAction = ReturnType<typeof loginAction>;

type LoginField = 'email' | 'password' | 'totpCode';

type FieldErrors = Partial<Record<LoginField, string>>;

const TOTP_CODE = /^\d{6}$/;

/** What the form refuses before sending: empty fields, a code that is not 6 digits. */
function validate(data: FormData): FieldErrors {
  const { email, password, totpCode } = readLoginForm(data);
  return {
    ...(email === '' ? { email: 'Saisissez votre adresse e-mail.' } : {}),
    ...(password === '' ? { password: 'Saisissez votre mot de passe.' } : {}),
    ...(TOTP_CODE.test(totpCode) ? {} : { totpCode: 'Saisissez un code de 6 chiffres.' }),
  };
}

const FIELD_ORDER: readonly LoginField[] = ['email', 'password', 'totpCode'];

/**
 * The answers of the action seen so far: each one re-announces the banner, a refusal clears the
 * secrets, a `429` the code (stale once the countdown is over).
 */
interface Answers {
  result: LoginActionResult | undefined;
  count: number;
  refusals: number;
  codeResets: number;
}

/**
 * Staff sign-in (`/login`): e-mail, password and TOTP code, sent to the route action. A refusal
 * never says which factor failed and empties the password and the code; a `429` empties the code
 * and counts down on the button. Once signed in, the action leads to `next` or `/`.
 */
export function LoginPage() {
  const result = useActionData<LoginAction>();
  const navigation = useNavigation();
  const [answers, setAnswers] = useState<Answers>({
    result,
    count: 0,
    refusals: 0,
    codeResets: 0,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const totpCodeRef = useRef<HTMLInputElement>(null);

  // A new answer of the action (state adjusted during render, no effect needed).
  if (answers.result !== result) {
    const isRefusal = result?.failure.code === 'invalid-credentials';
    const isThrottled = result?.failure.code === 'too-many-attempts';
    setAnswers({
      result,
      count: answers.count + 1,
      refusals: answers.refusals + (isRefusal ? 1 : 0),
      codeResets: answers.codeResets + (isRefusal || isThrottled ? 1 : 0),
    });
  }

  const failure = result?.failure ?? null;
  const retryLeft = useCountdown(failure?.code === 'too-many-attempts' ? failure.until : null);
  const banner = loginBannerMessage(failure, retryLeft);
  // Sending, or already on the way to the next page.
  const isPending = navigation.state !== 'idle';
  const isWaiting = retryLeft > 0;

  const clearError = (field: LoginField) => {
    setErrors(({ [field]: _cleared, ...rest }) => rest);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    // Sending, or asked to wait: a second submit sends nothing.
    if (isPending || isWaiting) {
      event.preventDefault();
      return;
    }
    const found = validate(new FormData(event.currentTarget));
    setErrors(found);
    const firstInvalid = FIELD_ORDER.find((field) => found[field] !== undefined);
    if (firstInvalid !== undefined) {
      event.preventDefault();
      const refs = { email: emailRef, password: passwordRef, totpCode: totpCodeRef };
      refs[firstInvalid].current?.focus();
    }
  };

  const buttonLabel = isPending
    ? 'Connexion…'
    : isWaiting
      ? `Réessayer dans ${formatCountdown(retryLeft)}`
      : 'Se connecter';

  return (
    <main lang="fr" className="grid min-h-dvh place-items-center px-4 py-10">
      <title>Connexion · E-Deep Admin</title>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <h1 className="text-xl font-semibold tracking-tight">Connexion au back-office</h1>
          </CardTitle>
          <CardDescription>Espace réservé à l’équipe E-Deep.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form method="post" replace noValidate onSubmit={handleSubmit} className="grid gap-5">
            {banner !== null && <FormAlert key={answers.count}>{banner}</FormAlert>}
            <TextField
              ref={emailRef}
              label="E-mail"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              required
              readOnly={isPending}
              error={errors.email}
              onChange={() => clearError('email')}
              className="h-10"
            />
            {/* A new key per refusal: the password is emptied, and the focus is back on it. */}
            <TextField
              key={`password-${answers.refusals}`}
              ref={passwordRef}
              label="Mot de passe"
              name="password"
              type="password"
              autoComplete="current-password"
              autoFocus={answers.refusals > 0}
              required
              readOnly={isPending}
              error={errors.password}
              onChange={() => clearError('password')}
              className="h-10"
            />
            <TextField
              // A new key per refusal or `429`: the code is emptied.
              key={`totp-${answers.codeResets}`}
              ref={totpCodeRef}
              label="Code de vérification"
              hint="Les 6 chiffres affichés par votre application d’authentification."
              name="totpCode"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              required
              readOnly={isPending}
              error={errors.totpCode}
              onChange={() => clearError('totpCode')}
              className="h-10 tracking-widest tabular-nums"
            />
            <Button
              type="submit"
              size="lg"
              className="h-11 w-full"
              aria-disabled={isPending || isWaiting || undefined}
              aria-busy={isPending || undefined}
            >
              {buttonLabel}
            </Button>
          </Form>
        </CardContent>
      </Card>
    </main>
  );
}
