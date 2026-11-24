import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { CurrentDiver } from '@/shared/session/types';
import { ToastProvider } from '@/shared/ui/Toast';
import { UserCard } from './UserCard';

const marine: CurrentDiver = {
  id: 'u1',
  firstName: 'Marine',
  lastName: 'Rousseau',
  level: { agency: 'FFESSM', code: 'N2', label: 'Niveau 2' },
};

function renderCard(user: CurrentDiver) {
  // A data router: the sign-out button is a fetcher form.
  const router = createMemoryRouter([
    { path: '/', element: <UserCard user={user} action="logout" /> },
  ]);
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  );
}

describe('UserCard', () => {
  it('shows the full name and the initials', () => {
    renderCard(marine);
    expect(screen.getByText('Marine Rousseau')).toBeTruthy();
    expect(screen.getByText('MR')).toBeTruthy();
    expect(screen.getByText('N2 · FFESSM')).toBeTruthy();
  });

  it('shows the first name alone when the user has no last name', () => {
    renderCard({ ...marine, lastName: null });
    expect(screen.getByText('Marine')).toBeTruthy();
    expect(screen.getByText('M')).toBeTruthy();
    expect(screen.queryByText(/null|undefined/)).toBeNull();
  });
});

describe('UserCard — level of another agency', () => {
  it('names the agency of the level', () => {
    renderCard({ ...marine, level: { agency: 'CMAS', code: '2*', label: 'Plongeur 2 étoiles' } });
    expect(screen.getByText('2* · CMAS')).toBeTruthy();
  });
});
