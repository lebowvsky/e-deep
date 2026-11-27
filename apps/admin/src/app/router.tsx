import { RouterProvider } from 'react-router';
import { router } from './services';

/**
 * React Router in data mode (D42). Route table and access control: `./routes.tsx`,
 * `./access-control/README.md`.
 */
export function AppRouter() {
  return <RouterProvider router={router} />;
}
