import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useApiClient } from '@/shared/hooks/useApiClient';
import { createHttpDiveRepository } from '../api/httpDiveRepository';
import type { SaveDive } from '../api/saveDive';

/**
 * The `saveDive` of the form: the HTTP adapter of the port, which refreshes the cached log and
 * detail once the dive is saved.
 *
 * No `useMutation`: the form reducer already holds the submit state (submitting, errors), a second
 * copy of it would only have to be kept in sync.
 */
export function useSaveDive(): SaveDive {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  return useMemo(
    () => createHttpDiveRepository({ apiClient, queryClient }),
    [apiClient, queryClient],
  );
}
