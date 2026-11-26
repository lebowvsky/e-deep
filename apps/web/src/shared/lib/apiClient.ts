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
  /** Seconds to wait before trying again (`Retry-After` of a `429 too-many-attempts`). */
  retryAfterS?: number | undefined;
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
  /** Only for `http` errors whose response carries a readable `Retry-After`. */
  readonly retryAfterS: number | undefined;

  constructor(kind: ApiErrorKind, message: string, options: ApiErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.kind = kind;
    this.status = options.status;
    this.code = options.code;
    this.fieldErrors = options.fieldErrors;
    this.retryAfterS = options.retryAfterS;
  }
}

/** An `http` error of `status`, with `code` in its body when one is given. */
export function isApiHttpError(error: unknown, status: number, code?: string): error is ApiError {
  return (
    error instanceof ApiError &&
    error.kind === 'http' &&
    error.status === status &&
    (code === undefined || error.code === code)
  );
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
  /** Sends `body` as JSON (none when `undefined`) and expects an empty answer (`204`). */
  postNoContent(path: string, body?: unknown, options?: RequestOptions): Promise<void>;
  /** Sends `body` as JSON and expects an empty answer (`204`). */
  putNoContent(path: string, body: unknown, options?: RequestOptions): Promise<void>;
  /** Expects an empty answer (`204`): any body is ignored. `body`: sent as JSON (`DELETE /me`). */
  delete(path: string, options?: DeleteOptions): Promise<void>;
}

export interface DeleteOptions extends RequestOptions {
  /** A JSON body, for the rare deletions that need one (the password of `DELETE /api/me`). */
  body?: unknown;
}

export interface ApiClientConfig {
  baseUrl: string;
  /** Maximum duration of a request before it fails with a `timeout` error. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

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

/** Longest wait taken from `Retry-After`: a broken or hostile value never locks the form for long. */
export const MAX_RETRY_AFTER_S = 3600;

/** `delta-seconds`, or an IMF-fixdate (`Sun, 06 Nov 1994 08:49:37 GMT`), RFC 9110 §10.2.3. */
const DELTA_SECONDS = /^\d{1,10}$/;
const IMF_FIXDATE =
  /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/;

/**
 * `Retry-After` in seconds, at most `MAX_RETRY_AFTER_S`: a delay (`120`) or an IMF-fixdate; a date
 * already past gives `0`. `undefined` when absent or in any other form (obsolete date formats
 * included).
 */
export function parseRetryAfter(
  value: string | null,
  now: number = Date.now(),
): number | undefined {
  if (value === null) return undefined;
  const trimmed = value.trim();
  let seconds: number;
  if (DELTA_SECONDS.test(trimmed)) {
    seconds = Number(trimmed);
  } else if (IMF_FIXDATE.test(trimmed)) {
    const date = Date.parse(trimmed);
    if (Number.isNaN(date)) return undefined;
    seconds = Math.max(0, Math.ceil((date - now) / 1000));
  } else {
    return undefined;
  }
  return Math.min(seconds, MAX_RETRY_AFTER_S);
}

function retryAfterOf(response: Response): { retryAfterS?: number } {
  const retryAfterS = parseRetryAfter(response.headers.get('Retry-After'));
  return retryAfterS === undefined ? {} : { retryAfterS };
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

  /**
   * Sends the request and settles the failures (timeout, network, HTTP status); `read` turns the
   * successful response into the result, before the timer stops.
   */
  async function send<T>(
    method: Method,
    path: string,
    read: (response: Response, url: URL) => Promise<T>,
    { body, signal: callerSignal }: RequestOptions & { body?: unknown } = {},
  ): Promise<T> {
    const url = new URL(path.replace(/^\/+/, ''), base);
    // A timer of the page rather than `AbortSignal.timeout`: cleared once the request settles.
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), timeoutMs);
    const timeoutSignal = timeout.signal;
    const signal = callerSignal ? AbortSignal.any([callerSignal, timeoutSignal]) : timeoutSignal;
    try {
      // The session cookie (D33) goes with every call: the API is on the front's origin (D34).
      const init: RequestInit =
        body === undefined
          ? { method, headers: { Accept: 'application/json' }, credentials: 'same-origin', signal }
          : {
              method,
              headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
              credentials: 'same-origin',
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
          ...retryAfterOf(response),
        });
      }

      return await read(response, url);
    } finally {
      clearTimeout(timer);
    }
  }

  /** The JSON body of a successful response, checked by `guard`. */
  const readBody =
    <T>(guard: TypeGuard<T>) =>
    async (response: Response, url: URL): Promise<T> => {
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
    };

  const ignoreBody = () => Promise.resolve();

  return {
    get: (path, guard, options) => send('GET', path, readBody(guard), options),
    post: (path, body, guard, options) => send('POST', path, readBody(guard), { ...options, body }),
    put: (path, body, guard, options) => send('PUT', path, readBody(guard), { ...options, body }),
    postNoContent: (path, body, options) =>
      send('POST', path, ignoreBody, body === undefined ? options : { ...options, body }),
    putNoContent: (path, body, options) => send('PUT', path, ignoreBody, { ...options, body }),
    delete: (path, options) => send('DELETE', path, ignoreBody, options),
  };
}
