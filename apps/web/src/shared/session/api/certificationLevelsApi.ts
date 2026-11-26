// `GET /api/certification-levels`: the active levels offered at `/welcome` (D38), checked at the
// boundary. Reference data, the same for every diver: cached for the session.
import type { CertificationLevelListResponse, CertificationLevelOption } from '@e-deep/shared';
import { queryOptions } from '@tanstack/react-query';
import { isArrayOf, isRecord, isString } from '@/shared/lib/guards';
import type { AuthClient } from '../authClient';

function isLevelOption(value: unknown): value is CertificationLevelOption {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.agency) &&
    isString(value.code) &&
    isString(value.label)
  );
}

export function isCertificationLevelListResponse(
  value: unknown,
): value is CertificationLevelListResponse {
  return isRecord(value) && isArrayOf(isLevelOption)(value.levels);
}

export const certificationLevelsQueryOptions = (authClient: AuthClient) =>
  queryOptions({
    queryKey: ['certification-levels'] as const,
    queryFn: ({ signal }) => authClient.certificationLevels({ signal }),
    staleTime: Infinity,
  });
