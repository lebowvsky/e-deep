import { useEffect, useState } from 'react';

const TICK_MS = 1000;

const secondsLeft = (until: number) => Math.max(0, Math.ceil((until - Date.now()) / 1000));

/**
 * Seconds left until `until` (epoch ms), updated every second, `0` once reached or without a
 * deadline (`null`). The clock is the system the effect follows; it stops at zero.
 */
export function useCountdown(until: number | null): number {
  const [left, setLeft] = useState(() => (until === null ? 0 : secondsLeft(until)));
  const [deadline, setDeadline] = useState(until);

  // A new deadline: start again from it (state adjusted during render, no effect needed).
  if (deadline !== until) {
    setDeadline(until);
    setLeft(until === null ? 0 : secondsLeft(until));
  }

  useEffect(() => {
    if (until === null) return;
    const timer = window.setInterval(() => {
      const next = secondsLeft(until);
      setLeft(next);
      if (next === 0) window.clearInterval(timer);
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [until]);

  return left;
}
