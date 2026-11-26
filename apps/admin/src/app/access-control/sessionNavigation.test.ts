import { createMemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { createSessionNavigation } from './sessionNavigation';

function routerAt(path: string) {
  const router = createMemoryRouter([{ path: '*', element: null }], { initialEntries: [path] });
  const navigate = vi.spyOn(router, 'navigate');
  return { router, navigate };
}

describe('createSessionNavigation', () => {
  it('leaves for the login page, back to the page once signed in', () => {
    const { router, navigate } = routerAt('/accounts?tab=1');

    createSessionNavigation(() => router)('unauthenticated');

    expect(navigate).toHaveBeenCalledExactlyOnceWith('/login?next=%2Faccounts%3Ftab%3D1', {
      replace: true,
    });
  });

  it('leaves for the forbidden page on a refused role', () => {
    const { router, navigate } = routerAt('/accounts');

    createSessionNavigation(() => router)('forbidden');

    expect(navigate).toHaveBeenCalledExactlyOnceWith('/forbidden', { replace: true });
  });

  it.each(['/login', '/forbidden'])('stays on %s', (path) => {
    const { router, navigate } = routerAt(path);

    createSessionNavigation(() => router)('unauthenticated');

    expect(navigate).not.toHaveBeenCalled();
  });
});
