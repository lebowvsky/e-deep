import type { AdminLoginRequest, AdminMeResponse } from '@e-deep/shared';
import type { ApiClient, RequestOptions } from '@/shared/lib/apiClient';
import { isOneOf, isRecord } from '@/shared/lib/guards';
import { STAFF_ROLES } from '@/shared/lib/staffRoles';

export function isAdminMeResponse(value: unknown): value is AdminMeResponse {
  return (
    isRecord(value) &&
    isRecord(value.account) &&
    typeof value.account.email === 'string' &&
    isOneOf(value.account.role, STAFF_ROLES)
  );
}

/** `GET /api/admin/me`: the signed-in staff member; rejects with a `401` / `403` `ApiError`. */
export function fetchAdminMe(
  client: ApiClient,
  options?: RequestOptions,
): Promise<AdminMeResponse> {
  return client.get('/admin/me', isAdminMeResponse, options);
}

/** `POST /api/admin/auth/login`: opens a staff session (cookie set by the API). */
export function logIn(
  client: ApiClient,
  request: AdminLoginRequest,
  options?: RequestOptions,
): Promise<AdminMeResponse> {
  return client.post('/admin/auth/login', request, isAdminMeResponse, options);
}

/** `POST /api/admin/auth/logout`: closes the staff session, if any. */
export function logOut(client: ApiClient, options?: RequestOptions): Promise<void> {
  return client.postNoContent('/admin/auth/logout', undefined, options);
}
