import { useEffect, useRef } from 'react';
import { useBlocker, type Blocker } from 'react-router';

export interface LeaveConfirmation {
  /** `blocked`: ask, then `proceed()` (leave) or `reset()` (stay). */
  blocker: Blocker;
  /**
   * Lets the next navigation through, e.g. the redirect after a successful save: the blocker reads
   * `hasUnsavedChanges` as of the last render, which a navigation in the same tick would not see.
   */
  release: () => void;
}

/**
 * Asks before leaving a page with unsaved changes: in-app navigations (links, back button) through
 * `useBlocker` — data router only — and closing or reloading the tab through `beforeunload`.
 */
export function useLeaveConfirmation(hasUnsavedChanges: boolean): LeaveConfirmation {
  const isReleased = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedChanges &&
      !isReleased.current &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
  );

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedChanges]);

  return {
    blocker,
    release: () => {
      isReleased.current = true;
    },
  };
}
