import { formatMeasure } from '@/shared/lib/format';
import { KpiCard } from '@/shared/ui/KpiCard';
import { surfaceCaption } from '../../../lib/diveFacts';
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
  const surface = surfaceCaption(dive.surfaceTemperatureC);

  return (
    <ul className={styles.kpis} aria-label="Mesures">
      <KpiCard
        label={{ short: 'Prof. max', long: 'Profondeur max' }}
        value={formatMeasure(dive.depthMaxM)}
        unit="m"
        srText={`${formatMeasure(dive.depthMaxM)} mètres`}
        // Accent stays rare (apps/web/CLAUDE.md): only the deepest dive of the log.
        tone={isPersonalBest ? 'accent' : 'default'}
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
          value={formatMeasure(temperatureC)}
          unit="°C"
          srText={`${formatMeasure(temperatureC)} degrés au fond`}
          caption={surface ?? undefined}
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
          value={formatMeasure(visibilityM)}
          unit="m"
          srText={`${formatMeasure(visibilityM)} mètres de visibilité`}
        />
      )}
    </ul>
  );
}
