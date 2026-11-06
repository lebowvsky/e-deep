import type { ReactNode } from 'react';
import type { NavItemId } from './navigation';
import { Sidebar } from './Sidebar';

interface AdminLayoutProps {
  currentItem: NavItemId;
  children: ReactNode;
}

const MAIN_ID = 'main-content';

/** Shell of every back-office page: skip link, sidebar navigation and the main content area. */
export function AdminLayout({ currentItem, children }: AdminLayoutProps) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[16rem_minmax(0,1fr)]">
      <a
        href={`#${MAIN_ID}`}
        className="sr-only rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
      >
        Skip to main content
      </a>
      <Sidebar currentItem={currentItem} />
      <main id={MAIN_ID} tabIndex={-1} className="px-4 py-6 outline-none md:px-8 md:py-8">
        {children}
      </main>
    </div>
  );
}
