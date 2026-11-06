function readApiBaseUrl(): string {
  const value = import.meta.env.VITE_API_BASE_URL;

  if (!value) {
    throw new Error(
      'VITE_API_BASE_URL is not defined. Copy apps/admin/.env.example to apps/admin/.env and set it.',
    );
  }
  if (!URL.canParse(value)) {
    throw new Error(`VITE_API_BASE_URL is not a valid absolute URL: "${value}".`);
  }

  return value;
}

/** Validated runtime configuration. Importing this module fails fast when the config is invalid. */
export const env = {
  apiBaseUrl: readApiBaseUrl(),
} as const;
