import type { ReactNode } from 'react';
import type { DiveFormPreview } from '../../../form/derived';
import { DivePreviewCard } from '../DivePreviewCard';
import { SectionNav, type SectionNavItem } from '../SectionNav';
import styles from './FormAside.module.scss';

export interface FormAsideProps {
  preview: DiveFormPreview;
  sections: readonly SectionNavItem[];
  /** Save, cancel and the draft mention (`DiveFormActions`). */
  actions: ReactNode;
}

/**
 * Right column of the form from 1280px, sticky (dive-form.jsx · FormAside): live preview, section
 * summary, actions and the draft mention. Below, the sticky bottom bar of the form replaces it.
 * After the fields in the DOM: tabbing reaches it last.
 */
export function FormAside({ preview, sections, actions }: FormAsideProps) {
  return (
    <div className={styles.aside}>
      <DivePreviewCard preview={preview} />
      <SectionNav items={sections} />
      {actions}
    </div>
  );
}
