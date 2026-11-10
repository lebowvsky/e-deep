import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { cx } from '@/shared/lib/classNames';
import styles from './Popover.module.scss';

export interface PopoverTriggerProps {
  ref: RefObject<HTMLButtonElement | null>;
  'aria-expanded': boolean;
  'aria-controls': string;
  onClick: () => void;
}

export interface PopoverProps {
  /** Renders the button that opens the panel; spread the given props on it. */
  renderTrigger: (props: PopoverTriggerProps) => ReactNode;
  /** Accessible name of the panel. */
  label: string;
  /** Panel content, rendered while open. */
  children: ReactNode;
  /** Side the panel is aligned with. Default `start`. */
  align?: 'start' | 'end';
  className?: string | undefined;
}

/**
 * Non-modal panel under a button (disclosure): opens on click, closes on Esc, on a click outside
 * or with `close`; Esc gives the focus back to the trigger.
 */
export function Popover({
  renderTrigger,
  label,
  children,
  align = 'start',
  className,
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [open, close]);

  return (
    <div ref={rootRef} className={cx(styles.root, className)}>
      {renderTrigger({
        ref: triggerRef,
        'aria-expanded': open,
        'aria-controls': panelId,
        onClick: () => setOpen((current) => !current),
      })}
      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-label={label}
        tabIndex={-1}
        hidden={!open}
        className={cx(styles.panel, align === 'end' && styles.end)}
      >
        {open && children}
      </div>
    </div>
  );
}
