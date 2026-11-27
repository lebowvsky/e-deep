import { matchRoutes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { createFakeApiClient } from '@/test/fakeApiClient';
import { createRoutes } from '../routes';
import { NAV_ITEMS } from './navigation';

describe('NAV_ITEMS', () => {
  const routes = createRoutes({ apiClient: createFakeApiClient().apiClient });

  it.each(NAV_ITEMS.map((item) => [item.id, item] as const))(
    'shows %s to the roles its route is open to',
    (_id, item) => {
      const route = matchRoutes(routes, item.to)?.at(-1)?.route;
      // A link to an undeclared page would only reach the catch-all route.
      expect(route?.path).not.toBe('*');
      const handle: unknown = route?.handle;
      expect(handle).toEqual({ allowedRoles: item.allowedRoles });
    },
  );
});
