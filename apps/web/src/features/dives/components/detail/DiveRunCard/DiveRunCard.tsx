import { Badge } from '@/shared/ui/Badge';
import { cx } from '@/shared/lib/classNames';
import { formatExitTime, formatImmersionTime } from '../../../lib/diveTime';
import { decompressionLabel, gasMixSpoken, oxygenLabel, stopsLabel } from '../../../lib/labels';
import type { DiveDetailView } from '../../../types';
import { Quantity } from '../../Quantity';
import { DetailSection } from '../DetailSection';
import { FactList } from '../FactList';
import styles from './DiveRunCard.module.scss';

export interface DiveRunCardProps {
  dive: DiveDetailView;
  className?: string | undefined;
}

/**
 * « Déroulé de la plongée » (V1, manual entry, no profile curve): immersion → duration → exit over
 * a time bar, then the gas and the stops. The bar is decorative: everything is in the text.
 */
export function DiveRunCard({ dive, className }: DiveRunCardProps) {
  const immersion = formatImmersionTime(dive.date, dive.utcOffsetMinutes);
  const exit = formatExitTime(dive.date, dive.utcOffsetMinutes, dive.durationMin);

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
      <div className={styles.bar} aria-hidden="true" />
      <FactList
        layout="cells"
        className={styles.facts}
        facts={[
          {
            term: 'Gaz',
            value: gasMixSpoken(dive.gasMix),
            note: oxygenLabel(dive.equipment.o2Percent),
          },
          { term: 'Paliers', value: stopsLabel(dive.stopsOk) },
          { term: 'Paliers de déco.', value: decompressionLabel(dive.hadDecompression) },
        ]}
      />
    </DetailSection>
  );
}
