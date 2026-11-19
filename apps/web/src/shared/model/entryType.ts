import type { EntryType } from '@e-deep/shared';

/**
 * Every entry type of the contract: a value the front does not know breaks it (D-14, deployed
 * front first). Read by the guards of the dive log and of the detail, and by the form choices.
 */
export const ENTRY_TYPES = ['BOAT', 'SHORE'] as const satisfies readonly EntryType[];
