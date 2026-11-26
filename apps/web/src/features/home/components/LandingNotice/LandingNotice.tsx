import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { landingNoticeOf, type LandingNotice as Notice } from '@/shared/session/lib/landingNotice';
import { Icon } from '@/shared/ui/Icon';
import styles from './LandingNotice.module.scss';

const MESSAGES = {
  'account-deleted': 'Ton compte et ton carnet ont été supprimés.',
} as const satisfies Record<Notice, string>;

/**
 * What the landing page says on arrival after the session ended on purpose (« Ton compte et ton
 * carnet ont été supprimés. », the route state of the navigation to `/`): above the hero, read as a
 * status, not an alert. Nothing when the arrival carries no notice.
 *
 * Said once: the notice is kept here while the landing page stays, and removed from the history
 * entry, so that a reload or a return to it does not say it again. Mounted on the landing only: a
 * change to `/login` or `/signup` dismisses it.
 */
export function LandingNotice() {
  const location = useLocation();
  const navigate = useNavigate();
  const [notice] = useState(() => landingNoticeOf(location.state));
  const noticeRef = useRef<HTMLDivElement>(null);
  const { pathname, search, hash } = location;
  const hasNoticeState = landingNoticeOf(location.state) !== null;

  // The page left may have been scrolled down to the deletion: the landing starts at its top,
  // header included, and the notice is read first (DOM scroll and focus: the effect's system).
  useEffect(() => {
    if (notice === null) return;
    window.scrollTo({ top: 0 });
    noticeRef.current?.focus({ preventScroll: true });
  }, [notice]);

  // Consumed once (the history entry: the effect's external system).
  useEffect(() => {
    if (!hasNoticeState) return;
    void navigate({ pathname, search, hash }, { replace: true, state: null });
  }, [hasNoticeState, navigate, pathname, search, hash]);

  if (notice === null) return null;

  return (
    <div className={styles.wrapper}>
      <div ref={noticeRef} className={styles.notice} role="status" tabIndex={-1}>
        <Icon name="check" size="md" className={styles.icon} />
        <p className={styles.text}>{MESSAGES[notice]}</p>
      </div>
    </div>
  );
}
