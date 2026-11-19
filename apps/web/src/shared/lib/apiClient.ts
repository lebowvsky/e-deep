import { isArrayOf, isRecord, isString } from './guards';

/** Runtime check that turns an unknown response body into a typed value. */
export type TypeGuard<T> = (value: unknown) => value is T;

export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'invalid-response';

/** Path of a field in the request body (`participation.maxDepthM`) → codes of its constraints. */
export type ApiFieldErrorCodes = Record<string, string[]>;

export interface ApiErrorOptions {
  status?: number | undefined;
  /** Business code of the error body (`identifier-conflict`), when the API sent one. */
  code?: string | undefined;
  /** Per-field codes of a `validation-failed` body. */
  fieldErrors?: ApiFieldErrorCodes | undefined;
  cause?: unknown;
}

/** Expected failure of an API call, safe to describe to the user. */
export class ApiError extends Error {
  override readonly name = 'ApiError';
  readonly kind: ApiErrorKind;
  /** HTTP status, only for `http` errors. */
  readonly status: number | undefined;
  /** Only for `http` errors whose body carries one. */
  readonly code: string | undefined;
  /** Only for `http` errors whose body carries them. */
  readonly fieldErrors: ApiFieldErrorCodes | undefined;

  constructor(kind: ApiErrorKind, message: string, options: ApiErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.kind = kind;
    this.status = options.status;
    this.code = options.code;
    this.fieldErrors = options.fieldErrors;
  }
}

export interface RequestOptions {
  /** Lets the caller cancel the request (e.g. on unmount). */
  signal?: AbortSignal;
}

export interface ApiClient {
  get<T>(path: string, guard: TypeGuard<T>, options?: RequestOptions): Promise<T>;
  /** Sends `body` as JSON. */
  post<T>(path: string, body: unknown, guard: TypeGuard<T>, options?: RequestOptions): Promise<T>;
  /** Sends `body` as JSON. */
  put<T>(path: string, body: unknown, guard: TypeGuard<T>, options?: RequestOptions): Promise<T>;
}

export interface ApiClientConfig {
  baseUrl: string;
  /** Maximum duration of a request before it fails with a `timeout` error. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

type Method = 'GET' | 'POST' | 'PUT';

/** What an error body may tell (D-26); anything else in it is ignored. */
interface ApiErrorBody {
  code?: string;
  fieldErrors?: ApiFieldErrorCodes;
}

const isFieldErrorCodes = (value: unknown): value is ApiFieldErrorCodes =>
  isRecord(value) && Object.values(value).every(isArrayOf(isString));

function readErrorBody(value: unknown): ApiErrorBody {
  if (!isRecord(value)) return {};
  return {
    ...(isString(value.code) ? { code: value.code } : {}),
    ...(isFieldErrorCodes(value.fieldErrors) ? { fieldErrors: value.fieldErrors } : {}),
  };
}

/** The JSON body of a failed response, `undefined` when there is none or it is not JSON. */
async function errorBodyOf(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    // An error page of a proxy, an empty body: the status alone describes the failure.
    return undefined;
  }
}

/**
 * Minimal JSON client over native `fetch`: timeout, HTTP errors (with the code and field errors
 * of their body) and body validation at the boundary.
 */
export function createApiClient({
  baseUrl,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: ApiClientConfig): ApiClient {
  // A trailing slash makes `new URL('health', base)` append instead of replacing the last segment.
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

  async function request<T>(
    method: Method,
    path: string,
    guard: TypeGuard<T>,
    { body, signal: callerSignal }: RequestOptions & { body?: unknown } = {},
  ): Promise<T> {
    const url = new URL(path.replace(/^\/+/, ''), base);
    // A timer of the page rather than `AbortSignal.timeout`: cleared once the request settles.
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), timeoutMs);
    const timeoutSignal = timeout.signal;
    const signal = callerSignal ? AbortSignal.any([callerSignal, timeoutSignal]) : timeoutSignal;
    try {
      const init: RequestInit =
        body === undefined
          ? { method, headers: { Accept: 'application/json' }, signal }
          : {
              method,
              headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
              signal,
            };

      let response: Response;
      try {
        response = await fetch(url, init);
      } catch (error) {
        if (timeoutSignal.aborted) {
          throw new ApiError('timeout', `The API did not answer within ${timeoutMs} ms.`, {
            cause: error,
          });
        }
        if (callerSignal?.aborted) {
          // Cancelled by the caller: not an API failure, propagate the AbortError untouched.
          throw error;
        }
        throw new ApiError('network', 'The API is unreachable.', { cause: error });
      }

      if (!response.ok) {
        throw new ApiError('http', `The API answered with HTTP ${response.status}.`, {
          status: response.status,
          ...readErrorBody(await errorBodyOf(response)),
        });
      }

      let data: unknown;
      try {
        data = await response.json();
      } catch (error) {
        throw new ApiError('invalid-response', 'The API answered with invalid JSON.', {
          cause: error,
        });
      }

      if (!guard(data)) {
        throw new ApiError('invalid-response', `Unexpected response shape for ${url.pathname}.`);
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    get: (path, guard, options) => request('GET', path, guard, options),
    post: (path, body, guard, options) => request('POST', path, guard, { ...options, body }),
    put: (path, body, guard, options) => request('PUT', path, guard, { ...options, body }),
  };
}
