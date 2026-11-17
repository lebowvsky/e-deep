import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { FormField } from '@/shared/ui/FormField';
import { SegmentedControl } from './SegmentedControl';

const SEA = [
  { value: 'calm', label: 'Calme' },
  { value: 'nice', label: 'Belle' },
  { value: 'rough', label: 'Agitée' },
] as const;
type Sea = (typeof SEA)[number]['value'];

function SeaHarness({ locked = false }) {
  const [sea, setSea] = useState<Sea>('nice');
  return (
    <FormField label="Mer" locked={locked}>
      <SegmentedControl variant="field" options={SEA} value={sea} onChange={setSea} />
    </FormField>
  );
}

const checked = () => screen.getByRole('radio', { checked: true });

describe('SegmentedControl', () => {
  it('is a radio group named by the field label, with one tab stop', () => {
    render(<SeaHarness />);
    screen.getByRole('radiogroup', { name: 'Mer' });
    expect(checked().textContent).toBe('Belle');
    expect(screen.getAllByRole('radio').map((radio) => radio.tabIndex)).toEqual([-1, 0, -1]);
  });

  it('moves and selects with the arrows, wrapping around, and Home / End', async () => {
    const user = userEvent.setup();
    render(<SeaHarness />);
    await user.tab();
    expect(checked()).toBe(document.activeElement);

    await user.keyboard('{ArrowRight}');
    expect(checked().textContent).toBe('Agitée');
    await user.keyboard('{ArrowRight}');
    expect(checked().textContent).toBe('Calme');
    await user.keyboard('{ArrowLeft}');
    expect(checked().textContent).toBe('Agitée');
    expect(checked()).toBe(document.activeElement);
    await user.keyboard('{Home}');
    expect(checked().textContent).toBe('Calme');
    await user.keyboard('{End}');
    expect(checked().textContent).toBe('Agitée');
  });

  it('keeps its choice when locked', async () => {
    const user = userEvent.setup();
    render(<SeaHarness locked />);
    await user.click(screen.getByRole('radio', { name: 'Calme' }));
    expect(checked().textContent).toBe('Belle');
    expect(screen.getByRole('radiogroup').getAttribute('aria-disabled')).toBe('true');
  });

  it('takes the required, invalid and message wiring of its field', () => {
    render(
      <FormField label="Mer" required error="Choisis l’état de la mer.">
        <SegmentedControl variant="field" options={SEA} value={null} onChange={() => {}} />
      </FormField>,
    );
    const group = screen.getByRole('radiogroup', { name: 'Mer' });
    expect(group.getAttribute('aria-required')).toBe('true');
    expect(group.getAttribute('aria-invalid')).toBe('true');
    expect(group.getAttribute('aria-describedby')).not.toBeNull();
    expect(document.getElementById(group.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      'Choisis l’état de la mer.',
    );
  });

  it('is named by its label outside a field', () => {
    render(<SegmentedControl label="Période" options={SEA} value="calm" onChange={() => {}} />);
    screen.getByRole('radiogroup', { name: 'Période' });
  });
});
