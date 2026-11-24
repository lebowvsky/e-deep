import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { mockUser } from '@/features/dashboard/mocks/dashboard';
import type { User } from '@/features/dashboard/types';
import { UserCard } from './UserCard';

function renderCard(user: User) {
  render(
    <MemoryRouter>
      <UserCard user={user} action="logout" />
    </MemoryRouter>,
  );
}

describe('UserCard', () => {
  it('shows the full name and the initials', () => {
    renderCard(mockUser);
    expect(screen.getByText('Marine Rousseau')).toBeTruthy();
    expect(screen.getByText('MR')).toBeTruthy();
  });

  it('shows the first name alone when the user has no last name', () => {
    renderCard({ ...mockUser, lastName: null });
    expect(screen.getByText('Marine')).toBeTruthy();
    expect(screen.getByText('M')).toBeTruthy();
    expect(screen.queryByText(/null|undefined/)).toBeNull();
  });
});
