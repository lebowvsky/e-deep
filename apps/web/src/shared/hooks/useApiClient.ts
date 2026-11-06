import { use } from 'react';
import type { ApiClient } from '@/shared/lib/apiClient';
import { ApiClientContext } from '@/shared/lib/apiClientContext';

export function useApiClient(): ApiClient {
  const client = use(ApiClientContext);
  if (!client) {
    throw new Error('useApiClient must be used inside <ApiClientContext value={…}>.');
  }
  return client;
}
