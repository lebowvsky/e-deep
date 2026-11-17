import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TextInput } from '@/shared/ui/TextInput';
import { FormField } from './FormField';

const describedBy = (element: HTMLElement) =>
  (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent);

describe('FormField', () => {
  it('names the control with its label and marks it required with a decorative star', () => {
    render(
      <FormField label="Date" required hint="Pas dans le futur.">
        <TextInput />
      </FormField>,
    );
    const input = screen.getByRole('textbox', { name: 'Date' });
    expect(input.getAttribute('aria-required')).toBe('true');
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(screen.getByText('*').getAttribute('aria-hidden')).toBe('true');
    expect(describedBy(input)).toEqual(['Pas dans le futur.']);
  });

  it('replaces the hint by the error, sets aria-invalid and shows the icon in the field', () => {
    const { container } = render(
      <FormField label="Site" hint="Tes sites." error="Choisis un site.">
        <TextInput />
      </FormField>,
    );
    const input = screen.getByRole('textbox', { name: 'Site' });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(describedBy(input)).toEqual(['Choisis un site.']);
    expect(screen.queryByText('Tes sites.')).toBeNull();
    expect(container.querySelector('[data-status="error"] svg')).not.toBeNull();
  });

  it('describes a warning without making the field invalid', () => {
    render(
      <FormField label="Profondeur max" warning="Au-delà de 40 m, vérifie la valeur.">
        <TextInput unit="m" unitLabel="mètres" />
      </FormField>,
    );
    const input = screen.getByRole('textbox', { name: 'Profondeur max' });
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(describedBy(input)).toEqual(['Au-delà de 40 m, vérifie la valeur.', 'mètres']);
  });

  it('makes a locked control read-only and keeps its help', () => {
    render(
      <FormField label="% O₂" hint="Air = 21 %" locked>
        <TextInput defaultValue="21" />
      </FormField>,
    );
    const input = screen.getByRole('textbox', { name: '% O₂' });
    expect(input).toHaveProperty('readOnly', true);
    expect(describedBy(input)).toEqual(['Air = 21 %']);
  });

  it('uses the given id, for the links of an error summary', () => {
    render(
      <FormField label="Sortie" id="field-exit">
        <TextInput />
      </FormField>,
    );
    expect(screen.getByRole('textbox', { name: 'Sortie' }).id).toBe('field-exit');
  });
});
