import type { ApiClient } from '@/shared/lib/apiClient';

/**
 * A fake API client for the tests: the methods given, the others rejecting (a test that only
 * reads never writes by accident).
 */
export function fakeApiClient(methods: Partial<ApiClient>): ApiClient {
  const unexpected = (method: string) => (path: string) =>
    Promise.reject(new Error(`Unexpected ${method} ${path}`));
  return { get: unexpected('GET'), post: unexpected('POST'), put: unexpected('PUT'), ...methods };
}
