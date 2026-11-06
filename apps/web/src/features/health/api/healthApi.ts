import type { DependencyStatus, HealthResponse, HealthStatus } from '@e-deep/shared';
import type { ApiClient, RequestOptions } from '@/shared/lib/apiClient';
import { isOneOf, isRecord } from '@/shared/lib/guards';

const HEALTH_STATUSES = ['ok', 'degraded'] as const satisfies readonly HealthStatus[];
const DEPENDENCY_STATUSES = ['up', 'down'] as const satisfies readonly DependencyStatus[];

/** Validates the body of `GET /health` against the shared contract. */
export function isHealthResponse(value: unknown): value is HealthResponse {
  return (
    isRecord(value) &&
    isOneOf(value.status, HEALTH_STATUSES) &&
    isOneOf(value.database, DEPENDENCY_STATUSES) &&
    typeof value.timestamp === 'string' &&
    !Number.isNaN(Date.parse(value.timestamp))
  );
}

export function fetchHealth(client: ApiClient, options?: RequestOptions): Promise<HealthResponse> {
  return client.get('health', isHealthResponse, options);
}
