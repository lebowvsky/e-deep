/** Availability of a single dependency checked by the health endpoint. */
export type DependencyStatus = 'up' | 'down';

/** Overall API status: `degraded` when at least one dependency is down. */
export type HealthStatus = 'ok' | 'degraded';

/** Response body of `GET /api/health`. */
export interface HealthResponse {
  status: HealthStatus;
  database: DependencyStatus;
  /** ISO 8601 timestamp of the check. */
  timestamp: string;
}
