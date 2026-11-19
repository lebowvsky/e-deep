import type {
  ApiFieldErrors,
  ApiValidationErrorResponse,
  DiveWriteParticipation,
  DiveWriteRequest,
} from '@e-deep/shared';
import { BadRequestException } from '@nestjs/common';
import { diveWriteRequest } from '../../../../test/support/dive-write-request';
import { createValidationPipe } from '../../../common/validation/validation-pipe';
import { DiveWriteRequestDto } from './dive-write-request.dto';

const pipe = createValidationPipe();

/** Runs the global validation pipe on a body; `{}` when it passes. */
async function fieldErrorsOf(body: unknown): Promise<ApiFieldErrors> {
  try {
    await pipe.transform(body, { type: 'body', metatype: DiveWriteRequestDto });
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

/** A JSON body as sent on the wire, so fields can be removed or mistyped. */
type Body = Record<string, unknown>;

function bodyOf(request: DiveWriteRequest): Body {
  return JSON.parse(JSON.stringify(request)) as Body;
}

function withParticipation(participation: Partial<DiveWriteParticipation>): DiveWriteRequest {
  return diveWriteRequest({ participation });
}

/** Sets (or removes, for `undefined`) the field at `path` (`participation.maxDepthM`). */
function withField(path: string, value: unknown): Body {
  const body = bodyOf(diveWriteRequest());
  const keys = path.split('.');
  const last = keys.pop() ?? '';
  let parent = body as Record<string, unknown>;
  for (const key of keys) {
    parent = parent[key] as Record<string, unknown>;
  }
  if (value === undefined) {
    delete parent[last];
  } else {
    parent[last] = value;
  }
  return body;
}

describe('DiveWriteRequestDto', () => {
  it('accepts a valid request', async () => {
    expect(await fieldErrorsOf(bodyOf(diveWriteRequest()))).toEqual({});
  });

  it('accepts every bound of the CHECKs', async () => {
    const request = diveWriteRequest({
      event: {
        startedAt: '2026-04-09T10:05:00+14:00',
        utcOffsetMinutes: 840,
        airTemperatureC: -40,
        diveCenter: `  ${'c'.repeat(120)}  `,
        entryType: 'SHORE',
        timeOfDay: 'NIGHT',
        weather: 'RAIN',
        seaState: 'ROUGH',
        currentStrength: 'STRONG',
      },
      participation: {
        maxDepthM: 20,
        durationMin: 1440,
        waterTemperatureC: -5,
        visibilityM: 100,
        gasMix: 'OTHER',
        notes: '🐠'.repeat(5000),
        surfaceWaterTemperatureC: 45,
        safetyStopDurationMin: 60,
        safetyStopDepthM: 20,
        isRepetitive: true,
        o2Percent: 100,
        tankVolumeL: 30,
        tankMaterial: 'ALUMINIUM',
        startPressureBar: 350,
        endPressureBar: 350,
        suitType: 'SEMI_DRY',
        suitThicknessMm: 15,
        weightKg: 0,
      },
      observations: [
        { label: ` ${'m'.repeat(80)} `, count: 9999 },
        { label: 'Murène', count: 1 },
        { label: 'murène', count: null },
      ],
      buddies: [
        {
          id: '01900000-0000-7000-8000-000000000001',
          firstName: 'L'.repeat(100),
          lastName: 'B',
          levelCode: 'N3',
          isNew: true,
        },
      ],
      baseUpdatedAt: '2026-07-16T07:30:00.123Z',
    });

    expect(await fieldErrorsOf(bodyOf(request))).toEqual({});
  });

  it.each([
    ['participation.maxDepthM', 0, 'min'],
    ['participation.maxDepthM', 350.1, 'max'],
    ['participation.maxDepthM', 32.55, 'precision'],
    ['participation.maxDepthM', '32', 'type'],
    ['participation.durationMin', 0, 'min'],
    ['participation.durationMin', 1441, 'max'],
    ['participation.durationMin', 45.5, 'integer'],
    ['participation.waterTemperatureC', -5.1, 'min'],
    ['participation.waterTemperatureC', 45.1, 'max'],
    ['participation.waterTemperatureC', 18.25, 'precision'],
    ['participation.visibilityM', -1, 'min'],
    ['participation.visibilityM', 101, 'max'],
    ['participation.visibilityM', 10.5, 'integer'],
    ['participation.gasMix', 'NITROX40', 'in'],
    ['participation.hasDecompression', 'yes', 'type'],
    ['participation.stopsOk', 1, 'type'],
    ['participation.notes', 'n'.repeat(5001), 'length'],
    ['participation.notes', 'a\u0000b', 'invalid-character'],
    ['participation.surfaceWaterTemperatureC', -5.1, 'min'],
    ['participation.surfaceWaterTemperatureC', 45.1, 'max'],
    ['participation.isRepetitive', 'no', 'type'],
    ['participation.tankVolumeL', 0, 'min'],
    ['participation.tankVolumeL', 30.1, 'max'],
    ['participation.tankMaterial', 'IRON', 'in'],
    ['participation.startPressureBar', 0, 'min'],
    ['participation.startPressureBar', 351, 'max'],
    ['participation.endPressureBar', -1, 'min'],
    ['participation.endPressureBar', 351, 'max'],
    ['participation.suitType', 'SHORTY', 'in'],
    ['participation.suitThicknessMm', 0, 'min'],
    ['participation.suitThicknessMm', 15.1, 'max'],
    ['participation.weightKg', -0.1, 'min'],
    ['participation.weightKg', 40.1, 'max'],
    ['participation.weightKg', 4.25, 'precision'],
    ['event.id', 'abc', 'uuid'],
    ['event.siteId', 42, 'uuid'],
    ['event.startedAt', '2026-04-09T10:05:00', 'date-time'],
    ['event.startedAt', '2026-04-09', 'date-time'],
    ['event.startedAt', '2026-02-30T10:05:00+02:00', 'date-time'],
    ['event.startedAt', '2026-04-09T24:00:00Z', 'date-time'],
    ['event.startedAt', '2026-04-09T10:05:00.1234+02:00', 'date-time'],
    ['event.utcOffsetMinutes', 60.5, 'integer'],
    ['event.entryType', 'PIER', 'in'],
    ['event.timeOfDay', 'DUSK', 'in'],
    ['event.weather', 'SNOW', 'in'],
    ['event.seaState', 'FLAT', 'in'],
    ['event.currentStrength', 'HUGE', 'in'],
    ['event.airTemperatureC', -40.1, 'min'],
    ['event.airTemperatureC', 60.1, 'max'],
    ['event.diveCenter', '   ', 'length'],
    ['event.diveCenter', 'c'.repeat(121), 'length'],
    // `btrim` strips spaces only: a tab counts in the stored length.
    ['event.diveCenter', `\t${'c'.repeat(120)}`, 'length'],
    ['site.id', 'site-1', 'uuid'],
    ['site.name', '', 'length'],
    ['site.name', 's'.repeat(121), 'length'],
    ['site.isNew', 'true', 'type'],
    ['baseUpdatedAt', 'yesterday', 'date-time'],
    ['observations', 'Murène', 'type'],
    ['buddies', {}, 'type'],
    ['event', 'event', 'type'],
  ])('refuses %s = %j with %s', async (path, value, code) => {
    expect(await fieldErrorsOf(withField(path, value))).toEqual({ [path]: [code] });
  });

  describe('required fields (D-22)', () => {
    it.each([
      'event',
      'participation',
      'observations',
      'site',
      'buddies',
      'baseUpdatedAt',
      'event.weather',
      'event.startedAt',
      'participation.notes',
      'participation.maxDepthM',
      'site.isNew',
    ])('reports an absent %s as required, and only that', async (path) => {
      expect(await fieldErrorsOf(withField(path, undefined))).toEqual({ [path]: ['required'] });
    });

    it.each(['participation.maxDepthM', 'participation.gasMix', 'event.id', 'observations'])(
      'refuses null for %s, which is not nullable',
      async (path) => {
        expect(await fieldErrorsOf(withField(path, null))).toEqual({ [path]: ['required'] });
      },
    );

    it.each(['event.weather', 'participation.notes', 'participation.o2Percent', 'baseUpdatedAt'])(
      'accepts null for %s (not entered)',
      async (path) => {
        expect(await fieldErrorsOf(withField(path, null))).toEqual({});
      },
    );
  });

  describe('cross-field rules', () => {
    it('refuses half a safety stop, on the field that is set (RG-25)', async () => {
      expect(await fieldErrorsOf(bodyOf(withParticipation({ safetyStopDurationMin: 3 })))).toEqual({
        'participation.safetyStopDurationMin': ['pair'],
      });
      expect(await fieldErrorsOf(bodyOf(withParticipation({ safetyStopDepthM: 5 })))).toEqual({
        'participation.safetyStopDepthM': ['pair'],
      });
    });

    it('refuses a safety stop as long as the dive or deeper than it (RG-25)', async () => {
      const request = withParticipation({
        durationMin: 45,
        maxDepthM: 4.5,
        safetyStopDurationMin: 45,
        safetyStopDepthM: 5,
      });
      expect(await fieldErrorsOf(bodyOf(request))).toEqual({
        'participation.safetyStopDurationMin': ['before-duration'],
        'participation.safetyStopDepthM': ['above-max-depth'],
      });
    });

    it('refuses an O2 percentage outside the OTHER mix (RG-23)', async () => {
      expect(
        await fieldErrorsOf(bodyOf(withParticipation({ gasMix: 'AIR', o2Percent: 21 }))),
      ).toEqual({ 'participation.o2Percent': ['o2-other-only'] });
      expect(
        await fieldErrorsOf(bodyOf(withParticipation({ gasMix: 'OTHER', o2Percent: 0 }))),
      ).toEqual({ 'participation.o2Percent': ['min'] });
    });

    it('refuses an end pressure above the start one (RG-24), not without a start', async () => {
      expect(
        await fieldErrorsOf(
          bodyOf(withParticipation({ startPressureBar: 200, endPressureBar: 201 })),
        ),
      ).toEqual({ 'participation.endPressureBar': ['above-start-pressure'] });
      expect(await fieldErrorsOf(bodyOf(withParticipation({ endPressureBar: 50 })))).toEqual({});
    });

    it.each([
      ['2026-04-09T10:05:00Z', 0],
      ['2026-04-09T10:05:00+00:00', 0],
      ['2026-04-09T10:05:00-03:30', -210],
      ['2026-04-09T10:05:00.250+05:45', 345],
    ])('accepts %s with an offset of %i minutes', async (startedAt, utcOffsetMinutes) => {
      const request = diveWriteRequest({ event: { startedAt, utcOffsetMinutes } });
      expect(await fieldErrorsOf(bodyOf(request))).toEqual({});
    });

    it.each([
      ['2026-04-09T10:05:00+02:00', 60],
      ['2026-04-09T10:05:00Z', 120],
      ['2026-04-09T10:05:00-02:00', 120],
    ])(
      'refuses %s with an offset of %i minutes, on the offset',
      async (startedAt, utcOffsetMinutes) => {
        const request = diveWriteRequest({ event: { startedAt, utcOffsetMinutes } });
        expect(await fieldErrorsOf(bodyOf(request))).toEqual({
          'event.utcOffsetMinutes': ['matches-offset'],
        });
      },
    );

    it('refuses an offset beyond the CHECK bounds, even matching startedAt', async () => {
      const east = diveWriteRequest({
        event: { startedAt: '2026-04-09T10:05:00+14:01', utcOffsetMinutes: 841 },
      });
      const west = diveWriteRequest({
        event: { startedAt: '2026-04-09T10:05:00-12:01', utcOffsetMinutes: -721 },
      });
      expect(await fieldErrorsOf(bodyOf(east))).toEqual({ 'event.utcOffsetMinutes': ['max'] });
      expect(await fieldErrorsOf(bodyOf(west))).toEqual({ 'event.utcOffsetMinutes': ['min'] });
    });

    it('does not judge the offset against an invalid startedAt', async () => {
      expect(await fieldErrorsOf(withField('event.startedAt', '2026-04-09T10:05:00'))).toEqual({
        'event.startedAt': ['date-time'],
      });
    });

    it('does not judge a rule against a mistyped sibling (its own error is enough)', async () => {
      const body = withField('participation.durationMin', 'long');
      (body['participation'] as Record<string, unknown>)['safetyStopDurationMin'] = 3;
      (body['participation'] as Record<string, unknown>)['safetyStopDepthM'] = 5;

      expect(await fieldErrorsOf(body)).toEqual({ 'participation.durationMin': ['type'] });
    });
  });

  describe('lists', () => {
    it('refuses more than 50 observations', async () => {
      const observations = Array.from({ length: 51 }, (_, index) => ({
        label: `Espèce ${String(index)}`,
        count: null,
      }));
      expect(await fieldErrorsOf(bodyOf(diveWriteRequest({ observations })))).toEqual({
        observations: ['too-many'],
      });
    });

    it('accepts 50 buddies and refuses more', async () => {
      const buddiesOf = (count: number) =>
        Array.from({ length: count }, (_, index) => ({
          id: `01900000-0000-7000-8000-${index.toString(16).padStart(12, '0')}`,
          firstName: 'Lucas',
          lastName: 'Bernard',
          levelCode: null,
          isNew: false,
        }));
      expect(await fieldErrorsOf(bodyOf(diveWriteRequest({ buddies: buddiesOf(50) })))).toEqual({});
      expect(await fieldErrorsOf(bodyOf(diveWriteRequest({ buddies: buddiesOf(51) })))).toEqual({
        buddies: ['too-many'],
      });
    });

    it('refuses two labels equal once trimmed, keeping case apart (D-19)', async () => {
      const observations = [
        { label: 'Murène', count: null },
        { label: ' Murène ', count: 2 },
      ];
      expect(await fieldErrorsOf(bodyOf(diveWriteRequest({ observations })))).toEqual({
        observations: ['duplicate'],
      });
    });

    it('refuses the same buddy twice, whatever the case of its id', async () => {
      const buddy = {
        id: '01900000-0000-7000-8000-0000000000ab',
        firstName: 'Lucas',
        lastName: 'Bernard',
        levelCode: null,
        isNew: false,
      };
      const buddies = [buddy, { ...buddy, id: buddy.id.toUpperCase() }];
      expect(await fieldErrorsOf(bodyOf(diveWriteRequest({ buddies })))).toEqual({
        buddies: ['duplicate'],
      });
    });

    it('reports nested errors by index path', async () => {
      const observations = [
        { label: 'Murène', count: null },
        { label: 'Corb', count: null },
        { label: 'Mérou', count: null },
        { label: '', count: 0 },
      ];
      const buddies = [
        { id: '01900000-0000-7000-8000-0000000000ab', firstName: 'Lucas', isNew: true },
      ];
      const body = { ...bodyOf(diveWriteRequest({ observations })), buddies };

      expect(await fieldErrorsOf(body)).toEqual({
        'observations.3.label': ['length'],
        'observations.3.count': ['min'],
        'buddies.0.lastName': ['required'],
        'buddies.0.levelCode': ['required'],
      });
    });
  });

  it('refuses unknown properties, nested ones included', async () => {
    const body = bodyOf(diveWriteRequest());
    (body['participation'] as Record<string, unknown>)['participationId'] = 'x';
    body['deletedAt'] = null;

    expect(await fieldErrorsOf(body)).toEqual({
      deletedAt: ['unknown'],
      'participation.participationId': ['unknown'],
    });
  });

  it('never echoes the value received', async () => {
    const secret = 'Asthme sévère, traitement en cours';
    const body = withField('participation.notes', `${secret}${'x'.repeat(5000)}`);
    (body['event'] as Record<string, unknown>)['diveCenter'] = `${secret}${'y'.repeat(120)}`;

    const fieldErrors = await fieldErrorsOf(body);

    expect(fieldErrors).toEqual({
      'participation.notes': ['length'],
      'event.diveCenter': ['length'],
    });
    expect(JSON.stringify(fieldErrors)).not.toContain(secret);
  });

  it('turns the body into DTO instances', async () => {
    const request = diveWriteRequest({ observations: [{ label: 'Corb', count: null }] });

    const dto: unknown = await pipe.transform(bodyOf(request), {
      type: 'body',
      metatype: DiveWriteRequestDto,
    });

    expect(dto).toBeInstanceOf(DiveWriteRequestDto);
    expect(dto).toEqual(request);
  });
});
