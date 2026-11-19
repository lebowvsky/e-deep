import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Outlet, useLocation, useMatch, useMatches } from 'react-router';
import { breakpoint } from '@/design/tokens';
import type { User } from '@/features/dashboard/types';
import { cx } from '@/shared/lib/classNames';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { Drawer } from '../Drawer';
import { Fab } from '../Fab';
import { hasHandleFlag } from '../routeHandle';
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
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const previousPath = useRef(pathname);
  // No FAB on a dive detail (detail-plongee.md) nor on the dive form, which the FAB opens: every
  // page under `/dives/…` (`:diveId`, `new`, `:diveId/edit`), but not the log itself.
  const onDivePage = useMatch({ path: '/dives/:diveId', end: false }) !== null;
  const matches = useMatches();
  // The dive form has its own ✕ top bar and sticky save bar on phones.
  const ownMobileBars = hasHandleFlag(matches, 'ownMobileBars');
  const hideFab = hasHandleFlag(matches, 'hideFab');
  const fullBleed = hasHandleFlag(matches, 'fullBleed');

  // Client-side navigation: move focus to the new content so screen readers announce it.
  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    mainRef.current?.focus();
  }, [pathname]);

  // While the modal drawer is open, the page behind it is out of reach (keyboard and screen readers).
  const behindDrawer = drawerOpen && !isTabletUp;

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">
        Aller au contenu
      </a>
      {isTabletUp ? (
        <Sidebar user={user} />
      ) : (
        !ownMobileBars && (
          <>
            <TopBar
              inert={behindDrawer}
              drawerId={drawerId}
              drawerOpen={drawerOpen}
              onOpenMenu={() => setDrawerOpen(true)}
            />
            <Drawer id={drawerId} open={drawerOpen} onClose={closeDrawer} user={user} />
          </>
        )
      )}
      <main
        ref={mainRef}
        id="main-content"
        className={cx(styles.main, ownMobileBars && styles.ownBars, fullBleed && styles.fullBleed)}
        tabIndex={-1}
        inert={behindDrawer}
      >
        <Outlet />
      </main>
      {!isTabletUp && !onDivePage && !hideFab && <Fab inert={behindDrawer} />}
    </div>
  );
}
