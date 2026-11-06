import { createContext } from 'react';
import type { ApiClient } from './apiClient';

/** The API client is injected through context so features stay testable without a real backend. */
export const ApiClientContext = createContext<ApiClient | null>(null);
