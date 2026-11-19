import { render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { MapViewProps } from '@/shared/ui/MapView';
import { toDiveDetailView, toSelfMember } from '../../../api/divesApi';
import { mockDiveDetail, mockFilledDiveDetail } from '../../../mocks/diveDetailResponse';
import { mockOwner } from '../../../mocks/diveLogResponse';
import type { DiveDetailView } from '../../../types';
import { DiveDetailReady } from './DiveDetailReady';

// No WebGL in jsdom: the map is a labelled picture.
vi.mock('@/shared/ui/MapView', () => ({
  MapView: ({ label, readOnly }: MapViewProps) => (
    <div role="img" aria-label={label} data-read-only={readOnly} />
  ),
}));

const self = toSelfMember(mockOwner);

/** The header links to the edit form and to a duplicate: a router is needed. */
const renderReady = (ui: ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

/** The latest mocked dive: filled with the mockup values, or with nothing entered at all. */
const filled = (): DiveDetailView =>
  toDiveDetailView({ ...mockFilledDiveDetail('d127'), gasMix: 'AIR' }, self);
const empty = (): DiveDetailView =>
  toDiveDetailView(
    { ...mockDiveDetail('d127'), gasMix: 'AIR', temperatureC: null, notes: null },
    self,
  );

const card = (name: RegExp) => screen.getByRole('region', { name });

/** The `<dd>` of a term in a card (description list). */
function valueOf(region: HTMLElement, term: string): HTMLElement {
  const dt = within(region).getByText(term, { selector: 'dt' });
  const dd = dt.nextElementSibling;
  if (!(dd instanceof HTMLElement) || dd.tagName !== 'DD') throw new Error(`No value for ${term}`);
  return dd;
}

describe('DiveDetailReady, filled dive', () => {
  it('adds the area to the place and the entry type to the tags', () => {
    renderReady(<DiveDetailReady dive={filled()} insights={null} />);

    expect(screen.getByText(/· Méditerranée$/)).toBeTruthy();
    const tags = screen.getByRole('list', { name: 'Étiquettes' });
    expect(
      within(tags)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toStrictEqual(['Palier OK', 'Air', 'Bateau']);
  });

  it('captions the bottom temperature with the surface one', () => {
    renderReady(<DiveDetailReady dive={filled()} insights={null} />);
    const measures = screen.getByRole('list', { name: 'Mesures' });
    expect(within(measures).getByText('Surface 16 °C')).toBeTruthy();
  });

  it('shows the run: safety stop, decompression, repetitive, no more gas', () => {
    renderReady(<DiveDetailReady dive={filled()} insights={null} />);
    const run = card(/Déroulé de la plongée/);

    expect(within(run).getByText('3 minutes à 5 mètres')).toBeTruthy();
    expect(valueOf(run, 'Paliers de déco.').textContent).toBe('Aucun');
    expect(valueOf(run, 'Successive').textContent).toBe('Non');
    expect(within(run).queryByText('Gaz')).toBeNull();
    // The time bar and its caption are decorative: the stop is in the text.
    const caption = within(run).getByText('palier 3 min à 5 m');
    expect(caption.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('shows the equipment, units read with their value', () => {
    renderReady(<DiveDetailReady dive={filled()} insights={null} />);
    const equipment = card(/Équipement & gaz/);

    expect(equipment.tagName).toBe('SECTION');
    expect(within(equipment).getByRole('heading', { level: 2 }).textContent).toContain(
      'Équipement & gaz',
    );
    expect(valueOf(equipment, 'Gaz').textContent).toBe('Air21 % O₂');
    expect(within(valueOf(equipment, 'Bloc')).getByText('12 litres, acier')).toBeTruthy();
    const pressure = valueOf(equipment, 'Pression');
    expect(within(pressure).getByText('200 bars au début, 60 bars à la fin')).toBeTruthy();
    expect(within(pressure).getByText('140 bar consommés')).toBeTruthy();
    expect(
      within(valueOf(equipment, 'Combinaison')).getByText('7 millimètres, semi-étanche'),
    ).toBeTruthy();
    expect(valueOf(equipment, 'Lest').textContent).toBe('—Non renseigné');
  });

  it('shows the conditions', () => {
    renderReady(<DiveDetailReady dive={filled()} insights={null} />);
    const conditions = card(/Conditions/);

    expect(valueOf(conditions, 'Type').textContent).toBe('Bateau · jour');
    expect(valueOf(conditions, 'Météo').textContent).toBe('EnsoleilléAir 19 °C');
    expect(valueOf(conditions, 'Mer').textContent).toBe('Calme');
    expect(valueOf(conditions, 'Courant').textContent).toBe('Faible');
    const water = valueOf(conditions, 'Eau');
    expect(within(water).getByText('16 degrés en surface, 14 degrés au fond')).toBeTruthy();
    // The note repeats the spoken form: hidden from screen readers.
    expect(within(water).getByText('surface → fond').getAttribute('aria-hidden')).toBe('true');
    expect(valueOf(conditions, 'Structure').textContent).toBe('Calvi Plongée');
  });

  it('lists the species in the order entered, with their spoken count', () => {
    renderReady(<DiveDetailReady dive={filled()} insights={null} />);
    const species = within(card(/Notes & observations/)).getByRole('list', {
      name: 'Espèces observées',
    });
    const items = within(species).getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(within(items[0] as HTMLElement).getByText('Mérou brun, 2 individus')).toBeTruthy();
    expect(
      within(items[1] as HTMLElement).getByText('Barracudas', { ignore: '[aria-hidden]' }),
    ).toBeTruthy();
  });

  it('gives each member a level tag, the user their level at the time of the dive', () => {
    const dive = filled();
    renderReady(<DiveDetailReady dive={dive} insights={null} />);
    const team = card(/Palanquée/);

    expect(within(team).getByText('N2 · FFESSM')).toBeTruthy();
    const levels = dive.team.filter((member) => member.level !== null).length;
    expect(within(team).getAllByText('Niveau')).toHaveLength(levels);
  });

  it('dates the creation and the change, in the device time zone', () => {
    renderReady(<DiveDetailReady dive={filled()} insights={null} />);
    const times = screen
      .getAllByText((_content, element) => element?.tagName === 'TIME')
      .filter((time) => time.closest('p')?.textContent?.startsWith('Créée le'));
    expect(times.map((time) => time.getAttribute('datetime'))).toStrictEqual([
      '2026-04-08T18:00:00.000Z',
      '2026-04-09T07:30:00.000Z',
    ]);
  });
});

describe('DiveDetailReady, nothing entered', () => {
  it('keeps every card, values missing as « — · Non renseigné(e) »', () => {
    renderReady(<DiveDetailReady dive={empty()} insights={null} />);

    for (const name of [/Déroulé/, /Équipement/, /Conditions/, /Notes/, /Site/, /Palanquée/]) {
      expect(card(name)).toBeTruthy();
    }
    const run = card(/Déroulé de la plongée/);
    expect(valueOf(run, 'Palier de sécurité').textContent).toBe('—Non renseigné');
    expect(valueOf(run, 'Successive').textContent).toBe('—Non renseignée');
    expect(within(run).queryByText(/^palier /)).toBeNull();

    const equipment = card(/Équipement & gaz/);
    expect(valueOf(equipment, 'Gaz').textContent).toBe('Air21 % O₂');
    expect(valueOf(equipment, 'Pression').textContent).toBe('—Non renseignée');
    // « — » is decorative: the words carry the information.
    expect(within(equipment).getAllByText('—')[0]?.getAttribute('aria-hidden')).toBe('true');
  });

  it('says « Rien de renseigné » in an empty card, without a list', () => {
    renderReady(<DiveDetailReady dive={empty()} insights={null} />);

    for (const name of [/Conditions/, /Notes & observations/]) {
      const region = card(name);
      expect(within(region).getByText('Rien de renseigné')).toBeTruthy();
      expect(region.querySelector('dl, ul')).toBeNull();
    }
  });

  it('keeps the Conditions card empty with the bottom temperature alone (a KPI already)', () => {
    const dive = { ...empty(), temperatureC: 17 };
    renderReady(<DiveDetailReady dive={dive} insights={null} />);
    expect(within(card(/Conditions/)).getByText('Rien de renseigné')).toBeTruthy();
  });

  it('shows the bottom temperature under « Eau » once a condition is entered', () => {
    const base = empty();
    const dive = {
      ...base,
      temperatureC: 17,
      conditions: { ...base.conditions, seaState: 'CALM' as const },
    };
    renderReady(<DiveDetailReady dive={dive} insights={null} />);
    const water = valueOf(card(/Conditions/), 'Eau');
    expect(within(water).getByText('17 degrés au fond')).toBeTruthy();
  });

  it('shows neither area nor entry type, nor a surface caption, nor a buddy level', () => {
    const dive = empty();
    renderReady(<DiveDetailReady dive={dive} insights={null} />);

    const header = document.querySelector('header');
    expect(within(header ?? document.body).getByText(dive.site.place ?? '')).toBeTruthy();
    const tags = screen.getByRole('list', { name: 'Étiquettes' });
    expect(within(tags).queryByText('Bateau')).toBeNull();
    expect(screen.queryByText(/^Surface /)).toBeNull();
    // Only the user's level is known.
    expect(within(card(/Palanquée/)).getAllByText('Niveau')).toHaveLength(1);
    expect(screen.queryByText(/modifiée le/)).toBeNull();
  });

  it('shows the coordinates and the marker of a site with a position', () => {
    const { container } = renderReady(<DiveDetailReady dive={empty()} insights={null} />);
    const site = card(/^Site/);
    expect(within(site).getByText('Latitude 42,580 nord, longitude 8,725 est')).toBeTruthy();
    const map = within(site).getByRole('img', { name: /^Carte autour de / });
    expect(map.dataset.readOnly).toBe('true');
    expect(container.querySelector('[class*="marker"]')).not.toBeNull();
    expect(container.querySelectorAll('[class*="place"]').length).toBeGreaterThan(0);
    expect(within(site).queryByText('Position non renseignée')).toBeNull();
  });
});

describe('DiveDetailReady, site created by its name (D-23)', () => {
  const nameOnly = (): DiveDetailView =>
    toDiveDetailView(
      {
        ...mockDiveDetail('d127'),
        site: {
          id: 's-new',
          name: 'Le Sec',
          locality: null,
          region: null,
          latitude: null,
          longitude: null,
          area: null,
        },
      },
      self,
    );

  it('says « Position non renseignée » instead of coordinates and marker', () => {
    const { container } = renderReady(<DiveDetailReady dive={nameOnly()} insights={null} />);
    const site = card(/^Site/);

    expect(within(site).getByText('Position non renseignée')).toBeTruthy();
    expect(within(site).queryByText(/^Latitude/)).toBeNull();
    expect(within(site).queryByRole('img', { name: /^Carte/ })).toBeNull();
    expect(container.querySelector('[class*="marker"]')).toBeNull();
  });

  it('offers to place the site on the map', () => {
    renderReady(<DiveDetailReady dive={nameOnly()} insights={null} />);
    const place = screen.getByRole('link', { name: 'Placer sur la carte' });
    expect(place.getAttribute('href')).toBe(`/map?panel=place&id=${nameOnly().site.id}`);
  });

  it('shows no place line, in the header nor in the site card', () => {
    const { container } = renderReady(<DiveDetailReady dive={nameOnly()} insights={null} />);
    expect(container.querySelectorAll('[class*="place"]')).toHaveLength(0);
    expect(screen.getByRole('heading', { level: 1, name: 'Le Sec' })).toBeTruthy();
  });
});

describe('DiveDetailReady, link to the site page', () => {
  it('leads to the site page from the name of the site', () => {
    renderReady(<DiveDetailReady dive={filled()} insights={null} />);
    const link = screen.getByRole('link', { name: filled().site.name });
    expect(link.getAttribute('href')).toBe(`/sites/${filled().site.id}`);
  });
});
