/** Product name shown in the UI. The mockups still say « DiveLog »: always use this constant. */
export const APP_NAME = 'E-Deep';

/** Document title of a page: « Tableau de bord · E-Deep » (WCAG 2.4.2). */
export function pageTitle(title: string): string {
  return `${title} · ${APP_NAME}`;
}

export interface FeatureFlags {
  /**
   * Sign-up offered on the landing page. Keep aligned with the API's `REGISTRATION_ENABLED`
   * (`false` by default: closed beta, D39); the API stays the authority (`403 registration-closed`).
   * `false`: « Inscriptions bientôt ouvertes » instead of the sign-up tab, `/signup` → `/login`.
   */
  signup: boolean;
  /** The app works without network (PWA, D22). `false`: the landing promises nothing offline (D45). */
  offline: boolean;
}

/** What the product delivers today; the landing page promises nothing more (D45). */
export const features: FeatureFlags = {
  signup: false,
  offline: false,
};

export interface PrivacyConfig {
  /**
   * The privacy promise of the landing page (« Tes données restent à toi »), `null` until its
   * wording is validated by the product owner: the landing then leaves it out (D45).
   */
  copy: string | null;
}

export const privacy: PrivacyConfig = {
  copy: null,
};
