import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BUDDIES, SELF } from '../../mocks/roster';
import { Palanquee } from './Palanquee';

const { LB, TN, EM, RP, CL } = BUDDIES;

describe('Palanquee', () => {
  it('puts the user first and names every member for screen readers', () => {
    render(<Palanquee team={[LB, SELF, TN]} max={5} size="xs" />);
    expect(
      screen.getByText('Palanquée de 3 : Marine Rousseau (toi), Lucas Bernard, Thao Nguyen'),
    ).toBeTruthy();
  });

  it('sums up the members beyond the limit as « +N »', () => {
    const team = [SELF, LB, TN, EM, RP, CL];
    const { container, rerender } = render(<Palanquee team={team} max={5} size="xs" />);
    expect(screen.getByText('+2')).toBeTruthy();
    expect(container.querySelectorAll('[aria-hidden="true"] > span')).toHaveLength(5);

    rerender(<Palanquee team={team} max={6} size="xs" />);
    expect(screen.queryByText(/^\+/)).toBeNull();
  });

  it('is focusable, so that the keyboard shows the names too', () => {
    const { container } = render(<Palanquee team={[SELF, LB]} max={5} size="xs" />);
    expect(container.firstElementChild?.getAttribute('tabindex')).toBe('0');
  });
});
