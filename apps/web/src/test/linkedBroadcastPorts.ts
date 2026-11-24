import type { BroadcastPort } from '@/shared/session/lib/authBroadcast';

/**
 * Two tabs of the same browser: what one posts, the other receives (never the sender itself, like
 * `BroadcastChannel`).
 */
export function linkedBroadcastPorts(): [BroadcastPort, BroadcastPort] {
  const listeners = new Map<BroadcastPort, Set<(event: MessageEvent) => void>>();
  const make = (): BroadcastPort => {
    const port: BroadcastPort = {
      postMessage: (data) => {
        for (const [other, handlers] of listeners) {
          if (other === port) continue;
          for (const handle of handlers) handle(new MessageEvent('message', { data }));
        }
      },
      addEventListener: (_type, listener) => listeners.get(port)?.add(listener),
      removeEventListener: (_type, listener) => listeners.get(port)?.delete(listener),
    };
    listeners.set(port, new Set());
    return port;
  };
  return [make(), make()];
}
