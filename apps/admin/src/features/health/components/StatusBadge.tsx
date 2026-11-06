import { CircleAlert, CircleCheck, CircleX, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/shared/lib/utils';

export type StatusTone = 'success' | 'warning' | 'danger';

const TONE_STYLES = {
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  danger: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
} as const satisfies Record<StatusTone, string>;

const TONE_ICONS = {
  success: CircleCheck,
  warning: CircleAlert,
  danger: CircleX,
} as const satisfies Record<StatusTone, LucideIcon>;

interface StatusBadgeProps {
  tone: StatusTone;
  /** Visible text: the status is never conveyed by color or icon alone. */
  children: string;
}

/** shadcn Badge with a status tone; the generated component stays untouched. */
export function StatusBadge({ tone, children }: StatusBadgeProps) {
  const Icon = TONE_ICONS[tone];
  return (
    <Badge variant="outline" className={cn('border-transparent', TONE_STYLES[tone])}>
      <Icon aria-hidden="true" />
      {children}
    </Badge>
  );
}
