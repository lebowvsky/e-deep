import { useId, type ReactNode } from 'react';
import { cx } from '@/shared/lib/classNames';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import type { SectionStatus } from '../../../form/derived';
import { DIVE_FORM_SECTIONS, SECTION_TITLES, type DiveFormSection } from '../../../form/model';
import { sectionId } from '../fieldBinding';
import { SectionStatusIcon, sectionStatusText } from '../SectionStatusIcon';
import styles from './FormSection.module.scss';

/** Folded state of a section (mobile accordion): header button, summary and state. */
export interface FormSectionCollapse {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** « Air · 12 L · 200 bar · 7 mm » (`sectionSummary`). */
  summary: string;
  status: SectionStatus;
}

export interface FormSectionProps {
  section: DiveFormSection;
  /** « facultatif » tag (sections 2 to 6). */
  optional?: boolean;
  /** Right side of the header: « * obligatoire », « 3 plongeurs ». */
  aside?: ReactNode;
  /** Makes the header an accordion button; omitted, the section is always open. */
  collapse?: FormSectionCollapse | undefined;
  children: ReactNode;
  className?: string | undefined;
}

/**
 * A numbered card of the form (dive-form.jsx · Section): a `<fieldset>` whose `<legend>` holds the
 * visible title (h2), anchor of the section summary. With `collapse`, the title is a
 * `<button aria-expanded aria-controls>` that folds the fields away; folded, it shows the summary
 * and the state of the section instead of the « facultatif » tag and the aside.
 */
export function FormSection({
  section,
  optional = false,
  aside,
  collapse,
  children,
  className,
}: FormSectionProps) {
  const contentId = useId();
  const isOpen = collapse?.open ?? true;
  const number = (
    <span className={styles.number} aria-hidden="true">
      {DIVE_FORM_SECTIONS.indexOf(section) + 1}
    </span>
  );
  const title = <span className={styles.titleText}>{SECTION_TITLES[section]}</span>;

  return (
    <fieldset
      id={sectionId(section)}
      className={cx(styles.section, className)}
      data-collapsible={collapse ? '' : undefined}
      data-folded={isOpen ? undefined : ''}
    >
      <legend className={styles.legend}>
        <h2 className={styles.title}>
          {collapse ? (
            <button
              type="button"
              className={styles.toggle}
              aria-expanded={isOpen}
              aria-controls={contentId}
              onClick={() => collapse.onOpenChange(!isOpen)}
            >
              {number}
              <span className={styles.heading}>
                {title}
                {!isOpen && (
                  <span
                    className={styles.summary}
                    data-empty={collapse.status.status === 'empty' ? '' : undefined}
                  >
                    {collapse.summary}
                  </span>
                )}
              </span>
              {!isOpen && (
                <>
                  <span className={styles.srOnly}>, {sectionStatusText(collapse.status)}</span>
                  <SectionStatusIcon status={collapse.status.status} />
                </>
              )}
              <Icon name="chevronDown" size="md" className={styles.chevron} />
            </button>
          ) : (
            <>
              {number}
              {title}
            </>
          )}
        </h2>
        {optional && isOpen && <Badge className={styles.optional}>facultatif</Badge>}
      </legend>
      {aside !== undefined && isOpen && <div className={styles.aside}>{aside}</div>}
      <div id={contentId} className={styles.content} hidden={!isOpen}>
        {children}
      </div>
    </fieldset>
  );
}
