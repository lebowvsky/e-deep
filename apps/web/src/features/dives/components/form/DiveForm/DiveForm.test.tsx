import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaveDive, SaveDiveResult } from '../../../api/saveDive';
import { EMPTY_SECTION_SUMMARY } from '../../../form/derived';
import type { DiveFormValues } from '../../../form/model';
import { duplicateDiveValues, editDiveValues, editTarget } from '../../../form/prefill';
import { CONTEXT, filledDive, formSourcesOf, validValues } from '../../../mocks/diveFormFixture';
import { mockDives } from '../../../mocks/dives';
import { MOCK_SITES } from '@/shared/sites/mocks/sites';
import { LOCKED_EVENT_HINT } from '../fieldBinding';
import { DiveForm, type DiveFormProps } from './DiveForm';

const NO_DRAFT: DiveFormProps['draftStore'] = {
  load: () => Promise.resolve(null),
  save: () => Promise.resolve(),
  clear: () => Promise.resolve(),
};

interface RenderOptions {
  initialValues?: DiveFormValues;
  saveDive?: SaveDive;
  canEditEvent?: boolean;
  draftStore?: DiveFormProps['draftStore'];
  onCreateSite?: DiveFormProps['onCreateSite'];
  sources?: DiveFormProps['sources'];
}

/** A new dive (#128) in a data router: `/dives` is where « Annuler » leads. */
function renderNew({
  initialValues = validValues(),
  saveDive = vi.fn<SaveDive>(),
  canEditEvent = true,
  draftStore = NO_DRAFT,
  onCreateSite = vi.fn<DiveFormProps['onCreateSite']>(),
  sources = formSourcesOf(mockDives),
}: RenderOptions = {}) {
  const onSaved = vi.fn<(id: string, number: number) => void>();
  const form = (
    <DiveForm
      mode={{ kind: 'new' }}
      initialValues={initialValues}
      target={{ kind: 'create' }}
      context={CONTEXT}
      sources={sources}
      log={mockDives}
      self={{ firstName: 'Marine', lastName: 'Rousseau', level: 'N2' }}
      prefill={{ kind: 'none' }}
      canEditEvent={canEditEvent}
      saveDive={saveDive}
      draftStore={draftStore}
      cancelHref="/dives"
      onSaved={onSaved}
      onCreateSite={onCreateSite}
    />
  );
  const router = createMemoryRouter(
    [
      { path: '/dives/new', element: form },
      { path: '/dives', element: <h1>Mes plongées</h1> },
      { path: '/dives/:diveId', element: <h1>Plongée</h1> },
    ],
    { initialEntries: ['/dives', '/dives/new'], initialIndex: 1 },
  );
  render(<RouterProvider router={router} />);
  return { router, onSaved };
}

