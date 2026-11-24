// `GET /api/me`: the source of the identity of the web front (D41). Checked at the boundary, cached
// once per session (`staleTime: Infinity`): only a login, a logout, an onboarding step or a
// session error changes it.
import type {
  CertificationLevelRef,
  HealthPolicyVersion,
  MeResponse,
  OnboardingStatus,
} from '@e-deep/shared';
import { queryOptions } from '@tanstack/react-query';
import { isNullable, isOneOf, isRecord, isString } from '@/shared/lib/guards';
import { SELF_HANDLED_SESSION_META } from '@/shared/lib/queryClient';
import type { AuthClient } from '../authClient';
import type { CurrentDiver } from '../types';

/** Every known policy version: a version added to the contract must be added here (D38). */
const HEALTH_POLICY_VERSIONS = ['2026-11'] as const satisfies readonly HealthPolicyVersion[];
const ONBOARDING_STATUSES = [
  'profile-required',
  'consent-required',
  'complete',
] as const satisfies readonly OnboardingStatus[];

// Compile-time checks that both lists cover their union: a literal added to the contract without
// its entry here would make the guard refuse every `/me` that carries it.
type MissingVersion = Exclude<HealthPolicyVersion, (typeof HEALTH_POLICY_VERSIONS)[number]>;
type MissingStatus = Exclude<OnboardingStatus, (typeof ONBOARDING_STATUSES)[number]>;
const everyVersionListed: MissingVersion extends never ? true : MissingVersion = true;
const everyStatusListed: MissingStatus extends never ? true : MissingStatus = true;
void everyVersionListed;
void everyStatusListed;

const isPolicyVersion = (value: unknown): value is HealthPolicyVersion =>
  isOneOf(value, HEALTH_POLICY_VERSIONS);

function isLevel(value: unknown): value is CertificationLevelRef {
  return isRecord(value) && isString(value.agency) && isString(value.code) && isString(value.label);
}

function isConsent(value: unknown): value is NonNullable<MeResponse['consent']> {
  return isRecord(value) && isPolicyVersion(value.policyVersion) && isString(value.grantedAt);
}

function isDiver(value: unknown): value is MeResponse['diver'] {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.firstName) &&
    isNullable(isString)(value.lastName) &&
    isNullable(isLevel)(value.level) &&
    isNullable(isString)(value.avatarUrl)
  );
}

export function isMeResponse(value: unknown): value is MeResponse {
  return (
    isRecord(value) &&
    isRecord(value.account) &&
    isString(value.account.email) &&
    value.account.role === 'diver' &&
    isDiver(value.diver) &&
    isNullable(isConsent)(value.consent) &&
    isPolicyVersion(value.currentPolicyVersion) &&
    isOneOf(value.onboarding, ONBOARDING_STATUSES)
  );
}

/** Query keys of the session. They hold no secret: there is no token on the client (D33). */
export const sessionKeys = {
  all: ['session'] as const,
  me: () => [...sessionKeys.all, 'me'] as const,
};

export const meQueryOptions = (authClient: AuthClient) =>
  queryOptions({
    queryKey: sessionKeys.me(),
    queryFn: ({ signal }) => authClient.me({ signal }),
    staleTime: Infinity,
    // The route loaders turn a `401` on `/me` into a redirect with the right `next`.
    meta: SELF_HANDLED_SESSION_META,
  });

/** The view of the diver, `null` while their level is unknown (profile not complete yet). */
export function toCurrentDiver({ diver }: MeResponse): CurrentDiver | null {
  if (diver.level === null) return null;
  return {
    id: diver.id,
    firstName: diver.firstName,
    lastName: diver.lastName,
    level: diver.level,
    ...(diver.avatarUrl === null ? {} : { avatarUrl: diver.avatarUrl }),
  };
}
