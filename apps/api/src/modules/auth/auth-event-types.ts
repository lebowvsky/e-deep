/**
 * Types of the security events kept in `auth_events` (D40), stored as `text` + `CHECK`
 * (`ck_auth_events__type`), same values. Internal to the API: never part of the front contract.
 */
export const AUTH_EVENT_TYPES = [
  'login_succeeded',
  'login_failed',
  'login_throttled',
  'logout',
  'sessions_revoked',
  'password_changed',
  'password_reset_by_operator',
  'consent_granted',
  'account_deleted',
  // The minimal sign-up (`RegistrationService`), migration `AddAccountCreatedAuthEvent`.
  'account_created',
  // `account:reset-totp`, migration `AddStaffTotp`.
  'totp_reset',
] as const;
export type AuthEventType = (typeof AUTH_EVENT_TYPES)[number];
