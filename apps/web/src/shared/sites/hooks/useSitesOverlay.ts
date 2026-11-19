import { useQuery } from '@tanstack/react-query';
import { sitesKeys } from '../api/queryKeys';
import { useSitesRepository } from '../repository/useSitesRepository';

/**
 * The local changes on the sites (`SitesRepository`), cached like a server read: every write
 * invalidates it (`useSiteCommands`). For the readers that do not need the positions (dive form).
 */
export function useSitesOverlay() {
  const repository = useSitesRepository();
  return useQuery({ queryKey: sitesKeys.overlay(), queryFn: () => repository.read() });
}
