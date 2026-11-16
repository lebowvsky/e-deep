/** Query keys of the dive log: `all` invalidates everything the feature caches. */
export const divesKeys = {
  all: ['dives'] as const,
  log: () => [...divesKeys.all, 'log'] as const,
  detail: (id: string) => [...divesKeys.all, 'detail', id] as const,
};
