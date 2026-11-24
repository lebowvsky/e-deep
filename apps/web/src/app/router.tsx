import { RouterProvider } from 'react-router';
import { router } from './services';

/** React Router in data mode (ARCHITECTURE.md D20). Route table: `./routes.tsx`. */
export function AppRouter() {
  return <RouterProvider router={router} />;
}
