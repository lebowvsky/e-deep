import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { SaveDive } from '../../../api/saveDive';
import { editDiveValues, editTarget } from '../../../form/prefill';
import { buildDiveFormSources } from '../../../form/sources';
import { CONTEXT, filledDive } from '../../../mocks/diveFormFixture';
import { mockDives } from '../../../mocks/dives';
import { LOCKED_EVENT_HINT } from '../fieldBinding';
import { DiveForm } from './DiveForm';

function renderEdit({ canEditEvent }: { canEditEvent: boolean }) {
  const dive = filledDive();
  render(
    <MemoryRouter>
      <DiveForm
        mode={{ kind: 'edit', diveId: dive.id }}
        number={dive.number}
        initialValues={editDiveValues(dive)}
        target={editTarget(dive)}
        context={CONTEXT}
        sources={buildDiveFormSources(mockDives)}
        log={mockDives}
        self={{ firstName: 'Marine', lastName: 'Rousseau', level: 'N2' }}
        prefill={{ kind: 'none' }}
        canEditEvent={canEditEvent}
        saveDive={vi.fn<SaveDive>()}
        draftStore={{
          load: () => Promise.resolve(null),
          save: () => Promise.resolve(),
          clear: () => Promise.resolve(),
        }}
        cancelHref={`/dives/${dive.id}`}
        onSaved={vi.fn()}
      />
    </MemoryRouter>,
  );
}

const input = (name: RegExp) => screen.getByLabelText<HTMLInputElement>(name);

describe('DiveForm — shared event', () => {
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
