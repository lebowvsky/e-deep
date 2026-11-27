import type { AdminMeResponse, StaffRole } from '@e-deep/shared';
import { vi } from 'vitest';
import { ApiError, type ApiClient, type TypeGuard } from '@/shared/lib/apiClient';

/**
 * An `ApiClient` over mocks: each test says what the calls resolve or reject with. Answers still
 * go through the guard of the call, as with the real client.
 */
export function createFakeApiClient() {
  const get = vi.fn<(path: string) => Promise<unknown>>();
  const post = vi.fn<(path: string, body: unknown) => Promise<unknown>>();
  const postNoContent = vi.fn<(path: string, body?: unknown) => Promise<void>>();

  async function checked<T>(answer: Promise<unknown>, guard: TypeGuard<T>): Promise<T> {
    const data = await answer;
    if (!guard(data)) throw new ApiError('invalid-response', 'Unexpected response shape.');
    return data;
  }

  const apiClient: ApiClient = {
    get: (path, guard) => checked(get(path), guard),
    post: (path, body, guard) => checked(post(path, body), guard),
    postNoContent: (path, body) => postNoContent(path, body),
  };
  return { apiClient, get, post, postNoContent };
}

export const adminMe = (role: StaffRole = 'admin'): AdminMeResponse => ({
  account: { email: `${role}@e-deep.test`, role },
});

export const httpError = (status: number, code?: string, retryAfterS?: number) =>
  new ApiError('http', `The API answered with HTTP ${status}.`, { status, code, retryAfterS });

export const networkError = () => new ApiError('network', 'The API is unreachable.');
