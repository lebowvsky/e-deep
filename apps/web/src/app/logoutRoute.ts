import type { QueryClient } from '@tanstack/react-query';
import { redirect } from 'react-router';
import { ApiError } from '@/shared/lib/apiClient';
import { isRecord } from '@/shared/lib/guards';
import type { AuthServices } from '@/shared/session/authServices';
import { endSession } from '@/shared/session/lib/endSession';

/** Where a signed-out diver lands: the landing page. */
export const AFTER_LOGOUT_PATH = '/';

/** The `fetcher` key of the sign-out form: one sign-out at a time, read by `useLogoutFeedback`. */
export const LOGOUT_FETCHER_KEY = 'logout';

/** What the `/logout` action answers when the API could not close the session. */
export interface LogoutFailure {
  status: 'error';
}

export function isLogoutFailure(data: unknown): data is LogoutFailure {
  return isRecord(data) && data.status === 'error';
}

export interface LogoutDependencies {
  authServices: AuthServices;
  queryClient: QueryClient;
}

/**
 * Action of `/logout` (`<fetcher.Form method="post" action="/logout">`, D41): the session ends
 * (`endSession`), then to the landing page. When the API cannot be reached (network, timeout,
 * 5xx), nothing changes and the form gets a `LogoutFailure` to show; anything else is a bug and
 * reaches the error element.
 */
export function logoutAction({ authServices, queryClient }: LogoutDependencies) {
  return async (): Promise<Response | LogoutFailure> => {
    try {
      await endSession(authServices, queryClient);
    } catch (error) {
      if (error instanceof ApiError) return { status: 'error' };
      throw error;
    }
    return redirect(AFTER_LOGOUT_PATH);
  };
}

/** A `GET /logout` (a typed URL, an old link) signs nobody out: to the landing page. */
export function logoutLoader(): Response {
  return redirect(AFTER_LOGOUT_PATH);
}
