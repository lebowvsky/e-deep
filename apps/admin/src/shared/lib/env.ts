import { parseApiBaseUrl } from './apiBaseUrl';

/** Validated runtime configuration. Importing this module fails fast when the config is invalid. */
export const env = {
  apiBaseUrl: parseApiBaseUrl(import.meta.env.VITE_API_BASE_URL, window.location.origin),
} as const;
