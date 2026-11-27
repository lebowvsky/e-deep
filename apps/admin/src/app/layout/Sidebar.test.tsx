import { render, screen, within } from '@testing-library/react';
import { LayoutDashboard, Users } from 'lucide-react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { SessionContext, type AdminSession } from '../access-control/session';
import { navItemsFor, type NavItem } from './navigation';
import { Sidebar } from './Sidebar';

const ITEMS: readonly NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    to: '/',
    icon: LayoutDashboard,
    allowedRoles: ['support', 'admin'],
  },
  { id: 'accounts', label: 'Accounts', to: '/accounts', icon: Users, allowedRoles: ['admin'] },
];

function renderSidebar(session: AdminSession) {
  const router = createMemoryRouter([
    {
      path: '*',
      element: (
        <SessionContext value={session}>
          <Sidebar items={ITEMS} />
        </SessionContext>
      ),
    },
  ]);
  render(<RouterProvider router={router} />);
}

const navLinks = () =>
  within(screen.getByRole('navigation', { name: 'Main' }))
    .getAllByRole('link')
    .map((link) => link.textContent);

describe('Sidebar', () => {
  it('shows every item to an admin', () => {
    renderSidebar({ email: 'admin@e-deep.test', role: 'admin' });

    expect(navLinks()).toEqual(['Dashboard', 'Accounts']);
  });

  it('hides the items a support role is not allowed to see', () => {
    renderSidebar({ email: 'support@e-deep.test', role: 'support' });

    expect(navLinks()).toEqual(['Dashboard']);
  });
});

describe('navItemsFor', () => {
  it('keeps the allowed items in their order', () => {
    expect(navItemsFor({ role: 'admin' }, ITEMS).map(({ id }) => id)).toEqual([
      'dashboard',
      'accounts',
    ]);
    expect(navItemsFor({ role: 'support' }, ITEMS).map(({ id }) => id)).toEqual(['dashboard']);
  });
});
