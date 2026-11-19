/** Narrows an unknown value to a plain object whose properties can be inspected. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Narrows an unknown value to one of the given string literals. */
export function isOneOf<const T extends string>(value: unknown, options: readonly T[]): value is T {
  return options.some((option) => option === value);
}

/** A finite number (`NaN` and `Infinity` are not valid JSON values anyway). */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/** A string that `Date.parse` understands (ISO 8601 dates from the API). */
export function isDateString(value: unknown): value is string {
  return isString(value) && !Number.isNaN(Date.parse(value));
}

/** `guard`, or `null`. */
export function isNullable<T>(guard: (value: unknown) => value is T) {
  return (value: unknown): value is T | null => value === null || guard(value);
}

/** One of `options`, or `null`. */
export function isNullableOneOf<const T extends string>(options: readonly T[]) {
  return (value: unknown): value is T | null => value === null || isOneOf(value, options);
}

/** An array whose every item passes `guard`. */
export function isArrayOf<T>(guard: (value: unknown) => value is T) {
  return (value: unknown): value is T[] => Array.isArray(value) && value.every(guard);
}

/** Latitude and longitude come both set or both `null` (D-23): a lone half is a broken body. */
export function isPositionPair(latitude: unknown, longitude: unknown): boolean {
  return (latitude === null && longitude === null) || (isNumber(latitude) && isNumber(longitude));
}
