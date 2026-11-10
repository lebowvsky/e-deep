export type PageItem = number | 'gap';

/**
 * Pages to show: the first, the last, the current one and its neighbours, at least 3 at each
 * end, « … » for the gaps. 13 pages, page 1 → 1 2 3 … 13 · page 7 → 1 … 6 7 8 … 13.
 */
export function pageItems(page: number, pageCount: number): PageItem[] {
  const shown = new Set([1, pageCount, page - 1, page, page + 1]);
  if (page <= 2) shown.add(3);
  if (page >= pageCount - 1) shown.add(pageCount - 2);

  const pages = [...shown].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
  return pages.flatMap((n, index): PageItem[] => {
    const previous = pages[index - 1];
    if (previous === undefined || n === previous + 1) return [n];
    // A gap of a single page shows the page itself rather than « … ».
    return n === previous + 2 ? [previous + 1, n] : ['gap', n];
  });
}
