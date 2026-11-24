import { redirect, type LoaderFunctionArgs } from 'react-router';
import type { FeatureFlags } from '@/shared/config/app';
import { LOGIN_PATH } from './sessionPaths';

/**
 * Loader of `/signup`: while the beta is closed (`features.signup`, D39), to the login page, with
 * the same query (`next` is kept). The API stays the authority (`403 registration-closed`).
 */
export function requireSignupOpen(features: Pick<FeatureFlags, 'signup'>) {
  return ({ request }: Pick<LoaderFunctionArgs, 'request'>): Response | null =>
    features.signup ? null : redirect(`${LOGIN_PATH}${new URL(request.url).search}`);
}
