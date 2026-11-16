import { KpiCard } from '@/shared/ui/KpiCard';
import { formatExitTime } from '../../../lib/diveTime';
import type { DiveDetailView } from '../../../types';
import styles from './DiveKpis.module.scss';

export interface DiveKpisProps {
  dive: DiveDetailView;
  /** `null` while the log is unknown: no caption rather than a guess. */
  isPersonalBest: boolean | null;
}

const MISSING = '—';

/** The four headline measures of the dive (same KpiCard as the dashboard). */
export function DiveKpis({ dive, isPersonalBest }: DiveKpisProps) {
  const exit = formatExitTime(dive.date, dive.utcOffsetMinutes, dive.durationMin);
  const { temperatureC, visibilityM } = dive;

  return (
    <ul className={styles.kpis} aria-label="Mesures">
      <KpiCard
        label={{ short: 'Prof. max', long: 'Profondeur max' }}
        value={dive.depthMaxM}
        unit="m"
        srText={`${dive.depthMaxM} mètres`}
        tone="accent"
        caption={isPersonalBest ? 'Ton record personnel' : undefined}
      />
      <KpiCard
        label="Durée"
        value={dive.durationMin}
        unit="min"
        srText={`${dive.durationMin} minutes`}
        caption={`Sortie à ${exit}`}
      />
      {temperatureC === null ? (
        <KpiCard
          label="Temp. fond"
          value={MISSING}
          tone="muted"
          srText="Température au fond non renseignée"
          caption="Non renseignée"
        />
      ) : (
        <KpiCard
          label="Temp. fond"
          value={temperatureC}
          unit="°C"
          srText={`${temperatureC} degrés au fond`}
        />
      )}
      {visibilityM === null ? (
        <KpiCard
          label="Visibilité"
          value={MISSING}
          tone="muted"
          srText="Visibilité non renseignée"
          caption="Non renseignée"
        />
      ) : (
        <KpiCard
          label="Visibilité"
          value={visibilityM}
          unit="m"
          srText={`${visibilityM} mètres de visibilité`}
        />
      )}
    </ul>
  );
}
