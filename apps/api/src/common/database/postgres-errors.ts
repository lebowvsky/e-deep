import { QueryFailedError } from 'typeorm';

const UNIQUE_VIOLATION = '23505';

/** True when `error` is a PostgreSQL unique violation of the named constraint or index. */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driverError: unknown = error.driverError;
  return (
    typeof driverError === 'object' &&
    driverError !== null &&
    'code' in driverError &&
    driverError.code === UNIQUE_VIOLATION &&
    'constraint' in driverError &&
    driverError.constraint === constraint
  );
}
