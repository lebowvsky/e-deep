import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockFilledDiveDetail } from '@/features/dives/mocks/diveDetailResponse';
import { mockDiveLogResponse } from '@/features/dives/mocks/diveLogResponse';
import { ApiError, type ApiClient } from '@/shared/lib/apiClient';
import { TestProviders } from '@/test/TestProviders';
import { DiveFormPage } from './DiveFormPage';

const DETAIL_PREFIX = 'dives/';

/** Answers like the API: the log on `dives`, the filled detail of any mocked dive on `dives/:id`. */
function apiLike(): ApiClient['get'] {
  return vi
    .fn()
    .mockImplementation((path: string) =>
      Promise.resolve(
        path.startsWith(DETAIL_PREFIX)
          ? mockFilledDiveDetail(path.slice(DETAIL_PREFIX.length))
          : mockDiveLogResponse,
      ),
    );
}

function Location() {
  const { pathname } = useLocation();
  return <output data-testid="location">{pathname}</output>;
}

function renderAt(path: string) {
  render(
    <TestProviders client={{ get: apiLike() }}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/dives/new" element={<DiveFormPage />} />
          <Route path="/dives/:diveId/edit" element={<DiveFormPage />} />
          <Route path="*" element={null} />
        </Routes>
        <Location />
      </MemoryRouter>
    </TestProviders>,
  );
}

/** The form itself (named by its h1), once the log and the source dive are loaded. */
const title = (name: string) => screen.findByRole('form', { name });
const siteField = () => screen.getByRole<HTMLInputElement>('combobox', { name: /^Site/ });
const field = (name: string | RegExp) => screen.getByLabelText<HTMLInputElement>(name);
const sectionLink = (name: RegExp) =>
  within(screen.getByRole('navigation', { name: 'Sections du formulaire' })).getByRole('link', {
    name,
  });

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('DiveFormPage — new dive', () => {
  it('opens on the next number and today, without suggestion past 48 h', async () => {
    renderAt('/dives/new');

    await title('Nouvelle plongée');
    expect(screen.getByText('Carnet · plongée #128')).toBeTruthy();
    expect(field('N° de plongée').value).toBe('128');
    expect(screen.queryByRole('button', { name: 'Reprendre' })).toBeNull();
    expect(screen.queryByText(/Prérempli depuis/)).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Enregistrer la plongée' })).toHaveLength(2);
    await waitFor(() => expect(document.title).toBe('Nouvelle plongée · E-Deep'));
  });

  it('suggests the latest dive under 48 h and takes its team, kit and conditions', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-04-09T09:00:00+02:00'));
    const user = userEvent.setup();
    renderAt('/dives/new');

    const resume = await screen.findByRole('button', { name: 'Reprendre' });
    expect(
      screen.getByText(/Reprendre la palanquée, l’équipement et les conditions de/),
    ).toBeTruthy();
    expect(field('Structure').value).toBe('');

    await user.click(resume);
    expect(field('Structure').value).toBe('Calvi Plongée');
    expect(field('Bloc').value).toBe('12');
    // The site and the times stay the diver's to enter.
    expect(siteField().value).toBe('');
    expect(screen.queryByRole('button', { name: 'Reprendre' })).toBeNull();
  });

  it('links the duration and the times both ways', async () => {
    renderAt('/dives/new');
    await title('Nouvelle plongée');

    fireEvent.change(field(/^Immersion/), { target: { value: '10:05' } });
    fireEvent.change(field(/^Sortie/), { target: { value: '10:49' } });
    expect(field(/^Durée/).value).toBe('44');

    fireEvent.change(field(/^Durée/), { target: { value: '50' } });
    expect(field(/^Sortie/).value).toBe('10:55');
  });

  it('saves with Ctrl + Entrée: blocked, it lists the fields to fix and focuses the first', async () => {
    const user = userEvent.setup();
    renderAt('/dives/new');
    await title('Nouvelle plongée');

    await user.click(field('N° de plongée'));
    await user.keyboard('{Control>}{Enter}{/Control}');

    const summary = await screen.findByRole('alert');
    expect(within(summary).getByText('5 champs à corriger')).toBeTruthy();
    const links = within(summary).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      'Site',
      'Immersion',
      'Sortie',
      'Durée',
      'Profondeur max',
    ]);
    expect(document.activeElement).toBe(siteField());

    await user.click(within(summary).getByRole('link', { name: 'Profondeur max' }));
    expect(document.activeElement).toBe(field(/^Profondeur max/));
  });

  it('shows the state of each section in the summary', async () => {
    renderAt('/dives/new');
    await title('Nouvelle plongée');

    expect(sectionLink(/^L’essentiel, partielle, il manque Site$/)).toBeTruthy();
    expect(sectionLink(/^Palanquée, vide$/)).toBeTruthy();

    fireEvent.change(field('Notes'), { target: { value: 'Mérou sous la voûte' } });
    expect(sectionLink(/^Notes & observations, partielle, il manque Espèces$/)).toBeTruthy();
    expect(sectionLink(/^Notes & observations/).getAttribute('href')).toBe('#dive-section-notes');
  });
});

