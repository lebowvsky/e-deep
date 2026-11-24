import { useId } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { LANDING_ANCHORS, STEPS } from '../../content';
import { SectionHeading } from '../SectionHeading';
import styles from './StepsSection.module.scss';

/** « Comment ça marche » (welcome.jsx): three cards on desktop, a list with hairlines on phones. */
export function StepsSection() {
  const titleId = useId();
  return (
    <section id={LANDING_ANCHORS.steps} className={styles.section} aria-labelledby={titleId}>
      <SectionHeading
        id={titleId}
        overline="Comment ça marche"
        title="Trois gestes, un carnet toujours à jour"
        centered
      />
      <ol className={styles.steps}>
        {STEPS.map((step) => (
          <li key={step.index} className={styles.step}>
            <div className={styles.top}>
              <span className={styles.index} aria-hidden="true">
                {step.index}
              </span>
              <Icon name={step.icon} size="xl" className={styles.icon} />
            </div>
            <div>
              <h3 className={styles.title}>{step.title}</h3>
              <p className={styles.text}>{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
