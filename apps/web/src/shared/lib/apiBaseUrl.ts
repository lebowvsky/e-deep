const ENV_FILE_HINT = 'Copy apps/web/.env.example to apps/web/.env and set it.';
const HTTP_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:']);

/**
 * Validates `VITE_API_BASE_URL` and returns an absolute base URL for the API client.
 *
 * The API is served on the front's own origin (D34): a relative path such as `/api` is
 * forwarded by the Vite proxy in dev and preview, and by the reverse proxy in production.
 * The API client builds its URLs with `new URL(path, base)`, which needs an absolute base,
 * so a path is resolved against `origin`. An absolute http(s) URL is still accepted as is.
 *
 * A path must resolve to `origin` itself: a protocol-relative value (`//host`, `/\host`, or
 * `/<tab>/host` since the URL parser strips tabs and newlines) would silently send every
 * request, cookies included, to another host. The origins are compared after resolution
 * rather than by inspecting characters, so no parser quirk can slip through.
 *
 * Error messages name the variable only, never its value (same rule as the API).
 *
 * @param value - Raw value of `VITE_API_BASE_URL`.
 * @param origin - Origin the relative path is resolved against (`window.location.origin`).
 * @returns The absolute API base URL.
 * @throws Error when the value is missing, leaves the origin, or is not an http(s) URL.
 */
export function parseApiBaseUrl(value: string | undefined, origin: string): string {
  if (!value) {
    throw new Error(`VITE_API_BASE_URL is not defined. ${ENV_FILE_HINT}`);
  }
  if (value.startsWith('/')) {
    const resolved = new URL(value, origin);
    if (resolved.origin !== new URL(origin).origin) {
      throw new Error('VITE_API_BASE_URL is a path that does not resolve to the front origin.');
    }
    return resolved.href;
  }
  if (URL.canParse(value) && HTTP_PROTOCOLS.has(new URL(value).protocol)) {
    return value;
  }

  throw new Error(
    `VITE_API_BASE_URL is neither a path starting with / nor an absolute http(s) URL. ${ENV_FILE_HINT}`,
  );
}
