import { AdminLayout } from './layout/AdminLayout';
import { DashboardPage } from './routes/DashboardPage';

/**
 * Single route for now: no router library until a second page exists.
 * When it does, pick one (TanStack Router or React Router) and move the routes here.
 *
 * Access control: not implemented yet. The role guard will wrap the routes declared here,
 * see `./access-control/README.md`. Until then every page is reachable by anyone who can load
 * the app; only the API decides what data is returned.
 */
export function AppRouter() {
  return (
    <AdminLayout currentItem="dashboard">
      <DashboardPage />
    </AdminLayout>
  );
}