/** jsdom has no `matchMedia`: a phone (< 768px) matches the `max-width` query of the accordion. */
function stubPhone() {
  vi.stubGlobal('matchMedia', (query: string): Partial<MediaQueryList> => ({
    matches: query.includes('max-width'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

const sectionToggle = (name: RegExp) => screen.getByRole('button', { name });
const saveButton = () =>
  screen.getAllByRole('button', { name: /^Enregistrer/ })[0] ?? document.body;
const input = (name: RegExp) => screen.getByLabelText<HTMLInputElement>(name);

// jsdom does not scroll.
const scrollIntoView = vi.fn();

beforeEach(() => {
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DiveForm — phone accordion', () => {
  it('folds sections 2 to 6, each with its summary and state', async () => {
    stubPhone();
    const user = userEvent.setup();
    renderNew();

    // « L'essentiel » is never folded.
    expect(screen.queryByRole('button', { name: /L’essentiel/ })).toBeNull();
    const notes = sectionToggle(/^Notes & observations/);
    expect(notes.getAttribute('aria-expanded')).toBe('false');
    expect(notes.textContent).toContain(EMPTY_SECTION_SUMMARY);
    expect(notes.textContent).toContain('vide');
    const content = document.getElementById(notes.getAttribute('aria-controls') ?? '');
    expect(content?.hidden).toBe(true);

    await user.click(notes);
    expect(notes.getAttribute('aria-expanded')).toBe('true');
    expect(content?.hidden).toBe(false);
    expect(screen.getByRole('textbox', { name: 'Notes' })).toBeTruthy();

    await user.click(notes);
    expect(notes.getAttribute('aria-expanded')).toBe('false');
    expect(content?.hidden).toBe(true);
  });

  it('keeps a duplicated dive folded, with the summaries filled', () => {
    stubPhone();
    renderNew({
      initialValues: duplicateDiveValues(filledDive(), { today: CONTEXT.today }),
    });

    const team = sectionToggle(/^Palanquée/);
    expect(team.getAttribute('aria-expanded')).toBe('false');
    expect(team.textContent).toContain('Lucas Bernard');
    expect(sectionToggle(/^Équipement & gaz/).textContent).not.toContain(EMPTY_SECTION_SUMMARY);
  });

  it('leaves every section open from the tablet', () => {
    renderNew();
    expect(screen.queryByRole('button', { name: /^Notes & observations/ })).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Notes' })).toBeTruthy();
  });
});

describe('DiveForm — errors', () => {
  it('opens a folded section that holds an error, then focuses the field', async () => {
    stubPhone();
    const user = userEvent.setup();
    const saveDive = vi.fn<SaveDive>();
    renderNew({ initialValues: validValues({ gas: 'NITROX', o2Percent: '' }), saveDive });

    await user.click(saveButton());

    const summary = screen.getByRole('alert');
    expect(within(summary).getByText('1 champ à corriger')).toBeTruthy();
    expect(sectionToggle(/^Équipement & gaz/).getAttribute('aria-expanded')).toBe('true');
    const o2 = input(/^% O₂/);
    expect(document.activeElement).toBe(o2);
    expect(o2.getAttribute('aria-invalid')).toBe('true');
    const message = document.getElementById(
      o2.getAttribute('aria-describedby')?.split(' ')[0] ?? '',
    );
    expect(message?.textContent).toMatch(/Nitrox/);
    expect(scrollIntoView).toHaveBeenCalled();
    expect(saveDive).not.toHaveBeenCalled();
  });

  it('opens the section of a summary link', async () => {
    stubPhone();
    const user = userEvent.setup();
    renderNew({ initialValues: validValues({ gas: 'NITROX', o2Percent: '' }) });

    await user.click(saveButton());
    const equipment = sectionToggle(/^Équipement & gaz/);
    await user.click(equipment);
    expect(equipment.getAttribute('aria-expanded')).toBe('false');

    await user.click(within(screen.getByRole('alert')).getByRole('link', { name: '% O₂' }));
    expect(equipment.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(input(/^% O₂/));
  });

  it('says when the save fails unexpectedly, and keeps the values', async () => {
    const report = vi.fn();
    vi.stubGlobal('reportError', report);
    const user = userEvent.setup();
    const failure = new Error('network down');
    renderNew({ saveDive: vi.fn<SaveDive>().mockRejectedValue(failure) });

    await user.click(saveButton());

    expect((await screen.findByRole('alert')).textContent).toMatch(/n’a pas abouti/);
    expect(report).toHaveBeenCalledWith(failure);
    expect(input(/^Profondeur max/).value).toBe('18');
  });
});

describe('DiveForm — save', () => {
  it('shows « Enregistrement… » and sends once on a double click', async () => {
    const user = userEvent.setup();
    let settle: (result: SaveDiveResult) => void = () => undefined;
    const saveDive = vi.fn<SaveDive>(
      () =>
        new Promise((resolve) => {
          settle = resolve;
        }),
    );
    const { onSaved } = renderNew({ saveDive });

    await user.dblClick(saveButton());

    expect(saveDive).toHaveBeenCalledTimes(1);
    const busy = screen.getAllByRole('button', { name: 'Enregistrement…' });
    expect(busy).toHaveLength(2);
    for (const button of busy) {
      expect(button.getAttribute('aria-busy')).toBe('true');
      // Still focusable: the focus is not dropped to the page while saving.
      expect(button.getAttribute('aria-disabled')).toBe('true');
      expect((button as HTMLButtonElement).disabled).toBe(false);
    }

    settle({ ok: true, id: 'd128', number: 128 });
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('d128', 128));
  });

  it('never saves on Entrée alone in a field: only the button or Ctrl/⌘ + Entrée do', async () => {
    const user = userEvent.setup();
    const saveDive = vi.fn<SaveDive>().mockResolvedValue({ ok: true, id: 'd128', number: 128 });
    renderNew({ saveDive });

    await user.type(input(/^Profondeur max/), '{Enter}');
    await user.type(input(/^Pression début/), '200{Enter}');
    expect(saveDive).not.toHaveBeenCalled();

    await user.keyboard('{Control>}{Enter}{/Control}');
    await waitFor(() => expect(saveDive).toHaveBeenCalledTimes(1));
  });

  it('saves the species still typed in its field with Ctrl + Entrée', async () => {
    const user = userEvent.setup();
    const saveDive = vi.fn<SaveDive>().mockResolvedValue({ ok: true, id: 'd128', number: 128 });
    renderNew({ saveDive });

    await user.type(screen.getByRole('textbox', { name: /^Espèces observées/ }), 'Mérou brun');
    await user.keyboard('{Control>}{Enter}{/Control}');

    await waitFor(() => expect(saveDive).toHaveBeenCalledTimes(1));
    expect(saveDive.mock.calls[0]?.[0].observations).toEqual([
      { label: 'Mérou brun', count: null },
    ]);
  });
});

describe('DiveForm — logbook number (D26)', () => {
  it('shows the number the dive will have, read only, and follows the date', () => {
    renderNew();

    const number = input(/^N° de plongée/);
    expect(number.readOnly).toBe(true);
    expect(number.value).toBe('128');
    expect(screen.getByText('Calculé selon la date')).toBeTruthy();
    expect(screen.getByText('Carnet · plongée #128')).toBeTruthy();

    fireEvent.change(input(/^Date/), { target: { value: '2000-01-01' } });
    expect(number.value).toBe('1');
    expect(screen.getByText('Carnet · plongée #1')).toBeTruthy();
    expect(screen.getByText(/^#1 · /)).toBeTruthy();
  });
});

describe('DiveForm — site', () => {
  it('says that a name none of my sites has will create a site', async () => {
    const user = userEvent.setup();
    renderNew({ initialValues: validValues({ site: { id: null, name: '' } }) });

    await user.type(screen.getByRole('combobox', { name: /^Site/ }), 'Revel');
    expect(screen.getByText('Nouveau site : il sera créé à l’enregistrement.')).toBeTruthy();
  });
});

describe('DiveForm — quick site creation', () => {
  const siteBox = () => screen.getByRole<HTMLInputElement>('combobox', { name: /^Site/ });
  const panel = () => screen.getByRole('dialog', { name: 'Nouveau site' });

  /** Types a name none of my sites has, then picks « Créer le site » with Entrée. */
  async function openPanel(user: ReturnType<typeof userEvent.setup>, name: string) {
    await user.type(siteBox(), name);
    await user.keyboard('{Enter}');
    return panel();
  }

  it('creates the site from the name typed, selects it and moves on to the date', async () => {
    const user = userEvent.setup();
    const onCreateSite = vi.fn<DiveFormProps['onCreateSite']>((draft) =>
      Promise.resolve({ id: 'local-site', name: draft.name }),
    );
    renderNew({ initialValues: validValues({ site: { id: null, name: '' } }), onCreateSite });

    const dialog = await openPanel(user, 'Grotte aux Corbs');
    const name = within(dialog).getByRole<HTMLInputElement>('textbox', { name: /^Nom/ });
    expect(name.value).toBe('Grotte aux Corbs');
    expect(document.activeElement).toBe(name);
    // The region of the latest dive (#127, Revellata), said so.
    expect(within(dialog).getByRole<HTMLInputElement>('combobox', { name: 'Région' }).value).toBe(
      'Calvi · Corse',
    );
    expect(within(dialog).getByText('Comme ta dernière plongée · modifiable')).toBeTruthy();
    expect(
      within(dialog).getByText(
        'Tu pourras placer le site sur la carte plus tard, depuis la page Carte.',
      ),
    ).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: 'Grotte' }));
    await user.click(within(dialog).getByRole('button', { name: 'Créer et sélectionner' }));

    expect(onCreateSite).toHaveBeenCalledWith({
      name: 'Grotte aux Corbs',
      region: 'Calvi · Corse',
      type: 'grotte',
      depthMinM: null,
      depthMaxM: null,
      position: null,
      accessNotes: null,
    });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Nouveau site' })).toBeNull());
    expect(siteBox().value).toBe('Grotte aux Corbs');
    expect(document.activeElement).toBe(input(/^Date/));
  });

  it('wants a name', async () => {
    const user = userEvent.setup();
    const onCreateSite = vi.fn<DiveFormProps['onCreateSite']>();
    renderNew({ initialValues: validValues({ site: { id: null, name: '' } }), onCreateSite });

    const dialog = await openPanel(user, 'Grotte aux Corbs');
    await user.clear(within(dialog).getByRole('textbox', { name: /^Nom/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Créer et sélectionner' }));

    expect(within(dialog).getByText('Donne un nom au site.')).toBeTruthy();
    expect(onCreateSite).not.toHaveBeenCalled();
  });

  it('offers a close site instead of a duplicate', async () => {
    const user = userEvent.setup();
    const onCreateSite = vi.fn<DiveFormProps['onCreateSite']>();
    renderNew({ initialValues: validValues({ site: { id: null, name: '' } }), onCreateSite });

    // A typo: the combobox lists the Revellata, the diver asks for a new site all the same.
    await user.type(siteBox(), 'Pointe Revelata');
    expect(screen.getByRole('option', { name: /Pointe de la Revellata/ })).toBeTruthy();
    await user.click(screen.getByRole('option', { name: /Créer le site/ }));
    const status = within(panel()).getByRole('status');
    expect(status.textContent).toContain('Un site proche existe : Pointe de la Revellata');

    await user.click(within(status).getByRole('button', { name: 'Utiliser celui-ci' }));

    expect(screen.queryByRole('dialog', { name: 'Nouveau site' })).toBeNull();
    expect(siteBox().value).toBe('Pointe de la Revellata');
    expect(screen.getByText('Tes sites, ou un nouveau site créé à la volée.')).toBeTruthy();
    expect(document.activeElement).toBe(input(/^Date/));
    expect(onCreateSite).not.toHaveBeenCalled();
  });

  it('closes on Échap or « Annuler » without creating anything, back to the site field', async () => {
    const user = userEvent.setup();
    const onCreateSite = vi.fn<DiveFormProps['onCreateSite']>();
    renderNew({ initialValues: validValues({ site: { id: null, name: '' } }), onCreateSite });

    await openPanel(user, 'Grotte aux Corbs');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Nouveau site' })).toBeNull();
    expect(document.activeElement).toBe(siteBox());

    await user.keyboard('{ArrowDown}{Enter}');
    await user.click(within(panel()).getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByRole('dialog', { name: 'Nouveau site' })).toBeNull();
    expect(document.activeElement).toBe(siteBox());
    expect(onCreateSite).not.toHaveBeenCalled();
  });

  it('opens as a modal bottom sheet on phones', async () => {
    stubPhone();
    const user = userEvent.setup();
    renderNew({ initialValues: validValues({ site: { id: null, name: '' } }) });

    const sheet = await openPanel(user, 'Grotte aux Corbs');
    expect(sheet.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(within(sheet).getByRole('textbox', { name: /^Nom/ }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Nouveau site' })).toBeNull();
  });
});

describe('DiveForm — site merged on this device', () => {
  it('sends a site of the API log as known, even once merged locally', async () => {
    const user = userEvent.setup();
    const saveDive = vi.fn<SaveDive>(() => Promise.resolve({ ok: true, id: 'd128', number: 128 }));
    // La Pointe de la Revellata (s01) merged into La Bibliothèque (s02) here: not in the choices.
    const sources = formSourcesOf(mockDives, {
      saved: new Map([['s02', MOCK_SITES.bibliotheque]]),
      removed: new Set(['s01']),
      mergedInto: new Map([['s01', 's02']]),
    });
    expect(sources.sites.some(({ id }) => id === 's01')).toBe(false);
    renderNew({ saveDive, sources });

    await user.click(saveButton());

    await waitFor(() => expect(saveDive).toHaveBeenCalledOnce());
    // Still a site of the API: never « new » (the API would refuse or duplicate it).
    expect(saveDive.mock.calls[0]?.[0].contacts.site).toEqual({
      id: 's01',
      name: 'Pointe de la Revellata',
      isNew: false,
    });
  });
});

describe('DiveForm — removing a row', () => {
  it('keeps the focus in the form when a member or a stop is removed', async () => {
    const user = userEvent.setup();
    renderNew();

    await user.click(screen.getByRole('button', { name: 'Ajouter Lucas Bernard' }));
    await user.click(screen.getByRole('button', { name: 'Retirer Lucas Bernard' }));
    expect(screen.queryByRole('button', { name: 'Retirer Lucas Bernard' })).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('combobox', { name: 'Ajouter un plongeur' }),
    );

    await user.click(screen.getByRole('switch', { name: 'Paliers de décompression' }));
    await user.click(screen.getByRole('button', { name: 'Ajouter un palier' }));
    await user.click(screen.getByRole('button', { name: 'Retirer le palier 1' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Ajouter un palier' }));
  });
});

describe('DiveForm — leaving', () => {
  it('asks before leaving with unsaved changes: Rester stays, Quitter leaves', async () => {
    const user = userEvent.setup();
    const save = vi.fn<DiveFormProps['draftStore']['save']>(() => Promise.resolve());
    const { router } = renderNew({ draftStore: { ...NO_DRAFT, save } });

    await user.clear(input(/^Profondeur max/));
    await user.type(input(/^Profondeur max/), '22');
    await user.click(screen.getAllByRole('link', { name: 'Annuler' })[0] ?? document.body);

    const dialog = screen.getByRole('alertdialog', { name: 'Quitter sans enregistrer ?' });
    expect(dialog.textContent).toContain('Ton brouillon reste disponible sur cet appareil.');
    await user.click(within(dialog).getByRole('button', { name: 'Rester' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(router.state.location.pathname).toBe('/dives/new');

    // The back button too.
    await act(() => router.navigate(-1));
    const again = screen.getByRole('alertdialog', { name: 'Quitter sans enregistrer ?' });
    await user.click(within(again).getByRole('button', { name: 'Quitter' }));
    expect(router.state.location.pathname).toBe('/dives');
    // « Ton brouillon reste disponible »: written on leaving, even within the draft delay.
    expect(save.mock.lastCall?.[1].values.maxDepthM).toBe('22');
  });

  it('does not save with Ctrl + Entrée while asking to leave', async () => {
    const user = userEvent.setup();
    const saveDive = vi.fn<SaveDive>().mockResolvedValue({ ok: true, id: 'd128', number: 128 });
    renderNew({ saveDive });

    await user.type(screen.getByRole('textbox', { name: 'Notes' }), 'Mérou');
    await user.click(screen.getAllByRole('link', { name: 'Annuler' })[0] ?? document.body);
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    await user.keyboard('{Control>}{Enter}{/Control}');

    expect(saveDive).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeTruthy();
  });

  it('leaves at once without changes', async () => {
    const user = userEvent.setup();
    const { router } = renderNew();

    await user.click(screen.getAllByRole('link', { name: 'Annuler' })[0] ?? document.body);

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(router.state.location.pathname).toBe('/dives');
  });

  it('asks the browser before closing the tab with unsaved changes', async () => {
    const user = userEvent.setup();
    renderNew();
    const closeTab = () => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(closeTab()).toBe(false);

    await user.type(input(/^Profondeur max/), '5');
    expect(closeTab()).toBe(true);
  });

  it('does not ask after a successful save', async () => {
    const user = userEvent.setup();
    const saveDive = vi.fn<SaveDive>().mockResolvedValue({ ok: true, id: 'd128', number: 128 });
    const { router, onSaved } = renderNew({ saveDive });
    onSaved.mockImplementation((id) => void router.navigate(`/dives/${id}`, { replace: true }));

    await user.clear(input(/^Profondeur max/));
    await user.type(input(/^Profondeur max/), '22');
    await user.click(saveButton());

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('d128', 128));
    await waitFor(() => expect(router.state.location.pathname).toBe('/dives/d128'));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});

describe('DiveForm — shared event', () => {
  function renderEdit({ canEditEvent }: { canEditEvent: boolean }) {
    const dive = filledDive();
    const router = createMemoryRouter([
      {
        path: '/',
        element: (
          <DiveForm
            mode={{ kind: 'edit', diveId: dive.id }}
            initialValues={editDiveValues(dive)}
            target={editTarget(dive)}
            context={CONTEXT}
            sources={formSourcesOf(mockDives)}
            log={mockDives}
            self={{ firstName: 'Marine', lastName: 'Rousseau', level: 'N2' }}
            prefill={{ kind: 'none' }}
            canEditEvent={canEditEvent}
            saveDive={vi.fn<SaveDive>()}
            draftStore={NO_DRAFT}
            cancelHref={`/dives/${dive.id}`}
            onSaved={vi.fn()}
            onCreateSite={vi.fn()}
          />
        ),
      },
    ]);
    render(<RouterProvider router={router} />);
  }

  it('locks the event fields when the diver cannot edit the event', () => {
    renderEdit({ canEditEvent: false });

    const site = screen.getByRole<HTMLInputElement>('combobox', { name: /^Site/ });
    expect(site.readOnly).toBe(true);
    expect(input(/^Date/).readOnly).toBe(true);
    expect(input(/^Immersion/).readOnly).toBe(true);
    expect(input(/^Structure/).readOnly).toBe(true);
    const entry = screen.getByRole('radiogroup', { name: 'Mise à l’eau' });
    expect(entry.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getAllByText(LOCKED_EVENT_HINT).length).toBeGreaterThanOrEqual(5);

    // The participation stays the diver's.
    expect(input(/^Sortie/).readOnly).toBe(false);
    expect(input(/^Profondeur max/).readOnly).toBe(false);
    expect(input(/^Pression fin/).readOnly).toBe(false);
    const team = screen.getByRole('list', { name: 'Membres de la palanquée' });
    expect(within(team).getAllByRole('button', { name: /^Retirer/ }).length).toBeGreaterThan(0);
  });

  it('leaves every field editable in V1', () => {
    renderEdit({ canEditEvent: true });

    expect(screen.getByRole<HTMLInputElement>('combobox', { name: /^Site/ }).readOnly).toBe(false);
    expect(input(/^Date/).readOnly).toBe(false);
    expect(screen.queryByText(LOCKED_EVENT_HINT)).toBeNull();
  });
});
