import type { ReactNode } from 'react';
import { formatClock } from '@/shared/lib/format';
import { Icon } from '@/shared/ui/Icon';
import type { DiveFormPreview } from '../../../form/derived';
import type { DiveFormSection } from '../../../form/model';
import { DivePreviewCard } from '../DivePreviewCard';
import { SectionNav, type SectionNavItem } from '../SectionNav';
import styles from './FormAside.module.scss';

export interface FormAsideProps {
  preview: DiveFormPreview;
  sections: readonly SectionNavItem[];
  activeSection: DiveFormSection | undefined;
  /** Time of the latest draft written on the device, `null` before the first one. */
  draftSavedAt: Date | null;
  /** Save and cancel (`DiveFormActions`). */
  actions: ReactNode;
}

/**
 * Right column of the form, sticky from 1024px (dive-form.jsx · FormAside): live preview, section
 * summary, actions and the draft mention. After the fields in the DOM: tabbing reaches it last.
 */
export function FormAside({
  preview,
  sections,
  activeSection,
  draftSavedAt,
  actions,
}: FormAsideProps) {
  return (
    <div className={styles.aside}>
      <DivePreviewCard preview={preview} />
      <SectionNav items={sections} activeSection={activeSection} />
      <div className={styles.footer}>
        {actions}
        {draftSavedAt !== null && (
          <p className={styles.draft}>
            <Icon name="cloud" size="sm" />
            Brouillon enregistré sur l’appareil · {formatClock(draftSavedAt)}
          </p>
        )}
      </div>
    </div>
  );
}
