import { createBrowserRouter, RouterProvider } from 'react-router';
import { routes } from './routes';

const router = createBrowserRouter(routes);

/** React Router in data mode (ARCHITECTURE.md D20). Route table: `./routes.tsx`. */
export function AppRouter() {
  return <RouterProvider router={router} />;
}
