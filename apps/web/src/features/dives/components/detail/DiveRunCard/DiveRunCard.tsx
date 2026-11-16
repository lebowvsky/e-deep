import type { CSSProperties } from 'react';
import { Badge } from '@/shared/ui/Badge';
import { cx } from '@/shared/lib/classNames';
import { safetyStopCaption, safetyStopFact, stopShare } from '../../../lib/diveFacts';
import { formatExitTime, formatImmersionTime } from '../../../lib/diveTime';
import { decompressionLabel, MISSING_LABELS, repetitiveLabel } from '../../../lib/labels';
import type { DiveDetailView } from '../../../types';
import { Quantity } from '../../Quantity';
import { DetailSection } from '../DetailSection';
import { contentFact, FactList } from '../FactList';
import styles from './DiveRunCard.module.scss';

export interface DiveRunCardProps {
  dive: DiveDetailView;
  className?: string | undefined;
}

/**
 * « Déroulé de la plongée » (V1, manual entry, no profile curve): immersion → duration → exit over
 * a time bar ending with the safety stop, then the stops and the repetitive dive. The bar and its
 * caption are decorative: everything is in the text.
 */
export function DiveRunCard({ dive, className }: DiveRunCardProps) {
  const immersion = formatImmersionTime(dive.date, dive.utcOffsetMinutes);
  const exit = formatExitTime(dive.date, dive.utcOffsetMinutes, dive.durationMin);
  const share = stopShare(dive.safetyStop, dive.durationMin);

  return (
    <DetailSection
      title="Déroulé de la plongée"
      icon="clock"
      aside={<Badge>Saisie manuelle</Badge>}
      className={className}
    >
      <dl className={styles.times}>
        <div className={styles.time}>
          <dt className={styles.term}>Immersion</dt>
          <dd className={styles.value}>
            <Quantity size="run" value={immersion} srText={immersion} />
          </dd>
        </div>
        <div className={cx(styles.time, styles.duration)}>
          <dt className={styles.srOnly}>Durée</dt>
          <dd className={styles.value}>
            <Quantity
              size="run"
              value={dive.durationMin}
              unit="min"
              srText={`${dive.durationMin} minutes`}
            />
          </dd>
        </div>
        <div className={cx(styles.time, styles.exit)}>
          <dt className={styles.term}>Sortie</dt>
          <dd className={styles.value}>
            <Quantity size="run" value={exit} srText={exit} />
          </dd>
        </div>
      </dl>
      <div className={styles.timeline} aria-hidden="true">
        <div className={styles.bar}>
          {share !== null && (
            <span className={styles.stop} style={{ '--stop-share': share } as CSSProperties} />
          )}
        </div>
        {dive.safetyStop && (
          <p className={styles.stopCaption}>{safetyStopCaption(dive.safetyStop)}</p>
        )}
      </div>
      <FactList
        layout="cells"
        className={styles.facts}
        facts={[
          contentFact(
            'Palier de sécurité',
            safetyStopFact(dive.safetyStop),
            MISSING_LABELS.masculine,
            'fact',
          ),
          { term: 'Paliers de déco.', value: decompressionLabel(dive.hadDecompression) },
          {
            term: 'Successive',
            value: dive.isRepetitive === null ? null : repetitiveLabel(dive.isRepetitive),
            missingLabel: MISSING_LABELS.feminine,
          },
        ]}
      />
    </DetailSection>
  );
}
