import type { DiveDetail, DiveLogResponse } from '@e-deep/shared';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { toSaveDiveInput } from '../form/convert';
import { editDiveValues, editTarget } from '../form/prefill';
import { mockFilledDiveDetail } from '../mocks/diveDetailResponse';
import { filledDive, validValues } from '../mocks/diveFormFixture';
import { mockDiveLogResponse } from '../mocks/diveLogResponse';
import { isDiveDetail, isDiveLogResponse } from './divesApi';
import { createInMemoryDiveRepository, renumber } from './inMemoryDiveRepository';
import { divesKeys } from './queryKeys';
import type { SaveDiveInput } from './saveDive';

const LEVEL = { agency: 'FFESSM', code: 'N2', label: 'Niveau 2' };
const NOW = new Date('2026-04-10T08:00:00.000Z');

function setup() {
  const queryClient = new QueryClient();
  queryClient.setQueryData(divesKeys.log(), structuredClone(mockDiveLogResponse));
  queryClient.setQueryData(divesKeys.detail('d127'), mockFilledDiveDetail('d127'));
  queryClient.setQueryData(divesKeys.detail('d1'), mockFilledDiveDetail('d1'));
  const saveDive = createInMemoryDiveRepository({ queryClient, diverLevel: LEVEL, now: () => NOW });
  const log = (): DiveLogResponse => {
    const data = queryClient.getQueryData(divesKeys.log());
    if (!isDiveLogResponse(data)) throw new Error('No log');
    return data;
  };
  const detail = (id: string): DiveDetail => {
    const data = queryClient.getQueryData(divesKeys.detail(id));
    if (!isDiveDetail(data)) throw new Error(`No detail ${id}`);
    return data;
  };
  return { queryClient, saveDive, log, detail };
}

const IDS = { eventId: 'new-event', newSiteId: 'new-site' };

function input(values = validValues({ date: '2026-04-09' })): SaveDiveInput {
  const result = toSaveDiveInput(values, { kind: 'create' }, IDS);
  if (result === null) throw new Error('Invalid values');
  return result;
}

describe('createInMemoryDiveRepository', () => {
  it('writes a new dive into the detail and log caches, numbered after the last one', async () => {
    const { saveDive, log, detail } = setup();
    const result = await saveDive(input());
    expect(result).toEqual({ ok: true, id: 'new-event', number: 128 });
    const saved = detail('new-event');
    expect(saved).toMatchObject({
      number: 128,
      depthMaxM: 18,
      durationMin: 44,
      diverLevel: LEVEL,
      createdAt: NOW.toISOString(),
    });
    expect(saved.site.name).toBe('Pointe de la Revellata');
    expect(log().dives[0]).toMatchObject({ id: 'new-event', number: 128 });
    expect(log().dives).toHaveLength(mockDiveLogResponse.dives.length + 1);
  });

  it('renumbers the later dives of an older dive, cached details included (D26)', async () => {
    const { saveDive, log, detail } = setup();
    const result = await saveDive(input(validValues({ date: '2000-01-01' })));
    expect(result).toEqual({ ok: true, id: 'new-event', number: 1 });
    expect(detail('new-event').number).toBe(1);
    expect(detail('d127').number).toBe(128);
    expect(detail('d1').number).toBe(2);
    expect(log().dives.at(-1)?.id).toBe('new-event');
  });

  it('creates a site typed by its name, without region nor position', async () => {
    const { saveDive, detail } = setup();
    await saveDive(input(validValues({ site: { id: null, name: 'Le Sec' } })));
    expect(detail('new-event').site).toEqual({
      id: 'new-site',
      name: 'Le Sec',
      locality: null,
      region: '',
      latitude: 0,
      longitude: 0,
      area: null,
    });
  });

  it('updates an edited dive in place, keeping its creation and level', async () => {
    const { saveDive, log, detail } = setup();
    const dive = filledDive();
    const values = { ...editDiveValues(dive), notes: 'Corrigé' };
    const update = toSaveDiveInput(values, editTarget(dive), IDS);
    if (update === null) throw new Error('Invalid values');
    expect(await saveDive(update)).toEqual({ ok: true, id: 'd127', number: 127 });
    expect(detail('d127')).toMatchObject({
      notes: 'Corrigé',
      number: 127,
      createdAt: dive.createdAt,
      updatedAt: NOW.toISOString(),
    });
    expect(log().dives).toHaveLength(mockDiveLogResponse.dives.length);
  });

  it('keeps the known level of a buddy chosen without one (contact level, D-21)', async () => {
    const { saveDive, detail } = setup();
    const lucas = { key: 'b1', id: 'b1', firstName: 'Lucas', lastName: 'Bernard' };
    await saveDive(input(validValues({ team: [{ ...lucas, level: '' }] })));
    expect(detail('new-event').buddies[0]?.level).toEqual({
      agency: 'FFESSM',
      code: 'N3',
      label: 'Niveau 3',
    });

    await saveDive(input(validValues({ team: [{ ...lucas, level: 'PA40' }] })));
    expect(detail('new-event').buddies[0]?.level).toEqual({
      agency: 'FFESSM',
      code: 'PA40',
      label: 'Plongeur autonome 40 m',
    });
  });

  it('rejects a site that is no longer in the log, as a field error', async () => {
    const { saveDive } = setup();
    const result = await saveDive(
      input(validValues({ site: { id: 'gone', name: 'Ancien site' } })),
    );
    expect(result).toEqual({
      ok: false,
      fieldErrors: { site: 'Ce site n’est plus dans ton carnet. Choisis-le à nouveau ou crée-le.' },
    });
  });

  it('fails without a loaded log', async () => {
    const saveDive = createInMemoryDiveRepository({
      queryClient: new QueryClient(),
      diverLevel: LEVEL,
    });
    await expect(saveDive(input())).rejects.toThrow('The dive log is not loaded.');
  });
});

describe('renumber', () => {
  it('ranks by start instant, then id, latest first', () => {
    const [first] = mockDiveLogResponse.dives;
    if (!first) throw new Error('Empty log');
    const at = (id: string, date: string) => ({ ...first, id, date, number: 0 });
    expect(
      renumber([
        at('b', '2026-01-01T10:00:00+01:00'),
        at('a', '2026-01-01T10:00:00+01:00'),
        at('c', '2026-01-01T08:00:00+00:00'),
      ]).map(({ id, number }) => [id, number]),
    ).toEqual([
      ['b', 3],
      ['a', 2],
      ['c', 1],
    ]);
  });
});
