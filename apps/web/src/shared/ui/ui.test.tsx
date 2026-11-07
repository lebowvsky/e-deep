import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { Button } from './Button';
import { Card } from './Card';
import { Icon } from './Icon';
import { Overline } from './Overline';
import { Skeleton } from './Skeleton';

describe('Icon', () => {
  it('is decorative without a label', () => {
    const { container } = render(<Icon name="search" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('width')).toBe('18');
  });

  it('is announced with a label', () => {
    render(<Icon name="bell" size="xl" label="Notifications" />);
    const img = screen.getByRole('img', { name: 'Notifications' });
    expect(img?.getAttribute('width')).toBe('20');
  });
});

describe('Button', () => {
  it('defaults to a secondary type="button"', () => {
    render(<Button>Voir le détail</Button>);
    const button = screen.getByRole('button', { name: 'Voir le détail' });
    expect(button?.getAttribute('type')).toBe('button');
    expect(button.className).toContain('secondary');
  });

  it('renders the variant and a decorative leading icon', () => {
    render(
      <Button variant="primary" icon="plus">
        Nouvelle plongée
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Nouvelle plongée' });
    expect(button.className).toContain('primary');
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('Card', () => {
  it('renders the requested element with elevation and padding', () => {
    render(
      <Card as="section" elevation={0} padding="lg" aria-label="Binômes">
        contenu
      </Card>,
    );
    const card = screen.getByRole('region', { name: 'Binômes' });
    expect(card.className).toContain('elevation0');
    expect(card.className).toContain('lg');
  });
});

describe('Overline', () => {
  it('renders as a heading when asked', () => {
    render(<Overline as="h2">Plongées totales</Overline>);
    expect(screen.getByRole('heading', { name: 'Plongées totales' }).tagName).toBe('H2');
  });
});

describe('Badge', () => {
  it('renders the tone and a hidden dot', () => {
    const { container } = render(
      <Badge tone="accent" dot>
        N2 · FFESSM
      </Badge>,
    );
    expect(screen.getByText('N2 · FFESSM').className).toContain('accent');
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe('Avatar', () => {
  it('shows initials with the data colour and stays decorative', () => {
    render(<Avatar initials="LB" color="#3a5a82" size="lg" />);
    const avatar = screen.getByText('LB');
    expect(avatar?.getAttribute('aria-hidden')).toBe('true');
    expect(avatar.style.backgroundColor).toBe('rgb(58, 90, 130)');
  });

  it('falls back to the user gradient without colour', () => {
    render(<Avatar initials="MR" />);
    expect(screen.getByText('MR').className).toContain('gradient');
  });
});

describe('Skeleton', () => {
  it('is hidden from assistive technologies', () => {
    const { container } = render(<Skeleton shape="block" />);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
  });
});
