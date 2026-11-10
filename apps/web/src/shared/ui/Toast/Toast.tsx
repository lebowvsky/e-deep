import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { motion } from '@/design/tokens';
import styles from './Toast.module.scss';
import { ToastContext } from './toastContext';

interface Message {
  id: number;
  text: string;
}

/** One toast at a time, bottom of the screen, for `motion.dur.toast` ms. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<Message | null>(null);

  const notify = useCallback((text: string) => {
    setMessage((current) => ({ id: (current?.id ?? 0) + 1, text }));
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), motion.dur.toast);
    return () => window.clearTimeout(timer);
  }, [message]);

  return (
    <ToastContext value={{ notify }}>
      {children}
      {/* The live region stays in the DOM so that screen readers announce each message. */}
      <div className={styles.region} role="status" aria-live="polite">
        {message && (
          <p key={message.id} className={styles.toast}>
            {message.text}
          </p>
        )}
      </div>
    </ToastContext>
  );
}
