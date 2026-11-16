import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from './Pagination';

const PAGE_COUNT = 13;

/** 130 dives, 10 per page: the page lives in the harness, as it lives in the URL in the app. */
function Harness({
  initialPage,
  onPage,
}: {
  initialPage: number;
  onPage?: (page: number) => void;
}) {
  const [page, setPage] = useState(initialPage);
  return (
    <Pagination
      page={page}
      pageCount={PAGE_COUNT}
      size={10}
      total={130}
      onPage={(next) => {
        onPage?.(next);
        setPage(next);
      }}
      onSize={() => {}}
    />
  );
}

const button = (name: string) => screen.getByRole('button', { name });

describe('Pagination', () => {
  it('keeps the focus on « Page suivante » when it reaches the last page', async () => {
    const user = userEvent.setup();
    render(<Harness initialPage={12} />);

    await user.click(button('Page suivante'));

    const next = button('Page suivante');
    expect(button('Page 13').getAttribute('aria-current')).toBe('page');
    expect(next.getAttribute('aria-disabled')).toBe('true');
    expect(next.hasAttribute('disabled')).toBe(false);
    expect(document.activeElement).toBe(next);
  });

  it('keeps the focus on « Page précédente » when it reaches the first page', async () => {
    const user = userEvent.setup();
    render(<Harness initialPage={2} />);

    await user.click(button('Page précédente'));

    const previous = button('Page précédente');
    expect(button('Page 1').getAttribute('aria-current')).toBe('page');
    expect(previous.getAttribute('aria-disabled')).toBe('true');
    expect(previous.hasAttribute('disabled')).toBe(false);
    expect(document.activeElement).toBe(previous);
  });

  it('does nothing when an unavailable step button is clicked or activated by keyboard', async () => {
    const user = userEvent.setup();
    const onPage = vi.fn();
    render(<Harness initialPage={1} onPage={onPage} />);

    const previous = button('Page précédente');
    await user.click(previous);
    previous.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');

    expect(onPage).not.toHaveBeenCalled();
    expect(button('Page 1').getAttribute('aria-current')).toBe('page');
    expect(document.activeElement).toBe(previous);
  });

  it('leaves the step buttons available away from the ends', () => {
    render(<Harness initialPage={7} />);
    expect(button('Page précédente').hasAttribute('aria-disabled')).toBe(false);
    expect(button('Page suivante').hasAttribute('aria-disabled')).toBe(false);
  });

  it.each([
    [1, 3],
    [1, 13],
    [13, 1],
    [7, 8],
    [7, 1],
  ])('keeps the focus on a page number: page %i → page %i', async (from, to) => {
    const user = userEvent.setup();
    render(<Harness initialPage={from} />);

    await user.click(button(`Page ${to}`));

    expect(button(`Page ${to}`).getAttribute('aria-current')).toBe('page');
    expect(document.activeElement).toBe(button(`Page ${to}`));
  });
});
