import type { StaffRole } from '@e-deep/shared';

/**
 * Every staff role (D42), the one list of the front end: read by the guards of the API answers
 * and of the route handles, and the roles of a page open to all staff.
 */
export const STAFF_ROLES = ['support', 'admin'] as const satisfies readonly StaffRole[];
