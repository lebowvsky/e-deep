/** Runtime check that turns an unknown response body into a typed value. */
export type TypeGuard<T> = (value: unknown) => value is T;

export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'invalid-response';

/** Expected failure of an API call, safe to describe to the user. */
export class ApiError extends Error {
  override readonly name = 'ApiError';
  readonly kind: ApiErrorKind;
  /** HTTP status, only for `http` errors. */
  readonly status: number | undefined;

  constructor(kind: ApiErrorKind, message: string, options?: { status?: number; cause?: unknown }) {
    super(message, { cause: options?.cause });
    this.kind = kind;
    this.status = options?.status;
  }
}

export interface RequestOptions {
  /** Lets the caller cancel the request (e.g. on unmount). */
  signal?: AbortSignal;
}

export interface ApiClient {
  get<T>(path: string, guard: TypeGuard<T>, options?: RequestOptions): Promise<T>;
}

export interface ApiClientConfig {
  baseUrl: string;
  /** Maximum duration of a request before it fails with a `timeout` error. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/** Minimal JSON client over native `fetch`: timeout, HTTP errors and body validation at the boundary. */
export function createApiClient({
  baseUrl,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: ApiClientConfig): ApiClient {
  // A trailing slash makes `new URL('health', base)` append instead of replacing the last segment.
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

  async function get<T>(path: string, guard: TypeGuard<T>, options: RequestOptions = {}) {
    const url = new URL(path.replace(/^\/+/, ''), base);
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = options.signal
      ? AbortSignal.any([options.signal, timeoutSignal])
      : timeoutSignal;

    let response: Response;
    try {
      response = await fetch(url, { headers: { Accept: 'application/json' }, signal });
    } catch (error) {
      if (timeoutSignal.aborted) {
        throw new ApiError('timeout', `The API did not answer within ${timeoutMs} ms.`, {
          cause: error,
        });
      }
      if (options.signal?.aborted) {
        // Cancelled by the caller: not an API failure, propagate the AbortError untouched.
        throw error;
      }
      throw new ApiError('network', 'The API is unreachable.', { cause: error });
    }

    if (!response.ok) {
      throw new ApiError('http', `The API answered with HTTP ${response.status}.`, {
        status: response.status,
      });
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      throw new ApiError('invalid-response', 'The API answered with invalid JSON.', {
        cause: error,
      });
    }

    if (!guard(body)) {
      throw new ApiError('invalid-response', `Unexpected response shape for ${url.pathname}.`);
    }
    return body;
  }

  return { get };
}
