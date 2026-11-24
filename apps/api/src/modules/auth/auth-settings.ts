/** Injection token of the authentication settings, read from the validated environment. */
export const AUTH_SETTINGS = Symbol('AUTH_SETTINGS');

export interface AuthSettings {
  /** `REGISTRATION_ENABLED` (D39): `false` in the closed beta. */
  readonly registrationEnabled: boolean;
}
