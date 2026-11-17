import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Switch } from './Switch';

function StopHarness({ disabled = false }) {
  const [on, setOn] = useState(false);
  return (
    <Switch
      checked={on}
      onCheckedChange={setOn}
      label="Palier de sécurité"
      hint="Fait pendant la remontée"
      disabled={disabled}
    />
  );
}

describe('Switch', () => {
  it('is a switch named by its label and described by its hint', () => {
    render(<StopHarness />);
    const toggle = screen.getByRole('switch', { name: 'Palier de sécurité' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(toggle.getAttribute('aria-describedby')).toBe(
      screen.getByText('Fait pendant la remontée').id,
    );
  });

  it('toggles on click, on its label and with the keyboard', async () => {
    const user = userEvent.setup();
    render(<StopHarness />);
    const toggle = screen.getByRole('switch');

    await user.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    await user.click(screen.getByText('Palier de sécurité'));
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    await user.keyboard(' ');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    await user.keyboard('{Enter}');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });

  it('does not change when disabled', async () => {
    const user = userEvent.setup();
    render(<StopHarness disabled />);
    await user.click(screen.getByRole('switch'));
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
  });
});
