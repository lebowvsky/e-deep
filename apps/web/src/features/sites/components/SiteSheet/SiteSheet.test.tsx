import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SiteSheet } from './SiteSheet';

function renderSheet() {
  const onAdd = vi.fn();
  render(
    <SiteSheet siteCount={23} waitingCount={1} onAdd={onAdd}>
      <p>Liste</p>
    </SiteSheet>,
  );
  const sheet = screen.getByRole('region', { name: 'Mes sites' });
  const handle = screen.getByRole('button', { name: /^Liste/ });
  return { sheet, handle, onAdd };
}

describe('SiteSheet', () => {
  it('opens at half height with its counters and « + Site »', async () => {
    const user = userEvent.setup();
    const { sheet, onAdd } = renderSheet();

    expect(sheet.getAttribute('data-snap')).toBe('half');
    expect(screen.getByText('23 sites · 1 à compléter')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Site' }));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it('moves between its 3 heights with the keyboard', async () => {
    const user = userEvent.setup();
    const { sheet, handle } = renderSheet();

    handle.focus();
    await user.keyboard('{ArrowUp}');
    expect(sheet.getAttribute('data-snap')).toBe('full');
    expect(handle.getAttribute('aria-label')).toMatch(/^Liste en plein écran/);
    await user.keyboard('{ArrowUp}');
    expect(sheet.getAttribute('data-snap')).toBe('full');
    await user.keyboard('{End}');
    expect(sheet.getAttribute('data-snap')).toBe('folded');
    await user.keyboard('{ArrowDown}');
    expect(sheet.getAttribute('data-snap')).toBe('folded');
    // Entrée goes up one height, and back down to folded from full.
    await user.keyboard('{Enter}');
    expect(sheet.getAttribute('data-snap')).toBe('half');
    await user.keyboard('{Home}{Enter}');
    expect(sheet.getAttribute('data-snap')).toBe('folded');
  });

  it('follows a drag of the handle', async () => {
    const user = userEvent.setup();
    const { sheet, handle } = renderSheet();

    await user.pointer([
      { keys: '[MouseLeft>]', target: handle, coords: { clientY: 400 } },
      { coords: { clientY: 300 } },
      { keys: '[/MouseLeft]', coords: { clientY: 300 } },
    ]);
    expect(sheet.getAttribute('data-snap')).toBe('full');
  });
});
