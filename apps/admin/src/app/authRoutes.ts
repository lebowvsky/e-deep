import type { AdminLoginRequest } from '@e-deep/shared';
import { redirect, type ActionFunctionArgs } from 'react-router';
import { logIn, logOut } from '@/features/auth/api/adminAuthApi';
import { toLoginFailure, type LoginFailure } from '@/features/auth/lib/loginFailure';
import { ApiError, type ApiClient } from '@/shared/lib/apiClient';
import { isRecord } from '@/shared/lib/guards';
import { LOGIN_PATH, safeNext } from './access-control/safeNext';

export interface AuthRouteDependencies {
  /** A client without `onSessionError`: a refused login is the form's business. */
  apiClient: ApiClient;
}

type ActionArgs = Pick<ActionFunctionArgs, 'request'>;

/** What the `/login` action answers when the session could not be opened. */
export interface LoginActionResult {
  failure: LoginFailure;
}

/** A form field read as text (`FormData` may also hold files). */
function textOf(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
}

/** The body of the login request; spaces typed inside the code (« 123 456 ») are dropped. */
export function readLoginForm(data: FormData): AdminLoginRequest {
  return {
    email: textOf(data, 'email').trim(),
    password: textOf(data, 'password'),
    totpCode: textOf(data, 'totpCode').replace(/\s/g, ''),
  };
}

/**
 * Action of `/login` (`<Form method="post">`): opens the staff session, then to `next` (internal
 * paths only) or `/`. A refusal comes back as a `LoginActionResult`; anything that is not an
 * `ApiError` is a bug and reaches the error element.
 */
export function loginAction({ apiClient }: AuthRouteDependencies) {
  return async ({ request }: ActionArgs): Promise<Response | LoginActionResult> => {
    const body = readLoginForm(await request.formData());
    try {
      await logIn(apiClient, body, { signal: request.signal });
    } catch (error) {
      return { failure: toLoginFailure(error, Date.now()) };
    }
    return redirect(safeNext(new URL(request.url).searchParams.get('next')));
  };
}

/** What the `/logout` action answers when the API could not close the session. */
export interface LogoutFailure {
  status: 'error';
}

export const isLogoutFailure = (data: unknown): data is LogoutFailure =>
  isRecord(data) && data.status === 'error';

/**
 * Action of `/logout` (the `LogoutButton` fetcher): closes the session, then to `/login`. When the
 * API cannot be reached, nothing changes and the button shows a `LogoutFailure`; anything else is
 * a bug and reaches the error element.
 */
export function logoutAction({ apiClient }: AuthRouteDependencies) {
  return async ({ request }: ActionArgs): Promise<Response | LogoutFailure> => {
    try {
      await logOut(apiClient, { signal: request.signal });
    } catch (error) {
      if (error instanceof ApiError) return { status: 'error' };
      throw error;
    }
    return redirect(LOGIN_PATH);
  };
}

/** A `GET /logout` (a typed URL, an old link) signs nobody out. */
export function logoutLoader(): Response {
  return redirect(LOGIN_PATH);
}
