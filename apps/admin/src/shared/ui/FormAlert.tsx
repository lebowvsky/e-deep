import type { ComponentProps } from 'react';
import { CircleAlert } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

/**
 * Refusal of a form, above its fields: announced as it appears (`role="alert"`). Give it a new
 * `key` per submission so that the same message, met again, is announced again.
 */
export function FormAlert({ className, children, ...rest }: ComponentProps<'div'>) {
  return (
    <div
      role="alert"
      className={cn(
        'flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive',
        className,
      )}
      {...rest}
    >
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}
