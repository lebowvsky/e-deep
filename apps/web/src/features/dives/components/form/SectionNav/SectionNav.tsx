import { useScrollSpy } from '@/shared/hooks/useScrollSpy';
import { cx } from '@/shared/lib/classNames';
import { Card } from '@/shared/ui/Card';
import type { SectionStatus } from '../../../form/derived';
import { DIVE_FORM_SECTIONS, SECTION_TITLES, type DiveFormSection } from '../../../form/model';
import { sectionId } from '../fieldBinding';
import { SectionStatusIcon, sectionStatusText } from '../SectionStatusIcon';
import styles from './SectionNav.module.scss';

export interface SectionNavItem {
  section: DiveFormSection;
  status: SectionStatus;
}

export interface SectionNavProps {
  items: readonly SectionNavItem[];
}

const SECTION_IDS = DIVE_FORM_SECTIONS.map(sectionId);

/**
 * Anchors to the six sections with their state: ✓ complete, ◐ partial (« − Pression fin »),
 * ○ empty (dive-form.jsx · FormAside · navigation des sections). The section being read is
 * highlighted (scroll-spy): watched here, so that scrolling re-renders the summary only.
 */
export function SectionNav({ items }: SectionNavProps) {
  const activeId = useScrollSpy(SECTION_IDS);
  const activeSection = DIVE_FORM_SECTIONS.find((section) => sectionId(section) === activeId);
  return (
    <Card padding="none" className={styles.card}>
      <nav aria-label="Sections du formulaire">
        <ul className={styles.list}>
          {items.map(({ section, status }) => {
            const isActive = section === activeSection;
            return (
              <li key={section}>
                <a
                  href={`#${sectionId(section)}`}
                  className={cx(styles.link, isActive && styles.active)}
                  aria-current={isActive ? 'true' : undefined}
                >
                  <SectionStatusIcon status={status.status} />
                  <span className={styles.title}>{SECTION_TITLES[section]}</span>
                  <span className={styles.srOnly}>, {sectionStatusText(status)}</span>
                  {status.status === 'partial' && (
                    <span className={styles.missing} aria-hidden="true">
                      − {status.missing}
                    </span>
                  )}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </Card>
  );
}
