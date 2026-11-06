/** Narrows an unknown value to a plain object whose properties can be inspected. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Narrows an unknown value to one of the given string literals. */
export function isOneOf<const T extends string>(value: unknown, options: readonly T[]): value is T {
  return options.some((option) => option === value);
}
