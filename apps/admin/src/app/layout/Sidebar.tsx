import { NavLink } from 'react-router';
import { cn } from '@/shared/lib/utils';
import { useSession } from '../access-control/session';
import { LogoutButton } from './LogoutButton';
import { navItemsFor, type NavItem } from './navigation';

interface SidebarProps {
  /** Every entry of the app (`NAV_ITEMS`); only those the session roles grant are shown. */
  items: readonly NavItem[];
}

const ROLE_LABELS = { support: 'Support', admin: 'Administrateur' } as const;

/**
 * App navigation: a top bar on small screens, a fixed-width column from `md` up. Items are
 * filtered by role (UX only): hiding an item never replaces the API authorization.
 */
export function Sidebar({ items }: SidebarProps) {
  const session = useSession();
  const visibleItems = navItemsFor(session, items);

  return (
    <aside className="border-b bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:h-dvh md:border-r md:border-b-0">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 md:h-full md:flex-col md:items-stretch md:gap-6 md:py-6">
        <p className="text-base font-semibold">
          E-Deep <span className="font-normal text-muted-foreground">Admin</span>
        </p>
        <nav aria-label="Main">
          <ul className="flex gap-1 md:flex-col">
            {visibleItems.map(({ id, label, to, icon: Icon }) => (
              <li key={id}>
                <NavLink
                  to={to}
                  end
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-sidebar-ring md:min-h-9',
                      isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
                    )
                  }
                >
                  <Icon aria-hidden="true" className="size-4" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div lang="fr" className="flex flex-col gap-2 md:mt-auto">
          <p className="text-sm">
            <span className="block truncate font-medium">{session.email}</span>
            <span className="text-muted-foreground">{ROLE_LABELS[session.role]}</span>
          </p>
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}
