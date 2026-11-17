import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { FormField } from '@/shared/ui/FormField';
import { NumberInput } from './NumberInput';

function DepthHarness({ decimal = true, signed = false }) {
  const [value, setValue] = useState('');
  return (
    <FormField label="Profondeur max">
      <NumberInput
        value={value}
        onValueChange={setValue}
        decimal={decimal}
        signed={signed}
        unit="m"
      />
    </FormField>
  );
}

const input = () => screen.getByRole('textbox', { name: 'Profondeur max' });

describe('NumberInput', () => {
  it('is a text field with the decimal keypad, never type="number"', () => {
    render(<DepthHarness />);
    expect(input().getAttribute('type')).toBe('text');
    expect(input().getAttribute('inputmode')).toBe('decimal');
  });

  it('shows the dot typed as a French comma and keeps one separator', async () => {
    const user = userEvent.setup();
    render(<DepthHarness />);
    await user.type(input(), '41.5,2m');
    expect(input()).toHaveProperty('value', '41,52');
  });

  it('keeps whole numbers only with the numeric keypad', async () => {
    const user = userEvent.setup();
    render(<DepthHarness decimal={false} />);
    expect(input().getAttribute('inputmode')).toBe('numeric');
    await user.type(input(), '-12,5');
    expect(input()).toHaveProperty('value', '125');
  });

  it('accepts a leading minus sign when signed', async () => {
    const user = userEvent.setup();
    render(<DepthHarness signed />);
    await user.type(input(), '-2');
    expect(input()).toHaveProperty('value', '-2');
  });
});
