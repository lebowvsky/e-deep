// Password policy of the sign-up form, mirroring the API (D35, `password-policy.ts`): 15 to 128
// characters, counted in code points after NFKC normalisation, no composition rule. The list of
// common passwords and the identity rule are checked by the API on submit (`fieldErrors.password`).
// `@e-deep/shared` holds types only: the bounds are repeated here, keep them in step with the API.

export const PASSWORD_MIN_LENGTH = 15;
export const PASSWORD_MAX_LENGTH = 128;

/** Length as the API measures it: code points of the NFKC form (« é » is 1, an emoji is 1). */
export function passwordLength(password: string): number {
  return [...password.normalize('NFKC')].length;
}

/** Segments of the gauge lit at each length: 1 from the first character, then 8, 15 and 20. */
const SEGMENT_THRESHOLDS = [1, 8, 15, 20] as const;

export const STRENGTH_SEGMENTS = SEGMENT_THRESHOLDS.length;

/** Lit segments (0 to 4) of the 4-segment gauge, which follows the length only. */
export function strengthSegments(length: number): number {
  return SEGMENT_THRESHOLDS.filter((threshold) => length >= threshold).length;
}

/** `warning` below the minimum, `success` once it is reached. */
export function strengthTone(length: number): 'warning' | 'success' {
  return length >= PASSWORD_MIN_LENGTH ? 'success' : 'warning';
}
