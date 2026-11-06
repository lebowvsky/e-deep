import type { HealthResponse } from '@e-deep/shared';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createApiClient } from '@/shared/lib/apiClient';
import { ApiClientContext } from '@/shared/lib/apiClientContext';
import { HealthCard } from './HealthCard';

const OK: HealthResponse = { status: 'ok', database: 'up', timestamp: '2026-11-06T12:00:00.000Z' };
const DEGRADED: HealthResponse = { ...OK, status: 'degraded', database: 'down' };

function stubFetch(...responses: (() => Response)[]) {
  const fetchMock = vi.fn<typeof fetch>();
  for (const response of responses) {
    fetchMock.mockImplementationOnce(() => Promise.resolve(response()));
  }
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/**
 * Runs `update` in an async `act` scope: React 19 only retries a suspended render
 * (and flushes the settled promise) when the act scope is awaited.
 */
async function actAsync(update: () => void) {
  await act(() => {
    update();
    return Promise.resolve();
  });
}

async function renderCard() {
  const client = createApiClient({ baseUrl: 'http://api.test/api' });
  await actAsync(() => {
    render(
      <ApiClientContext value={client}>
        <HealthCard />
      </ApiClientContext>,
    );
  });
}

function getRowValue(term: string): string | null {
  return screen.getByText(term).nextElementSibling?.textContent ?? null;
}

describe('HealthCard', () => {
  it('shows a loading status, then an operational API with the database up', async () => {
    let resolveResponse: (response: Response) => void = () => undefined;
    const pendingResponse = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    const fetchMock = vi.fn<typeof fetch>(() => pendingResponse);
    vi.stubGlobal('fetch', fetchMock);
    await renderCard();

    expect(screen.getByRole('region', { name: 'API status' })).toBeDefined();
    expect(screen.getByRole('status').textContent).toBe('Checking the API…');

    await actAsync(() => {
      resolveResponse(Response.json(OK));
    });

    expect(getRowValue('API')).toBe('Operational');
    expect(getRowValue('Database')).toBe('Up');
    expect(fetchMock.mock.calls[0]?.[0]).toEqual(new URL('http://api.test/api/health'));
  });

  it('shows a degraded API with the database down, after a refresh', async () => {
    const fetchMock = stubFetch(
      () => Response.json(OK),
      () => Response.json(DEGRADED),
    );
    await renderCard();

    const refresh = await screen.findByRole('button', { name: 'Refresh' });
    await actAsync(() => {
      fireEvent.click(refresh);
    });

    expect(await screen.findByText('Degraded')).toBeDefined();
    expect(getRowValue('Database')).toBe('Down');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shows an alert when the API fails, and recovers on retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    stubFetch(
      () => new Response(null, { status: 503 }),
      () => Response.json(OK),
    );
    await renderCard();

    expect((await screen.findByRole('alert')).textContent).toContain(
      'The API answered with HTTP 503.',
    );

    await actAsync(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });

    expect(await screen.findByText('Operational')).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
