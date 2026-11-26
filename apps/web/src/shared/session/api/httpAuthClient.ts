// The `AuthClient` port over the API (docs/plans/auth.md §3). Every expected refusal becomes a
// typed `AuthError`; a network failure, a timeout or a 5xx stays an `ApiError`.
import type {
  ChangePasswordRequest,
  ConsentGrantRequest,
  DeleteAccountRequest,
  LoginRequest,
  OnboardingRequest,
  RegisterRequest,
} from '@e-deep/shared';
import { ApiError, type ApiClient } from '@/shared/lib/apiClient';
import { AuthError, type AuthClient, type AuthFailure } from '../authClient';
import { isCertificationLevelListResponse } from './certificationLevelsApi';
import { isMeResponse } from './meApi';

/** The failure an HTTP error stands for, `null` when it is not an expected auth refusal. */
export function toAuthFailure(error: ApiError): AuthFailure | null {
  if (error.kind !== 'http') return null;
  switch (error.status) {
    case 400:
      return error.code === 'validation-failed'
        ? { code: 'validation-failed', fieldErrors: error.fieldErrors ?? {} }
        : null;
    case 401:
      // Any other 401 (no code: a proxy) still means there is no session.
      return error.code === 'invalid-credentials'
        ? { code: 'invalid-credentials' }
        : { code: 'unauthenticated' };
    case 403:
      return error.code === 'registration-closed' ? { code: 'registration-closed' } : null;
    case 409:
      if (error.code === 'email-taken') return { code: 'email-taken' };
      return error.code === 'onboarding-complete' ? { code: 'onboarding-complete' } : null;
    case 429:
      return { code: 'too-many-attempts', retryAfterS: error.retryAfterS ?? null };
    default:
      return null;
  }
}

/** Runs `call`, its expected refusals rethrown as `AuthError`. */
async function mapped<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    const failure = error instanceof ApiError ? toAuthFailure(error) : null;
    throw failure === null ? error : new AuthError(failure, { cause: error });
  }
}

export function createHttpAuthClient(apiClient: ApiClient): AuthClient {
  return {
    me: (options) => mapped(() => apiClient.get('me', isMeResponse, options)),
    login: (request: LoginRequest) =>
      mapped(() => apiClient.post('auth/login', request, isMeResponse)),
    signup: (request: RegisterRequest) =>
      mapped(() => apiClient.post('auth/register', request, isMeResponse)),
    logout: () => mapped(() => apiClient.postNoContent('auth/logout')),
    completeOnboarding: (request: OnboardingRequest) =>
      mapped(() => apiClient.post('me/onboarding', request, isMeResponse)),
    grantConsent: (request: ConsentGrantRequest) =>
      mapped(() => apiClient.post('me/consents', request, isMeResponse)),
    certificationLevels: (options) =>
      mapped(() =>
        apiClient.get('certification-levels', isCertificationLevelListResponse, options),
      ),
    changePassword: (request: ChangePasswordRequest) =>
      mapped(() => apiClient.putNoContent('me/password', request)),
    logoutAll: () => mapped(() => apiClient.postNoContent('auth/logout-all')),
    deleteAccount: (request: DeleteAccountRequest) =>
      mapped(() => apiClient.delete('me', { body: request })),
  };
}