describe('DiveFormPage — duplicate', () => {
  it('takes the site, team, kit and conditions of the source, never its times', async () => {
    renderAt('/dives/new?from=d127');

    await title('Nouvelle plongée');
    expect(await screen.findByText(/Prérempli depuis/)).toBeTruthy();
    expect(screen.getByText(/palanquée, équipement et conditions repris/)).toBeTruthy();
    expect(siteField().value).toBe('Pointe de la Revellata');
    expect(field('N° de plongée').value).toBe('128');
    expect(field('Structure').value).toBe('Calvi Plongée');
    for (const name of [/^Immersion/, /^Sortie/, /^Durée/, /^Profondeur max/]) {
      expect(field(name).value).toBe('');
    }
    expect(screen.getByRole('button', { name: 'Retirer Lucas Bernard' })).toBeTruthy();
    expect(sectionLink(/^Équipement & gaz, partielle, il manque Pression fin$/)).toBeTruthy();
  });

  it('starts again from a blank dive with « Repartir de zéro »', async () => {
    const user = userEvent.setup();
    renderAt('/dives/new?from=d127');

    await user.click(await screen.findByRole('button', { name: 'Repartir de zéro' }));
    expect(siteField().value).toBe('');
    expect(field('Structure').value).toBe('');
    expect(screen.queryByText(/Prérempli depuis/)).toBeNull();
  });
});

describe('DiveFormPage — edit', () => {
  it('shows the dive values, without banner, and saves back to the detail', async () => {
    const user = userEvent.setup();
    renderAt('/dives/d127/edit');

    await title('Modifier la plongée #127');
    expect(screen.getByText('Carnet · plongée #127')).toBeTruthy();
    expect(screen.queryByText(/Prérempli depuis/)).toBeNull();
    expect(field(/^Immersion/).value).toBe('10:30');
    expect(field(/^Sortie/).value).toBe('11:08');
    expect(field('Pression fin').value).toBe('60');
    const saves = screen.getAllByRole('button', { name: 'Enregistrer les modifications' });
    expect(saves).toHaveLength(2);

    await user.click(saves[0] ?? document.body);
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/dives/d127'));
  });

  it('says when the dive does not exist', async () => {
    const get = vi
      .fn()
      .mockImplementation((path: string) =>
        path.startsWith(DETAIL_PREFIX)
          ? Promise.reject(new ApiError('http', 'HTTP 404', { status: 404 }))
          : Promise.resolve(mockDiveLogResponse),
      );
    render(
      <TestProviders client={{ get }}>
        <MemoryRouter initialEntries={['/dives/unknown/edit']}>
          <Routes>
            <Route path="/dives/:diveId/edit" element={<DiveFormPage />} />
          </Routes>
        </MemoryRouter>
      </TestProviders>,
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: /n’existe pas ou a été supprimée/ }),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Retour à mes plongées' })).toBeTruthy();
  });
});
