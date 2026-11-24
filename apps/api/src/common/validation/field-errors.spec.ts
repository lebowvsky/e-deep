import type { ValidationError } from 'class-validator';
import { toFieldErrors, validationFailed } from './field-errors';

function error(
  property: string,
  constraints: Record<string, string> = {},
  children: ValidationError[] = [],
): ValidationError {
  return { property, constraints, children };
}

describe('toFieldErrors', () => {
  it('maps the constraint names to the contract codes, by dotted path', () => {
    const errors = [
      error('participation', {}, [error('maxDepthM', { max: 'm', isPositive: 'm' })]),
      error('observations', {}, [error('3', {}, [error('label', { length: 'm' })])]),
    ];

    expect(toFieldErrors(errors)).toEqual({
      'participation.maxDepthM': ['max', 'min'],
      'observations.3.label': ['length'],
    });
  });

  it('groups every unknown property, nested or not, under `_unknown`, never by its name', () => {
    const marker = 'zq-marker';
    const errors = [
      error(marker, { whitelistValidation: 'm' }),
      error('participation', {}, [error(`${marker}-2`, { whitelistValidation: 'm' })]),
      error('observations', {}, [
        error('0', {}, [error(`${marker}-3`, { whitelistValidation: 'm' })]),
      ]),
      error('durationMin', { isInt: 'm' }),
    ];

    const fieldErrors = toFieldErrors(errors);

    expect(fieldErrors).toEqual({ _unknown: ['unknown'], durationMin: ['integer'] });
    expect(JSON.stringify(fieldErrors)).not.toContain(marker);
  });

  it('keeps required alone, then type alone, and skips the content of such a field', () => {
    const errors = [
      error('maxDepthM', { isNumber: 'm', isDefined: 'm', max: 'm' }),
      error('buddies', { isArray: 'm' }, [error('firstName', { isDefined: 'm' })]),
    ];

    expect(toFieldErrors(errors)).toEqual({ maxDepthM: ['required'], buddies: ['type'] });
  });

  it('deduplicates the codes', () => {
    expect(toFieldErrors([error('event', { isObject: 'm', nestedValidation: 'm' })])).toEqual({
      event: ['type'],
    });
  });
});

describe('validationFailed', () => {
  it('builds the 400 of the contract', () => {
    const exception = validationFailed({ 'event.id': ['matches-route'] });

    expect(exception.getStatus()).toBe(400);
    expect(exception.getResponse()).toEqual({
      statusCode: 400,
      code: 'validation-failed',
      fieldErrors: { 'event.id': ['matches-route'] },
    });
  });
});
