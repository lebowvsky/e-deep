import { Outlet, useLoaderData } from 'react-router';
import { SessionContext } from '../access-control/session';
import type { requireStaffSession } from '../access-control/sessionLoaders';
import { AdminLayout } from './AdminLayout';

type StaffSessionLoader = ReturnType<typeof requireStaffSession>;

/** Element of the protected routes: the session checked by their loader, shared with the pages. */
export function ProtectedLayout() {
  const session = useLoaderData<StaffSessionLoader>();
  return (
    <SessionContext value={session}>
      <AdminLayout>
        <Outlet />
      </AdminLayout>
    </SessionContext>
  );
}
