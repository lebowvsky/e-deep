import type { CertificationLevelRef } from '@e-deep/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { createInMemoryDiveRepository } from '../api/inMemoryDiveRepository';
import type { SaveDive } from '../api/saveDive';

/**
 * The `saveDive` of the form. V1: the in-memory repository over the query cache (temporary); the
 * HTTP adapter will take its place here, with the same signature.
 *
 * No `useMutation`: the form reducer already holds the submit state (submitting, errors), a second
 * copy of it would only have to be kept in sync.
 */
export function useSaveDive(diverLevel: CertificationLevelRef): SaveDive {
  const queryClient = useQueryClient();
  return useMemo(
    () => createInMemoryDiveRepository({ queryClient, diverLevel }),
    [queryClient, diverLevel],
  );
}
