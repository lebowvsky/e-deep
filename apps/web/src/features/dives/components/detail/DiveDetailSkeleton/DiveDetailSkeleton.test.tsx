import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { toLoggedDive, toSelfMember } from '../../../api/divesApi';
import { mockDiveLogResponse, mockOwner } from '../../../mocks/diveLogResponse';
import { DiveDetailSkeleton } from './DiveDetailSkeleton';

describe('DiveDetailSkeleton', () => {
  it('shows the log preview header without entry type nor area (unknown yet, not guessed)', () => {
    const summary = mockDiveLogResponse.dives[0];
    if (!summary) throw new Error('Empty mocked log');
    const preview = toLoggedDive(summary, toSelfMember(mockOwner));
    render(<DiveDetailSkeleton preview={preview} />);

    expect(screen.getByRole('heading', { level: 1, name: preview.site.name })).toBeTruthy();
    const place = preview.site.place ?? '';
    expect(screen.getByText(place).textContent).toBe(place);
    const tags = screen.getByRole('list', { name: 'Étiquettes' });
    // The gas only: no stops, no Bateau / Bord.
    expect(within(tags).getAllByRole('listitem')).toHaveLength(1);
  });
});
