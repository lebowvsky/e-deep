import { Component, type ReactNode } from 'react';

export interface ErrorFallbackProps {
  error: unknown;
  /** Clears the error and renders `children` again. */
  reset: () => void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: (props: ErrorFallbackProps) => ReactNode;
  /** Called before re-rendering `children`, e.g. to invalidate the data that failed. */
  onReset?: () => void;
}

type ErrorBoundaryState = { status: 'ok' } | { status: 'failed'; error: unknown };

/**
 * Class component on purpose: React has no hook equivalent of getDerivedStateFromError.
 * Caught errors are already reported by React (`onCaughtError`, console in development).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { status: 'ok' };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { status: 'failed', error };
  }

  private readonly reset = () => {
    this.props.onReset?.();
    this.setState({ status: 'ok' });
  };

  override render(): ReactNode {
    if (this.state.status === 'failed') {
      return this.props.fallback({ error: this.state.error, reset: this.reset });
    }
    return this.props.children;
  }
}
