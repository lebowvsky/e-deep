import { useCallback, useId, useState } from 'react';
import { Outlet } from 'react-router';
import { breakpoint } from '@/design/tokens';
import type { User } from '@/features/dashboard/types';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { Drawer } from '../Drawer';
import { Fab } from '../Fab';
import { Sidebar } from '../Sidebar';
import { TopBar } from '../TopBar';
import styles from './AppShell.module.scss';

export interface AppShellProps {
  user: User;
}

const TABLET_UP = `(min-width: ${breakpoint.tablet}px)`;

/**
 * Application frame. ≥ 768px: sticky sidebar. Below: top bar + drawer + FAB. The swap is the only
 * JS-driven responsive switch (apps/web/CLAUDE.md); everything else is SCSS.
 */
export function AppShell({ user }: AppShellProps) {
  const isTabletUp = useMediaQuery(TABLET_UP);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerId = useId();
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">
        Aller au contenu
      </a>
      {isTabletUp ? (
        <Sidebar user={user} />
      ) : (
        <>
          <TopBar
            drawerId={drawerId}
            drawerOpen={drawerOpen}
            onOpenMenu={() => setDrawerOpen(true)}
          />
          <Drawer id={drawerId} open={drawerOpen} onClose={closeDrawer} user={user} />
        </>
      )}
      <main id="main-content" className={styles.main} tabIndex={-1}>
        <Outlet />
      </main>
      {!isTabletUp && <Fab />}
    </div>
  );
}
