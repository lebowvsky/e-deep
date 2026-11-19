import type { ApiFieldErrors, ApiValidationErrorResponse } from '@e-deep/shared';
import { BadRequestException } from '@nestjs/common';
import { siteCreateRequest } from '../../../../test/support/site-request';
import { createValidationPipe } from '../../../common/validation/validation-pipe';
import {
  SiteCreateRequestDto,
  SiteMergeRequestDto,
  SiteWriteRequestDto,
} from './site-write-request.dto';

const pipe = createValidationPipe();

/** Runs the global validation pipe on a body; `{}` when it passes. */
async function fieldErrorsOf(
  body: unknown,
  metatype: new () => object = SiteCreateRequestDto,
): Promise<ApiFieldErrors> {
  try {
    await pipe.transform(body, { type: 'body', metatype });
    return {};
  } catch (error) {
    if (!(error instanceof BadRequestException)) {
      throw error;
    }
    const response = error.getResponse() as ApiValidationErrorResponse;
    expect(response).toMatchObject({ statusCode: 400, code: 'validation-failed' });
    return response.fieldErrors;
  }
}

/** A creation body as sent on the wire, a field set or removed (`undefined`). */
function withField(field: string, value: unknown): Record<string, unknown> {
  const body: Record<string, unknown> = { ...siteCreateRequest() };
  if (value === undefined) {
    delete body[field];
  } else {
    body[field] = value;
  }
  return body;
}

const NOTHING_ENTERED = {
  locality: null,
  region: null,
  area: null,
  latitude: null,
  longitude: null,
  type: null,
  depthMinM: null,
  depthMaxM: null,
  accessNotes: null,
};

describe('SiteCreateRequestDto', () => {
  it('accepts a full site and a site known by its name only', async () => {
    expect(await fieldErrorsOf(siteCreateRequest())).toEqual({});
    expect(
      await fieldErrorsOf(siteCreateRequest({ ...NOTHING_ENTERED, createdVia: 'quick' })),
    ).toEqual({});
  });

  it.each([
    'id',
    'name',
    'locality',
    'region',
    'area',
    'latitude',
    'longitude',
    'type',
    'depthMinM',
    'depthMaxM',
    'accessNotes',
    'createdVia',
  ])('requires %s, null or not (D-22)', async (field) => {
    expect(await fieldErrorsOf(withField(field, undefined))).toEqual({ [field]: ['required'] });
  });

  it.each(['id', 'name', 'createdVia'])('refuses a null %s', async (field) => {
    expect(await fieldErrorsOf(withField(field, null))).toEqual({ [field]: ['required'] });
  });

  it.each<[string, unknown, string]>([
    ['id', 'abc', 'uuid'],
    ['name', '   ', 'length'],
    ['name', 'n'.repeat(121), 'length'],
    ['locality', '', 'length'],
    ['region', 'r'.repeat(121), 'length'],
    ['area', ' ', 'length'],
    ['latitude', 90.5, 'max'],
    ['latitude', -90.5, 'min'],
    ['latitude', 42.1234567, 'precision'],
    ['longitude', 180.5, 'max'],
    ['longitude', -180.5, 'min'],
    ['type', 'recif', 'in'],
    ['type', 'Tombant', 'in'],
    ['depthMinM', -1, 'min'],
    ['depthMinM', 10.25, 'precision'],
    ['depthMaxM', 0, 'min'],
    ['depthMaxM', 350.1, 'max'],
    ['accessNotes', '  ', 'length'],
    ['accessNotes', 'a'.repeat(2001), 'length'],
    ['createdVia', 'map', 'in'],
  ])('refuses %s = %j (%s)', async (field, value, code) => {
    const errors = await fieldErrorsOf(withField(field, value));
    expect(errors[field]).toContain(code);
  });

  it.each<[string, unknown]>([
    ['name', 42],
    ['latitude', '42.5'],
    ['depthMaxM', '30'],
    ['accessNotes', ['note']],
  ])('refuses a mistyped %s', async (field, value) => {
    expect(await fieldErrorsOf(withField(field, value))).toEqual({ [field]: ['type'] });
  });

  it('accepts the bounds', async () => {
    const bounds = siteCreateRequest({
      latitude: -90,
      longitude: 180,
      depthMinM: 0,
      depthMaxM: 350,
      accessNotes: 'a'.repeat(2000),
      name: 'n'.repeat(120),
    });
    expect(await fieldErrorsOf(bounds)).toEqual({});
  });

  it('refuses half a position on the coordinate that is set (pair, D-23)', async () => {
    expect(await fieldErrorsOf(withField('longitude', null))).toEqual({ latitude: ['pair'] });
    expect(await fieldErrorsOf(withField('latitude', null))).toEqual({ longitude: ['pair'] });
  });

  it('refuses a minimum depth above the maximum (depth-range, RG-32), accepts equal or one alone', async () => {
    expect(await fieldErrorsOf(siteCreateRequest({ depthMinM: 30, depthMaxM: 20 }))).toEqual({
      depthMinM: ['depth-range'],
    });
    expect(await fieldErrorsOf(siteCreateRequest({ depthMinM: 20, depthMaxM: 20 }))).toEqual({});
    expect(await fieldErrorsOf(siteCreateRequest({ depthMinM: 40, depthMaxM: null }))).toEqual({});
    expect(await fieldErrorsOf(siteCreateRequest({ depthMinM: null, depthMaxM: 5 }))).toEqual({});
  });

  it('refuses an unknown field', async () => {
    expect(await fieldErrorsOf(withField('zone', 'mediterranee'))).toEqual({ zone: ['unknown'] });
  });

  it('never echoes the values received', async () => {
    const secret = 'Passage secret sous la falaise';
    try {
      await pipe.transform(withField('accessNotes', `${secret}${'x'.repeat(2000)}`), {
        type: 'body',
        metatype: SiteCreateRequestDto,
      });
    } catch (error) {
      expect(JSON.stringify((error as BadRequestException).getResponse())).not.toContain(secret);
    }
    expect.assertions(1);
  });
});

describe('SiteWriteRequestDto', () => {
  it('has no origin: it cannot change (RG-34)', async () => {
    const { createdVia: _origin, ...replacement } = siteCreateRequest();
    expect(await fieldErrorsOf(replacement, SiteWriteRequestDto)).toEqual({});
    expect(await fieldErrorsOf(siteCreateRequest(), SiteWriteRequestDto)).toEqual({
      createdVia: ['unknown'],
    });
  });
});

describe('SiteMergeRequestDto', () => {
  it('requires a UUID target', async () => {
    const targetId = '01900000-0000-7000-8000-0000000000c2';
    expect(await fieldErrorsOf({ targetId }, SiteMergeRequestDto)).toEqual({});
    expect(await fieldErrorsOf({}, SiteMergeRequestDto)).toEqual({ targetId: ['required'] });
    expect(await fieldErrorsOf({ targetId: 'x' }, SiteMergeRequestDto)).toEqual({
      targetId: ['uuid'],
    });
  });
});
