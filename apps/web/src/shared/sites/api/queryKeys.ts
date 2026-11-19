/** Query keys of the sites: `all` invalidates everything they cache (not the dive log). */
export const sitesKeys = {
  all: ['sites'] as const,
  positions: () => [...sitesKeys.all, 'positions'] as const,
  overlay: () => [...sitesKeys.all, 'overlay'] as const,
};
