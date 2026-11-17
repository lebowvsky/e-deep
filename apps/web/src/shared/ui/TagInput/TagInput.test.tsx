import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { FormField } from '@/shared/ui/FormField';
import { TagInput } from './TagInput';

function SpeciesHarness({ initial = [] as string[] }) {
  const [values, setValues] = useState(initial);
  return (
    <FormField label="Espèces observées">
      <TagInput
        values={values}
        onValuesChange={setValues}
        suggestions={['Mérou brun', 'Murène', 'Poulpe']}
      />
    </FormField>
  );
}

const removeButtons = () => screen.queryAllByRole('button', { name: /^Retirer/ });
const input = () => screen.getByRole('textbox', { name: 'Espèces observées' });

describe('TagInput', () => {
  it('adds the text typed with Entrée, without duplicates', async () => {
    const user = userEvent.setup();
    render(<SpeciesHarness />);
    await user.type(input(), 'Gorgones rouges{Enter}gorgones ROUGES{Enter}');
    expect(screen.getByRole('button', { name: 'Retirer Gorgones rouges' })).toBeDefined();
    expect(removeButtons()).toHaveLength(1);
    expect(input()).toHaveProperty('value', '');
  });

  it('adds the text typed before a comma', async () => {
    const user = userEvent.setup();
    render(<SpeciesHarness />);
    await user.type(input(), 'Saupe,Sar, Castagnole');
    expect(screen.getByRole('button', { name: 'Retirer Saupe' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Retirer Sar' })).toBeDefined();
    expect(input()).toHaveProperty('value', ' Castagnole');
  });

  it('removes the last tag with Retour arrière in an empty field', async () => {
    const user = userEvent.setup();
    render(<SpeciesHarness initial={['Mérou brun', 'Gorgones rouges']} />);
    await user.type(input(), 'ab{Backspace}{Backspace}');
    expect(removeButtons()).toHaveLength(2);
    await user.keyboard('{Backspace}');
    expect(screen.queryByRole('button', { name: 'Retirer Gorgones rouges' })).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('Retiré : Gorgones rouges');
  });

  it('removes a tag with its button and gives the focus to the field', async () => {
    const user = userEvent.setup();
    render(<SpeciesHarness initial={['Mérou brun', 'Gorgones rouges']} />);
    await user.click(screen.getByRole('button', { name: 'Retirer Mérou brun' }));
    expect(screen.queryByRole('button', { name: 'Retirer Mérou brun' })).toBeNull();
    expect(input()).toBe(document.activeElement);
  });

  it('offers the matching suggestions not yet added', async () => {
    const user = userEvent.setup();
    render(<SpeciesHarness initial={['Mérou brun']} />);
    expect(screen.queryByRole('button', { name: 'Ajouter Mérou brun' })).toBeNull();
    await user.type(input(), 'mur');
    expect(screen.queryByRole('button', { name: 'Ajouter Poulpe' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Ajouter Murène' }));
    expect(screen.getByRole('button', { name: 'Retirer Murène' })).toBeDefined();
    expect(removeButtons()).toHaveLength(2);
    expect(input()).toHaveProperty('value', '');
  });

  it('adds the text left in the field when it loses the focus', async () => {
    const user = userEvent.setup();
    render(
      <>
        <SpeciesHarness />
        <button type="button">Enregistrer</button>
      </>,
    );
    await user.type(input(), 'Mérou brun');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(screen.getByRole('button', { name: 'Retirer Mérou brun' })).toBeDefined();
    expect(input()).toHaveProperty('value', '');
  });

  it('does not add a partial text when a suggestion is picked instead', async () => {
    const user = userEvent.setup();
    render(<SpeciesHarness />);
    await user.type(input(), 'Mur');
    await user.click(screen.getByRole('button', { name: 'Ajouter Murène' }));
    expect(removeButtons().map((button) => button.getAttribute('aria-label'))).toEqual([
      'Retirer Murène',
    ]);
    await user.tab();
    expect(removeButtons()).toHaveLength(1);
  });
});
