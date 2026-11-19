/** The page of a site (`/sites/:siteId`), linked from the map, the dashboard and a dive. */
export const siteHrefOf = (id: string) => `/sites/${encodeURIComponent(id)}`;
