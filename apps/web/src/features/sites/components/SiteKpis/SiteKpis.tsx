import {
  formatDiveCount,
  formatDiveDayMonthYear,
  formatMeasure,
  formatMonthYear,
  splitMinutes,
} from '@/shared/lib/format';
import type { SiteStats } from '@/shared/model/site';
import { KpiCard } from '@/shared/ui/KpiCard';
import styles from './SiteKpis.module.scss';

export interface SiteKpisProps {
  stats: SiteStats;
}

const MISSING = '—';

/**
 * The four figures of the site (sites.jsx · SiteDetailDesktop): dives here, deepest dive here
 * (the accent of the page), time underwater, bottom temperature. « — » without data. Phones keep
 * the first two (sites.jsx · SiteDetailMobile).
 */
export function SiteKpis({ stats }: SiteKpisProps) {
  const { maxDepth, bottomTemperature, firstDiveDate, averageMinutes } = stats;
  const time = splitMinutes(stats.totalMinutes);

  return (
    <ul className={styles.kpis} aria-label="Tes chiffres sur ce site">
      <KpiCard
        label={{ short: 'Plongées ici', long: 'Tes plongées ici' }}
        value={stats.diveCount}
        srText={formatDiveCount(stats.diveCount)}
        caption={firstDiveDate ? `Depuis ${formatMonthYear(firstDiveDate.slice(0, 7))}` : undefined}
      />
      {maxDepth ? (
        <KpiCard
          label={{ short: 'Prof. max ici', long: 'Ta prof. max ici' }}
          value={formatMeasure(maxDepth.depthM)}
          unit="m"
          tone="accent"
          srText={`${formatMeasure(maxDepth.depthM)} mètres`}
          caption={{
            short: `#${maxDepth.number}`,
            long: `#${maxDepth.number} · ${formatDiveDayMonthYear(maxDepth.date)}`,
          }}
        />
      ) : (
        <KpiCard
          label={{ short: 'Prof. max ici', long: 'Ta prof. max ici' }}
          value={MISSING}
          tone="muted"
          srText="Aucune plongée ici"
        />
      )}
      {averageMinutes === null ? (
        <KpiCard label="Temps cumulé" value={MISSING} tone="muted" srText="Aucune plongée ici" />
      ) : (
        <KpiCard
          label="Temps cumulé"
          value={time.hours}
          unit={`h ${String(time.minutes).padStart(2, '0')} min`}
          srText={`${time.hours} heures ${time.minutes} minutes`}
          caption={`moy. ${averageMinutes} min`}
        />
      )}
      {bottomTemperature ? (
        <KpiCard
          label="Temp. fond moy."
          value={formatMeasure(Math.round(bottomTemperature.averageC))}
          unit="°C"
          srText={`${formatMeasure(bottomTemperature.averageC)} degrés au fond en moyenne`}
          caption={`de ${formatMeasure(bottomTemperature.minC)} à ${formatMeasure(bottomTemperature.maxC)} °C`}
        />
      ) : (
        <KpiCard
          label="Temp. fond moy."
          value={MISSING}
          tone="muted"
          srText="Température au fond non renseignée"
        />
      )}
    </ul>
  );
}
