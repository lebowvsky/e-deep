// Dive writes over HTTP: the `SaveDive` port on `POST /dives` (creation) and `PUT /dives/:id`
// (full replacement), D-24. Once saved, the log and the detail are refetched from the API: the
// logbook numbers are the API's (D26), never computed here.
import type { DiveWriteRequest, DiveWriteResponse } from '@e-deep/shared';
import type { QueryClient } from '@tanstack/react-query';
import { ApiError, type ApiClient } from '@/shared/lib/apiClient';
import { isDateString, isNumber, isRecord, isString } from '@/shared/lib/guards';
import {
  DOMAIN_CODE_ERRORS,
  toDiveFormFieldErrors,
  type DiveFormFieldErrors,
} from './fieldErrorMapping';
import { divesKeys } from './queryKeys';
import type { SaveDive, SaveDiveInput, SaveDiveResult } from './saveDive';

export interface HttpDiveRepositoryDeps {
  apiClient: ApiClient;
  queryClient: QueryClient;
}

export function isDiveWriteResponse(value: unknown): value is DiveWriteResponse {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isNumber(value.number) &&
    Number.isInteger(value.number) &&
    isDateString(value.updatedAt)
  );
}

/** The input of the port is the contract plus `kind`; the dive team comes in display order. */
export function toDiveWriteRequest(input: SaveDiveInput): DiveWriteRequest {
  return {
    event: input.event,
    participation: input.participation,
    observations: input.observations,
    site: input.contacts.site,
    buddies: input.contacts.buddies,
    baseUpdatedAt: input.baseUpdatedAt,
  };
}

export const SITE_NOT_FOUND =
  'Ce site n’est plus dans ton carnet. Choisis-le à nouveau ou crée-le.';
export const TEAM_NOT_FOUND =
  'Un plongeur de la palanquée n’est peut-être plus dans ton carnet. Retire-le puis ajoute-le à nouveau.';

/**
 * `422 invalid-reference` names no field: a site, a buddy or a level unknown to the diver's log
 * (removed from another device, D-24). A site created by name cannot be the one: the site of the
 * log is blamed first (the likeliest), the dive team as well when it has members, so that fixing
 * the messages always clears the cause.
 */
function invalidReferenceErrors({ contacts }: SaveDiveInput): DiveFormFieldErrors {
  return {
    ...(contacts.site.isNew ? {} : { site: SITE_NOT_FOUND }),
    ...(contacts.buddies.length === 0 ? {} : { team: TEAM_NOT_FOUND }),
  };
}

/** What the diver can fix in the form, or `null` for a failure that is not theirs to fix. */
function fieldErrorsOf(error: unknown, input: SaveDiveInput): DiveFormFieldErrors | null {
  if (!(error instanceof ApiError) || error.kind !== 'http') return null;
  let errors: DiveFormFieldErrors | null = null;
  if (error.status === 400 && error.code === 'validation-failed' && error.fieldErrors) {
    errors = toDiveFormFieldErrors(error.fieldErrors);
  } else if (error.status === 400 && error.code !== undefined) {
    errors = DOMAIN_CODE_ERRORS[error.code] ?? null;
  } else if (error.status === 422 && error.code === 'invalid-reference') {
    errors = invalidReferenceErrors(input);
  }
  // Never an empty result: the form would show no message for a refused save.
  return errors !== null && Object.keys(errors).length > 0 ? errors : null;
}

/**
 * `SaveDive` over the API. Field errors resolve `{ ok: false }`; anything else (404 of an edited
 * dive gone meanwhile, `409 identifier-conflict`, network, timeout) rejects with the `ApiError`.
 */
export function createHttpDiveRepository({
  apiClient,
  queryClient,
}: HttpDiveRepositoryDeps): SaveDive {
  return async function saveDive(input: SaveDiveInput): Promise<SaveDiveResult> {
    const body = toDiveWriteRequest(input);
    let saved: DiveWriteResponse;
    try {
      saved =
        input.kind === 'create'
          ? await apiClient.post('dives', body, isDiveWriteResponse)
          : await apiClient.put(
              `dives/${encodeURIComponent(input.event.id)}`,
              body,
              isDiveWriteResponse,
            );
    } catch (error) {
      const fieldErrors = fieldErrorsOf(error, input);
      if (fieldErrors === null) throw error;
      return { ok: false, fieldErrors };
    }
    // Awaited so that the page the form leads to reads the saved dive; a failed refetch does not
    // reject (`invalidateQueries`), the dive is saved whatever happens to the cache.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: divesKeys.log() }),
      queryClient.invalidateQueries({ queryKey: divesKeys.detail(saved.id) }),
    ]);
    return { ok: true, id: saved.id, number: saved.number };
  };
}
