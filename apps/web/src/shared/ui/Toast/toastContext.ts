import { createContext, use } from 'react';

export interface ToastContextValue {
  /** Shows a short message, announced politely by screen readers. */
  notify: (message: string) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

/** Gives access to the toasts of the app (inside `ToastProvider`). */
export function useToast(): ToastContextValue {
  const context = use(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
