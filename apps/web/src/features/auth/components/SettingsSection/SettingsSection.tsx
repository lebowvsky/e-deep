import { useId, type ReactNode } from 'react';
import { Card } from '@/shared/ui/Card';
import styles from './SettingsSection.module.scss';

export interface SettingsSectionProps {
  title: string;
  children: ReactNode;
}

/** One section of `/settings`: a card named by its `h2`. */
export function SettingsSection({ title, children }: SettingsSectionProps) {
  const titleId = useId();
  return (
    <Card as="section" padding="lg" className={styles.section} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.title}>
        {title}
      </h2>
      {children}
    </Card>
  );
}
