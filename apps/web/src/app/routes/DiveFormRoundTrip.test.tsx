import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockFilledDiveDetail } from '@/features/dives/mocks/diveDetailResponse';
import { mockDiveLogResponse } from '@/features/dives/mocks/diveLogResponse';
import type { ApiClient } from '@/shared/lib/apiClient';
import { ApiClientContext } from '@/shared/lib/apiClientContext';
import { ToastProvider } from '@/shared/ui/Toast';
import { DiveDetailPage } from './DiveDetailPage';
import { DiveFormPage } from './DiveFormPage';

const DETAIL_PREFIX = 'dives/';

/** The log, and the filled detail of the mocked dives; a saved dive lives in the cache only. */
const get: ApiClient['get'] = vi.fn().mockImplementation((path: string) => {
  const id = path.slice(DETAIL_PREFIX.length);
  if (!path.startsWith(DETAIL_PREFIX)) return Promise.resolve(mockDiveLogResponse);
  return mockDiveLogResponse.dives.some((dive) => dive.id === id)
    ? Promise.resolve(mockFilledDiveDetail(id))
    : Promise.reject(new Error(`Unexpected request for ${id}`));
});

function renderApp() {
  const router = createMemoryRouter(
    [
      { path: '/dives/new', element: <DiveFormPage /> },
      { path: '/dives/:diveId', element: <DiveDetailPage /> },
      { path: '*', element: null },
    ],
    { initialEntries: ['/dives/new'] },
  );
  // Like the app (`staleTime` 60 s): the detail reads the dive the in-memory repository wrote,
  // without asking the API for it again.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: Infinity } },
  });
  render(
    <ApiClientContext value={{ get }}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </QueryClientProvider>
    </ApiClientContext>,
  );
  return router;
}

const field = (name: string | RegExp) => screen.getByLabelText<HTMLInputElement>(name);
const type = (name: string | RegExp, value: string) =>
  fireEvent.change(field(name), { target: { value } });
const radio = (group: string, option: string) =>
  within(screen.getByRole('radiogroup', { name: group })).getByRole('radio', { name: option });

beforeEach(() => {
  localStorage.clear();
  // jsdom does not scroll.
  Element.prototype.scrollIntoView = vi.fn();
});

// Every field of the form, saved through the in-memory repository (V1), then read on the detail.
// Not checked, being out of the dive model: the decompression stop lines, the surface interval and
// the level of a member (see each section below). The region and position of a site created by
// name are entered later, from the site sheet (spec).
describe('dive form → detail round trip', () => {
  // Fills about forty fields: longer than the default 5 s when the three apps test in parallel.
  it('shows on the detail every value entered in the form', { timeout: 20_000 }, async () => {
    const user = userEvent.setup();
    const router = renderApp();
    await screen.findByRole('form', { name: 'Nouvelle plongée' });

    // 1. L'essentiel. The logbook number is not saved: the API numbers the dives (D26).
    const site = screen.getByRole('combobox', { name: /^Site/ });
    fireEvent.change(site, { target: { value: 'Tombant des Américains' } });
    await user.click(screen.getByRole('option', { name: /Créer le site/ }));
    type(/^Date/, '2026-04-10');
    type(/^Immersion/, '21:12');
    type(/^Sortie/, '21:58');
    type(/^Profondeur max/, '23,4');

    // 2. Déroulé. Out of the model, so not checked: the decompression stop lines (D-16) and the
    // surface interval of a repetitive dive.
    await user.click(screen.getByRole('switch', { name: 'Palier de sécurité' }));
    type('Durée', '4');
    type('Profondeur', '5');
    await user.click(screen.getByRole('switch', { name: 'Paliers de décompression' }));
    await user.click(screen.getByRole('switch', { name: 'Paliers respectés' }));
    await user.click(screen.getByRole('switch', { name: 'Plongée successive' }));

    // 3. Palanquée. The level of a member is not checked: it belongs to the buddy's sheet, not
    // to the dive (D-21).
    await user.click(screen.getByRole('button', { name: 'Ajouter Lucas Bernard' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Ajouter un plongeur' }), {
      target: { value: 'Zoé Martin' },
    });
    await user.click(screen.getByRole('option', { name: /Ajouter « Zoé Martin »/ }));

    // 4. Équipement & gaz.
    await user.click(radio('Gaz', 'Nitrox'));
    type('% O₂', '36');
    type('Bloc', '15');
    await user.click(radio('Matériau', 'Alu'));
    type('Pression début', '210');
    type('Pression fin', '70');
    type('Combinaison', '5');
    await user.click(radio('Type', 'Semi-étanche'));
    type('Lest', '4,5');

    // 5. Conditions.
    await user.click(radio('Mise à l’eau', 'Bord'));
    await user.click(radio('Moment', 'Nuit'));
    type('Structure', 'Club des Américains');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Météo' }), 'Nuageux');
    type('Air', '19');
    await user.click(radio('Mer', 'Agitée'));
    await user.click(radio('Courant', 'Faible'));
    type('Eau surface', '18');
    type('Eau fond', '15');
    type('Visibilité', '12');

    // 6. Notes & observations.
    type('Notes', 'Poulpe dans la faille, murène au retour.');
    // A comma adds the text typed before it as a tag.
    type('Espèces observées', 'Poulpe commun,Murène,');

    await user.click(screen.getAllByRole('button', { name: 'Enregistrer la plongée' })[0] ?? site);
    await waitFor(() => expect(router.state.location.pathname).not.toBe('/dives/new'));

    // Header and KPI: site, number (#128, after #127 of 2026-04-09), date, entry, depth, duration,
    // exit (derived), temperatures, visibility, stops done, gas and entry type.
    await screen.findByRole('heading', { level: 1, name: 'Tombant des Américains' });
    const page = document.body.textContent ?? '';
    for (const text of [
      'Plongée #128',
      'ven. 10 avr. 2026 · 21:12',
      'Palier OK',
      'Nx 36',
      '23,4 mètres',
      '46 minutes',
      'Sortie à 21:58',
      '15 degrés au fond',
      'Surface 18 °C',
      '12 mètres de visibilité',
    ]) {
      expect(page).toContain(text);
    }

    const card = (name: RegExp) => screen.getByRole('region', { name }).textContent ?? '';
    const run = card(/^Déroulé/);
    expect(run).toContain('4 minutes à 5 mètres');
    expect(run).toMatch(/Paliers de déco\.Oui/);
    expect(run).toMatch(/SuccessiveOui/);

    const equipment = card(/^Équipement & gaz/);
    for (const text of [
      '36 % O₂',
      '15 litres, alu',
      '210 bars au début, 70 bars à la fin',
      '140 bar consommés',
      '5 millimètres, semi-étanche',
      '4,5 kilos',
    ]) {
      expect(equipment).toContain(text);
    }

    const conditions = card(/^Conditions/);
    for (const text of [
      'Bord · nuit',
      'Nuageux',
      'Air 19 °C',
      'Agitée',
      'Faible',
      '18 degrés en surface, 15 degrés au fond',
      'Club des Américains',
    ]) {
      expect(conditions).toContain(text);
    }

    const notes = card(/^Notes & observations/);
    expect(notes).toContain('Poulpe dans la faille, murène au retour.');
    expect(notes).toContain('Poulpe commun');
    expect(notes).toContain('Murène');

    const team = card(/^Palanquée/);
    expect(team).toContain('3 plongeurs');
    expect(team).toContain('Lucas Bernard');
    expect(team).toContain('Zoé Martin');

    // The site card reads the log: the saved dive is the deepest one here.
    expect(card(/^Site/)).toContain('23,4 mètres');
  });
});
