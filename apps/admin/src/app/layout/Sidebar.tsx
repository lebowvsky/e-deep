import { cn } from '@/shared/lib/utils';
import { NAV_ITEMS, type NavItemId } from './navigation';

interface SidebarProps {
  currentItem: NavItemId;
}

/**
 * App navigation: a top bar on small screens, a fixed-width column from `md` up.
 * Access control: nav items will be filtered by role here (UX only), see
 * `../access-control/README.md`. Hiding an item never replaces the API authorization.
 */
export function Sidebar({ currentItem }: SidebarProps) {
  return (
    <aside className="border-b bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:h-dvh md:border-r md:border-b-0">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 md:flex-col md:items-stretch md:gap-6 md:py-6">
        <p className="text-base font-semibold">
          E-Deep <span className="font-normal text-muted-foreground">Admin</span>
        </p>
        <nav aria-label="Main">
          <ul className="flex gap-1 md:flex-col">
            {NAV_ITEMS.map(({ id, label, href, icon: Icon }) => {
              const isCurrent = id === currentItem;
              return (
                <li key={id}>
                  <a
                    href={href}
                    aria-current={isCurrent ? 'page' : undefined}
                    className={cn(
                      'flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-sidebar-ring md:min-h-9',
                      isCurrent && 'bg-sidebar-accent text-sidebar-accent-foreground',
                    )}
                  >
                    <Icon aria-hidden="true" className="size-4" />
                    {label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
