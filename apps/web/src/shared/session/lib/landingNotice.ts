import { isRecord } from '@/shared/lib/guards';

/** What the landing page says on arrival after the session ended on purpose. */
export type LandingNotice = 'account-deleted';

/** Route state given with the navigation to `/` (`navigate('/', { state })`). */
export interface LandingState {
  notice: LandingNotice;
}

export const ACCOUNT_DELETED_STATE: LandingState = { notice: 'account-deleted' };

/** The notice of a route state, `null` when there is none (any other state, a plain visit). */
export function landingNoticeOf(state: unknown): LandingNotice | null {
  return isRecord(state) && state.notice === 'account-deleted' ? state.notice : null;
}
