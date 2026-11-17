import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FormField } from '@/shared/ui/FormField';
import { Combobox, type ComboboxOption } from './Combobox';

const SITES: ComboboxOption[] = [
  {
    id: 'revellata',
    label: 'Pointe de la Revellata',
    description: 'Calvi · Corse',
    meta: '8 plongées',
  },
  {
    id: 'corbs',
    label: 'Revellata — Grotte aux Corbs',
    description: 'Calvi · Corse',
    meta: '1 plongée',
  },
  {
    id: 'bibliotheque',
    label: 'La Bibliothèque',
    description: 'Calvi · Corse',
    meta: '12 plongées',
  },
];

interface HarnessProps {
  onSelect?: (option: ComboboxOption) => void;
  onCreate?: (query: string) => void;
}

function SiteHarness({ onSelect = vi.fn(), onCreate = vi.fn() }: HarnessProps) {
  const [text, setText] = useState('');
  return (
    <FormField label="Site" required>
      <Combobox
        options={SITES}
        inputValue={text}
        onInputChange={setText}
        onSelect={(option) => {
          setText(option.label);
          onSelect(option);
        }}
        create={{
          label: (query) => `Créer le site « ${query} »`,
          description: 'Nom, région et position à préciser ensuite',
          onCreate,
        }}
        groupLabel="Mes sites"
        optionIcon="pin"
      />
    </FormField>
  );
}

describe('Combobox', () => {
  it('follows the ARIA 1.2 combobox pattern', async () => {
    const user = userEvent.setup();
    render(<SiteHarness />);
    const input = screen.getByRole('combobox', { name: /Site/ });
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.getAttribute('aria-required')).toBe('true');

    await user.type(input, 'revel');

    expect(input.getAttribute('aria-expanded')).toBe('true');
    const listbox = screen.getByRole('listbox', { name: /Site/ });
    expect(input.getAttribute('aria-controls')).toBe(listbox.id);
    const options = screen.getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      'Pointe de la RevellataCalvi · Corse8 plongées',
      'Revellata — Grotte aux CorbsCalvi · Corse1 plongée',
      'Créer le site « revel »Nom, région et position à préciser ensuite',
    ]);
    expect(input.getAttribute('aria-activedescendant')).toBe(options[0]?.id);
    expect(options[0]?.getAttribute('aria-selected')).toBe('true');
  });

  it('filters ignoring accents and highlights the text found', async () => {
    const user = userEvent.setup();
    const { container } = render(<SiteHarness />);
    await user.type(screen.getByRole('combobox'), 'biblio');
    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(container.querySelector('mark')?.textContent).toBe('Biblio');
  });

  it('moves with the arrows, wraps around and picks with Entrée', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<SiteHarness onSelect={onSelect} />);
    const input = screen.getByRole('combobox');

    await user.type(input, 'revel');
    await user.keyboard('{ArrowDown}');
    expect(input.getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[1]?.id);
    await user.keyboard('{ArrowUp}{ArrowUp}');
    const options = screen.getAllByRole('option');
    expect(input.getAttribute('aria-activedescendant')).toBe(options[2]?.id);
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onSelect).toHaveBeenCalledWith(SITES[0]);
    expect(input).toHaveProperty('value', 'Pointe de la Revellata');
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('creates an entry from the text typed', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<SiteHarness onCreate={onCreate} />);

    await user.type(screen.getByRole('combobox'), 'Les Sept Îles');
    const create = screen.getByRole('option', { name: /Créer le site « Les Sept Îles »/ });
    expect(screen.getAllByRole('option')).toEqual([create]);
    await user.keyboard('{Enter}');

    expect(onCreate).toHaveBeenCalledWith('Les Sept Îles');
  });

  it('offers no creation when an option already has this name', async () => {
    const user = userEvent.setup();
    render(<SiteHarness />);
    await user.type(screen.getByRole('combobox'), 'la bibliotheque');
    expect(screen.queryByRole('option', { name: /Créer/ })).toBeNull();
  });

  it('picks an option with the pointer', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<SiteHarness onSelect={onSelect} />);
    await user.type(screen.getByRole('combobox'), 'corbs');
    await user.click(screen.getByRole('option', { name: /Grotte aux Corbs/ }));
    expect(onSelect).toHaveBeenCalledWith(SITES[1]);
  });

  it('closes on Échap and keeps the text', async () => {
    const user = userEvent.setup();
    render(<SiteHarness />);
    const input = screen.getByRole('combobox');
    await user.type(input, 'revel');
    await user.keyboard('{Escape}');

    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.getAttribute('aria-activedescendant')).toBeNull();
    expect(input).toHaveProperty('value', 'revel');
    expect(input).toBe(document.activeElement);

    await user.keyboard('{ArrowDown}');
    expect(input.getAttribute('aria-expanded')).toBe('true');
  });
});
