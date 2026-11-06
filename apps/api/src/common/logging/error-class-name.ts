/**
 * Returns the only error detail that may be logged: its class name.
 *
 * GDPR: the app handles health data. Error messages and stacks can embed SQL parameters,
 * request payload fragments or connection details, so they must never reach the logs.
 */
export function errorClassName(error: unknown): string {
  return error instanceof Error ? error.constructor.name : typeof error;
}
