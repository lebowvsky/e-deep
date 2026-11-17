import { ValidateBy, type ValidationArguments } from 'class-validator';

// Rules that compare a field with its siblings (RG-23, RG-24, RG-25) or the items of a list. They
// only judge a well-typed value: a missing or mistyped sibling reports its own error. Each
// constraint is named after its contract code (D-26).

/** The field must satisfy `isSatisfied` given the object it belongs to. */
export function CrossFieldRule<T extends object>(
  code: string,
  isSatisfied: (value: unknown, object: T) => boolean,
): PropertyDecorator {
  return ValidateBy({
    name: code,
    validator: {
      validate: (value: unknown, args?: ValidationArguments) =>
        args === undefined || isSatisfied(value, args.object as T),
    },
  });
}

/** Both set or both `null` (`ck_…__safety_stop`): reported on the field that is set. */
export function PairedWith<T extends object>(sibling: keyof T & string): PropertyDecorator {
  return CrossFieldRule<T>('pair', (_value, object) => object[sibling] !== null);
}

/** Strictly below a numeric sibling, when both are numbers. */
export function LessThanField<T extends object>(
  sibling: keyof T & string,
  code: string,
): PropertyDecorator {
  return CrossFieldRule<T>(code, (value, object) => {
    const bound = object[sibling];
    return typeof value !== 'number' || typeof bound !== 'number' || value < bound;
  });
}

/** At most a numeric sibling, when both are numbers (a `null` sibling bounds nothing). */
export function AtMostField<T extends object>(
  sibling: keyof T & string,
  code: string,
): PropertyDecorator {
  return CrossFieldRule<T>(code, (value, object) => {
    const bound = object[sibling];
    return typeof value !== 'number' || typeof bound !== 'number' || value <= bound;
  });
}

/**
 * No two items of the list share the same `property` (compared after `normalize`). Reported on
 * the list (`duplicate`). Items whose property is not a string report their own error.
 */
export function UniqueBy(
  property: string,
  normalize: (value: string) => string = (value) => value,
): PropertyDecorator {
  return ValidateBy({
    name: 'duplicate',
    validator: {
      validate: (items: unknown) => {
        if (!Array.isArray(items)) {
          return true;
        }
        const keys = items
          .map((item: unknown) => propertyOf(item, property))
          .filter((key) => typeof key === 'string')
          .map(normalize);
        return new Set(keys).size === keys.length;
      },
    },
  });
}

function propertyOf(item: unknown, property: string): unknown {
  return typeof item === 'object' && item !== null
    ? (item as Record<string, unknown>)[property]
    : undefined;
}
