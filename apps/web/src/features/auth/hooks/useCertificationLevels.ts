import { useQuery } from '@tanstack/react-query';
import { certificationLevelsQueryOptions } from '@/shared/session/api/certificationLevelsApi';
import { useAuthServices } from '@/shared/session/hooks/useAuthServices';

/** The levels offered at `/welcome` (`GET /api/certification-levels`). */
export function useCertificationLevels() {
  const { authClient } = useAuthServices();
  return useQuery(certificationLevelsQueryOptions(authClient));
}
