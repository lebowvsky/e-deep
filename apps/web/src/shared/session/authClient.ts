// The `authClient` port (D41): what the web front asks the API about the session. The app uses the
// HTTP adapter (`api/httpAuthClient.ts`); the tests and the dev `?state=` forcing use the in-memory
// fake (`mocks/fakeAuthClient.ts`), never bundled as a simulated session. No `refresh`: the session
// is an opaque `HttpOnly` cookie (D33), JS never holds a token.
import type {
  ConsentGrantRequest,
  LoginRequest,
  MeResponse,
  OnboardingRequest,
  RegisterRequest,
} from '@e-deep/shared';
import type { ApiFieldErrorCodes, RequestOptions } from '@/shared/lib/apiClient';

export interface AuthClient {
  /** `GET /api/me`. Rejects with `AuthError('unauthenticated')` without a session. */
  me(options?: RequestOptions): Promise<MeResponse>;
  /** `POST /api/auth/login`: opens a session (cookie set by the API). */
  login(request: LoginRequest): Promise<MeResponse>;
  /** `POST /api/auth/register`: creates the account and opens a session (`profile-required`). */
  signup(request: RegisterRequest): Promise<MeResponse>;
  /** `POST /api/auth/logout`: idempotent. */
  logout(): Promise<void>;
  /** `POST /api/me/onboarding`, from `/welcome`. */
  completeOnboarding(request: OnboardingRequest): Promise<MeResponse>;
  /** `POST /api/me/consents`: re-consent to the current policy version. */
  grantConsent(request: ConsentGrantRequest): Promise<MeResponse>;
}

/** An expected refusal of an auth call, one variant per API code (docs/plans/auth.md §3). */
export type AuthFailure =
  /** No (or no longer a) session. */
  | { code: 'unauthenticated' }
  /** Wrong email or password, always the same answer (no account enumeration). */
  | { code: 'invalid-credentials' }
  /** Throttled (D35); `retryAfterS` from `Retry-After`, `null` when the API did not say. */
  | { code: 'too-many-attempts'; retryAfterS: number | null }
  /** Closed beta (D39). */
  | { code: 'registration-closed' }
  | { code: 'email-taken' }
  /** `/me/onboarding` called twice. */
  | { code: 'onboarding-complete' }
  /** Per-field codes (`fieldErrors.password`: `too-short`, `compromised`…). */
  | { code: 'validation-failed'; fieldErrors: ApiFieldErrorCodes };

export type AuthFailureCode = AuthFailure['code'];

/** Typed failure of an `AuthClient` call. Anything else (network, timeout, 5xx) is an `ApiError`. */
export class AuthError extends Error {
  override readonly name = 'AuthError';
  readonly failure: AuthFailure;

  constructor(failure: AuthFailure, options: { cause?: unknown } = {}) {
    super(`Authentication refused: ${failure.code}.`, { cause: options.cause });
    this.failure = failure;
  }
}

/** `error` is an `AuthError` of `code`, its failure narrowed to that variant. */
export function isAuthFailure<C extends AuthFailureCode>(
  error: unknown,
  code: C,
): error is AuthError & { failure: Extract<AuthFailure, { code: C }> } {
  return error instanceof AuthError && error.failure.code === code;
}
