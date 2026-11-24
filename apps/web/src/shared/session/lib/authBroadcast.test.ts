import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { linkedBroadcastPorts as linkedPorts } from '@/test/linkedBroadcastPorts';
import { clearCacheOnRemoteLogout, createAuthBroadcast } from './authBroadcast';

describe('authBroadcast', () => {
  it('tells the other tab, which clears its cache and leaves the page', () => {
    const [mine, theirs] = linkedPorts();
    const here = createAuthBroadcast(() => mine);
    const there = createAuthBroadcast(() => theirs);
    const otherCache = new QueryClient();
    otherCache.setQueryData(['session', 'me'], { diver: 'cached' });
    otherCache.setQueryData(['dives', 'log'], { dives: [] });
    const onSignedOut = vi.fn();
    clearCacheOnRemoteLogout(there, otherCache, onSignedOut);

    here.announceLogout();

    expect(otherCache.getQueryCache().getAll()).toHaveLength(0);
    expect(onSignedOut).toHaveBeenCalledOnce();
  });

  it('ignores any other message', () => {
    const [mine, theirs] = linkedPorts();
    const listener = vi.fn();
    createAuthBroadcast(() => theirs).onLogout(listener);

    mine.postMessage({ type: 'login' });
    mine.postMessage('logout');

    expect(listener).not.toHaveBeenCalled();
  });

  it('stops listening once unsubscribed', () => {
    const [mine, theirs] = linkedPorts();
    const listener = vi.fn();
    const stop = createAuthBroadcast(() => theirs).onLogout(listener);

    stop();
    createAuthBroadcast(() => mine).announceLogout();

    expect(listener).not.toHaveBeenCalled();
  });

  it('does nothing without BroadcastChannel', () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    const broadcast = createAuthBroadcast();

    expect(() => broadcast.announceLogout()).not.toThrow();
    expect(broadcast.onLogout(vi.fn())).toBeTypeOf('function');
  });
});
