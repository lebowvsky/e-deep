import type { ApiFieldErrors, DiveWriteRequest } from '@e-deep/shared';
import { isSameUuid } from '../../../../common/ids/uuid';

/**
 * Identifiers that must agree across the request (and with the route on a `PUT`), compared as
 * UUIDs (case-insensitive). Checked after the DTO, which cannot see outside the object it
 * validates.
 */
export function requestConsistencyErrors(
  request: DiveWriteRequest,
  routeId?: string,
): ApiFieldErrors {
  const fieldErrors: ApiFieldErrors = {};
  if (routeId !== undefined && !isSameUuid(request.event.id, routeId)) {
    fieldErrors['event.id'] = ['matches-route'];
  }
  if (!isSameUuid(request.event.siteId, request.site.id)) {
    fieldErrors['event.siteId'] = ['matches-site'];
  }
  return fieldErrors;
}
