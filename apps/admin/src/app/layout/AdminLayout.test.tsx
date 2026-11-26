import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { SessionContext, type AdminSession } from '../access-control/session';
import { AdminLayout } from './AdminLayout';

const SESSION: AdminSession = { email: 'staff@e-deep.test', role: 'support' };

function renderLayout() {
  const router = createMemoryRouter([
    {
      path: '/',
      element: (
        <SessionContext value={SESSION}>
          <AdminLayout>
            <h1>Page content</h1>
          </AdminLayout>
        </SessionContext>
      ),
    },
  ]);
  render(<RouterProvider router={router} />);
}

describe('AdminLayout', () => {
  it('renders the skip link, the main navigation with the current page, and the content', () => {
    renderLayout();

    expect(screen.getByRole('link', { name: 'Skip to main content' }).getAttribute('href')).toBe(
      '#main-content',
    );
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(nav.querySelector('[aria-current="page"]')?.textContent).toBe('Dashboard');
    expect(screen.getByRole('main').textContent).toBe('Page content');
  });

  it('shows who is signed in, and a way to sign out', () => {
    renderLayout();

    expect(screen.getByText('staff@e-deep.test')).toBeDefined();
    expect(screen.getByText('Support')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Se déconnecter' })).toBeDefined();
  });
});
