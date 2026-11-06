import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdminLayout } from './AdminLayout';

describe('AdminLayout', () => {
  it('renders the skip link, the main navigation with the current page, and the content', () => {
    render(
      <AdminLayout currentItem="dashboard">
        <h1>Page content</h1>
      </AdminLayout>,
    );

    expect(screen.getByRole('link', { name: 'Skip to main content' }).getAttribute('href')).toBe(
      '#main-content',
    );
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(nav.querySelector('[aria-current="page"]')?.textContent).toBe('Dashboard');
    expect(screen.getByRole('main').textContent).toBe('Page content');
  });
});
