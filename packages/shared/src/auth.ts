// Contract of the authentication, the account and the onboarding (D33 to D45, docs/plans/auth.md
// §3). Session cookies are opaque and never read by JS: no token appears in these types.

import type { CertificationLevelRef } from './dives.js';

/** Role of an account. A `diver` account has a diver; a staff account never has one (D36). */
export type AccountRole = 'diver' | 'support' | 'admin';

/** Roles allowed on the admin back office (D42). */
export type StaffRole = Exclude<AccountRole, 'diver'>;

/** Purpose of a consent (GDPR art. 9.2.a, D38). */
export type ConsentPurpose = 'health_data_processing';

/**
 * Version of the health data policy the diver consents to (D38). Adding a version means adding a
 * literal here, front deployed first (like the D-14 unions).
 */
export type HealthPolicyVersion = '2026-11';

/**
 * Codes of `fieldErrors.password` (`fieldErrors.newPassword` on `PUT /api/me/password`) when the
 * password policy refuses a password (D35): 15 to 128 characters after NFKC normalisation, not in
 * the compromised list, not containing the email nor the name. The value is never echoed.
 */
export type PasswordPolicyFailure = 'too-short' | 'too-long' | 'compromised' | 'contains-identity';

/** Body of `POST /api/auth/register`: the minimal sign-up of the landing page. */
export interface RegisterRequest {
  /** 1 to 40 characters. */
  firstName: string;
  email: string;
  password: string;
}

/** Body of `POST /api/auth/login`. */
export interface LoginRequest {
  email: string;
  password: string;
  /** « Rester connecté »: persistent cookie and long session when `true` (D33). */
  rememberMe: boolean;
}

/** Body of `POST /api/admin/auth/login`. No `rememberMe`: staff sessions are always short (D42). */
export interface AdminLoginRequest {
  email: string;
  password: string;
  totpCode: string;
}

/** Body of `POST /api/me/onboarding`, sent from `/welcome` (D38). */
export interface OnboardingRequest {
  lastName: string | null;
  certificationLevelId: string;
  /** Dedicated, unchecked by default, mandatory checkbox. */
  healthDataConsent: true;
  policyVersion: HealthPolicyVersion;
}

/** Computed by the API only; the front never recomputes it. */
export type OnboardingStatus = 'profile-required' | 'consent-required' | 'complete';

/** `GET /api/me`: identity of the signed-in diver, source of truth of the web front (D41). */
export interface MeResponse {
  account: {
    email: string;
    role: 'diver';
  };
  diver: {
    id: string;
    firstName: string;
    lastName: string | null;
    /** `null` until onboarding. */
    level: CertificationLevelRef | null;
    avatarUrl: string | null;
  };
  /** Live consent, `null` before onboarding. */
  consent: {
    policyVersion: HealthPolicyVersion;
    /** ISO 8601 instant (UTC). */
    grantedAt: string;
  } | null;
  currentPolicyVersion: HealthPolicyVersion;
  onboarding: OnboardingStatus;
}

/** `GET /api/admin/me`. */
export interface AdminMeResponse {
  account: {
    email: string;
    role: StaffRole;
  };
}

/** Body of `PUT /api/me/password`. */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/** Body of `DELETE /api/me`: the password is typed again (D38). */
export interface DeleteAccountRequest {
  password: string;
}

/** Body of `POST /api/me/consents` (re-consent to a new policy version). */
export interface ConsentGrantRequest {
  purpose: ConsentPurpose;
  policyVersion: HealthPolicyVersion;
}

/**
 * An active level selectable at `/welcome`. `id` is what `OnboardingRequest.certificationLevelId`
 * sends.
 */
export interface CertificationLevelOption {
  id: string;
  agency: string;
  code: string;
  label: string;
}

/** `GET /api/certification-levels`: the active levels. */
export interface CertificationLevelListResponse {
  levels: CertificationLevelOption[];
}
